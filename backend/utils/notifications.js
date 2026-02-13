const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

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

module.exports = {
  sendAppointmentScheduledNotifications
};
