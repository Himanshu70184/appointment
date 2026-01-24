# Doctor Management & Availability Feature Guide

## Overview

The Doctor Management feature enables admins to dynamically manage doctor profiles, set availability/shifts, manage pricing by state, and track workload. This guide covers backend API endpoints and utility functions.

## Doctor Model Structure

```javascript
{
  user_id: ObjectId,           // Reference to User (role_id: 2)
  licenseNumber: String,       // Medical license number
  specialties: [String],       // e.g., ["General Practice", "Cardiology"]
  states: [String],            // States where doctor is licensed
  pricing: Map<State, Number>, // e.g., { "CA": 150, "NY": 175 }
  availability: [{
    dayOfWeek: Number,         // 0=Sunday, 6=Saturday
    startTime: String,         // "09:00" format
    endTime: String,           // "17:00" format
    timezone: String           // "America/Los_Angeles"
  }],
  blockedDates: [Date],        // Time off dates
  isActive: Boolean,           // Active status
  createdAt: Date,
  updatedAt: Date
}
```

---

## API Endpoints

### 1. Get All Doctors
```http
GET /api/doctors
```

**Query Parameters:**
- `isActive` (boolean): Filter by active status
- `state` (string): Filter by state (CA, NY, etc.)
- `specialty` (string): Filter by specialty

**Response:**
```json
{
  "doctors": [
    {
      "_id": "...",
      "user_id": {
        "_id": "...",
        "name": "Dr. Jane Smith",
        "email": "jane@example.com",
        "phone": "555-1234"
      },
      "licenseNumber": "MD123456",
      "specialties": ["General Practice"],
      "states": ["CA", "NY"],
      "pricing": { "CA": 150, "NY": 175 },
      "availability": [...],
      "isActive": true
    }
  ]
}
```

**Example:**
```bash
# Get all active doctors in California
curl "http://localhost:5000/api/doctors?isActive=true&state=CA"
```

---

### 2. Get Doctor by ID
```http
GET /api/doctors/:id
```

**Response:** Full doctor object with all details

**Example:**
```bash
curl "http://localhost:5000/api/doctors/507f1f77bcf86cd799439011"
```

---

### 3. Create Doctor Profile
```http
POST /api/doctors
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "licenseNumber": "MD789456",
  "specialties": ["General Practice", "Medical Marijuana"],
  "states": ["CA", "NY", "FL"],
  "pricing": {
    "CA": 150,
    "NY": 175,
    "FL": 160
  },
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
}
```

**Response:**
```json
{
  "message": "Doctor profile created successfully",
  "doctor": { ... }
}
```

**Validation Rules:**
- `user_id` is required and user must have role_id: 2 (Doctor)
- `licenseNumber` is required and will be uppercase
- `specialties` must be an array
- `states` must be an array (required)
- `pricing` values must be non-negative numbers
- `availability` must have valid dayOfWeek (0-6) and HH:mm format times

---

### 4. Update Doctor Profile
```http
PUT /api/doctors/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "licenseNumber": "MD999999",
  "specialties": ["Cardiology"],
  "states": ["CA", "TX"],
  "pricing": {
    "CA": 175,
    "TX": 160
  },
  "availability": [...],
  "isActive": false
}
```

**Example:**
```bash
curl -X PUT "http://localhost:5000/api/doctors/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"specialties": ["Cardiology", "Internal Medicine"]}'
```

---

### 5. Update Doctor Availability & Shifts
```http
PUT /api/doctors/:id/availability
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "availability": [
    {
      "dayOfWeek": 0,
      "startTime": "10:00",
      "endTime": "18:00",
      "timezone": "America/Los_Angeles"
    },
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "17:00",
      "timezone": "America/Los_Angeles"
    }
  ],
  "blockedDates": [
    "2026-02-15",
    "2026-02-16"
  ]
}
```

**Notes:**
- Completely replaces existing availability
- `blockedDates` are optional (time off dates)
- Dates are auto-converted to Date objects
- Time format must be HH:mm (24-hour)

---

### 6. Update Doctor Pricing
```http
PUT /api/doctors/:id/pricing
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "pricing": {
    "CA": 165,
    "NY": 190,
    "TX": 155
  }
}
```

**Validation:**
- All prices must be non-negative numbers
- States must match doctor's licensed states

---

### 7. Toggle Doctor Active Status
```http
PUT /api/doctors/:id/toggle-active
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "message": "Doctor activated successfully",
  "doctor": { ... }
}
```

---

### 8. Delete Doctor Profile
```http
DELETE /api/doctors/:id
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "message": "Doctor profile deleted successfully",
  "doctor": { ... }
}
```

**Important:** This is a hard delete. Use toggle-active to disable instead.

---

### 9. Get Available Appointment Slots
```http
GET /api/doctors/:id/available-slots?startDate=2026-02-01&endDate=2026-02-28
```

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD format
- `endDate` (required): YYYY-MM-DD format

**Response:**
```json
{
  "doctor_id": "507f1f77bcf86cd799439011",
  "availableSlots": [
    {
      "date": "2026-02-02",
      "time": "09:00",
      "datetime": "2026-02-02T09:00:00.000Z",
      "timezone": "America/Los_Angeles"
    },
    {
      "date": "2026-02-02",
      "time": "09:30",
      "datetime": "2026-02-02T09:30:00.000Z",
      "timezone": "America/Los_Angeles"
    }
  ],
  "totalSlots": 42
}
```

**Features:**
- Generates 30-minute slots automatically
- Excludes blocked dates
- Excludes past dates/times
- Respects working hours
- Returns up to 60 days of slots

**Example:**
```bash
curl "http://localhost:5000/api/doctors/507f1f77bcf86cd799439011/available-slots?startDate=2026-02-01&endDate=2026-02-28"
```

---

## Utility Functions

Import from `backend/utils/doctor.js`:

```javascript
const doctorUtils = require('../utils/doctor');
```

### 1. Find Earliest Available Slot
```javascript
const slot = doctorUtils.findEarliestAvailableSlot(doctor, startDate, slotDuration);
// Returns: Date object or null
```

### 2. Get Available Slots for Date Range
```javascript
const slots = doctorUtils.getAvailableSlots(doctor, startDate, endDate, 30);
// Returns: Array of slot objects
```

### 3. Check if Date is Blocked
```javascript
const isBlocked = doctorUtils.isDateBlocked(doctor, date);
// Returns: boolean
```

### 4. Get Booked Slots for a Date
```javascript
const bookedSlots = await doctorUtils.getBookedSlots(doctorId, date);
// Returns: Array of appointment objects
```

### 5. Check if Specific Slot is Available
```javascript
const available = doctorUtils.isSlotAvailable(doctor, slotDateTime, bookedSlots);
// Returns: boolean
```

### 6. Get Doctor Workload Analysis
```javascript
const workload = await doctorUtils.getDoctorWorkload(doctorId, startDate, endDate);
// Returns: { totalAppointments, busyDays, workloadByDate, averageAppointmentsPerDay }
```

### 7. Validate Availability Configuration
```javascript
const result = doctorUtils.validateAvailability(availabilityArray);
// Returns: { isValid: boolean, errors: Array }
```

### 8. Find Best Matching Doctors
```javascript
const doctors = await doctorUtils.findBestMatchingDoctors('CA', 'Cardiology', 200);
// Returns: Array of doctors matching criteria
```

---

## Complete Workflow Example

### Step 1: Create Doctor User
```bash
# Create user with role_id: 2 (Doctor)
POST /api/users
{
  "name": "Dr. Jane Smith",
  "email": "jane@example.com",
  "phone": "555-1234",
  "state": "CA",
  "role_id": 2
}
```

### Step 2: Create Doctor Profile
```bash
POST /api/doctors
Authorization: Bearer <admin-token>
{
  "user_id": "userid-from-step-1",
  "licenseNumber": "MD789456",
  "specialties": ["General Practice"],
  "states": ["CA", "NY"],
  "pricing": { "CA": 150, "NY": 175 },
  "availability": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "timezone": "America/Los_Angeles" }
  ]
}
```

### Step 3: Set Blocked Dates (e.g., vacation)
```bash
PUT /api/doctors/doctorid/availability
Authorization: Bearer <admin-token>
{
  "availability": [...],
  "blockedDates": ["2026-03-01", "2026-03-02", "2026-03-03"]
}
```

### Step 4: Get Available Slots
```bash
GET /api/doctors/doctorid/available-slots?startDate=2026-02-01&endDate=2026-02-28
```

### Step 5: Update Pricing
```bash
PUT /api/doctors/doctorid/pricing
Authorization: Bearer <admin-token>
{
  "pricing": { "CA": 175, "NY": 195 }
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Access denied (not admin) |
| 404 | Resource not found |
| 500 | Server error |

**Example Error Response:**
```json
{
  "errors": [
    {
      "param": "pricing",
      "msg": "Invalid price for state CA"
    }
  ]
}
```

---

## Admin Dashboard Integration

### Display Doctors List
```javascript
// Fetch all doctors
const response = await fetch('/api/doctors');
const { doctors } = await response.json();

// Render table with:
// - Doctor name, email, phone
// - License number
// - States, Specialties
// - Current pricing
// - Active status
// - Action buttons (Edit, Delete, Toggle Status)
```

### Edit Doctor
```javascript
// Show form with current values
// Allow updating:
// - License number
// - Specialties
// - States
// - Pricing per state
// - Availability/shifts
// - Blocked dates calendar
```

### Manage Availability
```javascript
// Visual shift scheduler showing:
// - Weekly grid (Mon-Sun)
// - Hours (9AM-5PM, etc.)
// - Current availability
// - Drag-to-add shifts
// - Calendar for blocked dates
// - Timezone selector
```

---

## Testing

### Test Data Setup
Run the provided script to create test doctors:
```bash
node scripts/create-test-data.js
```

This creates a test doctor:
- Name: Dr. Jane Smith
- Email: doctor@test.com
- License: MD123456
- States: CA, NY, FL
- Availability: Mon-Fri, 9AM-5PM

### Postman Collection

Save as `Doctor_API.postman_collection.json`:

```json
{
  "info": { "name": "Doctor API", "schema": "..." },
  "item": [
    {
      "name": "Get All Doctors",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/doctors"
      }
    },
    {
      "name": "Create Doctor",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/doctors",
        "header": { "Authorization": "Bearer {{token}}" },
        "body": { ... }
      }
    }
  ]
}
```

---

## Performance Considerations

1. **Availability Calculations**: Cached on client-side after fetch
2. **Date Range Limits**: Limited to 60 days to prevent excessive data
3. **Slot Duration**: Fixed at 30 minutes (configurable in utils)
4. **Blocking Strategy**: Use blockedDates for vacations, not individual slots
5. **Indexing**: Doctor model indexed on states and isActive for fast queries

---

## Future Enhancements

- [ ] Recurring blocked dates (e.g., every Sunday)
- [ ] Buffer time between appointments
- [ ] Break times within shifts
- [ ] Multiple shift patterns per day
- [ ] Doctor availability by appointment type
- [ ] Load balancing for multi-doctor booking
- [ ] Appointment reminders based on timezone
- [ ] Historical availability tracking

