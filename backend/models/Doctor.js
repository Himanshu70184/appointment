const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
  specialties: [{
    type: String
  }],
  states: [{
    type: String,
    required: true
  }],
  consultationFee: {
    type: Number,
    required: true,
    default: 0
  },
  pricing: {
    type: Map,
    of: Number // state -> price mapping (optional, for state-specific pricing)
  },
  availability: [{
    dayOfWeek: {
      type: Number, // 0 = Sunday, 6 = Saturday
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    startTime: {
      type: String, // HH:mm format
      required: true
    },
    endTime: {
      type: String, // HH:mm format
      required: true
    },
    breakStartTime: {
      type: String // HH:mm format (optional)
    },
    breakEndTime: {
      type: String // HH:mm format (optional)
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    },
    effectiveFrom: {
      type: Date
    },
    effectiveTo: {
      type: Date
    }
  }],
  blockedDates: [{
    type: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Doctor', doctorSchema);
