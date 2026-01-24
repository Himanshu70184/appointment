/**
 * Doctor Utility Functions
 * Handles availability management, slot calculations, and doctor-related operations
 */

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

/**
 * Find earliest available appointment slot for a doctor
 * @param {Object} doctor - Doctor object
 * @param {Date} startDate - Start date for search
 * @param {number} slotDuration - Slot duration in minutes (default 30)
 * @returns {Date|null} - Earliest available slot or null
 */
const findEarliestAvailableSlot = (doctor, startDate = null, slotDuration = 30) => {
  const now = new Date();
  const checkDate = startDate ? new Date(startDate) : new Date();
  checkDate.setHours(0, 0, 0, 0);

  // Look for available slots in the next 60 days
  for (let day = 0; day < 60; day++) {
    const currentDate = new Date(checkDate);
    currentDate.setDate(currentDate.getDate() + day);
    const dayOfWeek = currentDate.getDay();

    // Skip if date is blocked
    if (isDateBlocked(doctor, currentDate)) continue;

    // Get availability for this day
    const dayAvailability = doctor.availability.find(avail => avail.dayOfWeek === dayOfWeek);
    if (!dayAvailability) continue;

    // Find first available time slot
    const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
    const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes + slotDuration <= endMinutes; minutes += slotDuration) {
      const slotTime = new Date(currentDate);
      slotTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

      // Only return future slots
      if (slotTime > now) {
        return slotTime;
      }
    }
  }

  return null;
};

/**
 * Check if a date is blocked for a doctor
 * @param {Object} doctor - Doctor object
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
const isDateBlocked = (doctor, date) => {
  return doctor.blockedDates.some(blockedDate => {
    const blocked = new Date(blockedDate);
    return blocked.toDateString() === date.toDateString();
  });
};

/**
 * Get available slots for a date range
 * @param {Object} doctor - Doctor object
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} slotDuration - Slot duration in minutes
 * @returns {Array} - Array of available slots
 */
const getAvailableSlots = (doctor, startDate, endDate, slotDuration = 30) => {
  const slots = [];
  const now = new Date();

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();

    if (isDateBlocked(doctor, date)) continue;

    const dayAvailability = doctor.availability.find(avail => avail.dayOfWeek === dayOfWeek);
    if (!dayAvailability) continue;

    const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
    const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes + slotDuration <= endMinutes; minutes += slotDuration) {
      const slotTime = new Date(date);
      slotTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

      if (slotTime > now) {
        slots.push({
          date: slotTime.toISOString().split('T')[0],
          time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
          datetime: slotTime.toISOString(),
          timezone: dayAvailability.timezone
        });
      }
    }
  }

  return slots;
};

/**
 * Get booked slots for a doctor on a specific date
 * @param {string} doctorId - Doctor ID
 * @param {Date} date - Date to check
 * @returns {Promise<Array>}
 */
const getBookedSlots = async (doctorId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    doctor_id: doctorId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['canceled'] }
  });

  return appointments.map(appt => ({
    time: appt.scheduledTime,
    datetime: appt.scheduledDate,
    status: appt.status
  }));
};

/**
 * Check if a doctor is available for a specific slot
 * @param {Object} doctor - Doctor object
 * @param {Date} slotDateTime - Slot date and time
 * @param {Array} bookedSlots - Array of booked slots
 * @returns {boolean}
 */
const isSlotAvailable = (doctor, slotDateTime, bookedSlots = []) => {
  // Check if date is blocked
  if (isDateBlocked(doctor, slotDateTime)) {
    return false;
  }

  // Check day availability
  const dayOfWeek = slotDateTime.getDay();
  const dayAvailability = doctor.availability.find(avail => avail.dayOfWeek === dayOfWeek);

  if (!dayAvailability) {
    return false;
  }

  // Check time is within working hours
  const [availStartHour, availStartMin] = dayAvailability.startTime.split(':').map(Number);
  const [availEndHour, availEndMin] = dayAvailability.endTime.split(':').map(Number);

  const slotMinutes = slotDateTime.getHours() * 60 + slotDateTime.getMinutes();
  const availStartMinutes = availStartHour * 60 + availStartMin;
  const availEndMinutes = availEndHour * 60 + availEndMin;

  if (slotMinutes < availStartMinutes || slotMinutes >= availEndMinutes) {
    return false;
  }

  // Check if slot is already booked
  const isBooked = bookedSlots.some(booked => {
    const bookedTime = new Date(booked.datetime);
    return bookedTime.toISOString() === slotDateTime.toISOString();
  });

  return !isBooked;
};

/**
 * Get doctor workload for a date range
 * @param {string} doctorId - Doctor ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>}
 */
const getDoctorWorkload = async (doctorId, startDate, endDate) => {
  const appointments = await Appointment.find({
    doctor_id: doctorId,
    scheduledDate: { $gte: startDate, $lte: endDate },
    status: { $nin: ['canceled'] }
  });

  const workloadByDate = {};
  appointments.forEach(appt => {
    const dateStr = appt.scheduledDate.toISOString().split('T')[0];
    workloadByDate[dateStr] = (workloadByDate[dateStr] || 0) + 1;
  });

  const totalAppointments = appointments.length;
  const busyDays = Object.keys(workloadByDate).length;

  return {
    totalAppointments,
    busyDays,
    workloadByDate,
    averageAppointmentsPerDay: busyDays > 0 ? totalAppointments / busyDays : 0
  };
};

/**
 * Validate availability slot configuration
 * @param {Array} availability - Availability array
 * @returns {Object} - Validation result { isValid: boolean, errors: Array }
 */
const validateAvailability = (availability) => {
  const errors = [];
  const usedDays = new Set();

  if (!Array.isArray(availability)) {
    return { isValid: false, errors: ['Availability must be an array'] };
  }

  for (const slot of availability) {
    // Check required fields
    if (typeof slot.dayOfWeek !== 'number' || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      errors.push(`Invalid dayOfWeek: ${slot.dayOfWeek}. Must be 0-6`);
    }

    if (!slot.startTime || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.startTime)) {
      errors.push(`Invalid startTime: ${slot.startTime}. Format must be HH:mm`);
    }

    if (!slot.endTime || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.endTime)) {
      errors.push(`Invalid endTime: ${slot.endTime}. Format must be HH:mm`);
    }

    // Check if end time is after start time
    if (slot.startTime && slot.endTime) {
      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        errors.push(`End time must be after start time for day ${slot.dayOfWeek}`);
      }
    }

    // Check for duplicate days
    if (usedDays.has(slot.dayOfWeek)) {
      errors.push(`Duplicate availability for day ${slot.dayOfWeek}`);
    }
    usedDays.add(slot.dayOfWeek);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Find best matching doctors for a patient (by state, specialty, price)
 * @param {string} patientState - Patient state
 * @param {string} specialty - Medical specialty
 * @param {number} maxPrice - Maximum acceptable price
 * @returns {Promise<Array>}
 */
const findBestMatchingDoctors = async (patientState, specialty, maxPrice = null) => {
  const query = {
    states: patientState,
    isActive: true
  };

  if (specialty) {
    query.specialties = specialty;
  }

  const doctors = await Doctor.find(query)
    .populate('user_id', 'name email phone')
    .sort({ _id: 1 });

  // Filter by price if provided
  if (maxPrice) {
    return doctors.filter(doctor => {
      const price = doctor.pricing?.get(patientState);
      return price && price <= maxPrice;
    });
  }

  return doctors;
};

module.exports = {
  findEarliestAvailableSlot,
  isDateBlocked,
  getAvailableSlots,
  getBookedSlots,
  isSlotAvailable,
  getDoctorWorkload,
  validateAvailability,
  findBestMatchingDoctors
};
