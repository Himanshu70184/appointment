const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth, authorize } = require('../middleware/auth');
const IntakeFormTemplate = require('../models/IntakeFormTemplate');
const State = require('../models/State');
const { createLogger, asyncHandler } = require('../utils/logger');
const { NotFoundError } = require('../utils/errorResponse');

const router = express.Router();
const logger = createLogger('IntakeFormTemplates');

// @route   GET /api/intake-form-templates
// @desc    Get all intake form templates
// @access  Private (Admin/Staff)
router.get('/', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const { isActive, appointmentType, state } = req.query;
  
  const filters = {};
  if (isActive !== undefined) {
    filters.isActive = isActive === 'true';
  }
  if (appointmentType) {
    filters.appointmentTypes = appointmentType;
  }
  if (state) {
    filters.states = state;
  }

  const templates = await IntakeFormTemplate.find(filters)
    .populate('appointmentTypes', 'name')
    .populate('states', 'name code')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ isDefault: -1, createdAt: -1 });

  logger.info('Intake form templates fetched', { count: templates.length });
  res.json({ templates });
}));

// @route   GET /api/intake-form-templates/active
// @desc    Get active template for appointment booking (Public endpoint for patients)
// @access  Public
router.get('/active', asyncHandler(async (req, res) => {
  const { appointmentType, state } = req.query;
  
  const query = { isActive: true };
  
  // Match appointment type and state if provided
  if (appointmentType) {
    if (mongoose.Types.ObjectId.isValid(appointmentType)) {
      query.$or = [
        { appointmentTypes: appointmentType },
        { appointmentTypes: { $size: 0 } } // Templates with no specific appointment types (universal)
      ];
    } else {
      query.$or = [
        { appointmentTypes: { $size: 0 } }
      ];
    }
  }
  
  if (state) {
    let resolvedStateId = null;
    if (mongoose.Types.ObjectId.isValid(state)) {
      resolvedStateId = state;
    } else {
      const normalizedState = state.trim();
      const escapedState = normalizedState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stateNameRegex = new RegExp(`^${escapedState}$`, 'i');
      const stateDoc = await State.findOne({
        $or: [
          { code: normalizedState.toUpperCase() },
          { name: stateNameRegex }
        ]
      }).select('_id');
      if (stateDoc) {
        resolvedStateId = stateDoc._id.toString();
      }
    }

    if (resolvedStateId) {
      query.$and = [
        {
          $or: [
            { states: resolvedStateId },
            { states: { $size: 0 } } // Templates with no specific states (universal)
          ]
        }
      ];
    } else {
      query.$and = [
        { states: { $size: 0 } }
      ];
    }
  }

  // Find default template first, otherwise get the first active one
  let template = await IntakeFormTemplate.findOne({ ...query, isDefault: true })
    .populate('appointmentTypes', 'name')
    .populate('states', 'name code');

  if (!template) {
    template = await IntakeFormTemplate.findOne(query)
      .populate('appointmentTypes', 'name')
      .populate('states', 'name code')
      .sort({ createdAt: -1 });
  }

  if (!template) {
    // Fallback: return any active default template regardless of filters
    template = await IntakeFormTemplate.findOne({ isActive: true, isDefault: true })
      .populate('appointmentTypes', 'name')
      .populate('states', 'name code');
  }

  if (!template) {
    template = await IntakeFormTemplate.findOne({ isActive: true })
      .populate('appointmentTypes', 'name')
      .populate('states', 'name code')
      .sort({ createdAt: -1 });
  }

  if (!template) {
    return res.status(200).json({ template: null, message: 'No active intake form template found' });
  }

  logger.debug('Active template retrieved', { templateId: template._id });
  res.json({ template });
}));

// @route   GET /api/intake-form-templates/:id
// @desc    Get intake form template by ID
// @access  Private (Admin/Staff)
router.get('/:id', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const template = await IntakeFormTemplate.findById(req.params.id)
    .populate('appointmentTypes', 'name')
    .populate('states', 'name code')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!template) {
    throw new NotFoundError('Intake form template');
  }

  logger.debug('Template fetched', { templateId: req.params.id });
  res.json({ template });
}));

// @route   POST /api/intake-form-templates
// @desc    Create new intake form template
// @access  Private (Admin/Staff)
router.post('/', [
  auth,
  authorize('admin', 'staff'),
  body('name').trim().notEmpty().withMessage('Template name is required'),
  body('sections').isArray({ min: 1 }).withMessage('At least one section is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, isDefault, appointmentTypes, states, sections, settings } = req.body;

  // If setting as default, unset other defaults
  if (isDefault) {
    await IntakeFormTemplate.updateMany(
      { isDefault: true },
      { isDefault: false, updatedBy: req.user._id }
    );
  }

  const template = new IntakeFormTemplate({
    name,
    description,
    isDefault,
    appointmentTypes: appointmentTypes || [],
    states: states || [],
    sections,
    settings,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  await template.save();
  await template.populate('appointmentTypes states createdBy updatedBy');

  logger.info('Template created', { templateId: template._id, name: template.name });
  res.status(201).json({
    message: 'Intake form template created successfully',
    template
  });
}));

// @route   PUT /api/intake-form-templates/:id
// @desc    Update intake form template
// @access  Private (Admin/Staff)
router.put('/:id', [
  auth,
  authorize('admin', 'staff'),
  body('name').optional().trim().notEmpty(),
  body('sections').optional().isArray({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const template = await IntakeFormTemplate.findById(req.params.id);
  if (!template) {
    throw new NotFoundError('Intake form template');
  }

  const { name, description, isDefault, isActive, appointmentTypes, states, sections, settings } = req.body;

  // If setting as default, unset other defaults
  if (isDefault && !template.isDefault) {
    await IntakeFormTemplate.updateMany(
      { isDefault: true, _id: { $ne: template._id } },
      { isDefault: false, updatedBy: req.user._id }
    );
  }

  // Update fields
  if (name !== undefined) template.name = name;
  if (description !== undefined) template.description = description;
  if (isDefault !== undefined) template.isDefault = isDefault;
  if (isActive !== undefined) template.isActive = isActive;
  if (appointmentTypes !== undefined) template.appointmentTypes = appointmentTypes;
  if (states !== undefined) template.states = states;
  if (sections !== undefined) template.sections = sections;
  if (settings !== undefined) template.settings = { ...template.settings, ...settings };

  template.updatedBy = req.user._id;
  await template.save();
  await template.populate('appointmentTypes states createdBy updatedBy');

  logger.info('Template updated', { templateId: template._id });
  res.json({
    message: 'Intake form template updated successfully',
    template
  });
}));

// @route   DELETE /api/intake-form-templates/:id
// @desc    Delete intake form template
// @access  Private (Admin only)
router.delete('/:id', [auth, authorize('admin')], asyncHandler(async (req, res) => {
  const template = await IntakeFormTemplate.findById(req.params.id);
  if (!template) {
    throw new NotFoundError('Intake form template');
  }

  // Don't allow deleting default template without confirmation
  if (template.isDefault) {
    return res.status(400).json({ 
      message: 'Cannot delete default template. Set another template as default first.' 
    });
  }

  await template.deleteOne();

  logger.warn('Template deleted', { templateId: template._id, userId: req.user._id });
  res.json({ message: 'Intake form template deleted successfully' });
}));

// @route   POST /api/intake-form-templates/:id/duplicate
// @desc    Duplicate an intake form template
// @access  Private (Admin/Staff)
router.post('/:id/duplicate', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const template = await IntakeFormTemplate.findById(req.params.id);
  if (!template) {
    throw new NotFoundError('Intake form template');
  }

  const duplicatedTemplate = new IntakeFormTemplate({
    ...template.toObject(),
    _id: undefined,
    name: `${template.name} (Copy)`,
    isDefault: false,
    version: 1,
    createdBy: req.user._id,
    updatedBy: req.user._id,
    createdAt: undefined,
    updatedAt: undefined
  });

  await duplicatedTemplate.save();
  await duplicatedTemplate.populate('appointmentTypes states createdBy updatedBy');

  logger.info('Template duplicated', { 
    originalId: template._id, 
    duplicateId: duplicatedTemplate._id 
  });

  res.status(201).json({
    message: 'Intake form template duplicated successfully',
    template: duplicatedTemplate
  });
}));

// @route   PUT /api/intake-form-templates/:id/set-default
// @desc    Set template as default
// @access  Private (Admin/Staff)
router.put('/:id/set-default', [auth, authorize('admin', 'staff')], asyncHandler(async (req, res) => {
  const template = await IntakeFormTemplate.findById(req.params.id);
  if (!template) {
    throw new NotFoundError('Intake form template');
  }

  // Unset all other defaults
  await IntakeFormTemplate.updateMany(
    { isDefault: true, _id: { $ne: template._id } },
    { isDefault: false, updatedBy: req.user._id }
  );

  template.isDefault = true;
  template.isActive = true;
  template.updatedBy = req.user._id;
  await template.save();

  logger.info('Template set as default', { templateId: template._id });
  res.json({
    message: 'Template set as default successfully',
    template
  });
}));

module.exports = router;
