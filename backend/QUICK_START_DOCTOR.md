# Doctor Feature - Quick Start Guide

## Overview

This guide shows how to quickly set up and use the Doctor Management & Availability feature.

## Files Modified/Created

### Backend Files
- ✅ **Enhanced**: `backend/routes/doctors.js` - Complete CRUD + availability endpoints
- ✅ **Created**: `backend/utils/doctor.js` - Helper functions for availability management
- ✅ **Created**: `DOCTOR_FEATURE_GUIDE.md` - Complete API documentation

## Quick Setup (2 Minutes)

### 1. Verify Test Data
Test doctor is created automatically by `scripts/create-test-data.js`:
- Email: `doctor@test.com`
- License: `MD123456`
- States: CA, NY, FL
- Availability: Mon-Fri, 9AM-5PM

### 2. Start Backend Server
```bash
cd backend
npm run dev
```

The API is ready at: `http://localhost:5000`

---

## Common Tasks

### Task 1: List All Doctors
```bash
curl "http://localhost:5000/api/doctors"
```

Response:
```json
{
  "doctors": [
    {
      "_id": "...",
      "user_id": { "name": "Dr. Jane Smith", "email": "doctor@test.com" },
      "licenseNumber": "MD123456",
      "specialties": ["General Practice"],
      "states": ["CA", "NY", "FL"],
      "isActive": true
    }
  ]
}
```

### Task 2: Create New Doctor

**Step A: Create Doctor User** (if not using existing)
```bash
# User with role_id: 2 (Doctor role required)
POST /api/users
{
  "name": "Dr. John Doe",
  "email": "john@example.com",
  "phone": "555-9999",
  "state": "CA",
  "role_id": 2
}
```

**Step B: Create Doctor Profile**
```bash
curl -X POST "http://localhost:5000/api/doctors" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USERID_FROM_STEP_A",
    "licenseNumber": "MD999999",
    "specialties": ["Cardiology"],
    "states": ["CA", "NY"],
    "pricing": {"CA": 175, "NY": 200},
    "availability": [
      {
        "dayOfWeek": 1,
        "startTime": "09:00",
        "endTime": "17:00",
        "timezone": "America/Los_Angeles"
      },
      {
        "dayOfWeek": 2,
        "startTime": "09:00",
        "endTime": "17:00",
        "timezone": "America/Los_Angeles"
      }
    ]
  }'
```

### Task 3: Update Doctor Pricing
```bash
curl -X PUT "http://localhost:5000/api/doctors/<doctor-id>/pricing" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "pricing": {
      "CA": 185,
      "NY": 210
    }
  }'
```

### Task 4: Set Doctor Availability (Weekly Shifts)
```bash
curl -X PUT "http://localhost:5000/api/doctors/<doctor-id>/availability" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": [
      {"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 4, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"}
    ]
  }'
```

**Day Codes:**
- 0 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

### Task 5: Block Doctor Time Off
```bash
curl -X PUT "http://localhost:5000/api/doctors/<doctor-id>/availability" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": [
      {"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 4, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"},
      {"dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles"}
    ],
    "blockedDates": ["2026-03-15", "2026-03-16", "2026-03-17"]
  }'
```

### Task 6: Get Available Slots
```bash
curl "http://localhost:5000/api/doctors/<doctor-id>/available-slots?startDate=2026-02-01&endDate=2026-02-28"
```

Response includes all 30-minute slots for the date range:
```json
{
  "doctor_id": "...",
  "availableSlots": [
    {"date": "2026-02-02", "time": "09:00", "datetime": "2026-02-02T09:00:00Z"},
    {"date": "2026-02-02", "time": "09:30", "datetime": "2026-02-02T09:30:00Z"},
    ...
  ],
  "totalSlots": 42
}
```

### Task 7: Toggle Doctor Active/Inactive
```bash
curl -X PUT "http://localhost:5000/api/doctors/<doctor-id>/toggle-active" \
  -H "Authorization: Bearer <admin-token>"
```

### Task 8: Delete Doctor Profile
```bash
curl -X DELETE "http://localhost:5000/api/doctors/<doctor-id>" \
  -H "Authorization: Bearer <admin-token>"
```

---

## Using Helper Functions in Code

### Example: Find Next Available Appointment Slot
```javascript
const { findEarliestAvailableSlot } = require('../utils/doctor');

// Get doctor from database
const doctor = await Doctor.findById(doctorId);

// Find earliest available slot starting tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const availableSlot = findEarliestAvailableSlot(doctor, tomorrow);

if (availableSlot) {
  console.log('Next available:', availableSlot);
} else {
  console.log('No availability in next 60 days');
}
```

### Example: Check Doctor Workload
```javascript
const { getDoctorWorkload } = require('../utils/doctor');

const startDate = new Date('2026-02-01');
const endDate = new Date('2026-02-28');

const workload = await getDoctorWorkload(doctorId, startDate, endDate);

console.log('Total appointments:', workload.totalAppointments);
console.log('Busy days:', workload.busyDays);
console.log('Average per day:', workload.averageAppointmentsPerDay);
```

### Example: Get All Available Slots for Date Range
```javascript
const { getAvailableSlots } = require('../utils/doctor');

const doctor = await Doctor.findById(doctorId);
const startDate = new Date('2026-02-01');
const endDate = new Date('2026-02-28');

const slots = getAvailableSlots(doctor, startDate, endDate, 30);

// Group by date for display
const slotsByDate = {};
slots.forEach(slot => {
  if (!slotsByDate[slot.date]) {
    slotsByDate[slot.date] = [];
  }
  slotsByDate[slot.date].push(slot.time);
});

console.log(slotsByDate);
// { "2026-02-02": ["09:00", "09:30", "10:00", ...], ... }
```

---

## Frontend Integration Checklist

For the React/Next.js frontend, you'll need:

- [ ] **Doctors List Page** - Display all doctors with filter/search
- [ ] **Add Doctor Form** - Create new doctor with availability builder
- [ ] **Edit Doctor Form** - Update doctor details, pricing, availability
- [ ] **Weekly Shift Scheduler** - Visual interface to set availability
- [ ] **Calendar Widget** - Select blocked dates for time off
- [ ] **Delete Confirmation** - Confirm before deleting
- [ ] **Redux Slice** - `doctorSlice.ts` with async thunks for API calls
- [ ] **State Management** - Loading, error, success states

### Redux Slice Template
```typescript
// frontend/store/slices/doctorSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchDoctors = createAsyncThunk(
  'doctors/fetchAll',
  async (filters) => {
    const response = await fetch('/api/doctors', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  }
);

// ... more thunks for create, update, delete

const doctorSlice = createSlice({
  name: 'doctors',
  initialState: { doctors: [], loading: false, error: null },
  extraReducers: (builder) => {
    builder.addCase(fetchDoctors.fulfilled, (state, action) => {
      state.doctors = action.payload.doctors;
    });
    // ... handle pending, rejected states
  }
});

export default doctorSlice.reducer;
```

---

## Testing Checklist

- [ ] List all doctors
- [ ] Get single doctor details
- [ ] Create new doctor (valid input)
- [ ] Create doctor (invalid user role) - should fail
- [ ] Create doctor (duplicate user) - should fail
- [ ] Update doctor profile
- [ ] Update pricing
- [ ] Update availability with valid times
- [ ] Update availability (invalid time format) - should fail
- [ ] Add blocked dates
- [ ] Get available slots (valid date range)
- [ ] Get available slots (invalid dates) - should fail
- [ ] Toggle doctor active/inactive
- [ ] Delete doctor
- [ ] Filter by state
- [ ] Filter by specialty
- [ ] Filter by active status

---

## API Response Status Codes

| Endpoint | Method | Success | Error |
|----------|--------|---------|-------|
| /api/doctors | GET | 200 | 500 |
| /api/doctors/:id | GET | 200 | 404, 500 |
| /api/doctors | POST | 201 | 400, 401, 403, 500 |
| /api/doctors/:id | PUT | 200 | 400, 401, 403, 404, 500 |
| /api/doctors/:id/availability | PUT | 200 | 400, 401, 403, 404, 500 |
| /api/doctors/:id/pricing | PUT | 200 | 400, 401, 403, 404, 500 |
| /api/doctors/:id/toggle-active | PUT | 200 | 401, 403, 404, 500 |
| /api/doctors/:id | DELETE | 200 | 401, 403, 404, 500 |
| /api/doctors/:id/available-slots | GET | 200 | 400, 404, 500 |

---

## Troubleshooting

### Issue: "User must have doctor role"
**Solution**: Make sure user has `role_id: 2` (Doctor role required)

### Issue: "Invalid time format"
**Solution**: Use 24-hour HH:mm format (e.g., "09:00", "17:30")

### Issue: "End time must be after start time"
**Solution**: Verify startTime < endTime (e.g., start: "09:00", end: "17:00")

### Issue: Doctor not appearing in list
**Solution**: Check `isActive` flag - may need to filter with `?isActive=true`

### Issue: No available slots returned
**Solution**: Check if all days are blocked or doctor has no availability set

---

## Next Steps

1. ✅ Backend API fully implemented
2. ⏳ Frontend doctor management page (to be built)
3. ⏳ Weekly availability scheduler UI (to be built)
4. ⏳ Integration with appointment booking system
5. ⏳ Doctor workload analytics dashboard

For detailed API documentation, see: **DOCTOR_FEATURE_GUIDE.md**

