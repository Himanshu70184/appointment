const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

// @route   GET /api/doctor-portal/dashboard
// @desc    Get doctor dashboard statistics and upcoming appointments
// @access  Private (Doctor)
router.get('/dashboard', [auth, authorize('doctor')], async (req, res) => {
  try {
    // Find doctor profile
    const doctorProfile = await Doctor.findOne({ user_id: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    // Get all appointments for this doctor
    const allAppointments = await Appointment.find({ doctor_id: req.user._id });

    // Calculate statistics
    const stats = {
      total: allAppointments.length,
      scheduled: allAppointments.filter(a => a.status === 'scheduled').length,
      pending: allAppointments.filter(a => a.status === 'pending').length,
      onHold: allAppointments.filter(a => a.status === 'on-hold').length,
      cancelled: allAppointments.filter(a => a.status === 'cancelled').length,
      completed: allAppointments.filter(a => a.status === 'completed').length
    };

    // Get upcoming appointments (next 7 days, scheduled status)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingAppointments = await Appointment.find({
      doctor_id: req.user._id,
      status: 'scheduled',
      scheduledDate: {
        $gte: today,
        $lte: nextWeek
      }
    })
      .populate('patient_id', 'name email phone')
      .populate('appointmentType', 'name price duration cardValidityMonths')
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .limit(10);

    res.json({
      stats,
      upcomingAppointments,
      doctorProfile
    });
  } catch (error) {
    console.error('Doctor dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctor-portal/appointments
// @desc    Get all appointments for doctor with filters
// @access  Private (Doctor)
router.get('/appointments', [auth, authorize('doctor')], async (req, res) => {
  try {
    const { status, state, date, search } = req.query;

    // Find doctor profile
    const doctorProfile = await Doctor.findOne({ user_id: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    // Build query
    const query = { doctor_id: req.user._id };

    if (status) {
      query.status = status;
    }

    if (state) {
      query.state = state;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.scheduledDate = { $gte: startDate, $lte: endDate };
    }

    let appointments = await Appointment.find(query)
      .populate('patient_id', 'name email phone dateOfBirth')
      .populate('appointmentType', 'name price duration cardValidityMonths')
      .sort({ scheduledDate: -1, scheduledTime: -1 });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      appointments = appointments.filter(apt =>
        apt.patient_id.name.toLowerCase().includes(searchLower) ||
        apt.patient_id.email.toLowerCase().includes(searchLower)
      );
    }

    res.json({ appointments });
  } catch (error) {
    console.error('Get doctor appointments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctor-portal/appointments/:id
// @desc    Get single appointment details
// @access  Private (Doctor)
router.get('/appointments/:id', [auth, authorize('doctor')], async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id', 'name email phone dateOfBirth state')
      .populate('appointmentType', 'name price description duration cardValidityMonths')
      .populate('doctor_id', 'name email')
      .populate('documentRequests.requestedBy', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/appointments/:id/pdmp
// @desc    Verify PDMP for appointment
// @access  Private (Doctor)
router.put('/appointments/:id/pdmp', [auth, authorize('doctor')], async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    appointment.pdmpVerified = true;
    appointment.pdmpVerifiedAt = new Date();
    appointment.pdmpVerifiedBy = req.user._id;
    await appointment.save();

    res.json({
      message: 'PDMP verified successfully',
      appointment
    });
  } catch (error) {
    console.error('PDMP verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/appointments/:id/certify
// @desc    File certification for appointment
// @access  Private (Doctor)
router.put('/appointments/:id/certify', [auth, authorize('doctor')], async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if PDMP is verified
    if (!appointment.pdmpVerified) {
      return res.status(400).json({ message: 'PDMP must be verified before filing certification' });
    }

    appointment.certificationFiled = true;
    appointment.certificationFiledAt = new Date();
    appointment.certificationFiledBy = req.user._id;
    appointment.status = 'completed';
    await appointment.save();

    // Create notification for patient
    await Notification.create({
      user_id: appointment.patient_id,
      title: 'Certification Filed',
      message: `Your medical card certification has been filed by Dr. ${req.user.name}`,
      type: 'certification'
    });

    // Create notification for admin
    const adminUsers = await User.find({ role_id: 1 });
    for (const admin of adminUsers) {
      await Notification.create({
        user_id: admin._id,
        title: 'Certification Filed',
        message: `Dr. ${req.user.name} has filed certification for patient appointment`,
        type: 'certification'
      });
    }

    res.json({
      message: 'Certification filed successfully',
      appointment
    });
  } catch (error) {
    console.error('Certification filing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/appointments/:id/clinical-notes
// @desc    Add/update clinical notes
// @access  Private (Doctor)
router.put('/appointments/:id/clinical-notes', [
  auth,
  authorize('doctor'),
  body('clinicalNotes').notEmpty().withMessage('Clinical notes are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    appointment.clinicalNotes = req.body.clinicalNotes;
    await appointment.save();

    res.json({
      message: 'Clinical notes saved successfully',
      appointment
    });
  } catch (error) {
    console.error('Clinical notes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/doctor-portal/appointments/:id/request-documents
// @desc    Request additional documents from patient
// @access  Private (Doctor)
router.post('/appointments/:id/request-documents', [
  auth,
  authorize('doctor'),
  body('message').notEmpty().withMessage('Request message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id', 'name email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add document request
    appointment.documentRequests.push({
      requestedBy: req.user._id,
      message: req.body.message,
      status: 'pending'
    });
    await appointment.save();

    // Create notification for admin
    const adminUsers = await User.find({ role_id: 1 });
    for (const admin of adminUsers) {
      await Notification.create({
        user_id: admin._id,
        title: 'Document Request',
        message: `Dr. ${req.user.name} has requested additional documents for patient ${appointment.patient_id.name}`,
        type: 'document_request',
        relatedAppointment: appointment._id
      });
    }

    res.json({
      message: 'Document request sent to admin successfully',
      appointment
    });
  } catch (error) {
    console.error('Document request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/appointments/:id/status
// @desc    Update appointment status
// @access  Private (Doctor)
router.put('/appointments/:id/status', [
  auth,
  authorize('doctor'),
  body('status').isIn(['scheduled', 'on-hold', 'completed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify this appointment belongs to the logged-in doctor
    if (appointment.doctor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldStatus = appointment.status;
    appointment.status = req.body.status;
    await appointment.save();

    // Create notification for patient
    await Notification.create({
      user_id: appointment.patient_id,
      title: 'Appointment Status Updated',
      message: `Your appointment status has been changed from ${oldStatus} to ${req.body.status}`,
      type: 'status_change'
    });

    res.json({
      message: 'Appointment status updated successfully',
      appointment
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctor-portal/profile
// @desc    Get doctor profile
// @access  Private (Doctor)
router.get('/profile', [auth, authorize('doctor')], async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const doctorProfile = await Doctor.findOne({ user_id: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({
      user,
      doctorProfile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/profile
// @desc    Update doctor profile
// @access  Private (Doctor)
router.put('/profile', [
  auth,
  authorize('doctor'),
  body('name').optional().trim(),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user._id);

    if (req.body.name) user.name = req.body.name;
    if (req.body.phone) user.phone = req.body.phone;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctor-portal/change-password
// @desc    Change password
// @access  Private (Doctor)
router.put('/change-password', [
  auth,
  authorize('doctor'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user._id);

    // Let User model pre-save hook handle password hashing
    user.password = req.body.newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
