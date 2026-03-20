const nodemailer = require('nodemailer');

// Configure SMTP Transporter
const createTransporter = () => {
  // Check if SMTP is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP not configured. Email functionality will not work.');
    console.warn('Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env file');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Additional options for Gmail
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'EHR System'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('   To:', to);
    console.log('   Subject:', subject);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (user, verificationToken, baseUrl) => {
  const frontendUrl = baseUrl || process.env.FRONTEND_URL;
  const verificationUrl = verificationToken ? `${frontendUrl}/verify-email?token=${verificationToken}` : null;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Welcome to EHR System!</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for registering with our Electronic Health Records system.</p>
        ${verificationUrl ? `
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email</a>
          <p>Or copy and paste this link into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
        ` : '<p>Your account is ready to use.</p>'}
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, verificationUrl ? 'Welcome - Verify Your Email' : 'Welcome to EHR System', html);
};

const sendEmailVerificationEmail = async (user, verificationToken, baseUrl) => {
  const frontendUrl = baseUrl || process.env.FRONTEND_URL;
  const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Verify Your Email</h2>
        <p>Hello ${user.name},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" class="button">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Verify Your Email', html);
};

const sendPasswordSetupEmail = async (user, resetToken, baseUrl) => {
  const frontendUrl = baseUrl || process.env.FRONTEND_URL;
  const resetUrl = `${frontendUrl}/setup-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Set Up Your Password</h2>
        <p>Hello ${user.name},</p>
        <p>Please set your password by clicking the button below:</p>
        <a href="${resetUrl}" class="button">Set Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Set Up Your Password', html);
};

const sendPasswordResetEmail = async (user, resetToken, baseUrl) => {
  const frontendUrl = baseUrl || process.env.FRONTEND_URL;
  const resetUrl = `${frontendUrl}/setup-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hello ${user.name},</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Password Reset Request', html);
};

const sendPasswordResetConfirmationEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Password Reset Successful</h2>
        <p>Hello ${user.name},</p>
        <p>Your password has been updated successfully.</p>
        <p>If you did not perform this action, please contact support immediately.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Password Reset Confirmation', html);
};

const sendAppointmentNotification = async (user, appointment, status) => {
  const statusMessages = {
    pending: 'Your appointment is pending document upload.',
    scheduled: `Your appointment has been scheduled for ${new Date(appointment.scheduledDate).toLocaleString()}.`,
    need_admin_approval: 'Your appointment requires admin approval.',
    completed: 'Your appointment has been completed.',
    canceled: 'Your appointment has been canceled.'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Appointment Update</h2>
        <p>Hello ${user.name},</p>
        <p>${statusMessages[status] || 'Your appointment status has been updated.'}</p>
        <p>Appointment ID: ${appointment._id}</p>
        <p>Status: ${status}</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Appointment Status Update', html);
};

const send2FAEmail = async (user, code) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .code { font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; padding: 20px; background: #f5f5f5; border-radius: 5px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Two-Factor Authentication Code</h2>
        <p>Hello ${user.name},</p>
        <p>Your verification code is:</p>
        <div class="code">${code}</div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this code, please ignore this email.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Your 2FA Verification Code', html);
};

const resolveTemplateRecipient = (recipient) => {
  if (!recipient) return { email: null, name: 'Patient' };

  if (typeof recipient === 'string') {
    return { email: recipient, name: 'Patient' };
  }

  if (typeof recipient === 'object') {
    return {
      email: recipient.email || null,
      name: recipient.name || [recipient.firstName, recipient.lastName].filter(Boolean).join(' ').trim() || 'Patient'
    };
  }

  return { email: null, name: 'Patient' };
};

const sendTemplateEmail = async (recipient, template, data = {}) => {
  const { email, name } = resolveTemplateRecipient(recipient);
  if (!email) {
    throw new Error('Valid email recipient is required');
  }

  const patientName = data.patientName || name || 'Patient';
  const appointmentDate = data.appointmentDate || data.scheduledDate || 'TBD';
  const appointmentTime = data.appointmentTime || 'TBD';

  const templates = {
    'appointment-confirmation': {
      subject: 'Appointment Confirmation',
      html: `
        <div class="container">
          <h2>Appointment Confirmation</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment has been received and your payment is confirmed.</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Please complete your intake form to keep the booking moving.</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'payment-completed': {
      subject: 'Payment Completed Successfully',
      html: `
        <div class="container">
          <h2>Payment Completed</h2>
          <p>Hello ${patientName},</p>
          <p>Your payment has been completed successfully.</p>
          <p>Amount: ${data.amount || 'N/A'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'patient-appointment-scheduled': {
      subject: 'Appointment Scheduled',
      html: `
        <div class="container">
          <h2>Appointment Scheduled</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment is confirmed for ${appointmentDate} at ${appointmentTime}.</p>
          <p>State: ${data.state || 'N/A'}</p>
          <p>Doctor: ${data.doctorName || 'Unassigned'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'patient-appointment-rescheduled': {
      subject: 'Appointment Rescheduled',
      html: `
        <div class="container">
          <h2>Appointment Rescheduled</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment has been rescheduled.</p>
          <p>Previous: ${data.previousDate || 'TBD'} at ${data.previousTime || 'TBD'}</p>
          <p>Updated: ${appointmentDate} at ${appointmentTime}</p>
          <p>Updated by: ${data.actorName || 'System'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'patient-appointment-under-review': {
      subject: 'Appointment Under Review',
      html: `
        <div class="container">
          <h2>Appointment Under Review</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment is under review and requires admin/staff approval.</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>State: ${data.state || 'N/A'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'patient-appointment-completed': {
      subject: 'Appointment Completed',
      html: (() => {
        const reviewUrl = data.reviewUrl || process.env.GMB_REVIEW_URL || process.env.GOOGLE_REVIEW_URL;
        const reviewButton = reviewUrl
          ? `<a href="${reviewUrl}" class="button">Write a Review</a>`
          : '';
        const reviewLinkFallback = reviewUrl
          ? `<p>If the button does not work, copy and paste this link into your browser:</p><p>${reviewUrl}</p>`
          : '';

        return `
          <div class="container">
            <h2>Appointment Completed</h2>
            <p>Hello ${patientName},</p>
            <p>Your appointment on ${appointmentDate} at ${appointmentTime} has been completed.</p>
            <p>Doctor: ${data.doctorName || 'Unassigned'}</p>
            <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
            <p>We would appreciate your feedback.</p>
            ${reviewButton}
            ${reviewLinkFallback}
            <p>Best regards,<br>EHR System Team</p>
          </div>
        `;
      })()
    },
    'patient-appointment-cancelled': {
      subject: 'Appointment Cancelled',
      html: `
        <div class="container">
          <h2>Appointment Cancelled</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment scheduled for ${appointmentDate} at ${appointmentTime} has been cancelled.</p>
          <p>Cancelled by: ${data.cancelledBy || 'System'}</p>
          <p>Reason: ${data.reason || 'No reason was provided.'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'patient-appointment-on-hold': {
      subject: 'Appointment On Hold',
      html: `
        <div class="container">
          <h2>Appointment On Hold</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment has been placed on hold.</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>Reason: ${data.reason || 'We need additional information to proceed.'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'pending-intake': {
      subject: 'Action Required: Upload Intake Form',
      html: `
        <div class="container">
          <h2>Action Required</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment is pending. Please upload your intake form to proceed.</p>
          <p>Appointment ID: ${data.appointmentId}</p>
          <a href="${process.env.FRONTEND_URL}/appointments/${data.appointmentId}/intake" class="button">Upload Intake Form</a>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'scheduled': {
      subject: 'Appointment Confirmed',
      html: `
        <div class="container">
          <h2>Appointment Confirmed</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment has been scheduled for ${data.scheduledDate}.</p>
          <p>State: ${data.state}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'need-approval': {
      subject: 'Appointment Awaiting Approval',
      html: `
        <div class="container">
          <h2>Appointment Awaiting Approval</h2>
          <p>Hello ${patientName},</p>
          <p>Your appointment is under review and awaiting admin approval.</p>
          <p>We will notify you once it's approved.</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'admin-staff-appointment-scheduled': {
      subject: 'New Appointment Scheduled',
      html: `
        <div class="container">
          <h2>New Appointment Scheduled</h2>
          <p>Hello ${name || 'Team'},</p>
          <p>${patientName} is scheduled for ${appointmentDate} at ${appointmentTime}.</p>
          <p>State: ${data.state || 'N/A'}</p>
          <p>Doctor: ${data.doctorName || 'Unassigned'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'admin-staff-appointment-rescheduled': {
      subject: 'Appointment Rescheduled',
      html: `
        <div class="container">
          <h2>Appointment Rescheduled</h2>
          <p>Hello ${name || 'Team'},</p>
          <p>${patientName}'s appointment has been rescheduled.</p>
          <p>Previous: ${data.previousDate || 'TBD'} at ${data.previousTime || 'TBD'}</p>
          <p>Updated: ${appointmentDate} at ${appointmentTime}</p>
          <p>State: ${data.state || 'N/A'}</p>
          <p>Updated by: ${data.actorName || 'System'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'admin-staff-approval-required': {
      subject: 'Admin Approval Required',
      html: `
        <div class="container">
          <h2>Appointment Needs Approval</h2>
          <p>Hello ${name || 'Team'},</p>
          <p>${patientName}'s appointment requires admin approval before scheduling.</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>State: ${data.state || 'N/A'}</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'intake-submitted': {
      subject: 'Patient Intake Submitted',
      html: `
        <div class="container">
          <h2>Intake Form Submitted</h2>
          <p>Hello,</p>
          <p>${patientName} has submitted their intake form.</p>
          <p>Appointment ID: ${data.appointmentId || 'N/A'}</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${appointmentTime}</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'request-document': {
      subject: 'Additional Document Required',
      html: `
        <div class="container">
          <h2>Document Request</h2>
          <p>Hello ${patientName},</p>
          <p>We need the following document for your appointment:</p>
          <p><strong>${data.documentRequest}</strong></p>
          <p>Please upload it at your earliest convenience.</p>
          <a href="${process.env.FRONTEND_URL}/appointments/${data.appointmentId}" class="button">Upload Document</a>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    }
  };

  const templateAliases = {
    'appointment-confirmed': 'scheduled',
    'scheduled': 'patient-appointment-scheduled',
    'need-approval': 'patient-appointment-under-review'
  };

  const normalizedTemplate = templateAliases[template] || template;
  const templateData = templates[normalizedTemplate];
  if (!templateData) {
    throw new Error('Invalid email template');
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      ${templateData.html}
    </body>
    </html>
  `;

  return await sendEmail(email, templateData.subject, fullHtml);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendEmailVerificationEmail,
  sendPasswordSetupEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendAppointmentNotification,
  send2FAEmail,
  sendTemplateEmail
};
