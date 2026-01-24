const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Appointment = require('../models/Appointment');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Private (Admin, Staff)
router.get('/', auth, authorize(1, 4), async (req, res) => {
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

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private (Admin, Staff)
router.get('/:id', auth, authorize(1, 4), async (req, res) => {
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
router.post('/', auth, authorize(1, 4), [
  body('appointment').notEmpty().withMessage('Appointment is required'),
  body('patient').notEmpty().withMessage('Patient is required'),
  body('title').notEmpty().withMessage('Title is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointment, patient, title, description, assignedTo, priority, dueDate } = req.body;

    // Verify appointment exists
    const appointmentExists = await Appointment.findById(appointment);
    if (!appointmentExists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const task = new Task({
      appointment,
      patient,
      title,
      description,
      assignedTo,
      priority,
      dueDate,
      createdBy: req.user._id
    });

    await task.save();

    // Add task reference to appointment
    appointmentExists.tasks.push(task._id);
    await appointmentExists.save();

    await task.populate('appointment patient assignedTo createdBy');

    res.status(201).json({ message: 'Task created', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Admin, Staff)
router.put('/:id', auth, authorize(1, 4), async (req, res) => {
  try {
    const { title, description, status, assignedTo, priority, dueDate } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = dueDate;
    task.updatedBy = req.user._id;

    await task.save();
    await task.populate('appointment patient assignedTo createdBy updatedBy');

    res.json({ message: 'Task updated', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Admin, Staff)
router.delete('/:id', auth, authorize(1, 4), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Remove task reference from appointment
    await Appointment.updateOne(
      { _id: task.appointment },
      { $pull: { tasks: task._id } }
    );

    await task.deleteOne();

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
