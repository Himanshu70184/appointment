const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { 
  sendEmail, 
  sendWelcomeEmail, 
  send2FAEmail,
  sendPasswordSetupEmail 
} = require('../utils/email');

const router = express.Router();

// @route   POST /api/test-email/send
// @desc    Send a test email (Admin only)
// @access  Private (Admin)
router.post('/send', [auth, authorize('admin')], async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ 
        message: 'Missing required fields: to, subject, message' 
      });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🧪 Test Email from EHR System</h2>
          </div>
          <div class="content">
            <h3>${subject}</h3>
            <p>${message}</p>
            <hr>
            <p style="color: #666; font-size: 14px;">
              This is a test email sent from the EHR Appointment System.<br>
              Sent at: ${new Date().toLocaleString()}<br>
              Environment: ${process.env.NODE_ENV || 'development'}
            </p>
          </div>
          <div class="footer">
            <p>EHR Appointment System - Email Testing</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail(to, `[TEST] ${subject}`, html);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
        details: {
          to,
          subject,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      message: 'Server error while sending test email',
      error: error.message
    });
  }
});

// @route   POST /api/test-email/welcome
// @desc    Send a test welcome email to current user
// @access  Private
router.post('/welcome', auth, async (req, res) => {
  try {
    const fakeToken = 'test-verification-token-' + Date.now();
    
    const result = await sendWelcomeEmail(req.user, fakeToken);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test welcome email sent successfully',
        messageId: result.messageId,
        sentTo: req.user.email
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send welcome email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Welcome email test error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/test-email/2fa
// @desc    Send a test 2FA code email to current user
// @access  Private
router.post('/2fa', auth, async (req, res) => {
  try {
    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const result = await send2FAEmail(req.user, testCode);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test 2FA email sent successfully',
        messageId: result.messageId,
        sentTo: req.user.email,
        testCode // Include in response for testing purposes
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send 2FA email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('2FA email test error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/test-email/config
// @desc    Check email configuration (Admin only)
// @access  Private (Admin)
router.get('/config', [auth, authorize('admin')], async (req, res) => {
  try {
    const config = {
      isConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      smtp: {
        host: process.env.SMTP_HOST || 'Not set',
        port: process.env.SMTP_PORT || 'Not set',
        secure: process.env.SMTP_SECURE || 'false',
        user: process.env.SMTP_USER ? 
          process.env.SMTP_USER.substring(0, 3) + '***@' + process.env.SMTP_USER.split('@')[1] : 
          'Not set',
        passwordSet: !!process.env.SMTP_PASS
      },
      from: {
        email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'Not set',
        name: process.env.SMTP_FROM_NAME || 'EHR System'
      },
      status: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ? 
        '✅ Ready' : 
        '❌ Not configured - Check .env file'
    };

    res.json(config);
  } catch (error) {
    console.error('Config check error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
