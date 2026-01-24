const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Payment = require('../models/Payment');
const State = require('../models/State');

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

// @route   GET /api/admin/dashboard
// @desc    Get comprehensive dashboard data with analytics
// @access  Private (Admin only, not Staff)
router.get('/dashboard', async (req, res) => {
  try {
    // Only admin can see revenue
    const isAdmin = req.user.role_id === 1;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get appointment counts by status
    const statusCounts = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const appointmentStats = {
      total: 0,
      scheduled: 0,
      approval: 0,
      rescheduled: 0,
      cancelled: 0,
      completed: 0,
      pending: 0,
      'on-hold': 0
    };

    statusCounts.forEach(item => {
      appointmentStats[item._id] = item.count;
      appointmentStats.total += item.count;
    });

    // Get monthly appointments data for chart
    const monthlyData = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } // This year
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyAppointments = Array(12).fill(0);
    monthlyData.forEach(item => {
      monthlyAppointments[item._id - 1] = item.count;
    });

    let revenueData = null;
    if (isAdmin) {
      // Get revenue data by state
      const revenueByState = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointment_id',
            foreignField: '_id',
            as: 'appointment'
          }
        },
        { $unwind: '$appointment' },
        {
          $group: {
            _id: '$appointment.state',
            total: { $sum: '$amount' }
          }
        }
      ]);

      // Get monthly revenue for graph
      const monthlyRevenue = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: new Date(now.getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const monthlyRevenueData = Array(12).fill(0);
      monthlyRevenue.forEach(item => {
        monthlyRevenueData[item._id - 1] = item.total;
      });

      const totalRevenue = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      revenueData = {
        total: totalRevenue[0]?.total || 0,
        byState: revenueByState,
        monthly: monthlyRevenueData
      };
    }

    res.json({
      appointmentStats,
      monthlyAppointments,
      revenue: revenueData
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
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
