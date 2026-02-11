# Patient Booking Flow - Implementation Guide

## Overview
Complete patient-facing appointment booking system with payment processing, minor account handling, and intake form management.

---

## Flow Stages

### 1. **Appointment Selection** (`/patient/book`)
**Features:**
- Select appointment type (medical card type)
- Choose state
- Pick date from calendar
- View available time slots (filtered by doctor availability)
- No slot locking; availability is rechecked at booking and again after payment

**Technical Details:**
- Endpoint: `GET /api/patient-portal/available-slots`
- Filters: state, date, cardType
- Time Zone: EST (standardized across system)
- Returns: Available slots with doctor assignment
- Slots are not locked during step changes
- Availability is verified again after payment

---

### 2. **Patient Information & Payment** (`/patient/book`)
**Features:**
- Guest checkout allowed (no forced registration)
- Automatic minor detection based on date of birth (< 18 years)
- Guardian information required for minors
- Create account with email/password
- Apply discount coupon at checkout
- Secure payment processing
- If the slot becomes unavailable after payment, user is prompted to pick a new time without re-paying
- Booking summary shown above Step 2 (state, type, date, time, amount)

**Validation:**
- Age calculated from DOB
- Guardian fields mandatory for minors: name, phone, address
- Email uniqueness check
- Coupon validation before payment

**Technical Details:**
- Endpoint: `POST /api/patient-portal/book-appointment`
- Payment processed via `processPayment()` utility
- Account created only if email doesn't exist (guest checkout support)
- No slot lock token required

---

### 3. **Payment Processing**
**Payment Success Behavior:**

| User Type | Status After Payment | Next Step |
|-----------|---------------------|----------|
| Regular Patient (18+) | `pending` | Intake submission → `scheduled` |
| Minor (< 18) | `pending` | Intake submission → `approval` → admin approval → `scheduled` |

**Post-Payment Slot Conflict:**
- If another user books the slot first, the paid appointment is placed `on-hold`.
- The patient must select a new slot; payment is reused.
- Reschedule endpoint: `PUT /api/patient-portal/appointments/:id/reschedule`

**Payment Failure:**
- Appointment deleted
- User account deleted (only if newly created)
- Error returned with payment details

**Database Updates:**
```javascript
appointment.payment_id = payment._id
appointment.paymentCompleted = true
appointment.status = 'pending'
```

---

### 4. **Confirmation & Intake Prompt**
**Features:**
- Payment success confirmation
- Automatic redirect to intake form
- Different messaging for minors vs regular patients

**Response Data:**
```json
{
  "success": true,
  "message": "Appointment booked successfully!",
  "appointment": {
    "_id": "...",
    "status": "pending",
    "isMinor": false
  },
  "isNewUser": true,
  "redirectToIntake": true
}
```

---

### 5. **Intake Form Submission** (`/patient/intake/[id]`)
**Features:**
- Medical history collection
- Real-time eligibility checking
- Deadline enforcement (30 minutes before appointment)
- Time remaining countdown

**Validation Rules:**
✅ Payment must be completed  
✅ Must be submitted ≥30 minutes before appointment time  
✅ Cannot submit if already submitted  
✅ Cannot submit after deadline  

**Eligibility Check:**
- Endpoint: `GET /api/patient-portal/check-intake-eligibility/:appointmentId`
- Returns: eligible status, time remaining, deadline

**Technical Details:**
- Endpoint: `POST /api/patient-portal/submit-intake/:appointmentId`
- Auth: Required (patient role)
- Deadline calculation:
  ```javascript
  appointmentDateTime - 30 minutes = deadline
  if (now > deadline) → reject
  ```

---

## Status Workflow

### Regular Patient Flow
```
pending → (payment) → pending → (intake) → scheduled → (doctor review) → completed
```

### Minor Patient Flow
```
pending → (payment) → pending → (intake) → approval → (admin approves) → scheduled → completed
```

---

## Admin Approval for Minors

**Endpoint:** `POST /api/appointments/:id/approve-guardian`  
**Access:** Admin, Staff only  
**Required:** `isMinor: true` on appointment

**Approval Process:**
1. Admin reviews guardian information
2. Clicks "Approve" in admin portal
3. Appointment status: `approval` → `scheduled`
4. Patient notification sent
5. Patient can now access appointment

**Database Updates:**
```javascript
appointment.guardianApproved = true
appointment.guardianApprovedBy = admin._id
appointment.guardianApprovedAt = new Date()
appointment.status = 'scheduled'
```

---

## Key API Endpoints

| Endpoint | Method | Access | Purpose |
|----------|--------|--------|---------|
| `/api/patient-portal/available-slots` | GET | Public | Fetch time slots |
| `/api/patient-portal/book-appointment` | POST | Public | Book & pay |
| `/api/patient-portal/appointments/:id/reschedule` | PUT | Patient | Reschedule after conflict |
| `/api/patient-portal/check-intake-eligibility/:id` | GET | Patient | Check if intake can be submitted |
| `/api/patient-portal/submit-intake/:id` | POST | Patient | Submit intake form |
| `/api/appointments/:id/approve-guardian` | POST | Admin/Staff | Approve minor appointment |

---

## Frontend Components

### Booking Page (`app/patient/book/page.tsx`)
- Multi-step form (selection → details → payment)
- Minor field auto-show based on DOB
- Coupon validation
- Payment processing
- Redirect to intake on success

### Intake Page (`app/patient/intake/[id]/page.tsx`)
- Eligibility checking on load
- Time remaining display
- Deadline warnings
- Form validation
- Auto-redirect to dashboard on success

---

## Redux State Management

### Slice: `patientPortalSlice`

**Thunks:**
- `bookAppointment` - Complete booking with payment
- `checkIntakeEligibility` - Validate intake submission window
- `submitIntakeForm` - Submit medical intake data
- `getAvailableSlots` - Fetch appointment availability

**State Structure:**
```typescript
{
  appointments: Appointment[]
  availableSlots: Slot[]
  loading: boolean
  error: string | null
  success: string | null
}
```

---

## Database Models

### User
```javascript
{
  isMinor: Boolean,
  guardianName: String,
  guardianPhone: String,
  guardianAddress: String
}
```

### Appointment
```javascript
{
  isMinor: Boolean,
  guardianApproved: Boolean,
  guardianApprovedBy: ObjectId (User),
  guardianApprovedAt: Date,
  status: 'pending|scheduled|approval|completed',
  paymentCompleted: Boolean,
  paymentCompletedAt: Date,
  intakeSubmitted: Boolean,
  intakeSubmittedAt: Date,
  intakeForm: Mixed
}
```

---

## Security & Validation

### Backend Validation
- JWT token validation for authenticated routes
- Role-based access control (admin, staff, patient)
- Input sanitization via express-validator
- Payment verification before scheduling
- Slot conflict checking (atomic check before booking)

### Frontend Validation
- React Hook Form with Zod schemas
- Real-time age calculation for minor detection
- Coupon code validation before checkout
- Payment card format validation
- Intake deadline checking

---

## Time Zone Handling

**Current Implementation:** EST Standardized

All times stored and displayed in Eastern Standard Time (EST):
- Appointment scheduling
- Intake deadlines
- Calendar displays
- Email notifications

**Future Enhancement:** State-specific timezones can be added via State model configuration.

---

## Email Notifications

### Appointment Confirmation
**Trigger:** Successful payment  
**Template:** `appointment-confirmation`  
**Recipients:** Patient  
**Data:** Patient name, date, time, appointment ID

### Intake Submitted
**Trigger:** Intake form submission  
**Template:** `intake-submitted`  
**Recipients:** Doctor  
**Data:** Patient name, appointment details

### Approval Notification
**Trigger:** Admin approves minor appointment  
**Template:** `appointment-approved`  
**Recipients:** Patient (minor's guardian)

---

## Error Handling

### Payment Failure
```json
{
  "message": "Payment processing failed",
  "paymentFailed": true,
  "error": "Card declined"
}
```
**Action:** Delete appointment & user (if new), return to payment form

### Slot Conflict
```json
{
  "message": "Slot already booked",
  "slotConflict": true
}
```
**Action:** Refresh slots, return to time selection

### Intake Deadline Passed
```json
{
  "message": "Must submit 30 min before appointment",
  "intakeDeadlinePassed": true
}
```
**Action:** Show error, contact support prompt

---

## Testing Scenarios

### Test Case 1: Regular Patient Booking
1. Select appointment type & state
2. Choose date/time slot
3. Fill patient info (age > 18)
4. Apply valid coupon
5. Enter payment details
6. ✅ Payment success → status `scheduled`
7. Submit intake form
8. ✅ Appointment confirmed

### Test Case 2: Minor Patient Booking
1. Select appointment & slot
2. Fill patient info (age < 18)
3. Fill guardian information (required)
4. Process payment
5. ✅ Payment success → status `approval`
6. Admin reviews & approves
7. ✅ Status changes to `scheduled`
8. Patient submits intake
9. ✅ Appointment confirmed

### Test Case 3: Intake Deadline Enforcement
1. Book appointment for tomorrow 10:00 AM
2. Wait until 9:31 AM (29 min before)
3. ✅ Can submit intake
4. Wait until 9:30 AM (30 min before)
5. ❌ Cannot submit (deadline passed)

### Test Case 4: Guest Checkout
1. Use email of existing patient
2. Fill booking form
3. ✅ No duplicate user created
4. Appointment linked to existing user

---

## Future Enhancements

1. **State-Specific Timezones:** Read timezone from State model
2. **Intake Reminders:** Email/SMS 24 hours before deadline
3. **Partial Intake Saves:** Allow users to save progress
4. **Document Upload:** ID verification during intake
5. **Minor Approval Automation:** Auto-approve based on criteria
6. **Rescheduling:** Allow patients to reschedule within limits
7. **Coupon Auto-Apply:** Apply best available coupon automatically

---

## File Locations

### Backend
- Routes: [`backend/routes/patient-portal.js`](backend/routes/patient-portal.js)
- Appointment Model: [`backend/models/Appointment.js`](backend/models/Appointment.js)
- User Model: [`backend/models/User.js`](backend/models/User.js)
- Payment Utility: [`backend/utils/payment.js`](backend/utils/payment.js)

### Frontend
- Booking Page: [`frontend/app/patient/book/page.tsx`](frontend/app/patient/book/page.tsx)
- Intake Page: [`frontend/app/patient/intake/[id]/page.tsx`](frontend/app/patient/intake/[id]/page.tsx)
- Redux Slice: [`frontend/store/slices/patientPortalSlice.ts`](frontend/store/slices/patientPortalSlice.ts)

---

## Quick Start

### Run Backend
```bash
cd backend
npm install
npm run dev  # http://localhost:5000
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### Test Booking Flow
1. Visit: `http://localhost:3000/patient/book`
2. Follow booking steps
3. Check admin portal: `http://localhost:3000/appointments`
4. Approve minor appointments if needed

---

**Last Updated:** January 24, 2026  
**Implementation Status:** ✅ Complete and Production-Ready
