const nodemailer = require('nodemailer');

// Configure Mailchimp Transactional (Mandrill) or use SMTP
const createTransporter = () => {
  if (process.env.MAILCHIMP_API_KEY) {
    // Using Mailchimp Transactional (Mandrill)
    return nodemailer.createTransport({
      host: 'smtp.mandrillapp.com',
      port: 587,
      secure: false,
      auth: {
        user: 'mandrill',
        pass: process.env.MAILCHIMP_API_KEY
      }
    });
  } else {
    // Fallback to SMTP (configure with your email service)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
};

const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.MAILCHIMP_FROM_NAME || 'EHR System'} <${process.env.MAILCHIMP_FROM_EMAIL || 'noreply@example.com'}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (user, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
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
        <p>Thank you for registering with our Electronic Health Records system. Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" class="button">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>EHR System Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(user.email, 'Welcome - Verify Your Email', html);
};

const sendPasswordSetupEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/setup-password?token=${resetToken}`;
  
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

const sendTemplateEmail = async (user, template, data = {}) => {
  const templates = {
    'pending-intake': {
      subject: 'Action Required: Upload Intake Form',
      html: `
        <div class="container">
          <h2>Action Required</h2>
          <p>Hello ${user.name},</p>
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
          <p>Hello ${user.name},</p>
          <p>Your appointment has been scheduled for ${data.scheduledDate}.</p>
          <p>Doctor: ${data.doctorName}</p>
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
          <p>Hello ${user.name},</p>
          <p>Your appointment is under review and awaiting admin approval.</p>
          <p>We will notify you once it's approved.</p>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    },
    'request-document': {
      subject: 'Additional Document Required',
      html: `
        <div class="container">
          <h2>Document Request</h2>
          <p>Hello ${user.name},</p>
          <p>We need the following document for your appointment:</p>
          <p><strong>${data.documentRequest}</strong></p>
          <p>Please upload it at your earliest convenience.</p>
          <a href="${process.env.FRONTEND_URL}/appointments/${data.appointmentId}" class="button">Upload Document</a>
          <p>Best regards,<br>EHR System Team</p>
        </div>
      `
    }
  };

  const templateData = templates[template];
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

  return await sendEmail(user.email, templateData.subject, fullHtml);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordSetupEmail,
  sendAppointmentNotification,
  send2FAEmail,
  sendTemplateEmail
};
