# Doctor Availability & Shift Planning Feature

## 📋 Overview

A comprehensive scheduling system for managing doctor availability, including weekly recurring schedules, break times, state-based availability, and date ranges. Admins and staff can set and manage doctor work hours across multiple states.

## ✨ Features Implemented

### Backend Features

1. **DoctorAvailability Model** (`backend/models/DoctorAvailability.js`)
   - Weekly schedule (7 days with individual settings)
   - State-based availability
   - Date range management
   - Break time support
   - Active/inactive status
   - Audit trail (createdBy, updatedBy)

2. **API Routes** (`backend/routes/doctor-availability.js`)
   - `GET /api/doctors/:doctorId/availability` - Get all schedules for a doctor
   - `GET /api/doctors/:doctorId/availability/:id` - Get specific schedule
   - `POST /api/doctors/:doctorId/availability` - Create new schedule
   - `PUT /api/doctors/:doctorId/availability/:id` - Update schedule
   - `DELETE /api/doctors/:doctorId/availability/:id` - Delete schedule
   - `PUT /api/doctors/:doctorId/availability/:id/toggle` - Toggle active status
   - `GET /api/doctor-availability/check` - Check doctor availability for booking

3. **Smart Features**
   - Validation for overlapping schedules
   - Time format validation (HH:MM 24-hour)
   - Break time validation (within working hours)
   - State code validation
   - Methods to find cheapest available doctor

### Frontend Features

1. **Redux State Management** (`frontend/store/slices/doctorAvailabilitySlice.ts`)
   - Complete CRUD operations
   - Default weekly schedule generator
   - Error and success handling
   - Loading states

2. **DoctorAvailabilityModal Component** (`frontend/components/DoctorAvailabilityModal.tsx`)
   - **7-Day Weekly Schedule Cards** matching screenshot design:
     - Individual day toggle (On/Off switch)
     - Start time and end time pickers
     - Break start and break end time (optional)
     - Visual indicators for active/inactive days
   
   - **Date Range Picker**:
     - Start date and end date selection
     - Defaults to today → 3 months ahead
   
   - **State Selection**:
     - Multi-select checkboxes
     - Fetches from admin-defined states
     - Shows only active states
   
   - **Notes Field**: Optional notes/instructions

3. **Doctors Page Integration** (`frontend/app/doctors/page.tsx`)
   - "Availability" button in each doctor row
   - Opens availability modal
   - Seamless integration with existing doctor management

## 🎯 How It Works

### For Admins/Staff

#### 1. Access Doctor Availability
1. Navigate to **Dashboard → Doctors**
2. Find the doctor in the list
3. Click **"Availability"** button (teal-colored)

#### 2. Create New Schedule
1. Modal opens with default settings:
   - Monday-Friday: Active (8:00 AM - 6:00 PM)
   - Saturday-Sunday: Inactive
   - Date Range: Today to 3 months ahead

2. Customize each day:
   - Toggle day on/off
   - Set start and end times
   - Add break times (optional)

3. Select states where doctor will be available

4. Set date range for this schedule

5. Add notes (optional)

6. Click **"Create Availability"**

#### 3. Update Existing Schedule
1. Click "Availability" on a doctor
2. View/edit current schedule
3. Modify any fields
4. Click **"Update Availability"**

### For Appointment Booking System

The system automatically:
1. Checks doctor availability for requested date/time/state
2. Finds all available doctors
3. Sorts by consultation fee (cheapest first)
4. Assigns appointment to most affordable available doctor

## 📊 Data Structure

### Weekly Schedule Format
```javascript
{
  dayOfWeek: 0-6,        // 0 = Sunday, 6 = Saturday
  isActive: true/false,   // Day enabled?
  startTime: "08:00",     // HH:MM (24-hour)
  endTime: "18:00",       // HH:MM (24-hour)
  breakStartTime: "12:00", // Optional
  breakEndTime: "13:00"   // Optional
}
```

### Example Availability Record
```javascript
{
  doctor_id: "507f1f77bcf86cd799439011",
  states: ["CA", "NY", "TX"],
  weeklySchedule: [
    { dayOfWeek: 0, isActive: false },
    { dayOfWeek: 1, isActive: true, startTime: "09:00", endTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00" },
    // ... 5 more days
  ],
  startDate: "2026-01-27T00:00:00Z",
  endDate: "2026-04-27T00:00:00Z",
  isActive: true,
  notes: "Regular schedule"
}
```

## 🔧 Technical Details

### Validation Rules
1. **Weekly Schedule**: Must have all 7 days (0-6)
2. **Time Format**: HH:MM in 24-hour format (e.g., "08:00", "14:30")
3. **Start < End**: Start time must be before end time
4. **Break Times**: 
   - Must be within working hours
   - Break start < break end
   - Both or neither (can't have just one)
5. **Date Range**: End date must be after start date
6. **States**: Must be valid state codes from admin-defined states
7. **No Overlaps**: Can't have overlapping active schedules for same doctor

### Database Indexes
```javascript
// Optimized queries
{ doctor_id: 1, startDate: 1, endDate: 1 }
{ states: 1, startDate: 1, endDate: 1 }
{ doctor_id: 1, isActive: 1 }
```

### API Response Format
```json
{
  "success": true,
  "message": "Availability schedule created successfully",
  "availability": { ... }
}
```

## 🚀 Usage Examples

### Check if Doctor is Available
```javascript
// Backend method
const isAvailable = availabilityRecord.isAvailableAt(
  new Date('2026-02-15'),
  '14:00'
)
```

### Get Available Doctors for Booking
```javascript
// API call
GET /api/doctor-availability/check?stateCode=CA&date=2026-02-15&time=14:00

// Response: Doctors sorted by consultation fee
{
  "success": true,
  "availableDoctors": [
    {
      "doctor": { id, name, email, consultationFee: 50 },
      "availabilityId": "..."
    },
    {
      "doctor": { id, name, email, consultationFee: 75 },
      "availabilityId": "..."
    }
  ]
}
```

### Create Availability (Frontend)
```javascript
await dispatch(createDoctorAvailability({
  doctorId: "507f1f77bcf86cd799439011",
  states: ["CA", "NY"],
  weeklySchedule: [...],
  startDate: "2026-01-27",
  endDate: "2026-04-27",
  notes: "Winter schedule"
}))
```

## 🎨 UI Components

### Day Schedule Card
- **Header**: Day name + Toggle switch
- **Active State**: Teal background with input fields
- **Inactive State**: Gray background, no inputs
- **Fields**: Start Time, End Time, Break Start, Break End

### Color Scheme
- **Primary (Teal)**: `#14b8a6` (teal-600)
- **Active Day**: `#f0fdfa` (teal-50)
- **Inactive Day**: `#f9fafb` (gray-50)
- **Toggle On**: `#22c55e` (green-500)
- **Toggle Off**: `#9ca3af` (gray-400)

## 📝 Files Modified/Created

### Backend
- ✅ `models/DoctorAvailability.js` - New model
- ✅ `routes/doctor-availability.js` - New routes
- ✅ `server.js` - Added route registration

### Frontend
- ✅ `store/slices/doctorAvailabilitySlice.ts` - New Redux slice
- ✅ `store/store.ts` - Added reducer
- ✅ `components/DoctorAvailabilityModal.tsx` - New modal component
- ✅ `app/doctors/page.tsx` - Added availability button
- ✅ `types/index.ts` - Added types

## 🔐 Security & Permissions

- **Admin**: Full access (create, read, update, delete)
- **Staff**: Full access (create, read, update, delete)
- **Doctor**: No access (managed by admin/staff only)
- **Patient**: No access

All routes protected with `auth` and `authorize('admin', 'staff')` middleware.

## 🧪 Testing the Feature

### Manual Testing Steps

1. **Start Backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Create**:
   - Login as admin
   - Go to Doctors page
   - Click "Availability" on any doctor
   - Configure schedule
   - Click "Create Availability"
   - Verify success message

4. **Test Update**:
   - Click "Availability" again
   - Modify fields
   - Click "Update Availability"
   - Verify changes saved

5. **Test Validation**:
   - Try overlapping dates (should fail)
   - Try invalid times (should fail)
   - Try selecting no states (should fail)

### API Testing with Postman/curl

```bash
# Create availability
curl -X POST http://localhost:5000/api/doctors/{doctorId}/availability \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "states": ["CA", "NY"],
    "weeklySchedule": [...],
    "startDate": "2026-01-27",
    "endDate": "2026-04-27"
  }'

# Get availability
curl http://localhost:5000/api/doctors/{doctorId}/availability \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check available doctors
curl "http://localhost:5000/api/doctor-availability/check?stateCode=CA&date=2026-02-15&time=14:00"
```

## 🐛 Known Issues & Limitations

1. **Single Break Only**: Current version supports one break per day (can be extended if needed)
2. **No Exceptions**: Holiday/vacation handling to be added in future
3. **No Recurring Patterns**: Can't copy schedule to multiple weeks (manual entry required)
4. **No Calendar View**: List view only (calendar view can be added)

## 🚀 Future Enhancements

1. **Holiday Management**: Mark specific dates as unavailable
2. **Vacation Requests**: Temporary overrides
3. **Calendar View**: Visual monthly/weekly calendar
4. **Copy Schedule**: Duplicate to other doctors or weeks
5. **Templates**: Save/load schedule templates
6. **Bulk Operations**: Update multiple doctors at once
7. **Notifications**: Alert when schedule changes
8. **Conflict Detection**: Warn about appointment conflicts

## 📞 Support

If you encounter any issues or need additional features, contact the development team.

---

**Implementation Date**: January 27, 2026  
**Version**: 1.0.0  
**Status**: ✅ Complete and Ready for Use
