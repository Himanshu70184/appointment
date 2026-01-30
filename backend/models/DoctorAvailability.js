const mongoose = require('mongoose');

// Holiday schema for tracking doctor holidays
const holidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ['full-day', 'half-day'],
    required: true,
    default: 'full-day',
  },
  startTime: {
    type: String,
    // Format: "HH:MM" - Required for half-day holidays
    required: function() {
      return this.type === 'half-day';
    },
  },
  endTime: {
    type: String,
    // Format: "HH:MM" - Required for half-day holidays
    required: function() {
      return this.type === 'half-day';
    },
  },
  reason: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6,
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  startTime: {
    type: String,
    required: function() {
      return this.isActive;
    },
    // Format: "HH:MM" (24-hour format, e.g., "08:00")
  },
  endTime: {
    type: String,
    required: function() {
      return this.isActive;
    },
    // Format: "HH:MM" (24-hour format, e.g., "18:00")
  },
  breakStartTime: {
    type: String,
    default: null,
    // Format: "HH:MM" - Optional break time
  },
  breakEndTime: {
    type: String,
    default: null,
    // Format: "HH:MM" - Optional break time
  },
}, { _id: false });

const doctorAvailabilitySchema = new mongoose.Schema({
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  states: [{
    type: String,
    required: true,
    // State codes that doctor is available in (e.g., ['CA', 'NY', 'TX'])
  }],
  weeklySchedule: {
    type: [dayScheduleSchema],
    validate: {
      validator: function(schedule) {
        // Ensure all 7 days are present (0-6)
        const days = schedule.map(s => s.dayOfWeek);
        return days.length === 7 && 
               new Set(days).size === 7 &&
               days.every(d => d >= 0 && d <= 6);
      },
      message: 'Weekly schedule must contain all 7 days (0-6)',
    },
  },
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
    validate: {
      validator: function(endDate) {
        return endDate > this.startDate;
      },
      message: 'End date must be after start date',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  holidays: {
    type: [holidaySchema],
    default: [],
  },
  notes: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
doctorAvailabilitySchema.index({ doctor_id: 1, startDate: 1, endDate: 1 });
doctorAvailabilitySchema.index({ states: 1, startDate: 1, endDate: 1 });
doctorAvailabilitySchema.index({ doctor_id: 1, isActive: 1 });

// Method to check if doctor is available at a specific date/time
doctorAvailabilitySchema.methods.isAvailableAt = function(date, time) {
  // Check if date is within range
  if (date < this.startDate || date > this.endDate) {
    return false;
  }

  // Check if date is a holiday
  const dateStr = date.toISOString().split('T')[0];
  const holiday = this.holidays.find(h => {
    const holidayDate = new Date(h.date).toISOString().split('T')[0];
    return holidayDate === dateStr;
  });

  if (holiday) {
    if (holiday.type === 'full-day') {
      return false; // Doctor not available on full-day holiday
    } else if (holiday.type === 'half-day') {
      // Check if time falls within half-day holiday period
      if (time >= holiday.startTime && time < holiday.endTime) {
        return false;
      }
    }
  }

  // Get day of week
  const dayOfWeek = date.getDay();
  const daySchedule = this.weeklySchedule.find(s => s.dayOfWeek === dayOfWeek);

  if (!daySchedule || !daySchedule.isActive) {
    return false;
  }

  // Check if time is within working hours
  if (time < daySchedule.startTime || time > daySchedule.endTime) {
    return false;
  }

  // Check if time is during break
  if (daySchedule.breakStartTime && daySchedule.breakEndTime) {
    if (time >= daySchedule.breakStartTime && time < daySchedule.breakEndTime) {
      return false;
    }
  }

  return true;
};

// Static method to get active availability for a doctor
doctorAvailabilitySchema.statics.getActiveAvailability = async function(doctorId, date = new Date()) {
  return this.find({
    doctor_id: doctorId,
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date },
  }).sort({ startDate: -1 });
};

// Static method to get available doctors for a state and time slot
doctorAvailabilitySchema.statics.getAvailableDoctors = async function(stateCode, date, time) {
  const availabilities = await this.find({
    states: stateCode,
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date },
  }).populate('doctor_id', 'name email consultationFee status');

  const availableDoctors = [];

  for (const availability of availabilities) {
    if (availability.isAvailableAt(date, time) && 
        availability.doctor_id.status === 'active') {
      availableDoctors.push({
        doctor: availability.doctor_id,
        availability: availability,
      });
    }
  }

  // Sort by consultation fee (cheapest first)
  return availableDoctors.sort((a, b) => 
    a.doctor.consultationFee - b.doctor.consultationFee
  );
};

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
