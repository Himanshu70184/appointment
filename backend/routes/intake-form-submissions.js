const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { auth } = require('../middleware/auth');
const IntakeFormSubmission = require('../models/IntakeFormSubmission');
const IntakeFormTemplate = require('../models/IntakeFormTemplate');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { createLogger, asyncHandler } = require('../utils/logger');
const { NotFoundError } = require('../utils/errorResponse');
const { generateIntakeFormPDF } = require('../utils/pdfGenerator');

const router = express.Router();
const logger = createLogger('IntakeFormSubmissions');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/intake-forms');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype?.startsWith('image/') && allowedTypes.test(file.mimetype);

    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const handleUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    return next();
  });
};

const compressUploadedImages = async (files) => {
  if (!files || files.length === 0) return;

  const tasks = files.map(async (file) => {
    if (!file.mimetype?.startsWith('image/')) return;

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const tempPath = `${file.path}.tmp`;

    try {
      const image = sharp(file.path).rotate();

      if (ext === 'png') {
        await image.png({ compressionLevel: 8 }).toFile(tempPath);
      } else if (ext === 'webp') {
        await image.webp({ quality: 80 }).toFile(tempPath);
      } else {
        await image.jpeg({ quality: 80, mozjpeg: true }).toFile(tempPath);
      }

      await fs.rename(tempPath, file.path);
    } catch (error) {
      logger.warn('Image compression failed', { file: file.originalname, error: error.message });
    }
  });

  await Promise.all(tasks);
};

// @route   POST /api/intake-form-submissions
// @desc    Submit intake form (patient)
// @access  Private (Patient)
router.post('/', [auth, handleUpload], asyncHandler(async (req, res) => {
  const { appointment_id, template_id, formData, saveAsDraft } = req.body;

  if (!appointment_id || !template_id) {
    return res.status(400).json({ message: 'appointment_id and template_id are required' });
  }

  if (!formData) {
    return res.status(400).json({ message: 'formData is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(appointment_id)) {
    return res.status(400).json({ message: 'Invalid appointment_id' });
  }

  if (!mongoose.Types.ObjectId.isValid(template_id)) {
    return res.status(400).json({ message: 'Invalid template_id' });
  }

  // Verify appointment exists
  const appointment = await Appointment.findById(appointment_id);
  if (!appointment) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  const isPatient = req.user.role_id === 3;
  const isAdminOrStaff = req.user.role_id === 1 || req.user.role_id === 4;

  if (!isPatient && !isAdminOrStaff) {
    return res.status(403).json({ message: 'Not authorized to submit this form' });
  }

  if (isPatient && appointment.patient_id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to submit this form' });
  }

  // Get template
  const template = await IntakeFormTemplate.findById(template_id);
  if (!template) {
    return res.status(404).json({ message: 'Form template not found' });
  }

  // Parse form data
  let parsedFormData;
  try {
    parsedFormData = typeof formData === 'string' ? JSON.parse(formData) : formData;
  } catch (error) {
    return res.status(400).json({ message: 'Invalid formData JSON' });
  }

  if (!Array.isArray(parsedFormData)) {
    return res.status(400).json({ message: 'formData must be an array of fields' });
  }

  // Normalize fields to satisfy schema requirements
  parsedFormData = parsedFormData
    .map((field) => ({
      fieldId: field.fieldId || field.id || '',
      fieldType: field.fieldType || 'text',
      label: field.label || field.fieldId || field.id || 'Field',
      value: field.value ?? null,
      fileUrls: field.fileUrls
    }))
    .filter((field) => field.fieldId);

  // Process file uploads
  const uploadedFiles = {};
  if (req.files && req.files.length > 0) {
    await compressUploadedImages(req.files);
    req.files.forEach(file => {
      const fieldName = file.fieldname;
      if (!uploadedFiles[fieldName]) {
        uploadedFiles[fieldName] = [];
      }
      uploadedFiles[fieldName].push(`/uploads/intake-forms/${file.filename}`);
    });
  }

  // Merge file URLs into form data
  parsedFormData.forEach(field => {
    if (uploadedFiles[field.fieldId]) {
      field.fileUrls = uploadedFiles[field.fieldId];
    }
  });

  // Check if submission already exists
  let submission = await IntakeFormSubmission.findOne({ appointment_id });
  const patientUser = isPatient
    ? req.user
    : await User.findById(appointment.patient_id).select('-password');

  if (!patientUser) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  if (submission) {
    // Update existing submission
    submission.formData = parsedFormData;
    submission.status = saveAsDraft === 'true' ? 'draft' : 'submitted';
    submission.submittedAt = saveAsDraft === 'true' ? submission.submittedAt : new Date();
    submission.ipAddress = req.ip;
    submission.userAgent = req.get('user-agent');
  } else {
    // Create new submission
    submission = new IntakeFormSubmission({
      appointment_id,
      patient_id: patientUser._id,
      template_id,
      templateVersion: template.version,
      formData: parsedFormData,
      status: saveAsDraft === 'true' ? 'draft' : 'submitted',
      submittedAt: saveAsDraft === 'true' ? null : new Date(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  try {
    await submission.save();
  } catch (error) {
    logger.error('Failed to save intake submission', { error: error.message });
    return res.status(400).json({ message: error.message || 'Failed to save intake form submission' });
  }

  // Generate PDF if submitted (not draft)
  if (saveAsDraft !== 'true') {
    try {
      const pdfPath = await generateIntakeFormPDF(submission, template, appointment, patientUser);
      submission.pdfUrl = pdfPath;
      submission.pdfGeneratedAt = new Date();
      await submission.save();

      // Update appointment
      appointment.intakeSubmitted = true;
      appointment.intakeSubmittedAt = new Date();
      appointment.intakeForm = submission._id;
      if (appointment.status !== 'completed' && appointment.status !== 'cancelled' && appointment.status !== 'canceled') {
        appointment.status = appointment.isMinor ? 'approval' : 'scheduled';
      }
      await appointment.save();
    } catch (error) {
      logger.error('PDF generation failed', { error: error.message });
      // Continue even if PDF generation fails
    }
  }

  logger.info('Intake form submission saved', { 
    submissionId: submission._id, 
    status: submission.status 
  });

  res.status(201).json({
    message: saveAsDraft === 'true' 
      ? 'Form saved as draft' 
      : 'Intake form submitted successfully',
    submission
  });
}));

// @route   GET /api/intake-form-submissions/appointment/:appointmentId
// @desc    Get intake form submission by appointment ID
// @access  Private
router.get('/appointment/:appointmentId', [auth], asyncHandler(async (req, res) => {
  const submission = await IntakeFormSubmission.findOne({ 
    appointment_id: req.params.appointmentId 
  })
    .populate('template_id')
    .populate('patient_id', 'name email phone')
    .populate('reviewedBy', 'name email');

  if (!submission) {
    return res.status(404).json({ message: 'No intake form submission found' });
  }

  // Check authorization
  const userRole = req.user.role_id;
  const isPatient = submission.patient_id._id.toString() === req.user._id.toString();
  const isAuthorized = isPatient || userRole === 1 || userRole === 4 || userRole === 2; // patient, admin, staff, or doctor

  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  res.json({ submission });
}));

// @route   GET /api/intake-form-submissions/:id/pdf
// @desc    Get PDF of intake form submission
// @access  Private
router.get('/:id/pdf', [auth], asyncHandler(async (req, res) => {
  const submission = await IntakeFormSubmission.findById(req.params.id)
    .populate('patient_id');

  if (!submission) {
    throw new NotFoundError('Intake form submission');
  }

  // Check authorization
  const userRole = req.user.role_id;
  const isPatient = submission.patient_id._id.toString() === req.user._id.toString();
  const isAuthorized = isPatient || userRole === 1 || userRole === 4 || userRole === 2; // patient, admin, staff, or doctor

  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (!submission.pdfUrl) {
    return res.status(404).json({ message: 'PDF not generated yet' });
  }

  const pdfPath = path.join(__dirname, '..', submission.pdfUrl);
  res.sendFile(pdfPath);
}));

// @route   PUT /api/intake-form-submissions/:id/review
// @desc    Review intake form submission (Admin/Staff)
// @access  Private (Admin/Staff)
router.put('/:id/review', [auth], asyncHandler(async (req, res) => {
  const { status, reviewNotes } = req.body;

  const submission = await IntakeFormSubmission.findById(req.params.id);
  if (!submission) {
    throw new NotFoundError('Intake form submission');
  }

  submission.status = status;
  submission.reviewNotes = reviewNotes;
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();

  await submission.save();

  logger.info('Intake form reviewed', { 
    submissionId: submission._id, 
    status, 
    reviewerId: req.user._id 
  });

  res.json({
    message: 'Intake form reviewed successfully',
    submission
  });
}));

// @route   GET /api/intake-form-submissions
// @desc    Get all intake form submissions (Admin/Staff)
// @access  Private (Admin/Staff)
router.get('/', [auth], asyncHandler(async (req, res) => {
  const { status, patientId, startDate, endDate } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (patientId) filters.patient_id = patientId;
  if (startDate || endDate) {
    filters.submittedAt = {};
    if (startDate) filters.submittedAt.$gte = new Date(startDate);
    if (endDate) filters.submittedAt.$lte = new Date(endDate);
  }

  const submissions = await IntakeFormSubmission.find(filters)
    .populate('patient_id', 'name email phone')
    .populate('template_id', 'name')
    .populate('appointment_id')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({ submissions });
}));

module.exports = router;
