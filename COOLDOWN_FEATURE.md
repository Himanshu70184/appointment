# Cooldown Functionality

## Overview
A per-state booking cooldown prevents patients from booking a new appointment for a configured number of months after completing an appointment in the same state. The cooldown is configurable by admins and enforced for both patient self-booking and admin/staff booking.

## Business Rules
- Cooldown is per state (not per appointment type).
- Cooldown starts when an appointment is marked as completed.
- When active, booking is blocked until the eligible date.
- Admin/staff can override the cooldown with a required reason.
- Dates displayed to users are in MM/DD/YYYY format.

## Configuration (Admin)
Admins set cooldown months per state in the States Management screen.
- Field name: `cooldownMonths`
- Value: integer 0 to 120
- 0 means no cooldown for that state

## Data Model Updates
- State model: `cooldownMonths` (Number)
- Appointment model: `completedAt` (Date)

## Backend Enforcement
### Shared Helper
- File: backend/utils/bookingCooldown.js
- Function: `getStateCooldownBlock({ patientId, stateCode })`
- Returns `null` when no block; otherwise returns:
  - `cooldownMonths`
  - `eligibleDate`
  - `eligibleDateFormatted` (MM/DD/YYYY)
  - `stateName`

### Patient Booking Flow
- Route: POST /api/patient-portal/book-appointment
- File: backend/routes/patient-portal.js
- Logic:
  - If patient exists and has a completed appointment in the same state within cooldown window, the booking is blocked.
  - Response message includes the next eligible date (MM/DD/YYYY).

### Admin/Staff Booking Flow
- Route: POST /api/appointments/admin-book-patient
- File: backend/routes/appointments.js
- Logic:
  - If patient exists and is within cooldown, booking is blocked.
  - Override supported with:
    - `overrideCooldown: true`
    - `overrideReason: string (min 3 chars)`
  - Override reason is stored in `adminNotes`.

### Completion Timestamp
- Route: PUT /api/appointments/:id/complete
- Route: PUT /api/appointments/:id/status (when status = completed)
- File: backend/routes/appointments.js
- Action: sets `completedAt` to current date.

## Frontend UI
### States Admin
- State form includes `Cooldown Months` input.
- States table shows `Cooldown (Months)`.

### Patient Booking
- Appointment date input uses MM/DD/YYYY with calendar picker.
- DOB input uses MM/DD/YYYY with calendar picker.
- Booking errors show toast with MM/DD/YYYY eligible date.

### Admin/Staff Booking
- Appointment date input uses MM/DD/YYYY with calendar picker.
- DOB input uses MM/DD/YYYY with calendar picker.

## API Error Message Example
```
You must wait 8 months after a completed appointment in California. Next eligible date: 06/03/2026.
```

## File Map
Backend:
- backend/models/State.js
- backend/models/Appointment.js
- backend/routes/states.js
- backend/routes/patient-portal.js
- backend/routes/appointments.js
- backend/utils/bookingCooldown.js

Frontend:
- frontend/components/StateFormModal.tsx
- frontend/app/states/page.tsx
- frontend/app/patient/book/page.tsx
- frontend/app/appointments/book/page.tsx
- frontend/types/index.ts

## Testing Checklist
- Set cooldownMonths > 0 for a state.
- Complete an appointment for a patient in that state.
- Attempt to book again in the same state:
  - Patient booking should be blocked with MM/DD/YYYY eligible date.
  - Admin/staff booking should be blocked unless override is provided.
- Override booking with reason and confirm appointment is created.
- Set cooldownMonths = 0 and confirm booking is allowed.
