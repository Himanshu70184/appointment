const Coupon = require('../models/Coupon');

class CouponValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CouponValidationError';
    this.statusCode = statusCode;
  }
}

const normalizeCode = (code) => (code || '').trim().toUpperCase();

const normalizeState = (state) => (state || '').trim().toUpperCase();

const ensureAmount = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new CouponValidationError('Amount must be greater than 0');
  }
  return numericAmount;
};

const ensureDateOrder = (validFrom, validUntil) => {
  if (validFrom && validUntil && validFrom > validUntil) {
    throw new CouponValidationError('Coupon start date must be before the expiration date');
  }
};

const validateCouponDocument = (coupon, amount, stateCode, appointmentTypeId) => {
  if (!coupon) {
    throw new CouponValidationError('Invalid coupon code', 404);
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    throw new CouponValidationError('Coupon is not active yet');
  }

  if (coupon.validUntil && now > coupon.validUntil) {
    throw new CouponValidationError('Coupon has expired');
  }

  if (typeof coupon.usageLimit === 'number' && coupon.usageLimit > 0) {
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new CouponValidationError('Coupon usage limit exceeded');
    }
  }

  if (typeof coupon.minPurchase === 'number' && coupon.minPurchase > 0) {
    if (amount < coupon.minPurchase) {
      throw new CouponValidationError(`Minimum purchase of $${coupon.minPurchase.toFixed(2)} required`);
    }
  }

  if (Array.isArray(coupon.applicableStates) && coupon.applicableStates.length > 0) {
    if (!stateCode) {
      throw new CouponValidationError('Select a state before applying this coupon');
    }

    const normalizedState = normalizeState(stateCode);
    const stateMatch = coupon.applicableStates.some(
      (state) => normalizeState(state) === normalizedState
    );

    if (!stateMatch) {
      throw new CouponValidationError(`Coupon is not valid in ${normalizedState}`);
    }
  }

  if (
    Array.isArray(coupon.applicableAppointmentTypes) &&
    coupon.applicableAppointmentTypes.length > 0
  ) {
    if (!appointmentTypeId) {
      throw new CouponValidationError('Select a card type before applying this coupon');
    }

    const selectedId = appointmentTypeId.toString();
    const typeMatch = coupon.applicableAppointmentTypes.some((type) => {
      if (!type) return false;
      if (typeof type === 'string') return type === selectedId;
      if (type._id) return type._id.toString() === selectedId;
      if (type.toString) return type.toString() === selectedId;
      return false;
    });

    if (!typeMatch) {
      throw new CouponValidationError('Coupon is not valid for this appointment type');
    }
  }
};

const matchAppointmentTypeId = (candidate, targetId) => {
  if (!candidate || !targetId) return false;
  const normalizedTarget = targetId.toString();
  if (typeof candidate === 'string') return candidate === normalizedTarget;
  if (candidate._id) return candidate._id.toString() === normalizedTarget;
  if (typeof candidate.toString === 'function') {
    return candidate.toString() === normalizedTarget;
  }
  return false;
};

const resolveAppointmentTypeOverride = (coupon, appointmentTypeId) => {
  if (!appointmentTypeId) return null;
  if (!Array.isArray(coupon?.appointmentTypeOverrides)) return null;

  return coupon.appointmentTypeOverrides.find((entry) =>
    entry && matchAppointmentTypeId(entry.appointmentType, appointmentTypeId)
  ) || null;
};

const buildDiscountConfig = (coupon, appointmentTypeId) => {
  const baseConfig = {
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount
  };

  const override = resolveAppointmentTypeOverride(coupon, appointmentTypeId);
  if (!override) {
    return baseConfig;
  }

  return {
    discountType: override.discountType || baseConfig.discountType,
    discountValue:
      typeof override.discountValue === 'number'
        ? override.discountValue
        : baseConfig.discountValue,
    maxDiscount:
      typeof override.maxDiscount === 'number'
        ? override.maxDiscount
        : baseConfig.maxDiscount
  };
};

const calculateDiscount = (discountConfig, amount) => {
  let discountAmount = 0;
  const { discountType, discountValue, maxDiscount } = discountConfig;

  if (discountType === 'percentage') {
    discountAmount = amount * (discountValue / 100);
  } else {
    discountAmount = discountValue;
  }

  if (typeof maxDiscount === 'number' && maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    discountAmount = 0;
  }

  discountAmount = Math.min(discountAmount, amount);
  const finalAmount = Math.max(0, amount - discountAmount);

  return { discountAmount, finalAmount };
};

const validateAndCalculateCoupon = async ({ couponCode, amount, stateCode, appointmentTypeId }) => {
  const normalizedCode = normalizeCode(couponCode);
  if (!normalizedCode) {
    throw new CouponValidationError('Coupon code is required');
  }

  const numericAmount = ensureAmount(amount);

  const coupon = await Coupon.findOne({ code: normalizedCode, isActive: true });
  validateCouponDocument(coupon, numericAmount, stateCode, appointmentTypeId);
  ensureDateOrder(coupon.validFrom, coupon.validUntil);

  const discountConfig = buildDiscountConfig(coupon, appointmentTypeId);
  const { discountAmount, finalAmount } = calculateDiscount(discountConfig, numericAmount);

  return {
    coupon,
    discountAmount,
    finalAmount
  };
};

module.exports = {
  validateAndCalculateCoupon,
  CouponValidationError,
  normalizeCode,
  normalizeState,
  ensureAmount
};
