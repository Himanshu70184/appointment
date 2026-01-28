const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  fieldType: {
    type: String,
    enum: ['text', 'textarea', 'number', 'email', 'phone', 'date', 'checkbox', 'radio', 'select', 'file', 'multiselect', 'checkboxGroup'],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String
  },
  helpText: {
    type: String
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    value: String,
    label: String
  }],
  validation: {
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    pattern: String,
    errorMessage: String
  },
  order: {
    type: Number,
    required: true
  },
  conditionalLogic: {
    enabled: {
      type: Boolean,
      default: false
    },
    dependsOn: String, // fieldId that this field depends on
    condition: String, // 'equals', 'notEquals', 'contains', etc.
    value: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  sectionId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  order: {
    type: Number,
    required: true
  },
  fields: [fieldSchema]
}, { _id: false });

const intakeFormTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  appointmentTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType'
  }],
  states: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'State'
  }],
  sections: [sectionSchema],
  settings: {
    allowSaveProgress: {
      type: Boolean,
      default: true
    },
    showProgressBar: {
      type: Boolean,
      default: true
    },
    submitButtonText: {
      type: String,
      default: 'Submit Intake Form'
    },
    successMessage: {
      type: String,
      default: 'Your intake form has been submitted successfully!'
    },
    pdfHeaderText: {
      type: String,
      default: 'Medical Intake Form'
    },
    pdfFooterText: {
      type: String
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
intakeFormTemplateSchema.index({ isActive: 1, isDefault: 1 });
intakeFormTemplateSchema.index({ appointmentTypes: 1 });
intakeFormTemplateSchema.index({ states: 1 });

// Method to duplicate template with new version
intakeFormTemplateSchema.methods.createNewVersion = async function() {
  const newTemplate = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    version: this.version + 1,
    createdAt: undefined,
    updatedAt: undefined
  });
  return await newTemplate.save();
};

module.exports = mongoose.model('IntakeFormTemplate', intakeFormTemplateSchema);
