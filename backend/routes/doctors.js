const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/doctors
// @desc    Get all doctors (with optional filtering)
// @access  Public (all can view active doctors, but admin features protected)
router.get('/', async (req, res) => {
  try {
    const { isActive, state, specialty } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (state) {
      query.states = state;
    }
    if (specialty) {
      query.specialties = specialty;
    }

    const doctors = await Doctor.find(query)
      .populate('user_id', 'name email phone')
      .sort({ 'user_id.name': 1 });
    
    res.json({ doctors });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctors/:id
// @desc    Get doctor by ID with full details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('user_id', 'name email phone state');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json({ doctor });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/doctors
// @desc    Create doctor profile (Admin only)
// @access  Private (Admin)
router.post('/', [
  auth,
  authorize('admin'),
  body('user_id').notEmpty().withMessage('User ID is required'),
  body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
  body('specialties').isArray().withMessage('Specialties must be an array'),
  body('states').isArray().withMessage('States must be an array'),
  body('pricing').optional().isObject().withMessage('Pricing must be an object'),
  body('availability').optional().isArray().withMessage('Availability must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user_id, licenseNumber, specialties, states, pricing, availability } = req.body;

    // Check if user exists and has doctor role
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role_id !== 2) {
      return res.status(400).json({ message: 'User must have doctor role (role_id: 2)' });
    }

    // Check if doctor profile already exists for this user
    const existingDoctor = await Doctor.findOne({ user_id });
    if (existingDoctor) {
      return res.status(400).json({ message: 'Doctor profile already exists for this user' });
    }

    // Create pricing map if provided
    const pricingMap = new Map(Object.entries(pricing || {}));

    const doctor = new Doctor({
      user_id,
      licenseNumber: licenseNumber.toUpperCase(),
      specialties: specialties || [],
      states: states || [],
      pricing: pricingMap,
      availability: availability || [],
      isActive: true
    });

    await doctor.save();

    // Populate user data in response
    await doctor.populate('user_id', 'name email phone');

    res.status(201).json({
      message: 'Doctor profile created successfully',
      doctor: doctor.toObject()
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctors/:id
// @desc    Update doctor profile (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  auth,
  authorize('admin'),
  body('licenseNumber').optional().trim(),
  body('specialties').optional().isArray(),
  body('states').optional().isArray(),
  body('pricing').optional().isObject(),
  body('availability').optional().isArray(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doctor = await Doctor.findById(req.params.id).populate('user_id');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Update fields
    if (req.body.licenseNumber) doctor.licenseNumber = req.body.licenseNumber.toUpperCase();
    if (req.body.specialties) doctor.specialties = req.body.specialties;
    if (req.body.states) doctor.states = req.body.states;
    if (req.body.pricing) {
      doctor.pricing = new Map(Object.entries(req.body.pricing));
    }
    if (req.body.availability) doctor.availability = req.body.availability;
    if (req.body.isActive !== undefined) doctor.isActive = req.body.isActive;

    doctor.updatedAt = Date.now();
    await doctor.save();

    res.json({
      message: 'Doctor profile updated successfully',
      doctor: doctor.toObject()
    });
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctors/:id/availability
// @desc    Update doctor availability and shifts (Admin only)
// @access  Private (Admin)
router.put('/:id/availability', [
  auth,
  authorize('admin'),
  body('availability').isArray().withMessage('Availability must be an array'),
  body('blockedDates').optional().isArray().withMessage('Blocked dates must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { availability, blockedDates } = req.body;

    const doctor = await Doctor.findById(req.params.id).populate('user_id');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Validate availability slots
    const validDays = [0, 1, 2, 3, 4, 5, 6]; // Sunday to Saturday
    for (const slot of availability) {
      if (!validDays.includes(slot.dayOfWeek)) {
        return res.status(400).json({ message: 'Invalid day of week (0-6)' });
      }
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({ message: 'Start time and end time are required' });
      }
      // Validate time format HH:mm
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.startTime)) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:mm' });
      }
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.endTime)) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:mm' });
      }
    }

    doctor.availability = availability;
    if (blockedDates) {
      doctor.blockedDates = blockedDates.map(date => new Date(date));
    }
    doctor.updatedAt = Date.now();

    await doctor.save();

    res.json({
      message: 'Doctor availability updated successfully',
      doctor: doctor.toObject()
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctors/:id/pricing
// @desc    Update doctor pricing by state (Admin only)
// @access  Private (Admin)
router.put('/:id/pricing', [
  auth,
  authorize('admin'),
  body('pricing').isObject().withMessage('Pricing must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doctor = await Doctor.findById(req.params.id).populate('user_id');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Validate that all prices are numbers
    for (const [state, price] of Object.entries(req.body.pricing)) {
      if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ message: `Invalid price for state ${state}` });
      }
    }

    doctor.pricing = new Map(Object.entries(req.body.pricing));
    doctor.updatedAt = Date.now();
    await doctor.save();

    res.json({
      message: 'Doctor pricing updated successfully',
      doctor: doctor.toObject()
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/doctors/:id
// @desc    Delete doctor profile (Admin only)
// @access  Private (Admin)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json({
      message: 'Doctor profile deleted successfully',
      doctor
    });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctors/:id/toggle-active
// @desc    Toggle doctor active status (Admin only)
// @access  Private (Admin)
router.put('/:id/toggle-active', [auth, authorize('admin')], async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('user_id');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    doctor.isActive = !doctor.isActive;
    doctor.updatedAt = Date.now();
    await doctor.save();

    res.json({
      message: `Doctor ${doctor.isActive ? 'activated' : 'deactivated'} successfully`,
      doctor: doctor.toObject()
    });
  } catch (error) {
    console.error('Toggle doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctors/:id/available-slots
// @desc    Get available appointment slots for a doctor
// @access  Public
router.get('/:id/available-slots', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const slots = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();

      // Check if date is blocked
      const isBlocked = doctor.blockedDates.some(blockedDate => {
        const blocked = new Date(blockedDate);
        return blocked.toDateString() === date.toDateString();
      });

      if (isBlocked) continue;

      // Find availability for this day
      const dayAvailability = doctor.availability.find(avail => avail.dayOfWeek === dayOfWeek);
      if (!dayAvailability) continue;

      // Generate 30-minute slots
      const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
      const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const slotTime = new Date(date);
        slotTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

        slots.push({
          date: slotTime.toISOString().split('T')[0],
          time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
          datetime: slotTime.toISOString(),
          timezone: dayAvailability.timezone
        });
      }
    }

    res.json({
      doctor_id: doctor._id,
      availableSlots: slots,
      totalSlots: slots.length
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/doctors/:id/availability
// @desc    Update doctor availability/schedule configuration
// @access  Private (Admin)
router.put('/:id/availability', [
  auth,
  authorize('admin'),
  body('availability').isArray().withMessage('Availability must be an array')
], async (req, res) => {
  try {
    const { availability, blockedDates, states } = req.body;

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (availability) doctor.availability = availability;
    if (blockedDates) doctor.blockedDates = blockedDates;
    if (states) doctor.states = states;

    await doctor.save();
    await doctor.populate('user_id', 'name email phone');

    res.json({ 
      message: 'Doctor availability updated successfully', 
      doctor 
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/doctors/:id/block-dates
// @desc    Block specific dates for doctor
// @access  Private (Admin)
router.post('/:id/block-dates', [
  auth,
  authorize('admin'),
  body('dates').isArray().withMessage('Dates must be an array')
], async (req, res) => {
  try {
    const { dates } = req.body;

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Add new blocked dates (avoid duplicates)
    const existingDates = doctor.blockedDates.map(d => d.toISOString().split('T')[0]);
    const newDates = dates.filter(d => !existingDates.includes(new Date(d).toISOString().split('T')[0]));
    
    doctor.blockedDates.push(...newDates.map(d => new Date(d)));
    await doctor.save();

    res.json({ 
      message: 'Dates blocked successfully', 
      blockedDates: doctor.blockedDates 
    });
  } catch (error) {
    console.error('Block dates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/doctors/:id/block-dates
// @desc    Remove blocked dates for doctor
// @access  Private (Admin)
router.delete('/:id/block-dates', [
  auth,
  authorize('admin'),
  body('dates').isArray().withMessage('Dates must be an array')
], async (req, res) => {
  try {
    const { dates } = req.body;

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Remove specified dates
    const datesToRemove = dates.map(d => new Date(d).toISOString().split('T')[0]);
    doctor.blockedDates = doctor.blockedDates.filter(
      d => !datesToRemove.includes(d.toISOString().split('T')[0])
    );
    
    await doctor.save();

    res.json({ 
      message: 'Blocked dates removed successfully', 
      blockedDates: doctor.blockedDates 
    });
  } catch (error) {
    console.error('Remove blocked dates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
