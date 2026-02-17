const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const { sendTaskAssignedNotification, sendTaskCompletedNotification } = require('../utils/notifications');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Private (Admin, Staff)
router.get('/', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { status, assignedTo, appointment } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (appointment) filter.appointment = appointment;

    const tasks = await Task.find(filter)
      .populate('appointment patient assignedTo createdBy')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/appointments/:appointmentId/tasks
// @desc    Get tasks for specific appointment
// @access  Private (Admin, Staff)
router.get('/appointment/:appointmentId', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const tasks = await Task.find({ appointment: appointmentId })
      .populate('patient assignedTo createdBy updatedBy')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('Get appointment tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private (Admin, Staff)
router.get('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('appointment patient assignedTo createdBy updatedBy');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private (Admin, Staff)
router.post('/', auth, authorize('admin', 'staff'), [
  body('appointment').notEmpty().withMessage('Appointment is required'),
  body('title').notEmpty().withMessage('Title is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointment, patient, title, description, assignedTo, priority } = req.body;

    console.log('Creating task with:', { title, assignedTo, appointment });

    // Verify appointment exists
    const appointmentExists = await Appointment.findById(appointment);
    if (!appointmentExists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Use provided patient or extract from appointment
    const patientId = patient || appointmentExists.patient_id;
    if (!patientId) {
      return res.status(400).json({ message: 'Patient not found in appointment' });
    }

    const task = new Task({
      appointment,
      patient: patientId,
      title,
      description,
      assignedTo,
      priority,
      createdBy: req.user._id
    });

    await task.save();
    console.log('Task saved with ID:', task._id, 'Assigned to:', assignedTo);

    // Add task reference to appointment
    appointmentExists.tasks.push(task._id);
    await appointmentExists.save();

    await task.populate('appointment patient assignedTo createdBy');

    // Send notification to assigned staff
    if (assignedTo) {
      console.log('Assignment detected, sending notification to:', assignedTo);
      try {
        await sendTaskAssignedNotification({
          taskInput: task,
          assignedStaffId: assignedTo,
          createdByName: req.user.name || req.user.email || ''
        });
        console.log('Task notification sent successfully');
      } catch (notificationError) {
        console.error('Error sending task notification:', notificationError);
      }
    } else {
      console.log('No assignedTo specified, skipping notification');
    }

    res.status(201).json({ message: 'Task created', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { title, description, status, assignedTo, priority } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const previousStatus = task.status;
    const previousAssignedTo = task.assignedTo;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (priority) task.priority = priority;
    task.updatedBy = req.user._id;

    await task.save();
    await task.populate('appointment patient assignedTo createdBy updatedBy');

    // Send notification if task marked as completed
    if (previousStatus !== 'completed' && status === 'completed') {
      await sendTaskCompletedNotification({
        taskInput: task,
        createdByAdminId: task.createdBy._id,
        completedByName: req.user.name || req.user.email || ''
      });
    }

    // Send notification if task newly assigned to staff
    if (assignedTo && (!previousAssignedTo || previousAssignedTo.toString() !== assignedTo.toString())) {
      await sendTaskAssignedNotification({
        taskInput: task,
        assignedStaffId: assignedTo,
        createdByName: req.user.name || req.user.email || ''
      });
    }

    res.json({ message: 'Task updated', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Admin, Staff)
router.delete('/:id', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // If current user is the creator (assignedBy), allow hard delete
    if (task.createdBy && task.createdBy.toString() === req.user._id.toString()) {
      await Appointment.updateOne(
        { _id: task.appointment },
        { $pull: { tasks: task._id } }
      );
      await task.deleteOne();
      return res.json({ message: 'Task permanently deleted' });
    }

    // If current user is the assignee, only allow soft delete
    if (task.assignedTo && task.assignedTo.toString() === req.user._id.toString()) {
      if (!task.deleted) {
        task.deleted = true;
        await task.save();
      }
      return res.json({ message: 'Task soft deleted (hidden for assignee)' });
    }

    // Otherwise, deny
    return res.status(403).json({ message: 'You do not have permission to delete this task.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/tasks/test/send-notification
// @desc    Test task notification (Debug only)
// @access  Private (Admin, Staff)
router.post('/test/send-notification', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { staffId } = req.body;
    
    if (!staffId) {
      return res.status(400).json({ message: 'staffId is required' });
    }

    console.log('TEST: Sending task notification to staff:', staffId);
    
    // Verify staff exists
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found', staffId });
    }
    
    console.log('Staff found:', staff.email, 'role_id:', staff.role_id);

    // Create a test notification
    const testNotification = await Notification.create({
      user_id: staffId,
      type: 'task',
      title: 'Test Task Notification',
      message: 'This is a test notification from admin',
      related_id: staffId
    });

    console.log('Test notification created:', testNotification._id);

    res.json({ 
      message: 'Test notification created successfully', 
      staffId,
      staffEmail: staff.email,
      notification: testNotification
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/tasks/test/staff-list
// @desc    Get all staff members (Debug only)
// @access  Private (Admin, Staff)
router.get('/test/staff-list', auth, authorize('admin', 'staff'), async (req, res) => {
  try {
    const staff = await User.find({ role_id: 4 }).select('_id email name firstName lastName role_id createdAt');
    res.json({ 
      staffCount: staff.length,
      staff: staff.map(s => ({
        _id: s._id,
        email: s.email,
        name: s.name,
        role_id: s.role_id
      }))
    });
  } catch (error) {
    console.error('Staff list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
