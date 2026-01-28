const express = require('express');
const bcryptjs = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Payment = require('../models/Payment');
const State = require('../models/State');
const Staff = require('../models/Staff');

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

// @route   GET /api/admin/staff
// @desc    Get all staff members (Admin only)
// @access  Private (Admin)
router.get('/staff', async (req, res) => {
  try {
    const staff = await Staff.find()
      .populate('user_id', 'name email phone status')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/admin/staff
// @desc    Create a new staff member (Admin only)
// @access  Private (Admin)
router.post('/staff', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, password, status, department, designation, permissions, notes } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff already exists with this email' });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Create new user account for staff
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role_id: 4, // Staff role
      status: status || 'active',
      emailVerified: true // Staff accounts are pre-verified by admin
    });

    await user.save();

    // Create staff record
    const staff = new Staff({
      user_id: user._id,
      name,
      email,
      phone,
      department: department || 'Support',
      designation: designation || 'Staff Member',
      permissions: permissions || {},
      status: status || 'active',
      notes,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await staff.save();

    // Populate user data
    await staff.populate('user_id', 'name email phone status');

    res.status(201).json({
      message: 'Staff member created successfully',
      staff
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/admin/staff/:id
// @desc    Update staff member (Admin only)
// @access  Private (Admin)
router.put('/staff/:id', async (req, res) => {
  try {
    const { name, email, phone, password, status, department, designation, permissions, notes } = req.body;
    
    // Find staff record
    const staff = await Staff.findById(req.params.id);
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Find associated user
    const user = await User.findById(staff.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Associated user not found' });
    }

    // Update user fields
    if (name) {
      user.name = name;
      staff.name = name;
    }
    if (email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      const existingStaff = await Staff.findOne({ email, _id: { $ne: staff._id } });
      if (existingUser || existingStaff) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
      staff.email = email;
    }
    if (phone) {
      user.phone = phone;
      staff.phone = phone;
    }
    if (status) {
      user.status = status;
      staff.status = status;
    }
    
    // Update password if provided
    if (password) {
      const salt = await bcryptjs.genSalt(10);
      user.password = await bcryptjs.hash(password, salt);
    }

    // Update staff-specific fields
    if (department) staff.department = department;
    if (designation) staff.designation = designation;
    if (permissions) staff.permissions = { ...staff.permissions, ...permissions };
    if (notes !== undefined) staff.notes = notes;
    
    staff.updatedBy = req.user._id;
    user.updatedAt = Date.now();

    // Save both records
    await user.save();
    await staff.save();

    // Populate and return
    await staff.populate('user_id', 'name email phone status');

    res.json({
      message: 'Staff member updated successfully',
      staff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/admin/staff/:id
// @desc    Delete staff member (Admin only)
// @access  Private (Admin)
router.delete('/staff/:id', async (req, res) => {
  try {
    // Find staff record
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === staff.user_id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Delete staff record
    await Staff.findByIdAndDelete(req.params.id);
    
    // Also delete associated user account
    await User.findByIdAndDelete(staff.user_id);

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
