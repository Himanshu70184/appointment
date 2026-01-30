# Network Access 401 Error Fix

## 🐛 Problem
When testing team accessed the app via network IP (e.g., `http://192.168.29.154:3000`):
- ✅ Login worked
- ✅ 2FA worked
- ❌ Subsequent API calls (doctors list, patients list, etc.) returned **401 Unauthorized**

## 🔍 Root Cause
**Cookie Path and SameSite Issues**

When cookies were set with `Cookies.set('token', token, { expires: 7 })`, they were:
1. **Missing explicit path**: Cookie was scoped to the current path only
2. **Missing SameSite attribute**: Browser's default SameSite policy could block the cookie
3. **Network IP domain mismatch**: Cookies set on one page might not be accessible on another

### Why Login Worked But List Calls Failed?
1. Login sets the cookie → works fine
2. User navigates to dashboard/doctors page
3. Cookie not accessible due to missing `path: '/'`
4. API interceptor doesn't find token → doesn't send `Authorization` header
5. Backend returns 401 because no token was sent

## ✅ Solution
Updated all cookie operations to use proper configuration:

```typescript
// ❌ BEFORE
Cookies.set('token', token, { expires: 7 })

// ✅ AFTER
Cookies.set('token', token, { expires: 7, sameSite: 'lax', path: '/' })
```

### What This Does:
- **`path: '/'`**: Makes cookie accessible from all pages/routes
- **`sameSite: 'lax'`**: Allows cookie to be sent with navigation requests
- **`expires: 7`**: Cookie valid for 7 days

## 📝 Files Modified

1. **frontend/store/slices/authSlice.ts**
   - Updated `login` thunk cookie setting
   - Updated `verify2FA` thunk cookie setting
   - Updated `setupPassword` thunk cookie setting
   - Updated `logout` reducer to remove cookie with path

2. **frontend/lib/api.ts**
   - Updated error interceptor to remove cookie with path

3. **frontend/app/patient/book/page.tsx**
   - Updated booking flow cookie setting

## 🧪 Testing Steps for Network Access

### 1. Clear Browser Data
Before testing, clear cookies and cache:
- Press `F12` → Application tab → Clear storage

### 2. Test Login Flow
```
1. Access: http://192.168.29.154:3000/login
2. Login with admin credentials
3. Complete 2FA if prompted
4. Check browser DevTools → Application → Cookies
   - Should see 'token' cookie with Path: /
5. Navigate to Doctors page
6. Should load successfully (no 401 errors)
```

### 3. Verify Cookie Settings
In browser DevTools → Application → Cookies, the token cookie should show:
- **Name**: `token`
- **Path**: `/`
- **SameSite**: `Lax`
- **Expires**: 7 days from now

### 4. Test All Protected Routes
- ✅ Dashboard
- ✅ Doctors list
- ✅ Patients list
- ✅ Appointments list
- ✅ Staff management
- ✅ States management

## 🚀 Deployment Instructions

### For Testing Team:

1. **Restart Frontend Dev Server**
   ```bash
   # On developer machine
   cd frontend
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear Browser Cache**
   - All testers must clear cookies/cache
   - Or use Incognito/Private mode for testing

3. **Test Login Again**
   - Login should work
   - All subsequent API calls should work
   - No more 401 errors on lists

### For Production:

```bash
# Rebuild frontend
cd frontend
npm run build

# Restart server (if using PM2)
pm2 restart frontend
```

## 🔍 How to Debug Network Issues

### Check if Token is Being Sent
1. Open DevTools → Network tab
2. Click on any API request (e.g., `/api/doctors`)
3. Check Request Headers
4. Should see: `Authorization: Bearer <token>`

### Check if Cookie is Set
1. DevTools → Application → Cookies
2. Look for domain: `192.168.29.154`
3. Should see `token` cookie with proper Path and SameSite

### Common Issues and Solutions

#### Issue: "Token cookie not visible in DevTools"
**Solution**: Clear all cookies and login again

#### Issue: "401 only on specific pages"
**Solution**: This was the original problem - now fixed with `path: '/'`

#### Issue: "Works on localhost but not on network IP"
**Solution**: 
- Ensure backend is accessible at `http://192.168.29.154:5000`
- Check Windows Firewall allows port 5000
- Verify backend CORS settings allow the network IP

#### Issue: "CORS errors on network access"
**Solution**: Update backend CORS configuration:
```javascript
// backend/server.js
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from any local network IP
    const allowed = !origin || 
                    origin.startsWith('http://localhost') ||
                    origin.startsWith('http://192.168.') ||
                    origin.startsWith('http://10.') ||
                    origin.startsWith('http://172.');
    callback(null, allowed);
  },
  credentials: true
};
app.use(cors(corsOptions));
```

## 📊 Cookie Security Best Practices

### Current Configuration (Development)
```typescript
{
  expires: 7,        // 7 days
  sameSite: 'lax',  // Allow navigation requests
  path: '/'         // Accessible from all routes
}
```

### Production Recommendations
```typescript
{
  expires: 7,
  sameSite: 'strict', // More secure (if no cross-site navigation needed)
  path: '/',
  secure: true,       // HTTPS only (enable in production)
  httpOnly: false     // Must be false for client-side access
}
```

**Note**: We can't use `httpOnly: true` because we need to read the token in JavaScript (api interceptor). For better security in production, consider using httpOnly cookies with a separate refresh token strategy.

## ✨ Summary

**What Was Fixed**:
- ✅ Added `path: '/'` to all cookie operations
- ✅ Added `sameSite: 'lax'` for network compatibility
- ✅ Consistent cookie settings across all auth operations

**Impact**:
- Users can now access the app via network IP without 401 errors
- Cookie persists across all routes and pages
- Works seamlessly on same WiFi network for testing team

**Next Steps**:
1. Restart frontend dev server
2. Testing team clears browser cache
3. Login and test all features
4. Should work perfectly! 🎉
