const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { auth, authorize } = require('../middleware/auth');
const State = require('../models/State');
const { paginate, parseSortParam, buildFilterQuery } = require('../utils/pagination');
const { createLogger, asyncHandler } = require('../utils/logger');
const { NotFoundError } = require('../utils/errorResponse');
const { toCSV, processCSVUpload } = require('../utils/csvHelper');

const router = express.Router();
const logger = createLogger('States');

// Configure multer for CSV upload
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// @route   GET /api/states
// @desc    Get all states (with optional filtering and pagination)
// @access  Public (all can view, but admin features protected)
router.get('/', asyncHandler(async (req, res) => {
  const { isActive, page, limit, sort, search } = req.query;
  
  // Build filter query
  const filters = {};
  if (isActive !== undefined) {
    filters.isActive = isActive === 'true';
  }
  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination options
  const options = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    sort: parseSortParam(sort) || { name: 1 },
    select: '-createdBy -updatedBy'
  };

  // Use pagination if page parameter is provided
  if (page) {
    const result = await paginate(State, filters, options);
    logger.info('States fetched with pagination', { 
      total: result.pagination.totalItems, 
      page: result.pagination.currentPage 
    });
    return res.json({ 
      states: result.results, 
      pagination: result.pagination 
    });
  }

  // Return all states if no pagination requested (backward compatible)
  const states = await State.find(filters)
    .sort(options.sort)
    .select(options.select);

  logger.info('All states fetched', { count: states.length });
  res.json({ states });
}));

// @route   GET /api/states/:id
// @desc    Get state by ID
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const state = await State.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!state) {
    throw new NotFoundError('State');
  }

  logger.debug('State fetched', { stateId: req.params.id });
  res.json({ state });
}));

// @route   POST /api/states
// @desc    Create new state (Admin only)
// @access  Private (Admin)
router.post('/', [
  auth,
  authorize('admin'),
  body('code').isLength({ min: 2, max: 2 }).withMessage('Code must be 2 characters'),
  body('name').trim().notEmpty().withMessage('State name is required'),
  body('region').isIn(['Northeast', 'Midwest', 'South', 'West', 'Territory']).optional(),
  body('cooldownMonths').optional().isInt({ min: 0, max: 120 }).withMessage('Cooldown months must be between 0 and 120')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, name, region, notes, cooldownMonths } = req.body;
    const normalizedCode = code.toUpperCase();

    // Check if state already exists
    const existingState = await State.findOne({
      $or: [{ code: normalizedCode }, { name }, { abbreviation: normalizedCode }]
    });

    if (existingState) {
      return res.status(400).json({ message: 'State with this code or name already exists' });
    }

    const state = new State({
      code: normalizedCode,
      name,
      abbreviation: normalizedCode,
      region,
      notes,
      cooldownMonths: typeof cooldownMonths === 'number' ? cooldownMonths : 0,
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
  body('isActive').isBoolean().optional(),
  body('cooldownMonths').optional().isInt({ min: 0, max: 120 }).withMessage('Cooldown months must be between 0 and 120')
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
    if (req.body.isActive !== undefined) state.isActive = req.body.isActive;
    if (req.body.notes) state.notes = req.body.notes;
    if (req.body.cooldownMonths !== undefined) state.cooldownMonths = req.body.cooldownMonths;

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
router.put('/:id/toggle-active', [auth, authorize('admin')], asyncHandler(async (req, res) => {
  const state = await State.findById(req.params.id);

  if (!state) {
    throw new NotFoundError('State');
  }

  state.isActive = !state.isActive;
  state.updatedBy = req.user._id;
  state.updatedAt = Date.now();

  await state.save();

  logger.info('State status toggled', { 
    stateId: state._id, 
    newStatus: state.isActive 
  });

  res.json({
    message: `State ${state.isActive ? 'activated' : 'deactivated'} successfully`,
    state: state.toObject({ transform: (doc, ret) => {
      delete ret.createdBy;
      delete ret.updatedBy;
      return ret;
    }})
  });
}));

// @route   POST /api/states/bulk/toggle-active
// @desc    Bulk toggle active status for multiple states (Admin only)
// @access  Private (Admin)
router.post('/bulk/toggle-active', [auth, authorize('admin')], asyncHandler(async (req, res) => {
  const { stateIds, isActive } = req.body;

  if (!Array.isArray(stateIds) || stateIds.length === 0) {
    return res.status(400).json({ message: 'stateIds must be a non-empty array' });
  }

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive must be a boolean' });
  }

  const result = await State.updateMany(
    { _id: { $in: stateIds } },
    { 
      isActive, 
      updatedBy: req.user._id,
      updatedAt: Date.now()
    }
  );

  logger.info('Bulk state status update', { 
    count: result.modifiedCount, 
    status: isActive 
  });

  res.json({
    message: `${result.modifiedCount} states ${isActive ? 'activated' : 'deactivated'} successfully`,
    modifiedCount: result.modifiedCount
  });
}));

// @route   POST /api/states/bulk/delete
// @desc    Bulk delete multiple states (Admin only)
// @access  Private (Admin)
router.post('/bulk/delete', [auth, authorize('admin')], asyncHandler(async (req, res) => {
  const { stateIds } = req.body;

  if (!Array.isArray(stateIds) || stateIds.length === 0) {
    return res.status(400).json({ message: 'stateIds must be a non-empty array' });
  }

  const result = await State.deleteMany({ _id: { $in: stateIds } });

  logger.warn('Bulk state deletion', { 
    count: result.deletedCount,
    userId: req.user._id 
  });

  res.json({
    message: `${result.deletedCount} states deleted successfully`,
    deletedCount: result.deletedCount
  });
}));

// @route   GET /api/states/export/csv
// @desc    Export all states to CSV (Admin only)
// @access  Private (Admin)
router.get('/export/csv', [auth, authorize('admin')], asyncHandler(async (req, res) => {
  const states = await State.find()
    .select('-createdBy -updatedBy -__v')
    .sort({ name: 1 });

  // Transform data for CSV export
  const csvData = states.map(state => ({
    code: state.code,
    name: state.name,
    abbreviation: state.abbreviation,
    region: state.region,
    isActive: state.isActive,
    notes: state.notes || '',
    cooldownMonths: state.cooldownMonths || 0
  }));

  const csv = toCSV(csvData);

  logger.info('States exported to CSV', { count: states.length });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=states-export.csv');
  res.send(csv);
}));

// @route   POST /api/states/import/csv
// @desc    Import states from CSV file (Admin only)
// @access  Private (Admin)
router.post('/import/csv', [auth, authorize('admin'), upload.single('file')], asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No CSV file uploaded' });
  }

  // Define validation schema
  const schema = {
    code: { required: true, type: 'string', minLength: 2, maxLength: 2 },
    name: { required: true, type: 'string' },
    abbreviation: { required: true, type: 'string', minLength: 2, maxLength: 2 },
    region: { 
      required: true, 
      enum: ['Northeast', 'Midwest', 'South', 'West', 'Territory'] 
    },
    isActive: { type: 'boolean' },
    notes: { type: 'string' },
    cooldownMonths: { type: 'number' }
  };

  // Transformer function to convert CSV data to model format
  const transformer = (row) => ({
    code: row.code.toUpperCase(),
    name: row.name,
    abbreviation: row.abbreviation.toUpperCase(),
    region: row.region,
    isActive: row.isActive === 'true' || row.isActive === '1' || row.isActive === true,
    notes: row.notes || '',
    cooldownMonths: row.cooldownMonths ? Number(row.cooldownMonths) : 0
  });

  const result = await processCSVUpload({
    file: req.file,
    model: State,
    schema,
    transformer,
    userId: req.user._id,
    skipDuplicates: true,
    uniqueField: 'code'
  });

  logger.info('CSV import completed', {
    imported: result.imported,
    skipped: result.skipped,
    hasErrors: result.errors.length > 0
  });

  res.status(result.success ? 200 : 400).json(result);
}));

module.exports = router;
