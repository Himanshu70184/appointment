# 🔐 Staff 2FA with Admin Email - Quick Test Guide

## What Changed?

### 1. Admin Email Updated
- **Old:** admin@test.com
- **New:** himanshukumar.codexmattrix@gmail.com
- **Password:** admin123 (unchanged)

### 2. Staff Login 2FA Behavior
When staff members login, the 2FA code is sent to **ADMIN's email** instead of their own email.

**How it works:**
- Staff enters email/password → Backend validates credentials
- Backend generates 6-digit 2FA code
- Code is sent to **admin@gmail.com** (not staff's email)
- Staff must contact admin to get the code
- Staff enters code to complete login

## 🧪 Testing Steps

### Test 1: Admin Login (2FA to own email)
1. Login with: `himanshukumar.codexmattrix@gmail.com` / `admin123`
2. Check console logs for 2FA code
3. Check your Gmail inbox for 2FA code email
4. Enter the 6-digit code
5. ✅ Admin should login successfully

### Test 2: Staff Login (2FA to admin email)
1. Login with: `staff@test.com` / `staff123`
2. Check console logs - should show:
   ```
   🔐 Staff login detected: staff@test.com
   📧 Sending 2FA code to ADMIN email: himanshukumar.codexmattrix@gmail.com
   ```
3. Check **admin's Gmail** inbox for 2FA code (not staff's email!)
4. Admin shares the code with staff
5. Staff enters the code
6. ✅ Staff should login successfully

### Test 3: Doctor Login (No 2FA)
1. Login with: `doctor@test.com` / `doctor123`
2. ✅ Should login directly without 2FA

### Test 4: Patient Login (No 2FA)
1. Login with: `patient@test.com` / `patient123`
2. ✅ Should login directly without 2FA

## 📧 Expected Email Behavior

### Admin Login Email:
```
To: himanshukumar.codexmattrix@gmail.com
Subject: Your 2FA Verification Code
Body: 
  Hello Admin User,
  Your verification code is:
  [6-DIGIT CODE]
```

### Staff Login Email (sent to ADMIN):
```
To: himanshukumar.codexmattrix@gmail.com
Subject: Your 2FA Verification Code
Body:
  Hello Admin (for Staff Member),
  Your verification code is:
  [6-DIGIT CODE]
```

## 🔍 Console Logs

When staff logs in, backend will show:
```
🔐 Staff login detected: staff@test.com
📧 Sending 2FA code to ADMIN email: himanshukumar.codexmattrix@gmail.com

===========================================
🔐 2FA CODE for staff@test.com : 123456
📧 Code sent to: himanshukumar.codexmattrix@gmail.com
===========================================

✅ Email sent successfully: <message-id>
   To: himanshukumar.codexmattrix@gmail.com
   Subject: Your 2FA Verification Code
```

## 🎯 Why This Approach?

**Security Control:** Admin has full control over staff access
- Staff cannot login without admin's approval
- Admin receives all staff login codes
- Admin can monitor all staff login attempts
- Perfect for controlled access management

## 🚀 Start Testing

1. Make sure backend is running:
   ```bash
   cd backend
   npm run dev
   ```

2. Check SMTP configuration:
   ```bash
   GET http://localhost:5000/api/test-email/config
   ```

3. Test the login flows above

## 📝 API Endpoints for Testing

### Login (with 2FA check)
```bash
POST http://localhost:5000/api/auth/login
Body: {
  "email": "staff@test.com",
  "password": "staff123"
}

Response (if 2FA required):
{
  "requiresTwoFactor": true,
  "userId": "...",
  "message": "OTP sent to admin email. Please contact admin for the code.",
  "sentToAdmin": true
}
```

### Verify 2FA Code
```bash
POST http://localhost:5000/api/auth/verify-2fa
Body: {
  "userId": "...",
  "code": "123456"
}
```

## ✅ Success Criteria

- [x] Admin email updated in database
- [x] Admin login sends 2FA to their own email
- [x] Staff login sends 2FA to admin email (not staff's email)
- [x] Console logs show correct recipient
- [x] Emails arrive in admin Gmail inbox
- [x] 2FA codes work for authentication

---

**Created:** January 31, 2026  
**Admin Email:** himanshukumar.codexmattrix@gmail.com
