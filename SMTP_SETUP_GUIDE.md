# 📧 SMTP Email Setup Guide

## Overview
This guide helps you configure SMTP email for the EHR Appointment System using Gmail (for testing) or any other SMTP provider (for production).

---

## 🔧 Quick Setup for Testing (Gmail)

### Step 1: Enable 2-Step Verification
1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left menu
3. Under "Signing in to Google", enable **2-Step Verification**
4. Follow the setup process

### Step 2: Generate App Password
1. After enabling 2-Step Verification, go to: https://myaccount.google.com/apppasswords
2. Select app: **Mail**
3. Select device: **Other (Custom name)** → Type "EHR System"
4. Click **Generate**
5. **Copy the 16-character password** (it will be shown only once)

### Step 3: Update .env File
Edit `backend/.env` and update these values:

```env
# Replace with YOUR Gmail address
SMTP_USER=your-email@gmail.com

# Replace with the 16-character app password (no spaces)
SMTP_PASS=abcd efgh ijkl mnop

# Replace with YOUR Gmail address
SMTP_FROM_EMAIL=your-email@gmail.com

# You can customize this name
SMTP_FROM_NAME=EHR Appointment System
```

### Step 4: Restart Backend Server
```bash
cd backend
npm run dev
```

---

## ✅ Testing Email Configuration

### Test 1: Check Configuration
```bash
# Using curl (Windows PowerShell)
curl http://localhost:5000/api/test-email/config `
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Or visit in browser after logging in as admin
http://localhost:5000/api/test-email/config
```

**Expected Response:**
```json
{
  "isConfigured": true,
  "smtp": {
    "host": "smtp.gmail.com",
    "port": "587",
    "user": "you***@gmail.com",
    "passwordSet": true
  },
  "status": "✅ Ready"
}
```

### Test 2: Send Test Email (Admin Required)
Login as admin first, then:

```bash
POST http://localhost:5000/api/test-email/send
Headers: Authorization: Bearer YOUR_TOKEN
Body: {
  "to": "recipient@example.com",
  "subject": "Test Email",
  "message": "This is a test email from EHR System"
}
```

**Example using PowerShell:**
```powershell
$token = "YOUR_ADMIN_TOKEN"
$body = @{
    to = "your-email@gmail.com"
    subject = "EHR System Test"
    message = "Testing email functionality!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/test-email/send" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $body `
  -ContentType "application/json"
```

### Test 3: Send Welcome Email Template
```bash
POST http://localhost:5000/api/test-email/welcome
Headers: Authorization: Bearer YOUR_TOKEN
```

### Test 4: Send 2FA Code Email
```bash
POST http://localhost:5000/api/test-email/2fa
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 🔐 Getting Admin Token

### Option 1: Login via API
```powershell
$loginBody = @{
    email = "admin@test.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method Post `
  -Body $loginBody `
  -ContentType "application/json"

$token = $response.token
Write-Host "Token: $token"
```

### Option 2: Get from Browser
1. Login to admin dashboard: http://localhost:3000/login
2. Open Developer Tools (F12)
3. Go to **Application** tab → **Cookies** → http://localhost:3000
4. Copy the `token` value

---

## 📊 Email Testing Endpoints

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/test-email/config` | GET | Admin | Check SMTP configuration |
| `/api/test-email/send` | POST | Admin | Send custom test email |
| `/api/test-email/welcome` | POST | Any logged-in user | Send welcome email template |
| `/api/test-email/2fa` | POST | Any logged-in user | Send 2FA code email |

---

## 🚀 Production Setup

For production, switch to a professional email service:

### Option 1: SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name
```

### Option 2: AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASS=YOUR_SMTP_PASSWORD
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name
```

### Option 3: Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=YOUR_MAILGUN_PASSWORD
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name
```

---

## ❓ Troubleshooting

### Problem: "Email error: Invalid login"
**Solution:** 
- Make sure 2-Step Verification is enabled
- Generate a new App Password (don't use your regular Gmail password)
- Remove spaces from the app password in .env file

### Problem: "Email error: Connection timeout"
**Solution:**
- Check your internet connection
- Verify SMTP_HOST and SMTP_PORT are correct
- Some networks block port 587 - try port 465 with SMTP_SECURE=true

### Problem: Emails not being received
**Solution:**
- Check spam/junk folder
- Verify the recipient email address is correct
- Check Gmail "Sent" folder to confirm email was sent
- Check server logs for error messages

### Problem: "SMTP not configured" warning
**Solution:**
- Make sure all SMTP variables are set in .env
- Restart the backend server after updating .env
- Verify .env file is in the backend folder

---

## 📝 Email Templates in System

The system automatically sends emails for:

1. **Welcome Email** - When user registers
2. **Email Verification** - After registration
3. **Password Setup** - For new staff/doctors
4. **2FA Codes** - When 2FA is enabled
5. **Appointment Confirmations** - When appointment is scheduled
6. **Appointment Reminders** - Before appointment time
7. **Status Updates** - When appointment status changes

All templates are defined in: `backend/utils/email.js`

---

## 🎯 Next Steps

1. ✅ Configure SMTP in .env
2. ✅ Restart backend server
3. ✅ Test configuration endpoint
4. ✅ Send test email to yourself
5. ✅ Inform testing team to test registration flow
6. ✅ Monitor server logs for email activity

---

## 📞 Support

If you encounter issues:
1. Check server console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with curl/Postman to isolate frontend vs backend issues
4. Ensure firewall isn't blocking outgoing connections on port 587

---

**Created:** January 31, 2026  
**Last Updated:** January 31, 2026
