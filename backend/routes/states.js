const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const State = require('../models/State');

const router = express.Router();

// @route   GET /api/states
// @desc    Get all states (with optional filtering)
// @access  Public (all can view, but admin features protected)
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const states = await State.find(query)
      .sort({ name: 1 })
      .select('-createdBy -updatedBy');

    res.json({ states });
  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/states/:id
// @desc    Get state by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const state = await State.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!state) {
      return res.status(404).json({ message: 'State not found' });
    }

    res.json({ state });
  } catch (error) {
    console.error('Get state error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/states
// @desc    Create new state (Admin only)
// @access  Private (Admin)
router.post('/', [
  auth,
  authorize('admin'),
  body('code').isLength({ min: 2, max: 2 }).withMessage('Code must be 2 characters'),
  body('name').trim().notEmpty().withMessage('State name is required'),
  body('abbreviation').isLength({ min: 2, max: 2 }).withMessage('Abbreviation must be 2 characters'),
  body('region').isIn(['Northeast', 'Midwest', 'South', 'West', 'Territory']).optional(),
  body('medicalCardPrice').isFloat({ min: 0 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, name, abbreviation, region, medicalCardPrice, notes } = req.body;

    // Check if state already exists
    const existingState = await State.findOne({
      $or: [{ code }, { name }, { abbreviation }]
    });

    if (existingState) {
      return res.status(400).json({ message: 'State with this code, name, or abbreviation already exists' });
    }

    const state = new State({
      code: code.toUpperCase(),
      name,
      abbreviation: abbreviation.toUpperCase(),
      region,
      medicalCardPrice,
      notes,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await state.save();

    res.status(201).json({
      message: 'State created successfully',
      state: state.toObject({ transform: (doc, ret) => {
        delete ret.createdBy;
        delete ret.updatedBy;
        return ret;
      }})
    });
  } catch (error) {
    console.error('Create state error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/states/:id
// @desc    Update state (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  auth,
  authorize('admin'),
  body('name').trim().optional(),
  body('region').isIn(['Northeast', 'Midwest', 'South', 'West', 'Territory']).optional(),
  body('medicalCardPrice').isFloat({ min: 0 }).optional(),
  body('isActive').isBoolean().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const state = await State.findById(req.params.id);

    if (!state) {
      return res.status(404).json({ message: 'State not found' });
    }

    // Update fields
    if (req.body.name) state.name = req.body.name;
    if (req.body.region) state.region = req.body.region;
    if (req.body.medicalCardPrice !== undefined) state.medicalCardPrice = req.body.medicalCardPrice;
    if (req.body.isActive !== undefined) state.isActive = req.body.isActive;
    if (req.body.notes) state.notes = req.body.notes;

    state.updatedBy = req.user._id;
    state.updatedAt = Date.now();

    await state.save();

    res.json({
      message: 'State updated successfully',
      state: state.toObject({ transform: (doc, ret) => {
        delete ret.createdBy;
        delete ret.updatedBy;
        return ret;
      }})
    });
  } catch (error) {
    console.error('Update state error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/states/:id
// @desc    Delete state (Admin only)
// @access  Private (Admin)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const state = await State.findByIdAndDelete(req.params.id);

    if (!state) {
      return res.status(404).json({ message: 'State not found' });
    }

    res.json({
      message: 'State deleted successfully',
      state
    });
  } catch (error) {
    console.error('Delete state error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/states/:id/toggle-active
// @desc    Toggle state active status (Admin only)
// @access  Private (Admin)
router.put('/:id/toggle-active', [auth, authorize('admin')], async (req, res) => {
  try {
    const state = await State.findById(req.params.id);

    if (!state) {
      return res.status(404).json({ message: 'State not found' });
    }

    state.isActive = !state.isActive;
    state.updatedBy = req.user._id;
    state.updatedAt = Date.now();

    await state.save();

    res.json({
      message: `State ${state.isActive ? 'activated' : 'deactivated'} successfully`,
      state
    });
  } catch (error) {
    console.error('Toggle state error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
