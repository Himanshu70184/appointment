const mongoose = require('mongoose');

const submissionFieldSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  fieldType: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed
  },
  fileUrls: [String] // For file upload fields
}, { _id: false });

const intakeFormSubmissionSchema = new mongoose.Schema({
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  template_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntakeFormTemplate',
    required: true
  },
  templateVersion: {
    type: Number,
    required: true
  },
  formData: [submissionFieldSchema],
  pdfUrl: {
    type: String
  },
  pdfGeneratedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'reviewed', 'approved', 'rejected'],
    default: 'draft'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String
  },
  submittedAt: {
    type: Date
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
intakeFormSubmissionSchema.index({ appointment_id: 1 });
intakeFormSubmissionSchema.index({ patient_id: 1 });
intakeFormSubmissionSchema.index({ status: 1 });
intakeFormSubmissionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('IntakeFormSubmission', intakeFormSubmissionSchema);
