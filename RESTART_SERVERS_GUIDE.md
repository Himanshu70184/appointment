# Quick Fix Script - Network Access Issues

## 🚨 IMMEDIATE ACTION REQUIRED

Both **Backend and Frontend** servers need to be restarted to apply the authentication and cookie fixes.

---

## 🔧 Step 1: Restart Backend Server

### Option A: If running in terminal
1. Go to the backend terminal
2. Press `Ctrl+C` to stop the server
3. Run:
```bash
cd backend
npm run dev
```

### Option B: Using VS Code terminal
```powershell
# Terminal 1 - Backend
cd D:\office-cmx\appointment\backend
npm run dev
```

**Expected Output:**
```
MongoDB connected successfully
Server running on port 5000
✅ CORS allowed for: http://192.168.29.154:3000
```

---

## 🔧 Step 2: Restart Frontend Server

### In another terminal:
```powershell
# Terminal 2 - Frontend
cd D:\office-cmx\appointment\frontend
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000
```

---

## 🧪 Step 3: Testing Team - Clear Browser & Test

### CRITICAL: Clear Browser Data First!
**Why?** Old cookies won't have the correct `path: '/'` setting.

**How to Clear:**
1. Press `F12` to open DevTools
2. Go to **Application** tab
3. Click **Clear storage** (left sidebar)
4. Click **Clear site data** button
5. Close DevTools
6. **Refresh the page** (Ctrl+F5)

OR

**Use Incognito/Private Mode** (Easiest!)
- Chrome: `Ctrl+Shift+N`
- Edge: `Ctrl+Shift+P`
- Firefox: `Ctrl+Shift+P`

---

## 🎯 Step 4: Test Login & Lists

### Test Sequence:
```
1. Open: http://192.168.29.154:3000/login

2. Login with admin:
   Email: admin@test.com
   Password: admin123

3. Complete 2FA (check backend terminal for code)

4. After successful login, navigate to:
   ✅ Dashboard → Should load
   ✅ Doctors page → Should show list
   ✅ Appointments page → Should show list
   ✅ Staff page → Should show list
   ✅ Patients page → Should show list
```

---

## 🔍 Step 5: Verify It's Working

### Check Backend Terminal Logs
You should see:
```
CORS request from origin: http://192.168.29.154:3000
✅ CORS allowed for: http://192.168.29.154:3000
GET /api/doctors 200 - 45ms
GET /api/appointments 200 - 32ms
```

### Check Browser DevTools (F12)

#### 1. Check Cookies (Application Tab)
- Cookie name: `token`
- **Path: `/`** ← Must be present!
- SameSite: `Lax`
- Domain: `192.168.29.154`

#### 2. Check Network Tab
When clicking "Doctors":
- Request: `http://192.168.29.154:5000/api/doctors`
- Request Headers should include:
  ```
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
- Status: `200 OK` ✅
- Response: JSON with doctors array

#### 3. Check Console Tab
- Should be **NO red errors**
- No "Failed to fetch" errors
- No 401 errors

---

## ❌ Troubleshooting Common Issues

### Issue 1: "Failed to fetch" on doctors/appointments
**Cause:** Backend server not running or not accessible
**Solution:**
```bash
# Check if backend is running
# On developer machine, open browser:
http://localhost:5000/api/doctors

# From tester's machine, open browser:
http://192.168.29.154:5000/api/doctors

# Both should return JSON (even without login, it's public route)
```

### Issue 2: 401 Unauthorized on lists
**Cause:** Cookie not set correctly or old cookie
**Solution:**
1. Clear browser data completely
2. Login again
3. Check cookie has `Path: /` in DevTools

### Issue 3: CORS error in console
**Cause:** Backend CORS not configured or server not restarted
**Solution:**
1. Restart backend server
2. Check backend terminal shows: `✅ CORS allowed for: http://192.168.29.154:3000`

### Issue 4: Staff list works but doctors/appointments don't
**Cause:** Different routes might be cached differently
**Solution:**
1. Hard refresh: `Ctrl+Shift+R` or `Ctrl+F5`
2. Clear cache completely
3. Use Incognito mode

### Issue 5: Backend says "CORS allowed" but still errors
**Cause:** Old auth middleware causing issues
**Solution:**
Check if backend logs show authentication errors:
```
Token is not valid
```
This means the token format changed. Clear cookies and login again.

---

## 📊 Quick Diagnostic Commands

### From Developer Machine:

#### Test Backend Accessibility:
```powershell
# Test if backend is accessible from network
curl http://192.168.29.154:5000/api/doctors

# Should return JSON with doctors list
```

#### Test Frontend Build:
```powershell
cd frontend
npm run build

# Should complete without errors
```

#### Check Network Connectivity:
```powershell
# Get your network IP
ipconfig

# Look for "IPv4 Address" under "Wireless LAN adapter Wi-Fi"
# Should be 192.168.29.154 (or similar)
```

### From Tester's Machine:

#### Test Direct API Access:
Open browser and visit:
```
http://192.168.29.154:5000/api/doctors
```
Should see JSON response (even without login - it's a public route)

If you see an error or "Cannot connect", the issue is:
- Backend not running
- Firewall blocking port 5000
- Different WiFi network

---

## 🔥 Nuclear Option: Full Reset

If nothing works, do a complete reset:

### On Developer Machine:
```powershell
# Stop all servers (Ctrl+C in both terminals)

# Backend
cd backend
Remove-Item -Recurse -Force node_modules
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

### On Tester's Machine:
1. Close browser completely
2. Clear all browser data (not just cookies)
3. Restart browser
4. Try in Incognito mode first

---

## ✅ Expected Successful Flow

```
Developer Machine:
  Backend Terminal: 
    ✅ MongoDB connected successfully
    ✅ Server running on port 5000
    ✅ CORS allowed for: http://192.168.29.154:3000

  Frontend Terminal:
    ✅ ready - started server on 0.0.0.0:3000

Tester's Machine (192.168.29.XXX):
  Browser (http://192.168.29.154:3000):
    ✅ Login successful
    ✅ 2FA successful
    ✅ Dashboard loads
    ✅ Doctors list loads
    ✅ Appointments list loads
    ✅ Staff list loads
    
  DevTools Network Tab:
    ✅ All API calls show 200 OK
    ✅ Authorization header present in all requests
    
  DevTools Console:
    ✅ No errors
```

---

## 📝 Summary of All Fixes Applied

1. **Backend Authentication:**
   - Fixed double password hashing in staff/doctor creation
   - Fixed doctor password change endpoint
   - Set `emailVerified: true` for admin-created accounts
   - Improved error messages

2. **Frontend Cookies:**
   - Added `path: '/'` to all cookie operations
   - Added `sameSite: 'lax'` for network compatibility
   - Fixed cookie removal to use same path

3. **Backend CORS:**
   - Added logging for debugging
   - Explicitly allowed methods and headers
   - Verified network IP regex pattern

4. **Frontend API:**
   - Cookie removal uses correct path
   - Token properly extracted from cookies

---

## 🆘 If Still Not Working

Provide this information:

### From Backend Terminal:
```
[Copy the startup logs]
```

### From Frontend Terminal:
```
[Copy the startup logs]
```

### From Tester's Browser DevTools:
**Network Tab:**
- Screenshot of failed request
- Request headers
- Response headers
- Response body

**Console Tab:**
- [Copy any error messages]

**Application Tab → Cookies:**
- Screenshot of token cookie details

With this info, I can diagnose the exact issue!
