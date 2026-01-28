# 🌐 Network Access Setup for Testing Team

## 📋 Quick Setup Guide

Your testing team can now access the EHR system from any device on the same network!

---

## 🔧 What Was Changed

### Frontend (Next.js)
- Updated `package.json` to bind to all network interfaces
- Command changed from `next dev` to `next dev -H 0.0.0.0`

### Backend (Express API)
- Updated `server.js` to listen on `0.0.0.0`
- Now accessible from network devices

---

## 🖥️ Getting Your Network IP

### Option 1: Run PowerShell Script
```powershell
.\show-network-urls.ps1
```

### Option 2: Manual Check
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (WiFi/Ethernet)
Example: `192.168.1.100` or `10.0.0.50`

### Option 3: Quick Command
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*"}).IPAddress
```

---

## 🌐 Network URLs

Once you have your IP address (let's say it's `192.168.1.100`):

### Frontend URL
```
http://192.168.1.100:3000
```

### Backend API URL
```
http://192.168.1.100:5000
```

### Share with Testing Team
Send them the Frontend URL. They should be able to:
- Access the login page
- Register new accounts
- Book appointments
- Test all features

---

## 🔥 Windows Firewall Setup

### Quick Setup (Run as Administrator)

**Option 1: Using PowerShell Script**
Right-click PowerShell → Run as Administrator
```powershell
cd D:\office-cmx\appointment
.\show-network-urls.ps1
```
Follow the prompts to add firewall rules automatically.

**Option 2: Manual Commands**
```powershell
# Allow Next.js (Port 3000)
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# Allow Express API (Port 5000)
New-NetFirewallRule -DisplayName "Express API Server" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

**Option 3: GUI Method**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" → Specific local ports: `3000`
6. Allow the connection → Next → Next
7. Name it "Next.js Dev Server" → Finish
8. Repeat for port `5000` (name it "Express API Server")

---

## 🚀 Starting the Servers

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```
You should see:
```
Server running on http://localhost:5000
Network: Server accessible on local network at http://<your-ip>:5000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
You should see:
```
- Local:        http://localhost:3000
- Environments: .env.local
- Network:      http://192.168.1.100:3000  ← Share this URL!
```

---

## ✅ Testing Team Checklist

### For Testing Team Members:
1. ✅ Connect to the same WiFi network as the developer
2. ✅ Open any web browser (Chrome, Firefox, Safari, Edge)
3. ✅ Enter the Network URL: `http://<IP>:3000`
4. ✅ You should see the EHR login page

### Test Accounts
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

### Issue: Cannot connect from other devices

**Check 1: Same Network**
- Ensure all devices are on the same WiFi/network
- Check WiFi name matches on all devices

**Check 2: Firewall**
- Run firewall setup commands above
- Or temporarily disable Windows Firewall to test

**Check 3: Server Running**
- Make sure both frontend and backend are running
- Check terminal output for "Network:" URLs

**Check 4: Correct IP**
- Verify IP address hasn't changed
- Re-run `ipconfig` to confirm

**Check 5: Port Accessibility**
Test if ports are open from another device:
```bash
# On testing device (if curl is available)
curl http://<YOUR_IP>:3000
curl http://<YOUR_IP>:5000/api/health
```

### Issue: "Network URL not showing in Next.js output"

Stop the frontend server (Ctrl+C) and restart:
```bash
cd frontend
npm run dev
```
The `-H 0.0.0.0` flag should now show network URLs.

### Issue: Backend not accessible

Check `backend/server.js` has:
```javascript
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  // ...
});
```

---

## 📱 Mobile Testing

Your testing team can test on:
- ✅ Smartphones (iOS/Android)
- ✅ Tablets
- ✅ Other laptops/desktops
- ✅ Any device with a web browser on the same network

Just open the browser and go to: `http://<YOUR_IP>:3000`

---

## 🔒 Security Notes

⚠️ **Important:**
- These settings are for **development/testing only**
- Never expose development servers to the internet
- Only use on trusted local networks
- For production, use proper deployment with HTTPS

---

## 📊 Network Diagram

```
┌─────────────────┐
│  Your Computer  │
│  (Developer)    │
│                 │
│  Frontend:3000  │
│  Backend:5000   │
└────────┬────────┘
         │
    WiFi Router
    192.168.1.1
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───┴───┐ ┌──┴───┐  ┌───┴───┐  ┌──┴───┐
│Tester1│ │Tester2│ │Tester3│ │Mobile│
│Laptop │ │Tablet │ │Desktop│ │Phone │
└───────┘ └──────┘  └───────┘  └──────┘

All access: http://192.168.1.100:3000
```

---

## 🎯 Quick Reference

| Component | Local URL | Network URL (example) |
|-----------|-----------|----------------------|
| Frontend  | http://localhost:3000 | http://192.168.1.100:3000 |
| Backend   | http://localhost:5000 | http://192.168.1.100:5000 |

**Replace `192.168.1.100` with YOUR actual IP address!**

---

## 💡 Pro Tips

1. **Static IP**: Consider setting a static IP on your development machine to avoid changing URLs
2. **Bookmark**: Testing team can bookmark the URL for easy access
3. **QR Code**: Generate a QR code of the URL for easy mobile testing
4. **Network Name**: Make sure everyone knows the WiFi name to connect to

---

Need help? Check the troubleshooting section or restart both servers!
