const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    maxlength: 2,
    minlength: 2
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  abbreviation: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    maxlength: 2,
    minlength: 2
  },
  isActive: {
    type: Boolean,
    default: true
  },
  region: {
    type: String,
    enum: ['Northeast', 'Midwest', 'South', 'West', 'Territory'],
    default: 'South'
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

// Index for faster queries
stateSchema.index({ code: 1, isActive: 1 });
stateSchema.index({ name: 1 });

module.exports = mongoose.model('State', stateSchema);
