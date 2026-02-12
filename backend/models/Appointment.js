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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'approval', 'rescheduled', 'cancelled', 'completed', 'on-hold'],
    default: 'pending'
  },
  isMinor: {
    type: Boolean,
    default: false
  },
  guardianApproved: {
    type: Boolean,
    default: false
  },
  guardianApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  guardianApprovedAt: {
    type: Date
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
  intakeSubmitted: {
    type: Boolean,
    default: false
  },
  intakeSubmittedAt: {
    type: Date
  },
  paymentCompleted: {
    type: Boolean,
    default: false
  },
  paymentCompletedAt: {
    type: Date
  },
  completedAt: {
    type: Date
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
  adminNotes: {
    type: String
  },
  cancelReason: {
    type: String
  },
  clinicalNotes: {
    type: String
  },
  pdmpVerified: {
    type: Boolean,
    default: false
  },
  pdmpVerifiedAt: {
    type: Date
  },
  pdmpVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  certificationFiled: {
    type: Boolean,
    default: false
  },
  certificationFiledAt: {
    type: Date
  },
  certificationFiledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  documentRequests: [{
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    message: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'fulfilled'],
      default: 'pending'
    }
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  state: {
    type: String,
    required: true
  },
  state_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'State'
  },
  appointmentDate: {
    type: Date
  },
  appointmentTime: {
    type: String
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  adjustedAmount: {
    type: Number
  },
  couponCode: {
    type: String
  },
  couponDiscountAmount: {
    type: Number,
    default: 0
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
