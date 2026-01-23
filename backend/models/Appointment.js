const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  appointmentType: {
    type: String,
    required: true
  },
  medicalCardType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalCard',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'need_admin_approval', 'completed', 'canceled', 'rescheduled'],
    default: 'pending'
  },
  scheduledDate: {
    type: Date
  },
  scheduledTime: {
    type: String
  },
  payment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  intakeForm: {
    type: mongoose.Schema.Types.Mixed
  },
  documents: [{
    type: {
      type: String,
      enum: ['id', 'medical_records', 'guardian_id', 'other']
    },
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  notes: {
    type: String
  },
  ageVerified: {
    type: Boolean,
    default: false
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

appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
