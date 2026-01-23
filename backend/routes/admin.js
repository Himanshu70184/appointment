const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Payment = require('../models/Payment');

const router = express.Router();

// All routes require admin access
router.use(auth);
router.use(authorize('admin'));

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Calculate start of week without mutating now
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const startOfWeek = weekStart;
    
    // Calculate start of day without mutating now
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const startOfDay = dayStart;

    const [
      totalAppointments,
      monthlyAppointments,
      weeklyAppointments,
      dailyAppointments,
      totalUsers,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      Appointment.countDocuments(),
      Appointment.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Appointment.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Appointment.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      stats: {
        appointments: {
          total: totalAppointments,
          monthly: monthlyAppointments,
          weekly: weeklyAppointments,
          daily: dailyAppointments,
        },
        users: {
          total: totalUsers,
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          monthly: monthlyRevenue[0]?.total || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/admin/appointments
// @desc    Get all appointments with filters
// @access  Private (Admin)
router.get('/appointments', async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(query)
      .populate('patient_id', 'name email phone prn')
      .populate('doctor_id', 'name email')
      .populate('medicalCardType')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
