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

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordSetupEmail,
  sendAppointmentNotification
};
