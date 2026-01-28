# 🔧 Network Access - Quick Fix Guide

## ✅ Changes Made

### 1. Smart API URL Detection ([lib/api.ts](frontend/lib/api.ts))
The frontend now automatically detects if you're accessing via:
- **localhost** → calls API at `http://localhost:5000`
- **Network IP** → calls API at `http://192.168.29.154:5000`

No manual configuration needed! 🎉

### 2. CORS Configuration ([server.js](backend/server.js))
Backend now accepts requests from:
- `http://localhost:3000`
- `http://192.168.29.154:3000`
- Any IP address on your network

### 3. Network IP Display
Both servers show your network IP on startup!

---

## 🚀 How to Restart (IMPORTANT!)

### Step 1: Stop Both Servers
In both terminals, press **Ctrl+C** to stop the servers

### Step 2: Restart Backend
```bash
cd backend
npm run dev
```

You should see:
```
═══════════════════════════════════════════════════
  EHR System Backend API - Running
═══════════════════════════════════════════════════
  📱 Local:    http://localhost:5000
  🌐 Network:  http://192.168.29.154:5000
═══════════════════════════════════════════════════
```

### Step 3: Restart Frontend
```bash
cd frontend
npm run dev
```

You should see:
```
═══════════════════════════════════════════════════
  EHR System Frontend - Development Server
═══════════════════════════════════════════════════
  📱 Local:      http://localhost:3000
  🌐 Network:    http://192.168.29.154:3000
═══════════════════════════════════════════════════
```

---

## 🧪 Testing

### Local Access (Your Computer)
- Open: `http://localhost:3000`
- Login with test credentials
- ✅ Should work perfectly

### Network Access (Testing Team)
- Share: `http://192.168.29.154:3000`
- They should be on the same WiFi
- Login with test credentials
- ✅ Should work perfectly now!

### Test Credentials
```
Admin:
Email: admin@test.com
Password: admin123

Doctor:
Email: doctor@test.com
Password: doctor123

Patient:
Email: patient@test.com
Password: patient123
```

---

## 🐛 Troubleshooting

### "Port 5000 already in use"
Kill the process:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

### "Port 3000 already in use"
Kill the process:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### Network login still not working
1. ✅ Verify backend is running (check terminal)
2. ✅ Verify frontend is running (check terminal)
3. ✅ Open browser console (F12) and check for errors
4. ✅ Make sure both devices on same WiFi
5. ✅ Check Windows Firewall (see NETWORK_ACCESS_SETUP.md)

---

## 💡 How It Works

```
User accesses from network: http://192.168.29.154:3000
         ↓
Frontend detects hostname: "192.168.29.154"
         ↓
Automatically sets API to: http://192.168.29.154:5000
         ↓
Login request goes to correct backend
         ↓
CORS allows the request (192.168.29.154:3000)
         ↓
Login successful! 🎉
```

The system is now **network-aware** and automatically adapts! 

---

## 📱 Share These URLs

**For Your Testing Team:**
```
Frontend: http://192.168.29.154:3000
```

**For Local Development:**
```
Frontend: http://localhost:3000
```

Both work simultaneously! No need to change configuration when switching between local and network access.

---

**Next Steps:** Restart both servers as shown above! 🚀
