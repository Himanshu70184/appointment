const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    select: false
  },
  state: {
    type: String,
    required: function() {
      // State is required only for patients (role_id = 3)
      return this.role_id === 3;
    }
  },
  role_id: {
    type: Number,
    default: 3, // 1=Admin, 2=Doctor, 3=Patient, 4=Staff
    required: true
  },
  prn: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  status: {
    type: String,
    enum: ['new', 'verified', 'active', 'inactive'],
    default: 'new'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  dateOfBirth: {
    type: Date
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  guardianName: {
    type: String
  },
  guardianEmail: {
    type: String
  },
  guardianPhone: {
    type: String
  },
  guardianAddress: {
    type: String
  },
  isMinor: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: true // Enable 2FA by default for admins
  },
  twoFactorCode: {
    type: String,
    select: false
  },
  twoFactorExpires: {
    type: Date,
    select: false
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate PRN before saving if user is a patient
userSchema.pre('save', async function(next) {
  if (this.role_id === 3 && !this.prn) {
    const initials = this.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
    
    // Find the highest PRN number with these initials
    const lastUser = await mongoose.model('User')
      .findOne({ prn: new RegExp(`^${initials}`) })
      .sort({ prn: -1 });
    
    let number = 1;
    if (lastUser && lastUser.prn) {
      const lastNumber = parseInt(lastUser.prn.replace(initials, ''));
      if (!isNaN(lastNumber)) {
        number = lastNumber + 1;
      }
    }
    
    this.prn = `${initials}${number.toString().padStart(4, '0')}`;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
