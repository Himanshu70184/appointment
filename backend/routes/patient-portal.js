const express = require('express');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const AppointmentType = require('../models/AppointmentType');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const State = require('../models/State');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const { processPayment } = require('../utils/payment');
const { sendTemplateEmail, sendWelcomeEmail } = require('../utils/email');
const { getStateCooldownBlock, hasActiveAppointmentInState } = require('../utils/bookingCooldown');
const { validateAndCalculateCoupon, CouponValidationError } = require('../utils/coupon');
const {
  sendAppointmentScheduledNotifications,
  sendAppointmentCancellationNotifications,
  sendPendingIntakeNotifications,
  sendAdminApprovalRequiredNotifications,
  sendAppointmentRescheduleNotifications
} = require('../utils/notifications');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();


const addIntakePendingFlag = (appointment) => {
  const data = appointment.toObject ? appointment.toObject() : appointment;
  const status = data.status;
  const intakePending =
    !data.intakeSubmitted &&
    status !== 'completed' &&
    status !== 'cancelled' &&
    status !== 'canceled';
  return { ...data, intakePending };
};

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

    const EST_TIMEZONE = 'America/New_York';
    const getEstParts = (inputDate) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(inputDate);

      const map = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

      return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour: Number(map.hour),
        minute: Number(map.minute)
      };
    };

    const estNowParts = getEstParts(new Date());
    const estTodayStr = `${estNowParts.year}-${estNowParts.month}-${estNowParts.day}`;
    const isTodayInEst = date === estTodayStr;
    const minVisibleMinutes = estNowParts.hour * 60 + estNowParts.minute + 30;

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
        if (isTodayInEst && minutes < minVisibleMinutes) {
          continue; // Skip slots that are within 30 minutes of current EST time
        }
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

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists (guest checkout allowed)
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;
    
    if (!user) {
      isNewUser = true;
    } else if (user.role_id !== 3) {
      return res.status(400).json({ message: 'Email already taken. Use another email.' });
    } else {
      const activeAppointment = await hasActiveAppointmentInState({
        patientId: user._id,
        stateCode: state
      });

      if (activeAppointment) {
        const scheduledDateStr = activeAppointment.scheduledDate
          ? new Date(activeAppointment.scheduledDate).toLocaleDateString('en-US')
          : 'a pending date';
        const scheduledTimeStr = activeAppointment.scheduledTime || 'TBD';

        return res.status(400).json({
          message: `You already have an active appointment in ${state}. Scheduled for ${scheduledDateStr} at ${scheduledTimeStr}. Please reschedule or cancel it before booking another slot.`,
          existingAppointmentId: activeAppointment._id
        });
      }

      const cooldownBlock = await getStateCooldownBlock({
        patientId: user._id,
        stateCode: state
      });
      if (cooldownBlock) {
        return res.status(400).json({
          message: `You must wait ${cooldownBlock.cooldownMonths} months after a completed appointment in ${cooldownBlock.stateName}. Next eligible date: ${cooldownBlock.eligibleDateFormatted}.`
        });
      }
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

    // Calculate amount with coupon discount
    let amount = appointmentType.price;
    let appliedCoupon = null;
    let couponSavings = 0;

    if (couponCode) {
      try {
        const couponResult = await validateAndCalculateCoupon({
          couponCode,
          amount,
          stateCode: state,
          appointmentTypeId: cardType
        });

        amount = couponResult.finalAmount;
        appliedCoupon = couponResult.coupon;
        couponSavings = couponResult.discountAmount;
      } catch (couponError) {
        if (couponError instanceof CouponValidationError) {
          return res.status(couponError.statusCode || 400).json({ message: couponError.message });
        }
        console.error('Coupon validation failed:', couponError);
        return res.status(500).json({ message: 'Failed to apply coupon', error: couponError.message });
      }
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
        email: normalizedEmail,
        phone,
        dateOfBirth,
        password,
        state,
        role_id: 3, // Patient
        isMinor,
        guardianName: isMinor ? guardianName : undefined,
        guardianPhone: isMinor ? guardianPhone : undefined,
        guardianAddress: isMinor ? guardianAddress : undefined,
        status: 'active',
        emailVerified: true
      });

      await user.save();
    } else if (user && !user.emailVerified) {
      user.emailVerified = true;
      user.status = user.status === 'new' ? 'active' : user.status;
      await user.save();
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
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      adjustedAmount: amount,
      couponDiscountAmount: couponSavings > 0 ? couponSavings : 0
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
      appointment.paymentCompletedAt = new Date();
      
      // Keep pending until intake form is submitted
      // After intake submission: adults -> scheduled, minors -> approval
      appointment.status = 'pending';
      
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

    const postPaymentConflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      doctor_id: assignedDoctorId,
      status: { $in: ['scheduled', 'approval', 'pending', 'rescheduled'] }
    });

    if (postPaymentConflict) {
      appointment.status = 'on-hold';
      appointment.scheduledDate = null;
      appointment.scheduledTime = null;
      appointment.doctor_id = null;
      await appointment.save();

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      return res.status(409).json({
        message: 'This slot was booked by someone else after payment. Please choose another slot. Your payment is secure and will be applied to the new time.',
        slotConflictAfterPayment: true,
        appointmentId: appointment._id,
        token,
        isNewUser
      });
    }

    await sendPendingIntakeNotifications({ appointmentInput: appointment });
    if (appointment.isMinor) {
      await sendAdminApprovalRequiredNotifications({ appointmentInput: appointment });
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
        ? 'Appointment payment successful! Please complete your intake form to proceed with approval.'
        : 'Appointment booked successfully! Please complete your intake form to schedule.',
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

    const wasScheduled = appointment.status === 'scheduled';

    // Verify patient owns this appointment
    const appointmentPatientId = appointment.patient_id?._id || appointment.patient_id;
    const isOwnerById = appointmentPatientId && appointmentPatientId.toString() === req.user._id.toString();
    const isOwnerByEmail = appointment.patient_id?.email && appointment.patient_id.email === req.user.email;

    const isPatient = req.user.role_id === 3;
    const isAdminOrStaff = req.user.role_id === 1 || req.user.role_id === 4;

    if (isPatient && !isOwnerById && !isOwnerByEmail && !isAdminOrStaff) {
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
    const appointmentPatientId = appointment.patient_id?._id || appointment.patient_id;
    const isOwnerById = appointmentPatientId && appointmentPatientId.toString() === req.user._id.toString();
    const isOwnerByEmail = appointment.patient_id?.email && appointment.patient_id.email === req.user.email;

    if (!isOwnerById && !isOwnerByEmail) {
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
    // Move out of pending once intake is submitted
    if (appointment.status !== 'completed' && appointment.status !== 'cancelled' && appointment.status !== 'canceled') {
      appointment.status = appointment.isMinor ? 'approval' : 'scheduled';
    }
    await appointment.save();

    if (!wasScheduled && appointment.status === 'scheduled') {
      await sendAppointmentScheduledNotifications(appointment);
    }

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
router.get('/dashboard-stats', auth, async (req, res) => {
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
router.get('/appointments', auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient_id: req.user._id })
      .populate('doctor_id', 'name email')
      .populate('appointmentType', 'name price duration cardValidityMonths')
      .populate('payment_id', 'amount status transactionId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      appointments: appointments.map(addIntakePendingFlag)
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
router.get('/appointment/:id', auth, async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role_id === 3) {
      query.patient_id = req.user._id;
    }

    const appointment = await Appointment.findOne(query)
      .populate('patient_id', 'name firstName lastName email phone dateOfBirth')
      .populate('doctor_id', 'name email phone')
      .populate('appointmentType', 'name description price duration cardValidityMonths')
      .populate('payment_id', 'amount status transactionId createdAt');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const stateRecord = await State.findOne({ code: appointment.state }).select('name');

    res.json({
      success: true,
      appointment: {
        ...addIntakePendingFlag(appointment),
        stateName: stateRecord?.name || appointment.state
      }
    });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointment', 
      error: error.message 
    });
  }
});

// @route   PUT /api/patient-portal/appointments/:id/reschedule
// @desc    Reschedule patient appointment
// @access  Private (Patient)
router.put('/appointments/:id/reschedule', [
  auth,
  authorize('patient'),
  body('scheduledDate').notEmpty().withMessage('Scheduled date is required'),
  body('scheduledTime').notEmpty().withMessage('Scheduled time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scheduledDate, scheduledTime } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.patient_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this appointment' });
    }

    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({ message: 'Cannot reschedule a completed or cancelled appointment' });
    }

    const appointmentType = await AppointmentType.findById(appointment.appointmentType);
    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    const slotDuration = appointmentType.duration || 30;
    const assignedDoctorId = await getCheapestAvailableDoctor({
      state: appointment.state,
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

    const existingAppointment = await Appointment.findOne({
      _id: { $ne: appointment._id },
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      doctor_id: assignedDoctorId,
      status: { $in: ['scheduled', 'approval', 'pending', 'rescheduled'] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: 'This slot has been booked by someone else. Please choose another slot.',
        slotConflict: true
      });
    }

    const previousDoctorId = appointment.doctor_id?.toString();
    const previousDate = appointment.scheduledDate;
    const previousTime = appointment.scheduledTime;

    appointment.scheduledDate = new Date(scheduledDate);
    appointment.scheduledTime = scheduledTime;
    appointment.doctor_id = assignedDoctorId;
    appointment.status = 'rescheduled';
    await appointment.save();

    await sendAppointmentRescheduleNotifications({
      appointmentInput: appointment,
      previousDate,
      previousTime,
      previousDoctorId,
      rescheduleByRole: 'patient',
      rescheduleByName: req.user.name || req.user.email || ''
    });

    res.json({
      message: 'Appointment rescheduled',
      appointment: addIntakePendingFlag(appointment)
    });
  } catch (error) {
    console.error('Patient reschedule error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/patient-portal/appointments/:id/cancel
// @desc    Cancel patient appointment
// @access  Private (Patient)
router.put('/appointments/:id/cancel', [
  auth,
  authorize('patient'),
  body('reason').trim().notEmpty().withMessage('Cancellation reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.patient_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this appointment' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ message: 'Appointment is already cancelled' });
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = reason;
    await appointment.save();

    await sendAppointmentCancellationNotifications({
      appointmentInput: appointment,
      initiatorRole: 'patient',
      reason
    });

    res.json({ message: 'Appointment cancelled', appointment });
  } catch (error) {
    console.error('Patient cancel error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
  body('amount').isNumeric().withMessage('Amount is required'),
  body('state').optional().isString().isLength({ min: 2, max: 2 }).withMessage('State must be a 2-letter code'),
  body('appointmentTypeId').optional().isMongoId().withMessage('Appointment type is invalid')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { couponCode, amount, state, appointmentTypeId } = req.body;

    try {
      const couponResult = await validateAndCalculateCoupon({
        couponCode,
        amount,
          stateCode: state,
          appointmentTypeId
      });

      res.json({
        success: true,
        message: 'Coupon is valid',
        coupon: {
          code: couponResult.coupon.code,
          description: couponResult.coupon.description,
          discountType: couponResult.coupon.discountType,
          discountValue: couponResult.coupon.discountValue,
          maxDiscount: couponResult.coupon.maxDiscount,
          minPurchase: couponResult.coupon.minPurchase,
          validFrom: couponResult.coupon.validFrom,
          validUntil: couponResult.coupon.validUntil,
          usageLimit: couponResult.coupon.usageLimit,
          usedCount: couponResult.coupon.usedCount,
          applicableStates: couponResult.coupon.applicableStates
        },
        originalAmount: couponResult.discountAmount + couponResult.finalAmount,
        discountAmount: couponResult.discountAmount,
        finalAmount: couponResult.finalAmount
      });
    } catch (couponError) {
      if (couponError instanceof CouponValidationError) {
        return res.status(couponError.statusCode || 400).json({ message: couponError.message });
      }
      console.error('Coupon helper error:', couponError);
      return res.status(500).json({ message: 'Failed to validate coupon', error: couponError.message });
    }

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ 
      message: 'Failed to validate coupon', 
      error: error.message 
    });
  }
});

module.exports = router;
