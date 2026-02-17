const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Task = require('../models/Task');

const formatDisplayName = (user) => {
  if (!user) return 'Patient';
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || 'Patient';
  }
  return user.name || 'Patient';
};

const formatScheduleWindow = (appointment) => {
  if (!appointment) {
    return { dateLabel: 'TBD', timeLabel: 'TBD' };
  }

  const dateValue = appointment.scheduledDate ? new Date(appointment.scheduledDate) : null;
  const dateLabel = dateValue
    ? dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'TBD';

  const timeLabel = appointment.scheduledTime
    ? appointment.scheduledTime
    : dateValue
      ? dateValue.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'TBD';

  return { dateLabel, timeLabel };
};

const resolveUserId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id;
  return value;
};

const formatReason = (value) => {
  if (!value) return 'No reason was provided.';
  const trimmed = `${value}`.trim();
  return trimmed.length ? trimmed : 'No reason was provided.';
};

const normalizeInitiatorRole = (role) => {
  switch (role) {
    case 'patient':
    case 'doctor':
    case 'admin':
    case 'staff':
      return role;
    case 1:
      return 'admin';
    case 2:
      return 'doctor';
    case 3:
      return 'patient';
    case 4:
      return 'staff';
    default:
      return 'system';
  }
};

const capitalize = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const sendAppointmentScheduledNotifications = async (appointmentInput) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment || appointment.status !== 'scheduled') {
      return;
    }

    const patientId = resolveUserId(appointment.patient_id);
    const doctorId = resolveUserId(appointment.doctor_id);
    const hasIntake = Boolean(appointment.intakeSubmitted || appointment.intakeForm);

    const [patientUser, doctorUser, adminStaffUsers] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      doctorId ? User.findById(doctorId).select('firstName lastName name role_id') : null,
      User.find({ role_id: { $in: [1, 4] } }).select('_id role_id firstName lastName name')
    ]);

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const patientName = formatDisplayName(patientUser);
    const doctorName = formatDisplayName(doctorUser);

    const notifications = [];

    if (patientUser && patientUser.role_id === 3) {
      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Appointment Scheduled',
        message: `You are confirmed for ${dateLabel} at ${timeLabel}.`,
        related_id: appointment._id
      });
    }

    if (adminStaffUsers && adminStaffUsers.length) {
      adminStaffUsers.forEach((user) => {
        notifications.push({
          user_id: user._id,
          type: 'appointment',
          title: 'New Appointment Scheduled',
          message: `${patientName} is scheduled for ${dateLabel} at ${timeLabel}${doctorId ? ` with ${doctorName}` : ''}.`,
          related_id: appointment._id
        });
      });
    }

    if (doctorUser && hasIntake) {
      notifications.push({
        user_id: doctorUser._id,
        type: 'appointment',
        title: 'New Appointment Assigned',
        message: `${patientName} is on your schedule for ${dateLabel} at ${timeLabel}. Intake is completed.`,
        related_id: appointment._id
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch scheduling notifications:', error);
  }
};

const sendAppointmentCancellationNotifications = async ({
  appointmentInput,
  initiatorRole = 'system',
  reason
} = {}) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment) {
      return;
    }

    const normalizedInitiator = normalizeInitiatorRole(initiatorRole);
    const patientId = resolveUserId(appointment.patient_id);
    const doctorId = resolveUserId(appointment.doctor_id);

    const [patientUser, doctorUser, adminStaffUsers] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      doctorId ? User.findById(doctorId).select('firstName lastName name role_id') : null,
      User.find({ role_id: { $in: [1, 4] } }).select('_id role_id firstName lastName name')
    ]);

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const patientName = formatDisplayName(patientUser);
    const reasonText = formatReason(reason || appointment.cancelReason);
    const initiatorLabel = capitalize(normalizedInitiator);

    const notifications = [];

    if (patientUser) {
      const patientMessage = normalizedInitiator === 'patient'
        ? `You cancelled your appointment scheduled for ${dateLabel} at ${timeLabel}. Reason: ${reasonText}`
        : `Your appointment scheduled for ${dateLabel} at ${timeLabel} was cancelled by ${initiatorLabel}. Reason: ${reasonText}`;

      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Appointment Cancelled',
        message: patientMessage,
        related_id: appointment._id
      });
    }

    if (doctorUser) {
      const doctorMessage = normalizedInitiator === 'patient'
        ? `${patientName} cancelled their appointment scheduled for ${dateLabel} at ${timeLabel}. Reason: ${reasonText}`
        : `${patientName}'s appointment scheduled for ${dateLabel} at ${timeLabel} was cancelled by ${initiatorLabel}. Reason: ${reasonText}`;

      notifications.push({
        user_id: doctorUser._id,
        type: 'appointment',
        title: 'Appointment Cancelled',
        message: doctorMessage,
        related_id: appointment._id
      });
    }

    if (adminStaffUsers && adminStaffUsers.length) {
      adminStaffUsers.forEach((user) => {
        const adminMessage = normalizedInitiator === 'patient'
          ? `${patientName} cancelled their appointment scheduled for ${dateLabel} at ${timeLabel}. Reason: ${reasonText}`
          : `${initiatorLabel} cancelled ${patientName}'s appointment scheduled for ${dateLabel} at ${timeLabel}. Reason: ${reasonText}`;

        notifications.push({
          user_id: user._id,
          type: 'appointment',
          title: 'Appointment Cancelled',
          message: adminMessage,
          related_id: appointment._id
        });
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch cancellation notifications:', error);
  }
};

const sendPendingIntakeNotifications = async ({ appointmentInput } = {}) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment) {
      return;
    }

    if (!appointment.paymentCompleted || appointment.intakeSubmitted) {
      return;
    }

    const patientId = resolveUserId(appointment.patient_id);
    const doctorId = resolveUserId(appointment.doctor_id);

    const [patientUser, doctorUser] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      doctorId ? User.findById(doctorId).select('firstName lastName name role_id') : null
    ]);

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const patientName = formatDisplayName(patientUser);

    const notifications = [];

    if (patientUser) {
      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Complete Intake Form',
        message: `Payment received for ${dateLabel} at ${timeLabel}. Complete your intake form to keep the booking moving.`,
        related_id: appointment._id
      });
    }

    if (doctorUser) {
      notifications.push({
        user_id: doctorUser._id,
        type: 'appointment',
        title: 'Pending Intake',
        message: `${patientName} has a booking for ${dateLabel} at ${timeLabel} with intake still pending.`,
        related_id: appointment._id
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch pending intake notifications:', error);
  }
};

const sendAdminApprovalRequiredNotifications = async ({ appointmentInput } = {}) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment) {
      return;
    }

    const patientId = resolveUserId(appointment.patient_id);

    const [patientUser, adminStaffUsers] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      User.find({ role_id: { $in: [1, 4] } }).select('_id role_id firstName lastName name')
    ]);

    if (!patientUser && (!adminStaffUsers || !adminStaffUsers.length)) {
      return;
    }

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const patientName = formatDisplayName(patientUser);

    const notifications = [];

    if (patientUser) {
      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Awaiting Admin Approval',
        message: `Your appointment for ${dateLabel} at ${timeLabel} needs admin approval before it can be scheduled. We'll notify you once it's approved.`,
        related_id: appointment._id
      });
    }

    if (adminStaffUsers && adminStaffUsers.length) {
      adminStaffUsers.forEach((user) => {
        notifications.push({
          user_id: user._id,
          type: 'appointment',
          title: 'Approval Required',
          message: `${patientName}'s appointment for ${dateLabel} at ${timeLabel} requires admin approval before scheduling.`,
          related_id: appointment._id
        });
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch admin approval notifications:', error);
  }
};

const sendAppointmentCompletedNotifications = async ({
  appointmentInput,
  completedByRole = 'system',
  completedByName
} = {}) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment) {
      return;
    }

    const normalizedRole = normalizeInitiatorRole(completedByRole);
    const patientId = resolveUserId(appointment.patient_id);
    const doctorId = resolveUserId(appointment.doctor_id);

    const [patientUser, doctorUser, adminStaffUsers] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      doctorId ? User.findById(doctorId).select('firstName lastName name role_id') : null,
      User.find({ role_id: { $in: [1, 4] } }).select('_id role_id firstName lastName name')
    ]);

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const patientName = formatDisplayName(patientUser);
    const doctorName = formatDisplayName(doctorUser);
    const doctorSegment = doctorUser ? ` with ${doctorName}` : '';
    const actorLabelInput = completedByName && completedByName.trim().length ? completedByName.trim() : '';
    const roleLabel = normalizedRole !== 'system' ? capitalize(normalizedRole) : '';
    const actorLabel = actorLabelInput || roleLabel;
    const confirmationSuffix = actorLabel ? ` Confirmed by ${actorLabel}.` : '';

    const notifications = [];

    if (patientUser) {
      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Appointment Completed',
        message: `Your appointment on ${dateLabel} at ${timeLabel}${doctorSegment} has been completed.${confirmationSuffix}`.trim(),
        related_id: appointment._id
      });
    }

    if (doctorUser) {
      notifications.push({
        user_id: doctorUser._id,
        type: 'appointment',
        title: 'Appointment Completed',
        message: `${patientName}'s appointment on ${dateLabel} at ${timeLabel} has been completed.${confirmationSuffix}`.trim(),
        related_id: appointment._id
      });
    }

    if (adminStaffUsers && adminStaffUsers.length) {
      adminStaffUsers.forEach((user) => {
        notifications.push({
          user_id: user._id,
          type: 'appointment',
          title: 'Appointment Completed',
          message: `${patientName}'s appointment on ${dateLabel} at ${timeLabel} has been completed.${confirmationSuffix}`.trim(),
          related_id: appointment._id
        });
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch completion notifications:', error);
  }
};

const sendAppointmentRescheduleNotifications = async ({
  appointmentInput,
  previousDate,
  previousTime,
  previousDoctorId,
  rescheduleByRole = 'system',
  rescheduleByName
} = {}) => {
  try {
    const appointment =
      typeof appointmentInput === 'object' && appointmentInput !== null
        ? appointmentInput
        : await Appointment.findById(appointmentInput);

    if (!appointment) {
      return;
    }

    const patientId = resolveUserId(appointment.patient_id);
    const doctorId = resolveUserId(appointment.doctor_id);
    const normalizedRole = normalizeInitiatorRole(rescheduleByRole);

    const [patientUser, doctorUser, previousDoctorUser, adminStaffUsers] = await Promise.all([
      patientId ? User.findById(patientId).select('firstName lastName name role_id') : null,
      doctorId ? User.findById(doctorId).select('firstName lastName name role_id') : null,
      previousDoctorId ? User.findById(previousDoctorId).select('firstName lastName name role_id') : null,
      User.find({ role_id: { $in: [1, 4] } }).select('_id role_id firstName lastName name')
    ]);

    const { dateLabel, timeLabel } = formatScheduleWindow(appointment);
    const previousDateLabel = previousDate ? new Date(previousDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
    const previousTimeLabel = previousTime || 'TBD';
    const patientName = formatDisplayName(patientUser);
    const doctorName = formatDisplayName(doctorUser);
    const actorLabelInput = rescheduleByName && rescheduleByName.trim().length ? rescheduleByName.trim() : '';
    const roleLabel = normalizedRole !== 'system' ? capitalize(normalizedRole) : '';
    const actorLabel = actorLabelInput || roleLabel;
    const actorSegment = actorLabel ? ` by ${actorLabel}` : '';

    const notifications = [];

    const isDoctorChanged = previousDoctorId && doctorId && previousDoctorId.toString() !== doctorId.toString();

    // Patient always gets reschedule notification
    if (patientUser) {
      notifications.push({
        user_id: patientUser._id,
        type: 'appointment',
        title: 'Appointment Rescheduled',
        message: `Your appointment has been rescheduled from ${previousDateLabel} at ${previousTimeLabel} to ${dateLabel} at ${timeLabel}${actorSegment}.`,
        related_id: appointment._id
      });
    }

    // If doctor changed to a different doctor
    if (isDoctorChanged) {
      // Old doctor gets cancellation notification
      if (previousDoctorUser) {
        notifications.push({
          user_id: previousDoctorUser._id,
          type: 'appointment',
          title: 'Appointment Cancelled',
          message: `${patientName}'s appointment scheduled for ${previousDateLabel} at ${previousTimeLabel} has been cancelled.`,
          related_id: appointment._id
        });
      }

      // New doctor gets scheduled notification
      if (doctorUser) {
        notifications.push({
          user_id: doctorUser._id,
          type: 'appointment',
          title: 'New Appointment Assigned',
          message: `${patientName} is on your schedule for ${dateLabel} at ${timeLabel}.`,
          related_id: appointment._id
        });
      }
    } else if (doctorUser && doctorId) {
      // Same doctor - gets reschedule notification
      notifications.push({
        user_id: doctorUser._id,
        type: 'appointment',
        title: 'Appointment Rescheduled',
        message: `${patientName}'s appointment has been rescheduled from ${previousDateLabel} at ${previousTimeLabel} to ${dateLabel} at ${timeLabel}${actorSegment}.`,
        related_id: appointment._id
      });
    }

    // Admin/Staff always get reschedule notification
    if (adminStaffUsers && adminStaffUsers.length) {
      adminStaffUsers.forEach((user) => {
        notifications.push({
          user_id: user._id,
          type: 'appointment',
          title: 'Appointment Rescheduled',
          message: `${patientName}'s appointment has been rescheduled from ${previousDateLabel} at ${previousTimeLabel} to ${dateLabel} at ${timeLabel}${actorSegment}.`,
          related_id: appointment._id
        });
      });
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Failed to dispatch reschedule notifications:', error);
  }
};

const sendTaskAssignedNotification = async ({
  taskInput,
  assignedStaffId,
  createdByName
} = {}) => {
  try {
    console.log('sendTaskAssignedNotification called with:', { assignedStaffId, taskInput: taskInput?._id || taskInput });
    
    const task =
      typeof taskInput === 'object' && taskInput !== null
        ? taskInput
        : await Task.findById(taskInput);

    if (!task) {
      console.log('Task not found for notification');
      return;
    }

    if (!assignedStaffId) {
      console.log('No assignedStaffId provided for task notification');
      return;
    }

    const staff = await User.findById(assignedStaffId).select('firstName lastName name role_id email');
    if (!staff) {
      console.log('Staff member not found for ID:', assignedStaffId);
      return;
    }

    const taskCreatorName = createdByName && createdByName.trim().length ? createdByName.trim() : 'Admin';

    console.log('Creating notification for staff:', staff._id, staff.email);
    
    await Notification.create({
      user_id: assignedStaffId,
      type: 'task',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: "${task.title}".`,
      related_id: task._id
    });

    console.log('Task notification created successfully for:', staff.email);
  } catch (error) {
    console.error('Failed to dispatch task assigned notification:', error);
  }
};

const sendTaskCompletedNotification = async ({
  taskInput,
  createdByAdminId,
  completedByName
} = {}) => {
  try {
    const Task = require('../models/Task');
    const task =
      typeof taskInput === 'object' && taskInput !== null
        ? taskInput
        : await Task.findById(taskInput);

    if (!task || !createdByAdminId) {
      return;
    }

    const completedByLabel = completedByName && completedByName.trim().length ? completedByName.trim() : 'Staff';

    await Notification.create({
      user_id: createdByAdminId,
      type: 'task',
      title: 'Task Completed',
      message: `Task "${task.title}" has been marked as completed by ${completedByLabel}.`,
      related_id: task._id
    });
  } catch (error) {
    console.error('Failed to dispatch task completed notification:', error);
  }
};

 module.exports = {
   sendAppointmentScheduledNotifications,
   sendAppointmentCancellationNotifications,
   sendPendingIntakeNotifications,
   sendAppointmentCompletedNotifications,
   sendAdminApprovalRequiredNotifications,
   sendAppointmentRescheduleNotifications,
   sendTaskAssignedNotification,
   sendTaskCompletedNotification
};
