# Complete Testing Guide

See `SETUP_GUIDE.md` for setup instructions.

## Quick Test Steps

1. **Create test data:**
   ```bash
   cd backend
   npm run create-test-data
   ```

2. **Start servers:**
   - Backend: `cd backend && npm run dev`
   - Frontend: `cd frontend && npm run dev`

3. **Test accounts:**
   - Patient: `patient@test.com` / `patient123`
   - Admin: `admin@test.com` / `admin123`
   - Doctor: `doctor@test.com` / `doctor123`

4. **Test registration:**
   - Go to http://localhost:3000/register
   - Register new user
   - Check backend console for verification token
   - Visit: `http://localhost:3000/verify-email?token=TOKEN`
   - Set password and login

5. **Test booking:**
   - Login as patient
   - Click "Book Appointment"
   - Select medical card
   - Fill payment form (will fail without Authorize.net - that's expected)

For detailed testing scenarios, see the main documentation.
