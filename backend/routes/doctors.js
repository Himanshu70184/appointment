const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/doctors
// @desc    Get all doctors
// @access  Public
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.find({ isActive: true })
      .populate('user_id', 'name email phone')
      .select('-availability -blockedDates');
    res.json({ doctors });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/doctors/:id
// @desc    Get doctor by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('user_id', 'name email phone');
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
// @desc    Create doctor profile
// @access  Private (Admin)
router.post('/', [auth, authorize('admin')], async (req, res) => {
  try {
    const doctor = new Doctor(req.body);
    await doctor.save();
    res.status(201).json({ doctor });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
