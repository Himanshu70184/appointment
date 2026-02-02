const express = require('express');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const AppointmentType = require('../models/AppointmentType');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const State = require('../models/State');
const { auth, authorize } = require('../middleware/auth');
const { processPayment } = require('../utils/payment');
const { sendTemplateEmail, sendWelcomeEmail } = require('../utils/email');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const getCheapestAvailableDoctor = async ({ state, date, time, slotDuration }) => {
  const requestedDate = new Date(date);
  const requestedDay = requestedDate.getDay();

  const availabilities = await DoctorAvailability.find({
    states: state,
    isActive: true,
    startDate: { $lte: requestedDate },
    endDate: { $gte: requestedDate }
  }).populate('doctor_id', 'name email');

  if (!availabilities.length) {
    return null;
  }

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

// @route   GET /api/patient-portal/available-slots
// @desc    Get available time slots for booking (dynamically generated based on appointment type duration)
// @access  Public
router.get('/available-slots', async (req, res) => {
  try {
    const { state, date, cardType } = req.query;

    if (!state || !date || !cardType) {
      return res.status(400).json({ 
        message: 'State, date, and card type are required' 
      });
    }

    // Get appointment type to determine slot duration
    const appointmentType = await AppointmentType.findById(cardType);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    const slotDuration = appointmentType.duration || 30; // Default to 30 minutes

    // Find doctors available in the selected state using DoctorAvailability collection
    const requestedDate = new Date(date);
    const requestedDay = requestedDate.getDay();

    // Get all active doctor availabilities that cover the requested date
    const availabilities = await DoctorAvailability.find({
      states: state,
      isActive: true,
      startDate: { $lte: requestedDate },
      endDate: { $gte: requestedDate }
    }).populate('doctor_id', 'name email');

    const doctorUserIds = availabilities
      .map(a => a.doctor_id && a.doctor_id._id)
      .filter(Boolean);

    const activeDoctors = await Doctor.find({
      user_id: { $in: doctorUserIds },
      isActive: true
    }).select('user_id');

    const activeDoctorSet = new Set(activeDoctors.map(d => d.user_id.toString()));

    // Get all booked appointments for the selected date (across ALL states)
    // Because a doctor can only be in one appointment at a time, regardless of state
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      scheduledDate: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['scheduled', 'approval', 'pending', 'completed'] } // All non-cancelled appointments hold the slot
      // Note: Removed state filter - doctor can't be in two places at once!
    });

    console.log('Available slots request:', {
      date: requestedDate.toISOString(),
      state,
      totalBookedAppointments: bookedAppointments.length,
      bookedSlots: bookedAppointments.map(a => ({
        time: a.scheduledTime,
        doctor: a.doctor_id,
        status: a.status,
        bookedBy: a.bookedBy
      }))
    });

    // Build available slots dynamically
    const availableSlotMap = new Map();

    availabilities.forEach(availability => {
      if (!availability.doctor_id) return;
      if (!activeDoctorSet.has(availability.doctor_id._id.toString())) return;

      // Get the schedule for the requested day of week
      const daySchedule = availability.weeklySchedule.find(
        schedule => schedule.dayOfWeek === requestedDay
      );

      if (!daySchedule || !daySchedule.isActive) return;

      // Parse working hours
      const [startHour, startMin] = daySchedule.startTime.split(':').map(Number);
      const [endHour, endMin] = daySchedule.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Parse break times (if any)
      let breakStartMinutes = null;
      let breakEndMinutes = null;
      if (daySchedule.breakStartTime && daySchedule.breakEndTime) {
        const [breakStartHour, breakStartMin] = daySchedule.breakStartTime.split(':').map(Number);
        const [breakEndHour, breakEndMin] = daySchedule.breakEndTime.split(':').map(Number);
        breakStartMinutes = breakStartHour * 60 + breakStartMin;
        breakEndMinutes = breakEndHour * 60 + breakEndMin;
      }

      // Check if date is a holiday for this doctor
      let isHolidayDay = false;
      let halfDayHolidayStartMinutes = null;
      let halfDayHolidayEndMinutes = null;
      
      if (availability.holidays && availability.holidays.length > 0) {
        const dateStr = requestedDate.toISOString().split('T')[0];
        const holiday = availability.holidays.find(h => {
          const holidayDate = new Date(h.date).toISOString().split('T')[0];
          return holidayDate === dateStr;
        });

        if (holiday) {
          if (holiday.type === 'full-day') {
            // Skip this doctor entirely - full day holiday
            return;
          } else if (holiday.type === 'half-day') {
            // Mark half-day period to skip those slots
            if (holiday.startTime && holiday.endTime) {
              const [holidayStartHour, holidayStartMin] = holiday.startTime.split(':').map(Number);
              const [holidayEndHour, holidayEndMin] = holiday.endTime.split(':').map(Number);
              halfDayHolidayStartMinutes = holidayStartHour * 60 + holidayStartMin;
              halfDayHolidayEndMinutes = holidayEndHour * 60 + holidayEndMin;
            }
          }
        }
      }

      // Generate time slots based on appointment type duration
      for (let minutes = startMinutes; minutes + slotDuration <= endMinutes; minutes += slotDuration) {
        // Skip slots during break time
        if (breakStartMinutes !== null && breakEndMinutes !== null) {
          // Check if slot overlaps with break
          const slotEnd = minutes + slotDuration;
          if (minutes < breakEndMinutes && slotEnd > breakStartMinutes) {
            continue; // Skip this slot as it overlaps with break
          }
        }

        // Skip slots during half-day holiday
        if (halfDayHolidayStartMinutes !== null && halfDayHolidayEndMinutes !== null) {
          const slotEnd = minutes + slotDuration;
          if (minutes < halfDayHolidayEndMinutes && slotEnd > halfDayHolidayStartMinutes) {
            continue; // Skip this slot as it overlaps with half-day holiday
          }
        }

        const slotTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        
        // Check if slot is already booked
        const isBooked = bookedAppointments.some(apt => 
          apt.doctor_id && 
          apt.doctor_id.toString() === availability.doctor_id._id.toString() && 
          apt.scheduledTime === slotTime
        );

        if (!isBooked) {
          if (!availableSlotMap.has(slotTime)) {
            availableSlotMap.set(slotTime, {
              time: slotTime,
              date: date
            });
          }
        } else {
          console.log(`Slot ${slotTime} is booked, filtering out`);
        }
      }
    });

    const availableSlots = Array.from(availableSlotMap.values()).sort((a, b) =>
      a.time.localeCompare(b.time)
    );

    res.json({
      success: true,
      slots: availableSlots,
      slotDuration: slotDuration,
      totalSlots: availableSlots.length
    });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ 
      message: 'Failed to fetch available slots', 
      error: error.message 
    });
  }
});

// @route   POST /api/patient-portal/book-appointment
// @desc    Book appointment with registration, payment, and slot selection
// @access  Public
router.post('/book-appointment', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\d{10}$/).withMessage('Valid 10-digit phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('state').notEmpty().withMessage('State is required'),
  body('cardType').notEmpty().withMessage('Card type is required'),
  body('scheduledDate').isISO8601().withMessage('Scheduled date is required'),
  body('scheduledTime').notEmpty().withMessage('Scheduled time is required'),
  body('payment').isObject().withMessage('Payment information is required')
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
      payment: paymentData,
      couponCode,
      guardianName,
      guardianPhone,
      guardianAddress
    } = req.body;

    // Check if user already exists (guest checkout allowed)
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;
    
    if (!user) {
      isNewUser = true;
    }

    // Check if patient is a minor (under 18)
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const isMinor = age < 18 || (age === 18 && monthDiff < 0);

    // Validate guardian information for minors
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

    // Calculate amount with coupon discount
    let amount = appointmentType.price;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(), 
        isActive: true 
      });

      if (coupon && new Date(coupon.validUntil) > new Date()) {
        if (coupon.usedCount < (coupon.usageLimit || Infinity)) {
          if (coupon.discountType === 'percentage') {
            amount = amount * (1 - coupon.discountValue / 100);
          } else {
            amount = Math.max(0, amount - coupon.discountValue);
          }
          appliedCoupon = coupon;
        } else {
          return res.status(400).json({ message: 'Coupon usage limit exceeded' });
        }
      } else {
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
    }

    const slotDuration = appointmentType.duration || 30;
    const assignedDoctorId = await getCheapestAvailableDoctor({
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

    // Check slot availability one more time before creating appointment
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

    // Create user account if new (guest checkout)
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
        status: 'new'
      });

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      await user.save();

      const frontendUrl = req.get('origin') || process.env.FRONTEND_URL;

      // Send verification email (do not block booking flow if email fails)
      try {
        await sendWelcomeEmail(user, verificationToken, frontendUrl);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
    } else if (user && !user.emailVerified) {
      const frontendUrl = req.get('origin') || process.env.FRONTEND_URL;

      // Re-send verification email for existing unverified users
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save();

      try {
        await sendWelcomeEmail(user, verificationToken, frontendUrl);
      } catch (emailError) {
        console.error('Failed to re-send verification email:', emailError);
      }
    }

    // Create appointment
    // Status: 'pending' initially, will be updated after payment
    const appointment = new Appointment({
      patient_id: user._id,
      doctor_id: assignedDoctorId,
      appointmentType: cardType, // Now ObjectId reference
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      state,
      status: 'pending', // Will change to 'scheduled' or 'approval' after payment
      isMinor,
      paymentCompleted: false,
      intakeSubmitted: false,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined
    });

    await appointment.save();

    // Process payment
    let payment;
    try {
      const paymentResult = await processPayment(
        user._id,
        appointment._id,
        amount,
        paymentData
      );

      payment = paymentResult.payment;
      
      // Update appointment with payment info
      appointment.payment_id = payment._id;
      appointment.paymentCompleted = true;
      
      // Set status based on minor flag
      // Regular patients: scheduled immediately
      // Minors: requires admin approval
      if (isMinor) {
        appointment.status = 'approval'; // Requires admin approval
      } else {
        appointment.status = 'scheduled'; // Booked immediately
      }
      
      await appointment.save();

      // Update coupon usage if applicable
      if (appliedCoupon) {
        appliedCoupon.usedCount += 1;
        await appliedCoupon.save();
      }

    } catch (paymentError) {
      // Payment failed - delete the appointment and user (only if newly created)
      await Appointment.findByIdAndDelete(appointment._id);
      if (isNewUser) {
        await User.findByIdAndDelete(user._id);
      }

      return res.status(402).json({
        message: 'Payment processing failed. Please try again.',
        error: paymentError.message,
        paymentFailed: true
      });
    }

    // Send confirmation email
    try {
      await sendTemplateEmail(
        user.email,
        'appointment-confirmation',
        {
          patientName: user.name,
          appointmentDate: new Date(scheduledDate).toLocaleDateString(),
          appointmentTime: scheduledTime,
          appointmentId: appointment._id
        }
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({
      success: true,
      message: isMinor 
        ? 'Appointment payment successful! Your appointment requires admin approval. Please complete your intake form.'
        : 'Appointment booked successfully! Please complete your intake form.',
      appointment: {
        _id: appointment._id,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        status: appointment.status,
        isMinor: appointment.isMinor
      },
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        isMinor: user.isMinor
      },
      token,
      isNewUser,
      redirectToIntake: true
    });

  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ 
      message: 'Failed to book appointment', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/check-intake-eligibility/:appointmentId
// @desc    Check if intake form can still be submitted
// @access  Private (Patient)
router.get('/check-intake-eligibility/:appointmentId', auth, authorize('patient'), async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify patient owns this appointment
    if (appointment.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this appointment' });
    }

    // Check if already submitted
    if (appointment.intakeSubmitted) {
      return res.json({
        eligible: false,
        reason: 'Intake form already submitted',
        alreadySubmitted: true
      });
    }

    // Calculate time remaining
    const appointmentDateTime = new Date(appointment.scheduledDate);
    const [hours, minutes] = appointment.scheduledTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const thirtyMinutesBeforeAppointment = new Date(appointmentDateTime.getTime() - 30 * 60 * 1000);
    const now = new Date();
    
    const timeRemaining = thirtyMinutesBeforeAppointment - now;
    const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

    if (now > thirtyMinutesBeforeAppointment) {
      return res.json({
        eligible: false,
        reason: 'Deadline passed - intake must be submitted 30 minutes before appointment',
        deadlinePassed: true
      });
    }

    res.json({
      eligible: true,
      minutesRemaining: minutesRemaining,
      deadline: thirtyMinutesBeforeAppointment,
      appointmentTime: appointmentDateTime
    });

  } catch (error) {
    console.error('Error checking intake eligibility:', error);
    res.status(500).json({ 
      message: 'Failed to check intake eligibility', 
      error: error.message 
    });
  }
});

// @route   POST /api/patient-portal/submit-intake
// @desc    Submit intake form for appointment
// @access  Private (Patient)
router.post('/submit-intake/:appointmentId', [
  auth,
  authorize('patient'),
  body('intakeForm').isObject().withMessage('Intake form data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentId } = req.params;
    const { intakeForm } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify patient owns this appointment
    if (appointment.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this appointment' });
    }

    // Check if payment is completed
    if (!appointment.paymentCompleted) {
      return res.status(400).json({ 
        message: 'Payment must be completed before submitting intake form',
        paymentRequired: true
      });
    }

    // Check if intake is being submitted on time (30 minutes before appointment)
    const appointmentDateTime = new Date(appointment.scheduledDate);
    const [hours, minutes] = appointment.scheduledTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const thirtyMinutesBeforeAppointment = new Date(appointmentDateTime.getTime() - 30 * 60 * 1000);
    const now = new Date();
    
    if (now > thirtyMinutesBeforeAppointment) {
      return res.status(400).json({
        message: 'Intake form must be submitted at least 30 minutes before your appointment time',
        intakeDeadlinePassed: true
      });
    }

    // Update appointment with intake form
    appointment.intakeForm = intakeForm;
    appointment.intakeSubmitted = true;
    appointment.intakeSubmittedAt = new Date();
    // Keep current status - don't change to 'approval' if already 'scheduled'
    // Only minors should be in 'approval' status waiting for admin
    await appointment.save();

    // Send notification email to admin/doctor
    try {
      const doctor = await User.findById(appointment.doctor_id);
      if (doctor) {
        await sendTemplateEmail(
          doctor.email,
          'intake-submitted',
          {
            patientName: req.user.name,
            appointmentId: appointment._id,
            appointmentDate: appointment.scheduledDate.toLocaleDateString(),
            appointmentTime: appointment.scheduledTime
          }
        );
      }
    } catch (emailError) {
      console.error('Failed to send intake notification:', emailError);
    }

    res.json({
      success: true,
      message: isMinor 
        ? 'Intake form submitted successfully. Your appointment is waiting for admin approval.'
        : 'Intake form submitted successfully. Your appointment is confirmed!',
      appointment: {
        _id: appointment._id,
        status: appointment.status,
        intakeSubmitted: appointment.intakeSubmitted,
        isMinor: appointment.isMinor
      }
    });

  } catch (error) {
    console.error('Error submitting intake form:', error);
    res.status(500).json({ 
      message: 'Failed to submit intake form', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/dashboard-stats
// @desc    Get patient dashboard statistics
// @access  Private (Patient)
router.get('/dashboard-stats', auth, authorize('patient'), async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient_id: req.user._id });

    const stats = {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      approval: appointments.filter(a => a.status === 'approval').length,
      rescheduled: appointments.filter(a => a.status === 'rescheduled').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      pending: appointments.filter(a => a.status === 'pending').length,
      onHold: appointments.filter(a => a.status === 'on-hold').length
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard stats', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/appointments
// @desc    Get all patient appointments
// @access  Private (Patient)
router.get('/appointments', auth, authorize('patient'), async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient_id: req.user._id })
      .populate('doctor_id', 'name email')
      .populate('appointmentType', 'name price duration cardValidityMonths')
      .populate('payment_id', 'amount status transactionId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      appointments
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointments', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/appointment/:id
// @desc    Get appointment details
// @access  Private (Patient)
router.get('/appointment/:id', auth, authorize('patient'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor_id', 'name email phone')
      .populate('appointmentType', 'name description price duration cardValidityMonths')
      .populate('payment_id', 'amount status transactionId createdAt');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Verify patient owns this appointment
    if (appointment.patient_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this appointment' });
    }

    res.json({
      success: true,
      appointment
    });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointment', 
      error: error.message 
    });
  }
});

// @route   PUT /api/patient-portal/profile
// @desc    Update patient profile
// @access  Private (Patient)
router.put('/profile', [
  auth,
  authorize('patient'),
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\d{10}$/).withMessage('Valid 10-digit phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    
    // Update full name if first or last name changed
    if (firstName || lastName) {
      user.name = `${user.firstName || firstName} ${user.lastName || lastName}`;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      message: 'Failed to update profile', 
      error: error.message 
    });
  }
});

// @route   PUT /api/patient-portal/change-password
// @desc    Change patient password
// @access  Private (Patient)
router.put('/change-password', [
  auth,
  authorize('patient'),
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

    const { newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      message: 'Failed to change password', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/appointment-types
// @desc    Get all active appointment types for a specific state
// @access  Public
router.get('/appointment-types', async (req, res) => {
  try {
    const { state } = req.query;
    
    const filter = { isActive: true };
    
    // If state is provided, filter appointment types available in that state
    if (state) {
      filter.$or = [
        { states: state }, // Appointment type specifically for this state
        { states: [] },    // Appointment type available in all states (empty array)
        { states: { $exists: false } } // Field doesn't exist (backward compatibility)
      ];
    }

    const appointmentTypes = await AppointmentType.find(filter)
      .select('name description price duration cardValidityMonths states')
      .sort({ price: 1 });

    console.log(`Fetched ${appointmentTypes.length} appointment types for state: ${state || 'all'}`);

    res.json({
      success: true,
      appointmentTypes
    });

  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointment types', 
      error: error.message 
    });
  }
});

// @route   GET /api/patient-portal/states
// @desc    Get all active states
// @access  Public
router.get('/states', async (req, res) => {
  try {
    const states = await State.find({ isActive: true })
      .select('code name region')
      .sort({ name: 1 });

    res.json({
      success: true,
      states
    });

  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ 
      message: 'Failed to fetch states', 
      error: error.message 
    });
  }
});

// @route   POST /api/patient-portal/validate-coupon
// @desc    Validate coupon code and return discount
// @access  Public
router.post('/validate-coupon', [
  body('couponCode').notEmpty().withMessage('Coupon code is required'),
  body('amount').isNumeric().withMessage('Amount is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { couponCode, amount } = req.body;

    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(), 
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }

    if (new Date(coupon.validUntil) < new Date()) {
      return res.status(400).json({ message: 'Coupon has expired' });
    }

    if (coupon.usedCount >= (coupon.usageLimit || Infinity)) {
      return res.status(400).json({ message: 'Coupon usage limit exceeded' });
    }

    let discountedAmount = amount;
    let discountValue = 0;

    if (coupon.discountType === 'percentage') {
      discountValue = amount * (coupon.discountValue / 100);
      discountedAmount = amount - discountValue;
    } else {
      discountValue = Math.min(coupon.discountValue, amount);
      discountedAmount = Math.max(0, amount - coupon.discountValue);
    }

    res.json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      originalAmount: amount,
      discountAmount: discountValue,
      finalAmount: discountedAmount
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ 
      message: 'Failed to validate coupon', 
      error: error.message 
    });
  }
});

module.exports = router;
