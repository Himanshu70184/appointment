const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordSetupEmail, send2FAEmail } = require('../utils/email');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new lead/user
// @access  Public
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('appointmentType').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, state, appointmentType } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(400).json({ message: 'Email already taken. Use another email.' });
    }

    // Create new user/lead
    user = new User({
      name,
      email: normalizedEmail,
      phone,
      state,
      role_id: 3, // Patient
      status: 'new'
    });

    // Email verification disabled
    user.emailVerified = true;
    user.status = 'active';

    await user.save();

    const frontendUrl = req.get('origin') || process.env.FRONTEND_URL;

    // Optional welcome email (no verification)
    sendWelcomeEmail(user, null, frontendUrl).catch(() => {});

    res.status(201).json({
      message: 'Registration successful.',
      userId: user._id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = 'verified';
    await user.save();

    // Generate password setup token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    const frontendUrl = req.get('origin') || process.env.FRONTEND_URL;

    // Send password setup email
    await sendPasswordSetupEmail(user, resetToken, frontendUrl);

    res.json({
      message: 'Email verified successfully. Please check your email to set up your password.',
      setupToken: resetToken // For frontend redirect
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/setup-password
// @desc    Set password for verified user
// @access  Public
router.post('/setup-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.status = 'active';
    await user.save();

    const token_jwt = generateToken(user._id);

    res.json({
      message: 'Password set successfully',
      token: token_jwt,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        state: user.state,
        dateOfBirth: user.dateOfBirth,
        firstName: user.firstName,
        lastName: user.lastName,
        role_id: user.role_id,
        prn: user.prn
      }
    });
  } catch (error) {
    console.error('Password setup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password. Please check your credentials and try again.' });
    }

    if (!user.password) {
      return res.status(403).json({ message: 'Account setup incomplete. Please set your password.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password. Please check your credentials and try again.' });
    }

    // Check if 2FA is enabled for this user (admins/staff)
    if (user.twoFactorEnabled && (user.role_id === 1 || user.role_id === 4)) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash and save OTP
      const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
      user.twoFactorCode = hashedOTP;
      user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();

      // For STAFF login, send 2FA code to ADMIN email
      // For ADMIN login, send to their own email
      let emailRecipient = user;
      let recipientEmail = user.email;
      
      if (user.role_id === 4) { // Staff
        // Find admin user to send code to admin email
        const adminUser = await User.findOne({ role_id: 1 });
        if (adminUser) {
          emailRecipient = { 
            ...adminUser.toObject(), 
            name: `Admin (for ${user.name})` 
          };
          recipientEmail = adminUser.email;
          console.log(`\n🔐 Staff login detected: ${user.email}`);
          console.log(`📧 Sending 2FA code to ADMIN email: ${recipientEmail}\n`);
        }
      }

      // Development: Log OTP to console
      console.log('\n===========================================');
      console.log('🔐 2FA CODE for', user.email, ':', otp);
      console.log('📧 Code sent to:', recipientEmail);
      console.log('===========================================\n');

      // Send OTP via email (don't await to avoid blocking on email errors)
      send2FAEmail(emailRecipient, otp).catch(err => {
        console.error('Email send failed (non-blocking):', err.message);
      });

      const message = user.role_id === 4 
        ? 'OTP sent to admin email. Please contact admin for the code.' 
        : 'OTP sent to your email';

      return res.json({
        requiresTwoFactor: true,
        userId: user._id,
        message,
        sentToAdmin: user.role_id === 4
      });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role_id: user.role_id,
        prn: user.prn,
        status: user.status,
        phone: user.phone,
        state: user.state,
        dateOfBirth: user.dateOfBirth,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/verify-2fa
// @desc    Verify 2FA code
// @access  Public
router.post('/verify-2fa', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, code } = req.body;

    const user = await User.findById(userId).select('+twoFactorCode +twoFactorExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorCode || !user.twoFactorExpires) {
      return res.status(400).json({ message: 'No 2FA code requested' });
    }

    if (Date.now() > user.twoFactorExpires) {
      return res.status(400).json({ message: '2FA code expired. Please request a new one.' });
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Development: Debug 2FA verification
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 2FA Verification Debug:');
      console.log('   User:', user.email);
      console.log('   Code received:', code);
      console.log('   Hashed received:', hashedCode);
      console.log('   Stored hash:', user.twoFactorCode);
      console.log('   Match:', hashedCode === user.twoFactorCode);
    }

    if (hashedCode !== user.twoFactorCode) {
      return res.status(401).json({ message: 'Invalid 2FA code' });
    }

    // Clear 2FA code
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role_id: user.role_id,
        prn: user.prn,
        status: user.status,
        phone: user.phone,
        state: user.state,
        dateOfBirth: user.dateOfBirth,
        firstName: user.firstName,
        lastName: user.lastName,
      }
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        state: user.state,
        role_id: user.role_id,
        prn: user.prn,
        dateOfBirth: user.dateOfBirth,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        guardianName: user.guardianName
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
