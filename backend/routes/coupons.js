const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Coupon = require('../models/Coupon');
const Appointment = require('../models/Appointment');
const { auth, authorize } = require('../middleware/auth');
const { normalizeCode, normalizeState } = require('../utils/coupon');

const router = express.Router();

const createValidators = [
  body('code').trim().notEmpty().withMessage('Coupon code is required').isLength({ max: 32 }),
  body('description').optional().isLength({ max: 200 }).withMessage('Description must be under 200 characters'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').isFloat({ gt: 0 }).withMessage('Discount value must be greater than 0'),
  body('minPurchase').optional().isFloat({ min: 0 }).withMessage('Minimum purchase must be 0 or more'),
  body('maxDiscount').optional().isFloat({ gt: 0 }).withMessage('Maximum discount must be greater than 0'),
  body('validFrom').notEmpty().withMessage('Valid from date is required').isISO8601().withMessage('Valid from must be a valid date'),
  body('validUntil').notEmpty().withMessage('Valid until date is required').isISO8601().withMessage('Valid until must be a valid date'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
  body('applicableStates').optional().isArray().withMessage('Applicable states must be an array'),
  body('applicableStates.*').optional().isString().isLength({ min: 2, max: 2 }).withMessage('State codes must be 2 letters'),
  body('applicableAppointmentTypes').optional().isArray().withMessage('Applicable appointment types must be an array'),
  body('applicableAppointmentTypes.*').optional().isMongoId().withMessage('Appointment type id is invalid'),
  body('appointmentTypeOverrides').optional().isArray().withMessage('Appointment type overrides must be an array'),
  body('appointmentTypeOverrides.*.appointmentType')
    .notEmpty().withMessage('Override appointment type is required')
    .bail()
    .isMongoId().withMessage('Override appointment type id is invalid'),
  body('appointmentTypeOverrides.*.discountType')
    .notEmpty().withMessage('Override discount type is required')
    .bail()
    .isIn(['percentage', 'fixed']).withMessage('Override discount type must be percentage or fixed'),
  body('appointmentTypeOverrides.*.discountValue')
    .notEmpty().withMessage('Override discount value is required')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Override discount value must be greater than 0'),
  body('appointmentTypeOverrides.*.maxDiscount')
    .optional({ checkFalsy: true, nullable: true })
    .isFloat({ gt: 0 }).withMessage('Override max discount must be greater than 0'),
  body('isActive').optional().isBoolean()
];

const updateValidators = [
  body('code').optional().trim().notEmpty().withMessage('Coupon code cannot be empty').isLength({ max: 32 }),
  body('description').optional().isLength({ max: 200 }).withMessage('Description must be under 200 characters'),
  body('discountType').optional().isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').optional().isFloat({ gt: 0 }).withMessage('Discount value must be greater than 0'),
  body('minPurchase').optional().isFloat({ min: 0 }).withMessage('Minimum purchase must be 0 or more'),
  body('maxDiscount').optional().isFloat({ gt: 0 }).withMessage('Maximum discount must be greater than 0'),
  body('validFrom').optional().isISO8601().withMessage('Valid from must be a valid date'),
  body('validUntil').optional().isISO8601().withMessage('Valid until must be a valid date'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
  body('applicableStates').optional().isArray().withMessage('Applicable states must be an array'),
  body('applicableStates.*').optional().isString().isLength({ min: 2, max: 2 }).withMessage('State codes must be 2 letters'),
  body('applicableAppointmentTypes').optional().isArray().withMessage('Applicable appointment types must be an array'),
  body('applicableAppointmentTypes.*').optional().isMongoId().withMessage('Appointment type id is invalid'),
  body('appointmentTypeOverrides').optional().isArray().withMessage('Appointment type overrides must be an array'),
  body('appointmentTypeOverrides.*.appointmentType')
    .notEmpty().withMessage('Override appointment type is required')
    .bail()
    .isMongoId().withMessage('Override appointment type id is invalid'),
  body('appointmentTypeOverrides.*.discountType')
    .notEmpty().withMessage('Override discount type is required')
    .bail()
    .isIn(['percentage', 'fixed']).withMessage('Override discount type must be percentage or fixed'),
  body('appointmentTypeOverrides.*.discountValue')
    .notEmpty().withMessage('Override discount value is required')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Override discount value must be greater than 0'),
  body('appointmentTypeOverrides.*.maxDiscount')
    .optional({ checkFalsy: true, nullable: true })
    .isFloat({ gt: 0 }).withMessage('Override max discount must be greater than 0'),
  body('isActive').optional().isBoolean()
];

const formatCoupon = (coupon, usage = {}) => ({
  ...coupon.toObject({ versionKey: false }),
  redemptionCount: usage.count || 0,
  lastRedeemedAt: usage.lastRedeemedAt || null,
  totalSavings: usage.totalSavings || 0
});

const buildUsageMap = async (coupons) => {
  if (!coupons.length) return {};

  const couponCodes = coupons.map((coupon) => coupon.code);
  const usage = await Appointment.aggregate([
    {
      $match: {
        couponCode: { $in: couponCodes }
      }
    },
    {
      $group: {
        _id: '$couponCode',
        count: { $sum: 1 },
        lastRedeemedAt: { $max: '$createdAt' },
        totalSavings: { $sum: { $ifNull: ['$couponDiscountAmount', 0] } }
      }
    }
  ]);

  return usage.reduce((acc, entry) => {
    if (!entry._id) return acc;
    acc[entry._id] = {
      count: entry.count,
      lastRedeemedAt: entry.lastRedeemedAt,
      totalSavings: entry.totalSavings || 0
    };
    return acc;
  }, {});
};

const buildFilter = (query) => {
  const filter = {};
  if (query.status === 'active') {
    filter.isActive = true;
  } else if (query.status === 'inactive') {
    filter.isActive = false;
  }

  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [{ code: regex }, { description: regex }];
  }

  return filter;
};

const parseDates = ({ validFrom, validUntil }) => {
  const from = new Date(validFrom);
  const until = new Date(validUntil);

  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
    throw new Error('Invalid coupon dates');
  }

  if (from > until) {
    throw new Error('Valid from date must be before valid until date');
  }

  return { from, until };
};

const normalizeStates = (states = []) => {
  if (!Array.isArray(states)) return [];
  const normalized = states
    .map((state) => normalizeState(state))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const normalizeAppointmentTypes = (typeIds = []) => {
  if (!Array.isArray(typeIds)) return [];
  const normalized = typeIds
    .map((id) => {
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object' && id._id) return id._id.toString();
      return null;
    })
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

  return Array.from(new Set(normalized));
};

const normalizeAppointmentTypeOverrides = (overrides = []) => {
  if (!Array.isArray(overrides)) return [];

  const map = new Map();
  overrides.forEach((entry) => {
    if (!entry || !entry.appointmentType) return;

    let typeId = entry.appointmentType;
    if (typeof typeId === 'object' && typeId !== null) {
      if (typeId._id) {
        typeId = typeId._id.toString();
      } else if (typeof typeId.toString === 'function') {
        typeId = typeId.toString();
      }
    }

    if (typeof typeId !== 'string' || !mongoose.Types.ObjectId.isValid(typeId)) {
      return;
    }

    const normalized = {
      appointmentType: typeId,
      discountType: entry.discountType,
      discountValue: Number(entry.discountValue)
    };

    if (entry.maxDiscount !== undefined && entry.maxDiscount !== null && entry.maxDiscount !== '') {
      normalized.maxDiscount = Number(entry.maxDiscount);
    }

    map.set(typeId, normalized);
  });

  return Array.from(map.values());
};

const validatePercentageCap = (discountType, discountValue, contextLabel = 'Percentage discount') => {
  if (discountType === 'percentage' && Number(discountValue) > 100) {
    throw new Error(`${contextLabel} cannot exceed 100%`);
  }
};

// @route   GET /api/coupons
// @desc    List coupons (admin)
// @access  Private (Admin)
router.get('/', [auth, authorize('admin')], async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .populate('applicableAppointmentTypes', 'name price duration')
      .populate('appointmentTypeOverrides.appointmentType', 'name price duration');
    const usageMap = await buildUsageMap(coupons);
    res.json({ coupons: coupons.map((coupon) => formatCoupon(coupon, usageMap[coupon.code])) });
  } catch (error) {
    console.error('List coupons error:', error);
    res.status(500).json({ message: 'Failed to fetch coupons', error: error.message });
  }
});

// @route   POST /api/coupons
// @desc    Create coupon (admin)
// @access  Private (Admin)
router.post('/', [auth, authorize('admin'), ...createValidators], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit,
      applicableStates = [],
      applicableAppointmentTypes = [],
      appointmentTypeOverrides = [],
      isActive = true
    } = req.body;

    if (discountType === 'percentage' && Number(discountValue) > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%' });
    }

    const normalizedOverrides = normalizeAppointmentTypeOverrides(appointmentTypeOverrides);
    try {
      normalizedOverrides.forEach((override) => {
        validatePercentageCap(override.discountType, override.discountValue, 'Override percentage discount');
      });
    } catch (overrideError) {
      return res.status(400).json({ message: overrideError.message });
    }

    const normalizedCode = normalizeCode(code);
    const existingCoupon = await Coupon.findOne({ code: normalizedCode });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    let dateRange;
    try {
      dateRange = parseDates({ validFrom, validUntil });
    } catch (dateError) {
      return res.status(400).json({ message: dateError.message });
    }

    const coupon = new Coupon({
      code: normalizedCode,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      validFrom: dateRange.from,
      validUntil: dateRange.until,
      usageLimit,
      applicableStates: normalizeStates(applicableStates),
      applicableAppointmentTypes: normalizeAppointmentTypes(applicableAppointmentTypes),
      appointmentTypeOverrides: normalizedOverrides,
      isActive
    });

    await coupon.save();
    await coupon
      .populate('applicableAppointmentTypes', 'name price duration')
      .populate('appointmentTypeOverrides.appointmentType', 'name price duration');

    const usageMap = await buildUsageMap([coupon]);
    res.status(201).json({
      message: 'Coupon created',
      coupon: formatCoupon(coupon, usageMap[coupon.code])
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ message: 'Failed to create coupon', error: error.message });
  }
});

// @route   PUT /api/coupons/:id
// @desc    Update coupon (admin)
// @access  Private (Admin)
router.put('/:id', [auth, authorize('admin'), ...updateValidators], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const updates = { ...req.body };
    ['usedCount', 'createdAt', 'updatedAt'].forEach((key) => delete updates[key]);

    if (updates.code) {
      const normalizedCode = normalizeCode(updates.code);
      const duplicate = await Coupon.findOne({ code: normalizedCode, _id: { $ne: coupon._id } });
      if (duplicate) {
        return res.status(400).json({ message: 'Another coupon already uses this code' });
      }
      updates.code = normalizedCode;
    }

    const nextDiscountType = updates.discountType || coupon.discountType;
    const nextDiscountValue = updates.discountValue ?? coupon.discountValue;
    if (nextDiscountType === 'percentage' && Number(nextDiscountValue) > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%' });
    }

    if (updates.validFrom || updates.validUntil) {
      let dateRange;
      try {
        dateRange = parseDates({
          validFrom: updates.validFrom || coupon.validFrom,
          validUntil: updates.validUntil || coupon.validUntil
        });
      } catch (dateError) {
        return res.status(400).json({ message: dateError.message });
      }
      updates.validFrom = dateRange.from;
      updates.validUntil = dateRange.until;
    }

    if (updates.applicableStates) {
      updates.applicableStates = normalizeStates(updates.applicableStates);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'applicableAppointmentTypes')) {
      updates.applicableAppointmentTypes = normalizeAppointmentTypes(updates.applicableAppointmentTypes);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'appointmentTypeOverrides')) {
      const normalizedOverrides = normalizeAppointmentTypeOverrides(updates.appointmentTypeOverrides);
      try {
        normalizedOverrides.forEach((override) => {
          validatePercentageCap(override.discountType, override.discountValue, 'Override percentage discount');
        });
      } catch (overrideError) {
        return res.status(400).json({ message: overrideError.message });
      }
      updates.appointmentTypeOverrides = normalizedOverrides;
    }

    Object.assign(coupon, updates);
    await coupon.save();
    await coupon
      .populate('applicableAppointmentTypes', 'name price duration')
      .populate('appointmentTypeOverrides.appointmentType', 'name price duration');

    const usageMap = await buildUsageMap([coupon]);
    res.json({
      message: 'Coupon updated',
      coupon: formatCoupon(coupon, usageMap[coupon.code])
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ message: 'Failed to update coupon', error: error.message });
  }
});

// @route   GET /api/coupons/:id/redemptions
// @desc    List coupon redemptions with patient details
// @access  Private (Admin)
router.get('/:id/redemptions', [auth, authorize('admin')], async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const couponCode = (coupon.code || '').toUpperCase();
    const match = { couponCode };

    const [appointments, totalItems, aggregateTotals] = await Promise.all([
      Appointment.find(match)
        .populate('patient_id', 'name firstName lastName email phone')
        .populate('appointmentType', 'name price duration cardValidityMonths')
        .populate('payment_id', 'amount status transactionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(match),
      Appointment.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSavings: { $sum: { $ifNull: ['$couponDiscountAmount', 0] } },
            totalAdjusted: { $sum: { $ifNull: ['$adjustedAmount', 0] } }
          }
        }
      ])
    ]);

    const aggregate = aggregateTotals[0] || { totalSavings: 0, totalAdjusted: 0 };
    const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

    const redemptions = appointments.map((appointment) => {
      const patient = appointment.patient_id;
      const service = appointment.appointmentType;
      const discountAmount = toNumber(appointment.couponDiscountAmount) || 0;
      const adjustedAmount = toNumber(appointment.adjustedAmount)
        ?? toNumber(appointment.payment_id?.amount)
        ?? toNumber(service?.price)
        ?? 0;
      const fallbackBase = toNumber(service?.price)
        ?? (discountAmount === 0 ? toNumber(appointment.payment_id?.amount) : null)
        ?? toNumber(appointment.amount)
        ?? adjustedAmount;
      const originalAmount = discountAmount > 0
        ? (adjustedAmount || 0) + discountAmount
        : (fallbackBase ?? adjustedAmount ?? 0);
      const patientName = patient?.name
        || [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim()
        || 'Patient';

      return {
        appointmentId: appointment._id,
        patient: {
          id: patient?._id,
          name: patientName,
          email: patient?.email || null,
          phone: patient?.phone || null
        },
        state: appointment.state,
        serviceName: typeof service === 'object' ? service?.name : '',
        couponCode: appointment.couponCode,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        createdAt: appointment.createdAt,
        discountAmount,
        originalAmount,
        finalAmount: adjustedAmount,
        paymentStatus: appointment.payment_id?.status || null
      };
    });

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    res.json({
      coupon: {
        _id: coupon._id,
        code: couponCode,
        description: coupon.description
      },
      redemptions,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      totals: {
        totalSavings: aggregate.totalSavings || 0,
        totalAdjusted: aggregate.totalAdjusted || 0
      }
    });
  } catch (error) {
    console.error('Coupon redemptions error:', error);
    res.status(500).json({ message: 'Failed to fetch coupon redemptions', error: error.message });
  }
});

// @route   DELETE /api/coupons/:id
// @desc    Delete coupon (admin)
// @access  Private (Admin)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await coupon
      .populate('applicableAppointmentTypes', 'name price duration')
      .populate('appointmentTypeOverrides.appointmentType', 'name price duration');

    res.json({ message: 'Coupon deleted successfully', coupon: formatCoupon(coupon) });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ message: 'Failed to delete coupon', error: error.message });
  }
});

// @route   PUT /api/coupons/:id/toggle-active
// @desc    Toggle coupon active status (admin)
// @access  Private (Admin)
router.put('/:id/toggle-active', [auth, authorize('admin')], async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();
    await coupon
      .populate('applicableAppointmentTypes', 'name price duration')
      .populate('appointmentTypeOverrides.appointmentType', 'name price duration');

    res.json({
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon: formatCoupon(coupon)
    });
  } catch (error) {
    console.error('Toggle coupon error:', error);
    res.status(500).json({ message: 'Failed to toggle coupon status', error: error.message });
  }
});

module.exports = router;
