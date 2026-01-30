const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const State = require('../models/State');
const { createLogger, asyncHandler } = require('../utils/logger');
const { NotFoundError } = require('../utils/errorResponse');

const router = express.Router();
const logger = createLogger('DoctorAvailability');

// Validation middleware for weekly schedule
const validateWeeklySchedule = (schedule) => {
  if (!Array.isArray(schedule) || schedule.length !== 7) {
    return 'Weekly schedule must contain exactly 7 days';
  }

  const days = schedule.map(s => s.dayOfWeek);
  const uniqueDays = new Set(days);
  
  if (uniqueDays.size !== 7) {
    return 'Weekly schedule must have unique days (0-6)';
  }

  for (const day of schedule) {
    if (day.isActive) {
      if (!day.startTime || !day.endTime) {
        return `Day ${day.dayOfWeek} is active but missing start or end time`;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(day.startTime) || !timeRegex.test(day.endTime)) {
        return `Invalid time format for day ${day.dayOfWeek}. Use HH:MM (24-hour format)`;
      }

      if (day.startTime >= day.endTime) {
        return `Start time must be before end time for day ${day.dayOfWeek}`;
      }

      // Validate break times if provided (and not empty/null)
      const hasBreakStart = day.breakStartTime && day.breakStartTime !== '' && day.breakStartTime !== '--:--';
      const hasBreakEnd = day.breakEndTime && day.breakEndTime !== '' && day.breakEndTime !== '--:--';
      
      if (hasBreakStart || hasBreakEnd) {
        if (!hasBreakStart || !hasBreakEnd) {
          return `Both break start and end times must be provided for day ${day.dayOfWeek}`;
        }

        if (!timeRegex.test(day.breakStartTime) || !timeRegex.test(day.breakEndTime)) {
          return `Invalid break time format for day ${day.dayOfWeek}. Use HH:MM (24-hour format)`;
        }

        if (day.breakStartTime >= day.breakEndTime) {
          return `Break start time must be before break end time for day ${day.dayOfWeek}`;
        }

        if (day.breakStartTime < day.startTime || day.breakEndTime > day.endTime) {
          return `Break times must be within working hours for day ${day.dayOfWeek}`;
        }
      }
    }
  }

  return null;
};

// Validation middleware for holidays
const validateHolidays = (holidays, startDate, endDate) => {
  if (!holidays || holidays.length === 0) {
    return null; // No holidays is valid
  }

  if (!Array.isArray(holidays)) {
    return 'Holidays must be an array';
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  for (let i = 0; i < holidays.length; i++) {
    const holiday = holidays[i];

    // Validate date exists
    if (!holiday.date) {
      return `Holiday ${i + 1} is missing a date`;
    }

    const holidayDate = new Date(holiday.date);
    
    // Check if holiday is within schedule range
    if (holidayDate < start || holidayDate > end) {
      return `Holiday on ${holiday.date} is outside the schedule date range`;
    }

    // Validate type
    if (!holiday.type || !['full-day', 'half-day'].includes(holiday.type)) {
      return `Holiday ${i + 1} must have type 'full-day' or 'half-day'`;
    }

    // Validate half-day times
    if (holiday.type === 'half-day') {
      if (!holiday.startTime || !holiday.endTime) {
        return `Half-day holiday on ${holiday.date} must have start and end times`;
      }

      if (!timeRegex.test(holiday.startTime) || !timeRegex.test(holiday.endTime)) {
        return `Invalid time format for holiday on ${holiday.date}. Use HH:MM (24-hour format)`;
      }

      if (holiday.startTime >= holiday.endTime) {
        return `Start time must be before end time for holiday on ${holiday.date}`;
      }
    }
  }

  return null;
};

// @route   GET /api/doctors/:doctorId/availability
// @desc    Get all availability schedules for a doctor
// @access  Private (Admin/Staff)
router.get('/:doctorId/availability', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const { active, upcoming, current } = req.query;

  // Verify doctor exists
  const doctor = await User.findById(doctorId);
  if (!doctor || doctor.role_id !== 2) {
    throw new NotFoundError('Doctor');
  }

  let query = { doctor_id: doctorId };

  // Filter by active status
  if (active !== undefined) {
    query.isActive = active === 'true';
  }

  // Filter for upcoming schedules
  if (upcoming === 'true') {
    query.startDate = { $gt: new Date() };
  }

  // Filter for current active schedules
  if (current === 'true') {
    const now = new Date();
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
    query.isActive = true;
  }

  const availabilities = await DoctorAvailability.find(query)
    .populate('doctor_id', 'name email')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ startDate: -1 });

  logger.info('Doctor availability fetched', { 
    doctorId, 
    count: availabilities.length 
  });

  res.json({ 
    success: true,
    availabilities,
    count: availabilities.length
  });
}));

// @route   GET /api/doctors/:doctorId/availability/:id
// @desc    Get specific availability schedule
// @access  Private (Admin/Staff)
router.get('/:doctorId/availability/:id', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const availability = await DoctorAvailability.findOne({
    _id: req.params.id,
    doctor_id: req.params.doctorId
  })
    .populate('doctor_id', 'name email consultationFee')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!availability) {
    throw new NotFoundError('Availability schedule');
  }

  logger.debug('Availability schedule fetched', { id: req.params.id });

  res.json({ 
    success: true,
    availability 
  });
}));

// @route   POST /api/doctors/:doctorId/availability
// @desc    Create new availability schedule for a doctor
// @access  Private (Admin/Staff)
router.post('/:doctorId/availability', [
  auth,
  authorize('admin', 'staff'),
  body('states').isArray({ min: 1 }).withMessage('At least one state is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('weeklySchedule').isArray({ min: 7, max: 7 }).withMessage('Weekly schedule must have 7 days'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Validation errors creating availability', { errors: errors.array() });
    return res.status(400).json({ 
      success: false,
      message: errors.array().map(e => e.msg).join(', '),
      errors: errors.array() 
    });
  }

  const { doctorId } = req.params;
  const { states, weeklySchedule, startDate, endDate, holidays, notes } = req.body;
  
  logger.debug('Creating availability', { doctorId, states, dateRange: `${startDate} to ${endDate}`, holidayCount: holidays?.length || 0 });

  // Verify doctor exists and is a doctor
  const doctor = await User.findById(doctorId);
  if (!doctor || doctor.role_id !== 2) {
    return res.status(404).json({ 
      success: false,
      message: 'Doctor not found' 
    });
  }

  // Validate weekly schedule
  const scheduleError = validateWeeklySchedule(weeklySchedule);
  if (scheduleError) {
    logger.error('Schedule validation failed', { error: scheduleError, weeklySchedule });
    return res.status(400).json({ 
      success: false,
      message: scheduleError 
    });
  }

  // Validate holidays
  if (holidays) {
    const holidayError = validateHolidays(holidays, startDate, endDate);
    if (holidayError) {
      logger.error('Holiday validation failed', { error: holidayError, holidays });
      return res.status(400).json({ 
        success: false,
        message: holidayError 
      });
    }
  }

  // Validate states exist
  const validStates = await State.find({ code: { $in: states } });
  if (validStates.length !== states.length) {
    return res.status(400).json({ 
      success: false,
      message: 'One or more invalid state codes' 
    });
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end <= start) {
    return res.status(400).json({ 
      success: false,
      message: 'End date must be after start date' 
    });
  }

  // Check for overlapping schedules
  const overlapping = await DoctorAvailability.findOne({
    doctor_id: doctorId,
    isActive: true,
    $or: [
      { 
        startDate: { $lte: end },
        endDate: { $gte: start }
      }
    ]
  });

  if (overlapping) {
    logger.warn('Schedule overlap detected', { 
      doctorId, 
      requestedRange: `${start} to ${end}`,
      existingRange: `${overlapping.startDate} to ${overlapping.endDate}`
    });
    return res.status(400).json({ 
      success: false,
      message: `This schedule overlaps with an existing active schedule (${new Date(overlapping.startDate).toLocaleDateString()} - ${new Date(overlapping.endDate).toLocaleDateString()}). Please deactivate or delete the existing schedule first, or choose different dates.`,
      overlappingSchedule: {
        id: overlapping._id,
        startDate: overlapping.startDate,
        endDate: overlapping.endDate
      }
    });
  }

  // Create new availability
  const availability = new DoctorAvailability({
    doctor_id: doctorId,
    states,
    weeklySchedule,
    startDate: start,
    endDate: end,
    holidays: holidays || [],
    notes,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await availability.save();

  await availability.populate('doctor_id', 'name email');

  logger.info('Doctor availability created', { 
    doctorId, 
    availabilityId: availability._id,
    states,
    dateRange: `${start.toISOString()} to ${end.toISOString()}`
  });

  res.status(201).json({
    success: true,
    message: 'Availability schedule created successfully',
    availability
  });
}));

// @route   PUT /api/doctors/:doctorId/availability/:id
// @desc    Update availability schedule
// @access  Private (Admin/Staff)
router.put('/:doctorId/availability/:id', [
  auth,
  authorize('admin', 'staff'),
  body('states').optional().isArray({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('weeklySchedule').optional().isArray({ min: 7, max: 7 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }

  const availability = await DoctorAvailability.findOne({
    _id: req.params.id,
    doctor_id: req.params.doctorId
  });

  if (!availability) {
    throw new NotFoundError('Availability schedule');
  }

  const { states, weeklySchedule, startDate, endDate, holidays, notes, isActive } = req.body;

  // Validate weekly schedule if provided
  if (weeklySchedule) {
    const scheduleError = validateWeeklySchedule(weeklySchedule);
    if (scheduleError) {
      return res.status(400).json({ 
        success: false,
        message: scheduleError 
      });
    }
    availability.weeklySchedule = weeklySchedule;
  }

  // Validate holidays if provided
  if (holidays !== undefined) {
    const effectiveStartDate = startDate || availability.startDate;
    const effectiveEndDate = endDate || availability.endDate;
    
    const holidayError = validateHolidays(holidays, effectiveStartDate, effectiveEndDate);
    if (holidayError) {
      return res.status(400).json({ 
        success: false,
        message: holidayError 
      });
    }
    availability.holidays = holidays;
  }

  // Validate and update states
  if (states) {
    const validStates = await State.find({ code: { $in: states } });
    if (validStates.length !== states.length) {
      return res.status(400).json({ 
        success: false,
        message: 'One or more invalid state codes' 
      });
    }
    availability.states = states;
  }

  // Update dates if provided
  if (startDate) availability.startDate = new Date(startDate);
  if (endDate) availability.endDate = new Date(endDate);

  // Validate date range
  if (availability.endDate <= availability.startDate) {
    return res.status(400).json({ 
      success: false,
      message: 'End date must be after start date' 
    });
  }

  // Check for overlapping schedules (excluding current schedule)
  if (startDate || endDate) {
    const overlapping = await DoctorAvailability.findOne({
      doctor_id: req.params.doctorId,
      _id: { $ne: req.params.id }, // Exclude current schedule
      isActive: true,
      $or: [
        { 
          startDate: { $lte: availability.endDate },
          endDate: { $gte: availability.startDate }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        success: false,
        message: 'This schedule overlaps with another existing active schedule',
        overlappingSchedule: {
          id: overlapping._id,
          startDate: overlapping.startDate,
          endDate: overlapping.endDate
        }
      });
    }
  }

  // Update other fields
  if (notes !== undefined) availability.notes = notes;
  if (isActive !== undefined) availability.isActive = isActive;

  availability.updatedBy = req.user._id;

  await availability.save();
  await availability.populate('doctor_id', 'name email');

  logger.info('Doctor availability updated', { 
    availabilityId: availability._id,
    doctorId: req.params.doctorId 
  });

  res.json({
    success: true,
    message: 'Availability schedule updated successfully',
    availability
  });
}));

// @route   DELETE /api/doctors/:doctorId/availability/:id
// @desc    Delete availability schedule
// @access  Private (Admin/Staff)
router.delete('/:doctorId/availability/:id', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const availability = await DoctorAvailability.findOneAndDelete({
    _id: req.params.id,
    doctor_id: req.params.doctorId
  });

  if (!availability) {
    throw new NotFoundError('Availability schedule');
  }

  logger.warn('Doctor availability deleted', { 
    availabilityId: req.params.id,
    doctorId: req.params.doctorId,
    deletedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Availability schedule deleted successfully'
  });
}));

// @route   PUT /api/doctors/:doctorId/availability/:id/toggle
// @desc    Toggle availability schedule active status
// @access  Private (Admin/Staff)
router.put('/:doctorId/availability/:id/toggle', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const availability = await DoctorAvailability.findOne({
    _id: req.params.id,
    doctor_id: req.params.doctorId
  });

  if (!availability) {
    throw new NotFoundError('Availability schedule');
  }

  availability.isActive = !availability.isActive;
  availability.updatedBy = req.user._id;

  await availability.save();
  await availability.populate('doctor_id', 'name email');

  logger.info('Availability status toggled', { 
    availabilityId: availability._id,
    newStatus: availability.isActive 
  });

  res.json({
    success: true,
    message: `Availability schedule ${availability.isActive ? 'activated' : 'deactivated'} successfully`,
    availability
  });
}));

// @route   GET /api/doctor-availability/check
// @desc    Check doctor availability for a specific date/time/state
// @access  Public (for appointment booking)
router.get('/check', asyncHandler(async (req, res) => {
  const { stateCode, date, time } = req.query;

  if (!stateCode || !date || !time) {
    return res.status(400).json({ 
      success: false,
      message: 'State code, date, and time are required' 
    });
  }

  const appointmentDate = new Date(date);
  const availableDoctors = await DoctorAvailability.getAvailableDoctors(
    stateCode,
    appointmentDate,
    time
  );

  logger.debug('Available doctors checked', { 
    stateCode, 
    date, 
    time,
    count: availableDoctors.length 
  });

  res.json({
    success: true,
    availableDoctors: availableDoctors.map(ad => ({
      doctor: {
        id: ad.doctor._id,
        name: ad.doctor.name,
        email: ad.doctor.email,
        consultationFee: ad.doctor.consultationFee,
      },
      availabilityId: ad.availability._id,
    })),
    count: availableDoctors.length
  });
}));

module.exports = router;
