# Patient Workflow Implementation Guide

## Overview
This document outlines the complete implementation of the patient workflow for the MMJ-Docs EHR system, including appointment booking, payment processing, intake form submission, and patient dashboard management.

## 📋 Table of Contents
1. [Architecture](#architecture)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [User Journey](#user-journey)
5. [API Endpoints](#api-endpoints)
6. [Testing Guide](#testing-guide)

---

## Architecture

### Database Schema Updates
**Appointment Model** (`backend/models/Appointment.js`)
- Added `intakeSubmitted` (Boolean) - tracks if patient submitted intake form
- Added `intakeSubmittedAt` (Date) - timestamp of intake submission
- Added `paymentCompleted` (Boolean) - tracks payment status
- Added `paymentCompletedAt` (Date) - timestamp of successful payment

**User Model** (`backend/models/User.js`)
- Added `firstName` (String) - patient's first name
- Added `lastName` (String) - patient's last name
- Added `isMinor` (Boolean) - indicates if patient is under 18

### State Management
**Redux Slice**: `frontend/store/slices/patientPortalSlice.ts`
- Manages patient-specific state (appointments, stats, slots)
- Handles async operations for booking, intake, profile updates

---

## Backend Implementation

### Routes: `/api/patient-portal/*`
Location: `backend/routes/patient-portal.js`

#### Public Routes
1. **GET /available-slots** - Get available appointment slots
   - Query params: `state`, `date`, `cardType`
   - Returns: Array of available time slots with doctor info

2. **POST /book-appointment** - Book appointment with registration
   - Creates user account
   - Validates minor patient (requires guardian info)
   - Checks slot availability
   - Processes payment
   - Handles slot conflicts

3. **GET /states** - Get active states with pricing
4. **POST /validate-coupon** - Validate and calculate coupon discount

#### Protected Routes (Patient Only)
5. **POST /submit-intake/:appointmentId** - Submit medical intake form
   - Validates payment completion
   - Updates appointment status to "approval"

6. **GET /dashboard-stats** - Get appointment statistics
7. **GET /appointments** - Get all patient appointments
8. **GET /appointment/:id** - Get specific appointment details
9. **PUT /profile** - Update patient profile (name, phone)
10. **PUT /change-password** - Change patient password

### Key Backend Features

#### Minor Patient Validation
```javascript
const age = today.getFullYear() - birthDate.getFullYear()
const isMinor = age < 18 || (age === 18 && monthDiff < 0)

if (isMinor && (!guardianName || !guardianPhone || !guardianAddress)) {
  return res.status(400).json({
    message: 'Guardian information required for patients under 18',
    isMinor: true
  })
}
```

#### Slot Conflict Handling
```javascript
const existingAppointment = await Appointment.findOne({
  scheduledDate: new Date(scheduledDate),
  scheduledTime,
  doctor_id,
  status: { $in: ['scheduled', 'approval', 'pending'] }
})

if (existingAppointment) {
  return res.status(409).json({
    message: 'This slot has been booked by someone else',
    slotConflict: true
  })
}
```

#### Payment and Booking Transaction
- Creates user → Creates appointment → Processes payment
- On payment failure: Deletes appointment and user (rollback)
- On success: Updates appointment with payment info

---

## Frontend Implementation

### Pages Structure
```
frontend/app/patient/
├── book/page.tsx              # Step-by-step booking flow
├── dashboard/page.tsx         # Patient dashboard with stats
├── profile/page.tsx           # Profile and password management
├── appointment/[id]/page.tsx  # View appointment details
└── intake/[id]/page.tsx       # Submit intake form
```

### Booking Flow (3 Steps)

#### Step 1: Slot Selection
- Select state, card type, and date
- Display medical card options with pricing
- Validate all selections before proceeding

#### Step 2: Time Selection
- Fetch available slots from backend
- Display doctor names with time slots
- Handle no-availability scenario
- Re-check slot availability on selection

#### Step 3: Registration & Payment
- Collect patient information (name, email, phone, DOB, password)
- Auto-detect minor patients (under 18) via DOB
- Show guardian fields for minors
- Apply coupon codes with real-time validation
- Collect payment information
- Submit booking with payment

### Patient Dashboard

**Appointment Statistics Cards:**
- Total Appointments
- Scheduled (confirmed)
- Awaiting Approval
- Pending (missing payment/intake)
- Rescheduled
- Completed
- On Hold
- Cancelled

**Appointments Table:**
- Sr. No, Service, Date & Time, State, Price, Status
- Status badges with color coding
- "Intake Pending" warning for incomplete appointments
- Quick actions: View Details, Complete Intake

### Profile Management

**View Mode:**
- Display read-only information
- Email is non-editable
- DOB is non-editable
- Shows Patient ID (PRN)

**Edit Mode:**
- Edit first name, last name, phone
- Validation via React Hook Form + Zod
- Save/Cancel options

**Password Change:**
- Separate form for security
- Requires new password + confirmation
- Minimum 6 characters validation

---

## User Journey

### 1. New Patient Booking
```
Public Landing → /patient/book
  ↓
Step 1: Select State + Card Type + Date
  ↓
Step 2: Choose Available Time Slot
  ↓
Step 3: Enter Details + Payment
  ↓
Payment Processing
  ↓
Success → Redirect to /patient/intake/[id]
```

### 2. Intake Form Submission
```
/patient/intake/[id]
  ↓
Fill Medical Information
  ↓
Submit Form
  ↓
Appointment Status → "Approval"
  ↓
Redirect to /patient/dashboard
```

### 3. Dashboard Access
```
/patient/dashboard
  ↓
View Stats + Appointments List
  ↓
Actions:
  - View Details → /patient/appointment/[id]
  - Complete Intake → /patient/intake/[id]
  - Book New → /patient/book
  - Edit Profile → /patient/profile
```

---

## API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patient-portal/available-slots` | Get available appointment slots |
| POST | `/api/patient-portal/book-appointment` | Book appointment with registration & payment |
| GET | `/api/patient-portal/states` | Get active states |
| POST | `/api/patient-portal/validate-coupon` | Validate coupon code |

### Protected Endpoints (Patient)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patient-portal/submit-intake/:id` | Submit intake form |
| GET | `/api/patient-portal/dashboard-stats` | Get appointment statistics |
| GET | `/api/patient-portal/appointments` | Get all patient appointments |
| GET | `/api/patient-portal/appointment/:id` | Get appointment details |
| PUT | `/api/patient-portal/profile` | Update profile |
| PUT | `/api/patient-portal/change-password` | Change password |

---

## Special Scenarios

### 1. Minor Patient (Under 18)
- System auto-detects based on date of birth
- Mandatory guardian fields: Name, Phone, Address
- Appointment marked with `isMinor: true`
- Yellow warning badge on appointment details

### 2. Slot Conflict After Payment
- Payment succeeds but slot is taken
- User sees: "This slot is booked by someone else"
- System shows slot selection again
- No additional payment required
- Auto-redirects to intake after new slot selection

### 3. Payment Failure
- Appointment and user deleted (rollback)
- User sees error message with "Retry" option
- Can restart booking process

### 4. Drop-off After Payment
- User account created
- Payment completed
- Intake form not submitted
- Dashboard shows "Intake Pending" warning
- Status remains "pending" until intake submitted

### 5. Invalid Coupon
- Real-time validation on "Apply" button
- Error message displayed
- Can proceed without coupon
- Original price displayed

---

## Testing Guide

### Backend Testing

#### 1. Test Slot Availability
```bash
curl http://localhost:5000/api/patient-portal/available-slots?state=CA&date=2026-01-25&cardType=<CARD_ID>
```

#### 2. Test Booking (with Minor)
```bash
curl -X POST http://localhost:5000/api/patient-portal/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "johndoe@test.com",
    "phone": "1234567890",
    "dateOfBirth": "2010-05-15",
    "password": "test123",
    "state": "CA",
    "cardType": "<CARD_ID>",
    "scheduledDate": "2026-01-25",
    "scheduledTime": "10:00 AM",
    "doctor_id": "<DOCTOR_ID>",
    "guardianName": "Jane Doe",
    "guardianPhone": "9876543210",
    "guardianAddress": "123 Main St",
    "payment": { ... }
  }'
```

#### 3. Test Coupon Validation
```bash
curl -X POST http://localhost:5000/api/patient-portal/validate-coupon \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "SAVE10", "amount": 100}'
```

### Frontend Testing

#### 1. Test Booking Flow
- Navigate to `/patient/book`
- Select state, card, and date
- Verify available slots appear
- Select slot and proceed
- Enter valid patient info (adult)
- Verify form validation
- Test with DOB < 18 years (verify guardian fields appear)
- Apply invalid coupon (verify error)
- Apply valid coupon (verify discount calculation)
- Submit booking

#### 2. Test Dashboard
- Login as patient
- Navigate to `/patient/dashboard`
- Verify stats cards display correctly
- Check appointment list
- Click "View Details" on appointment
- Verify appointment details page

#### 3. Test Intake Form
- From dashboard, click "Complete Intake"
- Fill required fields
- Submit form
- Verify redirect to dashboard
- Check appointment status changed to "approval"

#### 4. Test Profile Management
- Navigate to `/patient/profile`
- Click "Edit Profile"
- Update name and phone
- Save changes
- Verify updates reflected
- Test password change

---

## Status Workflow

```
Appointment Status Flow:
pending → (intake submitted) → approval → (doctor approves) → scheduled → completed

Alternative Flows:
pending → (admin/doctor action) → on-hold
scheduled → (admin reschedule) → rescheduled
any → (patient/admin cancel) → cancelled
```

---

## Next Steps / Enhancements

1. **Email Notifications**
   - Appointment confirmation email
   - Intake reminder (24 hours after payment)
   - Appointment reminder (24 hours before scheduled time)

2. **Document Upload**
   - Add file upload to intake form
   - Support ID, medical records, guardian ID

3. **Appointment Cancellation**
   - Patient-initiated cancellation
   - Refund workflow

4. **Rescheduling**
   - Patient can request reschedule
   - Admin approves and assigns new slot

5. **Video Consultation**
   - Integration with Zoom/Twilio
   - Join link on appointment details page

---

## File Reference

### Backend Files
- [patient-portal.js](backend/routes/patient-portal.js) - All patient portal routes
- [Appointment.js](backend/models/Appointment.js) - Updated appointment model
- [User.js](backend/models/User.js) - Updated user model with patient fields

### Frontend Files
- [patientPortalSlice.ts](frontend/store/slices/patientPortalSlice.ts) - Redux state management
- [book/page.tsx](frontend/app/patient/book/page.tsx) - Booking flow
- [dashboard/page.tsx](frontend/app/patient/dashboard/page.tsx) - Patient dashboard
- [intake/[id]/page.tsx](frontend/app/patient/intake/[id]/page.tsx) - Intake form
- [profile/page.tsx](frontend/app/patient/profile/page.tsx) - Profile management
- [appointment/[id]/page.tsx](frontend/app/patient/appointment/[id]/page.tsx) - Appointment details

---

## Support

For issues or questions:
1. Check browser console for errors
2. Check backend logs for API errors
3. Verify MongoDB connection
4. Ensure all environment variables are set
5. Test API endpoints with Postman/curl

---

**Implementation Date**: January 24, 2026
**Version**: 1.0
**Status**: ✅ Complete and Ready for Testing
