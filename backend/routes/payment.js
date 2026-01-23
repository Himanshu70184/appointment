const express = require('express');
const { auth } = require('../middleware/auth');
const Payment = require('../models/Payment');

const router = express.Router();

// @route   GET /api/payment/:id
// @desc    Get payment details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user_id', 'name email')
      .populate('appointment_id');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Users can only view their own payments unless admin/staff
    if (
      req.user.role_id !== 1 &&
      req.user.role_id !== 4 &&
      payment.user_id._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
