const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['Admin', 'Reception', 'Support', 'Billing', 'Medical Records', 'Other'],
    default: 'Support'
  },
  designation: {
    type: String,
    default: 'Staff Member'
  },
  permissions: {
    canManageAppointments: {
      type: Boolean,
      default: true
    },
    canManagePatients: {
      type: Boolean,
      default: true
    },
    canManageLeads: {
      type: Boolean,
      default: true
    },
    canManageTasks: {
      type: Boolean,
      default: true
    },
    canViewReports: {
      type: Boolean,
      default: false
    },
    canManageDoctors: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave'],
    default: 'active'
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
staffSchema.index({ user_id: 1 });
staffSchema.index({ email: 1 });
staffSchema.index({ status: 1 });
staffSchema.index({ department: 1 });

module.exports = mongoose.model('Staff', staffSchema);
