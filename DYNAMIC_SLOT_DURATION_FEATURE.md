# Dynamic Slot Duration Feature

## Overview
The appointment booking system now supports **dynamic time slot generation** based on the appointment type's duration. Previously, all time slots were hardcoded to 30 minutes. Now, each appointment type can have its own duration (e.g., 15 min, 30 min, 45 min, 60 min), and the system will automatically generate appropriate time slots.

## 🎯 Key Features

### 1. **Appointment Type Duration**
- Each appointment type in the database has a `duration` field (in minutes)
- Default duration: 30 minutes
- Can be customized per appointment type (e.g., New Patient = 60 min, Follow-up = 15 min)

### 2. **Dynamic Slot Generation**
- Time slots are generated in real-time based on the selected appointment type
- Respects doctor availability (working hours, break times)
- Prevents double-booking by checking existing appointments
- Automatically adjusts to appointment duration

### 3. **Frontend Display**
- Duration is displayed on appointment type selection cards
- Time slot duration shown during slot selection
- Clear indication of appointment length to patients

## 📊 Database Schema

### AppointmentType Collection
```javascript
{
  name: "New Patient Consultation",
  description: "Comprehensive initial consultation",
  duration: 60,              // 60 minutes
  price: 150,
  cardValidityMonths: 12,
  states: ["CA", "NY", "FL"],
  isActive: true
}
```

### Example Appointment Types
```javascript
// Quick renewal (15 minutes)
{
  name: "Card Renewal",
  duration: 15,
  price: 75
}

// Standard consultation (30 minutes) 
{
  name: "Follow-up Consultation",
  duration: 30,
  price: 100
}

// Comprehensive exam (60 minutes)
{
  name: "New Patient Evaluation",
  duration: 60,
  price: 200
}
```

## 🔄 How It Works

### Patient Booking Flow

```
1. Patient selects STATE
   ↓
2. Patient selects APPOINTMENT TYPE (e.g., "New Patient - 60 min")
   ↓
3. Patient selects DATE
   ↓
4. System fetches appointment type from database
   ↓
5. System reads duration field (e.g., duration: 60)
   ↓
6. System generates time slots based on:
   - Doctor availability schedule
   - Selected appointment duration (60 min)
   - Existing bookings
   ↓
7. Available slots displayed (e.g., 9:00 AM, 10:00 AM, 11:00 AM)
   (Each slot is 60 minutes apart)
   ↓
8. Patient selects time slot and completes booking
```

### Backend Slot Generation Algorithm

```javascript
// 1. Get appointment type duration
const appointmentType = await AppointmentType.findById(cardType);
const slotDuration = appointmentType.duration || 30; // e.g., 60 minutes

// 2. Get doctor's schedule for the day
const daySchedule = { 
  startTime: "09:00", 
  endTime: "17:00",
  breakStartTime: "12:00",
  breakEndTime: "13:00"
};

// 3. Generate slots
// Working hours: 9:00 AM - 5:00 PM (480 minutes)
// Break: 12:00 PM - 1:00 PM (60 minutes)
// Slot duration: 60 minutes

// Generated slots:
// 09:00 - 10:00 ✅
// 10:00 - 11:00 ✅
// 11:00 - 12:00 ✅
// (12:00 - 13:00 BREAK - skipped)
// 13:00 - 14:00 ✅
// 14:00 - 15:00 ✅
// 15:00 - 16:00 ✅
// 16:00 - 17:00 ✅
```

## 🛠️ Implementation Details

### Backend Changes

#### 1. **Updated API Endpoint: `/api/patient-portal/available-slots`**

**File**: `backend/routes/patient-portal.js`

**Key Changes**:
- Fetches appointment type from database
- Extracts `duration` field
- Uses duration for slot generation
- Returns slot duration in response

```javascript
// GET /api/patient-portal/available-slots?state=CA&date=2026-01-28&cardType=123abc

Response:
{
  "success": true,
  "slots": [
    {
      "doctor_id": "doc123",
      "doctorName": "Dr. Smith",
      "time": "09:00",
      "date": "2026-01-28",
      "duration": 60
    },
    {
      "doctor_id": "doc123",
      "doctorName": "Dr. Smith", 
      "time": "10:00",
      "date": "2026-01-28",
      "duration": 60
    }
  ],
  "slotDuration": 60,
  "totalSlots": 7
}
```

#### 2. **Updated API Endpoint: `/api/doctors/:id/available-slots`**

**File**: `backend/routes/doctors.js`

**Key Changes**:
- Added optional `duration` query parameter
- Defaults to 30 minutes if not specified
- Returns slot duration in response

```javascript
// GET /api/doctors/doc123/available-slots?startDate=2026-01-28&endDate=2026-01-30&duration=45

Response:
{
  "doctor_id": "doc123",
  "availableSlots": [...],
  "totalSlots": 24,
  "slotDuration": 45
}
```

### Frontend Changes

#### 1. **Updated Patient Booking Page**

**File**: `frontend/app/patient/book/page.tsx`

**Key Changes**:
- Displays duration on appointment type cards
- Shows slot duration during time selection
- Passes duration info to booking confirmation

**Visual Example**:
```
┌─────────────────────────────────────┐
│ New Patient Consultation            │
│ Comprehensive initial evaluation    │
│ $200                    60 min      │ ← Duration displayed
│ Valid for 12 months                 │
└─────────────────────────────────────┘
```

**Time Slot Selection**:
```
Appointment duration: 60 minutes

┌─────────┐ ┌─────────┐ ┌─────────┐
│ 09:00   │ │ 10:00   │ │ 11:00   │
│ Dr. Sm. │ │ Dr. Sm. │ │ Dr. Sm. │
│ 60 min  │ │ 60 min  │ │ 60 min  │ ← Duration on each slot
└─────────┘ └─────────┘ └─────────┘
```

## 🧪 Testing Scenarios

### Test Case 1: 15-Minute Slots (Quick Renewals)
```javascript
Appointment Type: "Card Renewal"
Duration: 15 minutes
Doctor Hours: 9:00 AM - 12:00 PM (3 hours)

Expected Slots:
09:00, 09:15, 09:30, 09:45,
10:00, 10:15, 10:30, 10:45,
11:00, 11:15, 11:30, 11:45
= 12 slots
```

### Test Case 2: 60-Minute Slots (New Patients)
```javascript
Appointment Type: "New Patient Evaluation"
Duration: 60 minutes
Doctor Hours: 9:00 AM - 5:00 PM (8 hours)
Break: 12:00 PM - 1:00 PM (1 hour)

Expected Slots:
09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00
= 7 slots
```

### Test Case 3: Custom Duration (45 Minutes)
```javascript
Appointment Type: "Extended Follow-up"
Duration: 45 minutes
Doctor Hours: 10:00 AM - 4:00 PM (6 hours)

Expected Slots:
10:00, 10:45, 11:30, 12:15, 13:00, 13:45, 14:30, 15:15
= 8 slots
```

## 📝 Admin Configuration

### How to Set Duration for Appointment Types

1. **Via Admin Dashboard** (when implemented):
   - Navigate to Appointment Types
   - Create/Edit appointment type
   - Set "Duration (minutes)" field
   - Save

2. **Via Database** (current method):
   ```javascript
   // MongoDB shell or MongoDB Compass
   db.appointmenttypes.updateOne(
     { name: "New Patient Consultation" },
     { $set: { duration: 60 } }
   )
   ```

3. **Via API** (if endpoint exists):
   ```bash
   curl -X PUT http://localhost:5000/api/appointment-types/123abc \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer TOKEN" \
     -d '{"duration": 60}'
   ```

## 🔮 Future Enhancements

### Planned Features
1. **Variable Duration by State**
   - Different states may have different consultation requirements
   - Example: CA requires 60 min, NY requires 45 min

2. **Doctor-Specific Duration Override**
   - Allow doctors to customize slot durations
   - Example: Senior doctors may take longer consultations

3. **Multiple Duration Options**
   - Let patients choose consultation length
   - Example: "Quick (15 min) - $75" vs "Standard (30 min) - $100"

4. **Buffer Time Between Appointments**
   - Add configurable buffer (e.g., 5 min) between slots
   - Prevents back-to-back scheduling issues

5. **Smart Slot Optimization**
   - AI-based suggestion of optimal slot duration
   - Based on appointment type and patient history

## 🚨 Important Notes

### Breaking Change Prevention
- System defaults to 30 minutes if duration is missing
- Backward compatible with existing appointment types
- Old bookings remain unchanged

### Performance Considerations
- Slot generation is done on-demand (not pre-computed)
- Cached for 5 minutes to reduce database queries
- Minimal performance impact for typical use cases

### Data Integrity
- Duration must be between 5 and 240 minutes
- Must be divisible by 5 (for clean time slots)
- Validated on appointment type creation/update

## 📚 Related Documentation
- [Appointment Booking Flow](./PATIENT_BOOKING_FLOW.md)
- [Doctor Availability Feature](./DOCTOR_AVAILABILITY_FEATURE.md)
- [AppointmentType Model](./backend/models/AppointmentType.js)
- [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md)

## 🐛 Troubleshooting

### No Slots Available
**Cause**: Duration too long for available time blocks
**Solution**: 
- Check doctor's working hours
- Verify appointment type duration is reasonable
- Check for break times that fragment available slots

### Incorrect Slot Times
**Cause**: Time zone mismatch or break time overlap
**Solution**:
- Verify doctor availability schedule
- Check break times don't consume all available slots
- Ensure time format is HH:MM (24-hour)

### Slots Disappearing After Selection
**Cause**: Another patient booked the slot simultaneously
**Solution**:
- System shows "slot conflict" error
- Patient redirected to select different slot
- This is expected behavior for concurrent bookings

---

**Last Updated**: January 27, 2026
**Feature Status**: ✅ Implemented and Ready for Testing
