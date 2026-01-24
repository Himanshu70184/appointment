# Patient Workflow - Quick Start Guide

## 🚀 Implementation Complete!

The complete patient workflow has been implemented according to your specifications. Below is everything you need to know to test and use the new features.

## ✅ What's Been Implemented

### Backend (Express.js)
- ✅ New route: `/api/patient-portal/*` with 10 endpoints
- ✅ Public appointment booking with user registration
- ✅ Payment processing integration
- ✅ Minor patient validation (under 18 requires guardian info)
- ✅ Slot conflict detection and handling
- ✅ Intake form submission
- ✅ Patient dashboard statistics
- ✅ Profile management (update name, phone, password)
- ✅ Coupon validation and discount calculation

### Frontend (Next.js + React)
- ✅ Multi-step booking page (`/patient/book`)
- ✅ Patient dashboard with stats (`/patient/dashboard`)
- ✅ Intake form page (`/patient/intake/[id]`)
- ✅ Appointment details page (`/patient/appointment/[id]`)
- ✅ Profile management page (`/patient/profile`)
- ✅ Redux state management via `patientPortalSlice`

### Database Updates
- ✅ Appointment model: Added `intakeSubmitted`, `paymentCompleted` fields
- ✅ User model: Added `firstName`, `lastName`, `isMinor` fields

## 🏃 How to Run

### 1. Start Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on: `http://localhost:5000`

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: `http://localhost:3000`

### 3. Access Patient Portal
Navigate to: **http://localhost:3000/patient/book**

## 📖 User Journey

### New Patient Books Appointment

1. **Visit** `/patient/book`
2. **Step 1**: Select State, Card Type, and Date
3. **Step 2**: Choose available time slot
4. **Step 3**: Enter personal info, guardian info (if under 18), and payment details
5. **Submit** → Payment processes → Account created
6. **Redirect** to `/patient/intake/[id]` to complete medical intake form
7. **After intake** → Status changes to "Waiting for Approval"
8. **Dashboard** → View all appointments at `/patient/dashboard`

### Existing Patient Login

1. Login with email and password
2. Navigate to `/patient/dashboard`
3. View appointment stats and list
4. Click "View Details" or "Complete Intake"
5. Manage profile at `/patient/profile`

## 🧪 Testing Scenarios

### Test 1: Adult Patient Booking
- Use DOB: `1990-05-15` (over 18)
- Guardian fields should NOT appear
- Complete booking flow
- Submit payment
- Complete intake form

### Test 2: Minor Patient Booking
- Use DOB: `2010-05-15` (under 18)
- Guardian fields SHOULD appear (required)
- System validates guardian info
- Complete booking with guardian details

### Test 3: Slot Conflict
1. Book an appointment for specific time
2. Try booking same slot again (different browser/incognito)
3. Second booking should show "slot conflict" error after payment
4. User redirected to choose another slot

### Test 4: Coupon Code
- Apply valid coupon code during booking
- Verify discount is calculated
- Final amount should reflect discount

### Test 5: Dashboard & Profile
- Login as patient
- View dashboard with stats
- Click "Edit Profile"
- Update name and phone
- Change password

## 📍 Key URLs

| Page | URL | Access |
|------|-----|--------|
| Public Booking | `/patient/book` | Public |
| Patient Dashboard | `/patient/dashboard` | Patient only |
| Intake Form | `/patient/intake/[id]` | Patient only |
| Appointment Details | `/patient/appointment/[id]` | Patient only |
| Profile Management | `/patient/profile` | Patient only |

## 🔑 API Endpoints Reference

### Public Endpoints
```
GET  /api/patient-portal/available-slots?state=CA&date=2026-01-25&cardType=<ID>
POST /api/patient-portal/book-appointment
GET  /api/patient-portal/states
POST /api/patient-portal/validate-coupon
```

### Protected Endpoints (Requires Patient Login)
```
POST /api/patient-portal/submit-intake/:appointmentId
GET  /api/patient-portal/dashboard-stats
GET  /api/patient-portal/appointments
GET  /api/patient-portal/appointment/:id
PUT  /api/patient-portal/profile
PUT  /api/patient-portal/change-password
```

## 📊 Appointment Statuses

| Status | Description | When It Happens |
|--------|-------------|-----------------|
| **pending** | Payment done, intake not submitted | After successful payment |
| **approval** | Waiting for doctor/admin approval | After intake submission |
| **scheduled** | Confirmed by doctor/admin | Admin/doctor approves |
| **on-hold** | Needs attention (missing docs, etc.) | Admin sets |
| **rescheduled** | Date/time changed | Admin reschedules |
| **completed** | Consultation finished | Doctor marks complete |
| **cancelled** | Cancelled by patient/admin | Cancellation action |

## ⚠️ Important Notes

### Minor Patient Rules
- Patients under 18 automatically flagged as `isMinor: true`
- Guardian Name, Phone, and Address are **required**
- System validates age based on Date of Birth

### Payment Flow
- Payment processed via `utils/payment.js`
- On failure: User and Appointment are deleted (rollback)
- On success: Appointment marked as `paymentCompleted: true`

### Slot Availability
- Slots checked in real-time from doctor availability
- Already booked slots are filtered out
- Slot re-checked before payment to prevent conflicts

### Intake Form
- Required AFTER payment
- Appointment status changes from "pending" to "approval" after submission
- Dashboard shows "Intake Pending" warning if not submitted

## 🎨 UI Components

### Status Badges (Color Coded)
- 🟢 **Scheduled**: Green
- 🟡 **Approval**: Yellow
- 🟠 **Pending**: Orange
- 🔴 **On Hold**: Red
- 🔵 **Completed**: Blue
- ⚫ **Cancelled**: Gray
- 🟣 **Rescheduled**: Purple

### Dashboard Stats Cards
8 cards showing:
- Total Appointments
- Scheduled
- Awaiting Approval
- Pending
- Rescheduled
- Completed
- On Hold
- Cancelled

## 🛠️ Troubleshooting

### "No available slots" message
- Check if doctors exist in the selected state
- Verify doctor has availability configured
- Ensure selected date is not in the past
- Check if all slots are already booked

### Payment fails
- Verify payment gateway configuration in `.env`
- Check `utils/payment.js` implementation
- Ensure payment data is complete

### Intake form not accessible
- Verify payment is completed
- Check `paymentCompleted` field in appointment
- Ensure user is logged in

### Can't access patient dashboard
- Verify user is logged in
- Check user `role_id` is 3 (patient)
- Check JWT token is valid

## 📚 Documentation

For complete implementation details, see:
- [PATIENT_WORKFLOW_IMPLEMENTATION.md](./PATIENT_WORKFLOW_IMPLEMENTATION.md) - Full technical documentation
- [backend/routes/patient-portal.js](./backend/routes/patient-portal.js) - API implementation
- [frontend/store/slices/patientPortalSlice.ts](./frontend/store/slices/patientPortalSlice.ts) - State management

## 🎯 Next Steps

1. **Test the complete flow** end-to-end
2. **Configure payment gateway** with real credentials
3. **Set up email notifications** (confirmation, reminders)
4. **Add document upload** functionality
5. **Implement appointment cancellation/rescheduling**

## ✨ Features Included

- ✅ Multi-step booking wizard
- ✅ Real-time slot availability
- ✅ Minor patient handling with guardian validation
- ✅ Coupon code support
- ✅ Payment integration
- ✅ Slot conflict detection
- ✅ Medical intake form
- ✅ Patient dashboard with comprehensive stats
- ✅ Profile management
- ✅ Password change
- ✅ Responsive design (mobile-friendly)
- ✅ Form validation (React Hook Form + Zod)
- ✅ Error handling
- ✅ Loading states
- ✅ Success messages

---

**Status**: ✅ Ready for Testing
**Date**: January 24, 2026
**Implementation**: Complete

Need help? Check the full documentation or review the code comments!
