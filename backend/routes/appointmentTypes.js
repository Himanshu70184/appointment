const express = require('express');
const { body, validationResult } = require('express-validator');
const AppointmentType = require('../models/AppointmentType');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/appointment-types
// @desc    Get all appointment types
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const appointmentTypes = await AppointmentType.find(filter)
      .populate('createdBy updatedBy')
      .sort({ name: 1 });

    res.json({ appointmentTypes });
  } catch (error) {
    console.error('Get appointment types error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/appointment-types/:id
// @desc    Get single appointment type
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const appointmentType = await AppointmentType.findById(req.params.id)
      .populate('createdBy updatedBy');

    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    res.json({ appointmentType });
  } catch (error) {
    console.error('Get appointment type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/appointment-types
// @desc    Create new appointment type
// @access  Private (Admin only)
router.post('/', auth, authorize(1), [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, duration, price, isActive } = req.body;

    // Check if appointment type already exists
    const existingType = await AppointmentType.findOne({ name });
    if (existingType) {
      return res.status(400).json({ message: 'Appointment type with this name already exists' });
    }

    const appointmentType = new AppointmentType({
      name,
      description,
      duration,
      price,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    await appointmentType.save();
    await appointmentType.populate('createdBy');

    res.status(201).json({ message: 'Appointment type created', appointmentType });
  } catch (error) {
    console.error('Create appointment type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/appointment-types/:id
// @desc    Update appointment type
// @access  Private (Admin only)
router.put('/:id', auth, authorize(1), async (req, res) => {
  try {
    const { name, description, duration, price, isActive } = req.body;

    const appointmentType = await AppointmentType.findById(req.params.id);

    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    if (name) appointmentType.name = name;
    if (description) appointmentType.description = description;
    if (duration) appointmentType.duration = duration;
    if (price !== undefined) appointmentType.price = price;
    if (isActive !== undefined) appointmentType.isActive = isActive;
    appointmentType.updatedBy = req.user._id;

    await appointmentType.save();
    await appointmentType.populate('createdBy updatedBy');

    res.json({ message: 'Appointment type updated', appointmentType });
  } catch (error) {
    console.error('Update appointment type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/appointment-types/:id
// @desc    Delete appointment type
// @access  Private (Admin only)
router.delete('/:id', auth, authorize(1), async (req, res) => {
  try {
    const appointmentType = await AppointmentType.findById(req.params.id);

    if (!appointmentType) {
      return res.status(404).json({ message: 'Appointment type not found' });
    }

    await appointmentType.deleteOne();

    res.json({ message: 'Appointment type deleted' });
  } catch (error) {
    console.error('Delete appointment type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
