const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/leads
// @desc    Get all leads
// @access  Private (Admin, Staff)
router.get('/', auth, authorize(1, 4), async (req, res) => {
  try {
    const { status, leadFrom, state } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (leadFrom) filter.leadFrom = leadFrom;
    if (state) filter.state = state;

    const leads = await Lead.find(filter)
      .populate('createdBy updatedBy convertedToPatient')
      .sort({ createdAt: -1 });

    res.json({ leads });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leads/:id
// @desc    Get single lead
// @access  Private (Admin, Staff)
router.get('/:id', auth, authorize(1, 4), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('createdBy updatedBy convertedToPatient');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({ lead });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/leads
// @desc    Create new lead
// @access  Public
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('state').notEmpty().withMessage('State is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, state, leadFrom, notes } = req.body;

    // Check if lead already exists
    const existingLead = await Lead.findOne({ email });
    if (existingLead) {
      return res.status(400).json({ message: 'Lead already exists with this email' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already registered with this email' });
    }

    const lead = new Lead({
      name,
      email,
      phone,
      state,
      leadFrom: leadFrom || 'website',
      notes,
      createdBy: req.user?._id
    });

    await lead.save();

    res.status(201).json({ message: 'Lead created', lead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leads/:id
// @desc    Update lead
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize(1, 4), async (req, res) => {
  try {
    const { name, email, phone, state, leadFrom, status, notes } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (name) lead.name = name;
    if (email) lead.email = email;
    if (phone) lead.phone = phone;
    if (state) lead.state = state;
    if (leadFrom) lead.leadFrom = leadFrom;
    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    lead.updatedBy = req.user._id;

    await lead.save();

    res.json({ message: 'Lead updated', lead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/leads/:id/convert
// @desc    Convert lead to patient
// @access  Private (Admin, Staff)
router.post('/:id/convert', auth, authorize(1, 4), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (lead.status === 'converted') {
      return res.status(400).json({ message: 'Lead already converted' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: lead.email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create patient account
    const patient = new User({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      state: lead.state,
      role_id: 3, // Patient
      status: 'new'
    });

    await patient.save();

    // Update lead status
    lead.status = 'converted';
    lead.convertedToPatient = patient._id;
    lead.updatedBy = req.user._id;
    await lead.save();

    res.json({ 
      message: 'Lead converted to patient successfully', 
      patient,
      lead 
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/leads/:id
// @desc    Delete lead
// @access  Private (Admin, Staff)
router.delete('/:id', auth, authorize(1, 4), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await lead.deleteOne();

    res.json({ message: 'Lead deleted' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
