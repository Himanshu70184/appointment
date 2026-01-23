# EHR System - Setup and Testing Guide

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

**Backend `.env`** (create in `backend/` folder):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ehr-system
JWT_SECRET=my-super-secret-jwt-key-minimum-32-characters-long-for-security
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env.local`** (create in `frontend/` folder):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3. Start MongoDB

**Option A: Local MongoDB**
- Windows: Should start automatically, or run `mongod`
- Mac/Linux: `sudo systemctl start mongod` or `brew services start mongodb-community`

**Option B: MongoDB Atlas (Cloud - Recommended)**
1. Sign up at https://www.mongodb.com/cloud/atlas (free)
2. Create cluster
3. Get connection string
4. Use as `MONGODB_URI` in `.env`

### 4. Create Test Data

```bash
cd backend
node scripts/create-test-data.js
```

This creates:
- Medical card types
- Admin user: `admin@test.com` / `admin123`
- Doctor user: `doctor@test.com` / `doctor123`
- Patient user: `patient@test.com` / `patient123`
- Staff user: `staff@test.com` / `staff123`

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on: http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:3000

### 6. Open Browser

Go to: **http://localhost:3000**

## Testing Functionality

### Test 1: Login with Test Account

1. Go to http://localhost:3000/login
2. Login with: `patient@test.com` / `patient123`
3. You should see the dashboard

### Test 2: Register New User

1. Go to http://localhost:3000/register
2. Fill the form:
   - Name: Test User
   - Email: newuser@test.com
   - Phone: 555-1234
   - State: CA
3. Click Register
4. Check backend console for verification token
5. Visit: `http://localhost:3000/verify-email?token=TOKEN_FROM_CONSOLE`
6. Set password
7. Login

### Test 3: Book Appointment

1. Login as patient
2. Click "Book Appointment"
3. Select a medical card type
4. Fill payment form (Note: Without Authorize.net, payment will fail - see below)
5. Complete intake form
6. Upload documents

**Note:** For testing without real payment gateway, you can temporarily modify the payment logic.

### Test 4: Admin Dashboard

1. Login as: `admin@test.com` / `admin123`
2. Access admin endpoints via API:
   - `GET http://localhost:5000/api/admin/stats`
   - `GET http://localhost:5000/api/admin/appointments`

### Test 5: API Testing with Postman/Thunder Client

**Login and Get Token:**
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "patient@test.com",
  "password": "patient123"
}
```

**Use Token for Authenticated Requests:**
```
GET http://localhost:5000/api/appointments
Authorization: Bearer YOUR_TOKEN_HERE
```

## Common Issues

### MongoDB Connection Error
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- For Atlas, whitelist your IP address

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

### CORS Error
- Verify `FRONTEND_URL` in backend `.env` matches frontend URL
- Ensure frontend is running

### Module Not Found
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Testing Without Real Services

### Email (Mailchimp)
- Without API key: Emails won't send
- Check backend console for verification tokens
- Tokens are stored in database

### Payment (Authorize.net)
- Without credentials: Payment will fail
- For testing, you can modify `backend/utils/payment.js` to skip real payment

## Next Steps

1. Set up real email service
2. Configure payment gateway
3. Deploy to production
4. Set up monitoring

For detailed instructions, see the main README.md
