const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const AppointmentType = require('../models/AppointmentType');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const { processPayment } = require('../utils/payment');
const { sendAppointmentNotification, sendTemplateEmail } = require('../utils/email');

const router = express.Router();

const findCheapestAvailableDoctor = async ({ state, date, time, slotDuration }) => {
  const requestedDate = new Date(date);
  const requestedDay = requestedDate.getDay();

  const availabilities = await DoctorAvailability.find({
    states: state,
    isActive: true,
    startDate: { $lte: requestedDate },
    endDate: { $gte: requestedDate }
  }).populate('doctor_id', 'name email');

  if (!availabilities.length) return null;

  const doctorUserIds = availabilities
    .map(a => a.doctor_id && a.doctor_id._id)
    .filter(Boolean);

  const doctors = await Doctor.find({
    user_id: { $in: doctorUserIds },
    isActive: true
  }).select('user_id consultationFee');

  const doctorMap = new Map(
    doctors.map(d => [d.user_id.toString(), d])
  );

  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const bookedAppointments = await Appointment.find({
    scheduledDate: {
      $gte: startOfDay,
      $lt: endOfDay
    },
    status: { $in: ['scheduled', 'approval', 'pending', 'completed'] }
  });

  const [slotHour, slotMin] = time.split(':').map(Number);
  const slotStartMinutes = slotHour * 60 + slotMin;
  const slotEndMinutes = slotStartMinutes + slotDuration;

  const candidates = [];

  availabilities.forEach((availability) => {
    if (!availability.doctor_id) return;

    const doctorDoc = doctorMap.get(availability.doctor_id._id.toString());
    if (!doctorDoc) return;

    const daySchedule = availability.weeklySchedule.find(
      schedule => schedule.dayOfWeek === requestedDay
    );

    if (!daySchedule || !daySchedule.isActive) return;

    const [startHour, startMin] = daySchedule.startTime.split(':').map(Number);
    const [endHour, endMin] = daySchedule.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (slotStartMinutes < startMinutes || slotEndMinutes > endMinutes) return;

    let breakStartMinutes = null;
    let breakEndMinutes = null;
    if (daySchedule.breakStartTime && daySchedule.breakEndTime) {
      const [breakStartHour, breakStartMin] = daySchedule.breakStartTime.split(':').map(Number);
      const [breakEndHour, breakEndMin] = daySchedule.breakEndTime.split(':').map(Number);
      breakStartMinutes = breakStartHour * 60 + breakStartMin;
      breakEndMinutes = breakEndHour * 60 + breakEndMin;
    }

    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      if (slotStartMinutes < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
        return;
      }
    }

    // Check if date is a holiday
    if (availability.holidays && availability.holidays.length > 0) {
      const dateStr = requestedDate.toISOString().split('T')[0];
      const holiday = availability.holidays.find(h => {
        const holidayDate = new Date(h.date).toISOString().split('T')[0];
        return holidayDate === dateStr;
      });

      if (holiday) {
        if (holiday.type === 'full-day') {
          return; // Skip this doctor - full day holiday
        } else if (holiday.type === 'half-day') {
          // Check if slot falls within half-day holiday period
          if (holiday.startTime && holiday.endTime) {
            const [holidayStartHour, holidayStartMin] = holiday.startTime.split(':').map(Number);
            const [holidayEndHour, holidayEndMin] = holiday.endTime.split(':').map(Number);
            const holidayStartMinutes = holidayStartHour * 60 + holidayStartMin;
            const holidayEndMinutes = holidayEndHour * 60 + holidayEndMin;
            
            if (slotStartMinutes < holidayEndMinutes && slotEndMinutes > holidayStartMinutes) {
              return; // Skip this doctor - slot overlaps with half-day holiday
            }
          }
        }
      }
    }

    const isBooked = bookedAppointments.some(apt => 
      apt.doctor_id && 
      apt.doctor_id.toString() === availability.doctor_id._id.toString() && 
      apt.scheduledTime === time
    );

    if (!isBooked) {
      candidates.push({
        doctorId: availability.doctor_id._id,
        consultationFee: doctorDoc.consultationFee || 0
      });
    }
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.consultationFee - b.consultationFee);
  return candidates[0].doctorId;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// @route   POST /api/appointments/admin-book
// @desc    Admin/Staff book appointment for patient (No payment, pending approval)
// @access  Private (Admin, Staff)
router.post('/admin-book', [
  auth,
  authorize('admin', 'staff'),
  body('patient_id').notEmpty().withMessage('Patient is required'),
  body('doctor_id').notEmpty().withMessage('Doctor is required'),
  body('state_id').notEmpty().withMessage('State is required'),
  body('appointmentType_id').notEmpty().withMessage('Appointment type is required'),
  body('appointmentDate').notEmpty().withMessage('Appointment date is required'),
  body('appointmentTime').notEmpty().withMessage('Appointment time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      patient_id,
      doctor_id,
      state_id,
      appointmentType_id,
      appointmentDate,
      appointmentTime,
      notes
    } = req.body;

    // Verify patient exists
    const patient = await User.findById(patient_id);
    if (!patient || patient.role_id !== 3) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Verify appointment type exists
    const appointmentType = await AppointmentType.findById(appointmentType_id);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    // Create appointment with pending status (requires approval)
    const appointment = new Appointment({
      patient_id,
      doctor_id,
      state_id,
      appointmentType: appointmentType_id,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      status: 'pending',
      notes: notes || '',
      bookedBy: req.user._id, // Track who created this booking
      requiresApproval: true
    });

    await appointment.save();

    // Create notification for patient
    await Notification.create({
      user_id: patient_id,
      type: 'appointment',
      title: 'Appointment Scheduled',
      message: `An appointment has been scheduled for you on ${appointmentDate} at ${appointmentTime}. Pending approval.`,
      related_id: appointment._id
    });

    // Create notification for admin
    await Notification.create({
      user_id: req.user._id,
      type: 'appointment',
      title: 'Appointment Created',
      message: `Appointment created for ${patient.firstName} ${patient.lastName}. Pending approval.`,
      related_id: appointment._id
    });

    res.status(201).json({
      message: 'Appointment created successfully. Pending approval.',
      appointment
    });
  } catch (error) {
    console.error('Admin book appointment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointments/admin-book-patient
// @desc    Admin/Staff book appointment with patient registration (No payment)
// @access  Private (Admin, Staff)
router.post('/admin-book-patient', [
  auth,
  authorize('admin', 'staff'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\d{10}$/).withMessage('Valid 10-digit phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('state').notEmpty().withMessage('State is required'),
  body('cardType').notEmpty().withMessage('Appointment type is required'),
  body('scheduledDate').isISO8601().withMessage('Scheduled date is required'),
  body('scheduledTime').notEmpty().withMessage('Scheduled time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      password,
      state,
      cardType,
      scheduledDate,
      scheduledTime,
      isMinor,
      guardianName,
      guardianPhone,
      guardianAddress
    } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
    }

    // Validate guardian info for minors
    if (isMinor) {
      if (!guardianName || !guardianPhone || !guardianAddress) {
        return res.status(400).json({
          message: 'Guardian information (name, phone, address) is required for patients under 18',
          isMinor: true
        });
      }
    }

    // Get appointment type details
    const appointmentType = await AppointmentType.findById(cardType);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    const slotDuration = appointmentType.duration || 30;
    const assignedDoctorId = await findCheapestAvailableDoctor({
      state,
      date: scheduledDate,
      time: scheduledTime,
      slotDuration
    });

    if (!assignedDoctorId) {
      return res.status(409).json({
        message: 'No doctors are available for this time slot. Please choose another time.',
        slotConflict: true
      });
    }

    // Check slot availability
    const existingAppointment = await Appointment.findOne({
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      doctor_id: assignedDoctorId,
      status: { $in: ['scheduled', 'approval', 'pending'] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: 'This slot has been booked by someone else. Please choose another slot.',
        slotConflict: true
      });
    }

    // Create user account if new
    if (isNewUser) {
      user = new User({
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        dateOfBirth,
        password,
        state,
        role_id: 3, // Patient
        isMinor,
        guardianName: isMinor ? guardianName : undefined,
        guardianPhone: isMinor ? guardianPhone : undefined,
        guardianAddress: isMinor ? guardianAddress : undefined,
        status: 'active', // Active immediately for admin-created accounts
        emailVerified: true // Admin-created patients are pre-verified
      });

      await user.save();
      console.log('New patient created:', { id: user._id, name: user.name, email: user.email });
    } else {
      console.log('Using existing patient:', { id: user._id, name: user.name, email: user.email });
    }

    // Create appointment (no payment required for admin/staff booking)
    const appointment = new Appointment({
      patient_id: user._id,
      doctor_id: assignedDoctorId,
      appointmentType: cardType,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      state,
      status: 'pending', // All admin/staff bookings need approval before scheduling
      isMinor,
      paymentCompleted: true, // Mark as completed (no payment required)
      intakeSubmitted: false,
      bookedBy: req.user._id // Track who created this booking
    });

    await appointment.save();
    console.log('Appointment created:', {
      appointmentId: appointment._id,
      patientId: user._id,
      patientName: user.name,
      bookedByAdminId: req.user._id,
      bookedByAdminName: req.user.name
    });

    // Create notification for patient
    await Notification.create({
      user_id: user._id,
      type: 'appointment',
      title: 'Appointment Pending Approval',
      message: `Your appointment for ${new Date(scheduledDate).toLocaleDateString()} at ${scheduledTime} is pending admin approval.`,
      related_id: appointment._id
    });

    // Create notification for admin/staff who created it
    await Notification.create({
      user_id: req.user._id,
      type: 'appointment',
      title: 'Appointment Created',
      message: `Appointment created for ${user.firstName} ${user.lastName}.`,
      related_id: appointment._id
    });

    // Send email notification to patient
    try {
      await sendTemplateEmail(
        user.email,
        'appointment-confirmation',
        {
          patientName: user.firstName,
          appointmentDate: new Date(scheduledDate).toLocaleDateString(),
          appointmentTime: scheduledTime,
          appointmentType: appointmentType.name,
          appointmentId: appointment._id
        }
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      success: true,
      message: `${isNewUser ? 'Patient registered and appointment created' : 'Appointment created'} successfully`,
      appointment: {
        _id: appointment._id,
        patient_id: user._id,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        status: appointment.status
      },
      patient: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isNewUser
      }
    });

  } catch (error) {
    console.error('Admin book patient appointment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointments
// @desc    Create new appointment with payment
// @access  Private (Patient)
router.post('/', [
  auth,
  authorize('patient'),
  body('appointmentType_id').notEmpty().withMessage('Appointment type is required'),
  body('payment').notEmpty().withMessage('Payment information is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentType_id, payment: paymentData, couponCode } = req.body;

    // Get appointment type details
    const appointmentType = await AppointmentType.findById(appointmentType_id);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    // Calculate amount (apply coupon if provided)
    let amount = appointmentType.price;
    if (couponCode) {
      const Coupon = require('../models/Coupon');
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon && new Date(coupon.validUntil) > new Date() && coupon.usedCount < (coupon.usageLimit || Infinity)) {
        if (coupon.discountType === 'percentage') {
          amount = amount * (1 - coupon.discountValue / 100);
        } else {
          amount = Math.max(0, amount - coupon.discountValue);
        }
      }
    }

    // Create appointment
    const appointment = new Appointment({
      patient_id: req.user._id,
      appointmentType: appointmentType_id,
      status: 'pending'
    });

    await appointment.save();

    // Process payment
    const paymentResult = await processPayment(
      { ...paymentData, amount },
      req.user._id,
      appointment._id
    );

    if (!paymentResult.success) {
      await Appointment.findByIdAndDelete(appointment._id);
      return res.status(400).json({ message: 'Payment failed', error: paymentResult.error });
    }

    // Update appointment with payment ID
    appointment.payment_id = paymentResult.payment._id;
    await appointment.save();

    // Create notification
    await Notification.create({
      user_id: req.user._id,
      type: 'appointment',
      title: 'Appointment Created',
      message: 'Your appointment has been created. Please complete the intake form.',
      related_id: appointment._id
    });

    res.status(201).json({
      message: 'Appointment created successfully',
      appointment,
      payment: paymentResult.payment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointments/:id/intake
// @desc    Submit intake form and upload documents
// @access  Private (Patient)
router.post('/:id/intake', [
  auth,
  authorize('patient'),
  upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'medicalRecords', maxCount: 5 },
    { name: 'guardianId', maxCount: 1 }
  ])
], async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      patient_id: req.user._id
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const { intakeForm } = req.body;
    const parsedIntakeForm = typeof intakeForm === 'string' ? JSON.parse(intakeForm) : intakeForm;

    appointment.intakeForm = parsedIntakeForm;

    // Handle file uploads
    const documents = [];
    if (req.files.idDocument) {
      documents.push({
        type: 'id',
        filename: req.files.idDocument[0].originalname,
        path: req.files.idDocument[0].path
      });
    }
    if (req.files.medicalRecords) {
      req.files.medicalRecords.forEach(file => {
        documents.push({
          type: 'medical_records',
          filename: file.originalname,
          path: file.path
        });
      });
    }
    if (req.files.guardianId) {
      documents.push({
        type: 'guardian_id',
        filename: req.files.guardianId[0].originalname,
        path: req.files.guardianId[0].path
      });
    }

    appointment.documents = documents;

    // Check age and set status
    if (parsedIntakeForm.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(parsedIntakeForm.dateOfBirth).getFullYear();
      if (age < 21) {
        appointment.status = 'need_admin_approval';
        appointment.ageVerified = false;
      } else {
        appointment.status = 'scheduled';
      }
    } else {
      appointment.status = 'scheduled';
    }

    await appointment.save();

    // Assign doctor
    await assignDoctor(appointment);

    // Update user profile with DOB and guardian info if provided
    if (parsedIntakeForm.dateOfBirth) {
      await User.findByIdAndUpdate(req.user._id, {
        dateOfBirth: parsedIntakeForm.dateOfBirth,
        guardianName: parsedIntakeForm.guardianName,
        guardianEmail: parsedIntakeForm.guardianEmail,
        guardianPhone: parsedIntakeForm.guardianPhone
      });
    }

    // Create notification
    await Notification.create({
      user_id: req.user._id,
      type: 'appointment',
      title: 'Intake Form Submitted',
      message: 'Your intake form has been submitted. Appointment scheduling in progress.',
      related_id: appointment._id
    });

    // Send email notification
    const user = await User.findById(req.user._id);
    await sendAppointmentNotification(user, appointment, appointment.status);

    res.json({
      message: 'Intake form submitted successfully',
      appointment
    });
  } catch (error) {
    console.error('Intake form error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to assign doctor
const assignDoctor = async (appointment) => {
  try {
    const patient = await User.findById(appointment.patient_id);
    const appointmentType = await AppointmentType.findById(appointment.appointmentType);

    // Find available doctors in the patient's state
    const doctors = await Doctor.find({
      states: patient.state,
      isActive: true
    }).populate('user_id');

    if (doctors.length === 0) {
      return null;
    }

    // Sort by price (lowest first)
    const doctorsWithPricing = doctors.map(doctor => ({
      doctor,
      price: doctor.pricing?.get(patient.state) || 0
    })).sort((a, b) => a.price - b.price);

    // Find earliest available slot
    let assignedDoctor = null;
    let earliestDate = null;

    for (const { doctor } of doctorsWithPricing) {
      const availableSlot = findEarliestAvailableSlot(doctor, appointment.scheduledDate);
      if (availableSlot && (!earliestDate || availableSlot < earliestDate)) {
        earliestDate = availableSlot;
        assignedDoctor = doctor;
      }
    }

    if (assignedDoctor) {
      appointment.doctor_id = assignedDoctor.user_id._id;
      appointment.scheduledDate = earliestDate;
      appointment.status = appointment.status === 'need_admin_approval' ? 'need_admin_approval' : 'scheduled';
      await appointment.save();
    }

    return assignedDoctor;
  } catch (error) {
    console.error('Doctor assignment error:', error);
    return null;
  }
};

// Helper function to find earliest available slot
const findEarliestAvailableSlot = (doctor, preferredDate = null) => {
  const now = new Date();
  const startDate = preferredDate ? new Date(preferredDate) : new Date();
  startDate.setHours(0, 0, 0, 0);

  // Look for available slots in the next 30 days
  for (let day = 0; day < 30; day++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + day);
    const dayOfWeek = checkDate.getDay();

    // Check if date is blocked
    const isBlocked = doctor.blockedDates.some(blockedDate => {
      const blocked = new Date(blockedDate);
      return blocked.toDateString() === checkDate.toDateString();
    });

    if (isBlocked) continue;

    // Find availability for this day
    const dayAvailability = doctor.availability.find(avail => avail.dayOfWeek === dayOfWeek);
    if (!dayAvailability) continue;

    // Check for available time slots (every 30 minutes)
    const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
    const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const slotTime = new Date(checkDate);
      slotTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

      if (slotTime > now) {
        return slotTime;
      }
    }
  }

  return null;
};

// @route   GET /api/appointments
// @desc    Get appointments (filtered by role)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};

    if (req.user.role_id === 3) {
      // Patient - only their appointments
      query.patient_id = req.user._id;
    } else if (req.user.role_id === 2) {
      // Doctor - only their appointments
      query.doctor_id = req.user._id;
    }
    // Admin and Staff can see all

    const appointments = await Appointment.find(query)
      .populate('patient_id', 'name email phone prn')
      .populate('doctor_id', 'name email')
      .populate('appointmentType', 'name price duration cardValidityMonths')
      .sort({ createdAt: -1 });

    res.json({ appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get single appointment
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    let query = { _id: req.params.id };

    if (req.user.role_id === 3) {
      query.patient_id = req.user._id;
    } else if (req.user.role_id === 2) {
      query.doctor_id = req.user._id;
    }

    const appointment = await Appointment.findOne(query)
      .populate('patient_id', 'name email phone prn dateOfBirth guardianName guardianEmail guardianPhone')
      .populate('doctor_id', 'name email')
      .populate('appointmentType', 'name description price duration cardValidityMonths')
      .populate('payment_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status (Admin/Staff)
// @access  Private (Admin/Staff)
router.put('/:id/status', [
  auth,
  authorize('admin', 'staff'),
  body('status').isIn(['pending', 'scheduled', 'need_admin_approval', 'completed', 'canceled', 'rescheduled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = req.body.status;
    await appointment.save();

    // Create notification
    await Notification.create({
      user_id: appointment.patient_id._id,
      type: 'appointment',
      title: 'Appointment Status Updated',
      message: `Your appointment status has been updated to ${req.body.status}`,
      related_id: appointment._id
    });

    // Send email notification
    await sendAppointmentNotification(appointment.patient_id, appointment, req.body.status);

    res.json({
      message: 'Appointment status updated',
      appointment
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointments/:id/send-email
// @desc    Send templated email to patient
// @access  Private (Admin, Staff)
router.post('/:id/send-email', [
  auth,
  authorize(1, 4),
  body('template').notEmpty().withMessage('Email template is required')
], async (req, res) => {
  try {
    const { template, customMessage } = req.body;
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id doctor_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const emailData = {
      appointmentId: appointment._id,
      scheduledDate: appointment.scheduledDate 
        ? new Date(appointment.scheduledDate).toLocaleString() 
        : 'Not scheduled',
      doctorName: appointment.doctor_id?.name || 'Not assigned',
      state: appointment.state,
      documentRequest: customMessage || 'Additional documents required'
    };

    await sendTemplateEmail(appointment.patient_id, template, emailData);

    // Create notification
    await Notification.create({
      user_id: appointment.patient_id._id,
      type: 'email',
      title: 'Email Sent',
      message: `Email sent regarding your appointment`,
      related_id: appointment._id
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointments/:id/approve-guardian
// @desc    Approve guardian details for minor patient
// @access  Private (Admin, Staff)
router.post('/:id/approve-guardian', auth, authorize(1, 4), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (!appointment.isMinor) {
      return res.status(400).json({ message: 'This appointment is not for a minor' });
    }

    appointment.guardianApproved = true;
    appointment.guardianApprovedBy = req.user._id;
    appointment.guardianApprovedAt = new Date();
    appointment.status = 'scheduled';
    await appointment.save();

    // Create notification
    await Notification.create({
      user_id: appointment.patient_id._id,
      type: 'appointment',
      title: 'Appointment Approved',
      message: 'Your appointment has been approved and scheduled',
      related_id: appointment._id
    });

    res.json({ message: 'Guardian approved and appointment scheduled', appointment });
  } catch (error) {
    console.error('Approve guardian error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/appointments/:id/reschedule
// @desc    Change appointment date and time
// @access  Private (Admin, Staff, Patient)
router.put('/:id/reschedule', [
  auth,
  body('scheduledDate').notEmpty().withMessage('Scheduled date is required'),
  body('scheduledTime').notEmpty().withMessage('Scheduled time is required')
], async (req, res) => {
  try {
    const { scheduledDate, scheduledTime, doctor_id } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check authorization
    if (req.user.role_id === 3 && appointment.patient_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    appointment.scheduledDate = scheduledDate;
    appointment.scheduledTime = scheduledTime;
    if (doctor_id) appointment.doctor_id = doctor_id;
    appointment.status = 'rescheduled';
    await appointment.save();

    // Create notification
    await Notification.create({
      user_id: appointment.patient_id._id,
      type: 'appointment',
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled to ${new Date(scheduledDate).toLocaleString()}`,
      related_id: appointment._id
    });

    res.json({ message: 'Appointment rescheduled', appointment });
  } catch (error) {
    console.error('Reschedule error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/appointments/:id/complete
// @desc    Mark appointment as completed
// @access  Private (Admin, Doctor)
router.put('/:id/complete', auth, authorize(1, 2), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = 'completed';
    await appointment.save();

    // Create notification
    await Notification.create({
      user_id: appointment.patient_id._id,
      type: 'appointment',
      title: 'Appointment Completed',
      message: 'Your appointment has been marked as completed',
      related_id: appointment._id
    });

    res.json({ message: 'Appointment completed', appointment });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/appointments/:id/notes
// @desc    Update admin notes for appointment
// @access  Private (Admin, Staff)
router.put('/:id/notes', auth, authorize(1, 4), [
  body('adminNotes').notEmpty().withMessage('Notes are required')
], async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.adminNotes = adminNotes;
    await appointment.save();

    res.json({ message: 'Notes updated', appointment });
  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
