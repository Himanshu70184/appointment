# Doctor Holiday & Time Off Management Feature

## 🎯 Overview

The Doctor Holiday Management feature allows administrators and staff to mark specific dates when doctors are unavailable due to holidays, vacations, or personal time off. This ensures that patients cannot book appointments during these periods.

## ✨ Features

### 1. **Holiday Calendar**
- Interactive monthly calendar view
- Multi-date selection capability
- Visual indicators for selected and existing holidays
- Month navigation (previous/next)
- Only dates within the availability schedule range are selectable

### 2. **Holiday Types**

#### **Full-Day Holiday**
- Doctor is completely unavailable for the entire day
- No appointments can be booked on this date
- Example: Vacation day, public holiday

#### **Half-Day Holiday**
- Doctor is unavailable for specific hours
- Requires start and end time selection
- Appointments can still be booked outside the half-day period
- Example: Morning off (08:00 - 12:00), Afternoon off (13:00 - 18:00)

### 3. **Holiday Management**
- **Add Multiple Holidays**: Select multiple dates at once
- **Set Holiday Type**: Choose between full-day or half-day
- **Specify Time Range**: For half-day holidays, set start/end times
- **Add Reason**: Optional field to note the reason (e.g., "Vacation", "Personal", "Sick Leave")
- **Remove Holidays**: Easily delete individual holidays
- **Visual List**: See all scheduled holidays with details

## 🖥️ User Interface

### Accessing Holiday Calendar

1. Navigate to **Doctors** section in admin dashboard
2. Click **"Manage Availability"** for the desired doctor
3. In the availability modal, find the **"Holidays & Time Off"** section
4. Click **"📅 Add Holidays"** button

### Adding Holidays

**Step 1: Select Dates**
- Navigate to the desired month using Prev/Next buttons
- Click on dates to select (purple highlight indicates selection)
- Click again to deselect
- Multiple dates can be selected at once

**Step 2: Configure Holiday Type**
- Choose **Full Day** or **Half Day**
- For half-day:
  - Set **Start Time** (e.g., 08:00)
  - Set **End Time** (e.g., 12:00)

**Step 3: Add Reason (Optional)**
- Enter a reason like "Vacation", "Conference", "Personal Day"

**Step 4: Confirm**
- Click **"Add Holiday(s)"** button
- Selected dates will be marked as holidays

### Visual Indicators

- **Gray**: Dates outside the availability range (disabled)
- **Purple**: Currently selected dates
- **Red with border**: Dates already marked as holidays
- **White**: Available dates that can be selected

### Managing Existing Holidays

All scheduled holidays are displayed in a list above the calendar:
- **Date**: When the holiday occurs
- **Type Badge**: 
  - Red badge = Full Day
  - Yellow badge = Half Day (with time range)
- **Reason**: If provided
- **Remove Button (✕)**: Click to delete the holiday

## 🔧 Technical Implementation

### Backend (MongoDB Schema)

```javascript
holidays: [{
  date: Date,           // Holiday date
  type: String,         // 'full-day' or 'half-day'
  startTime: String,    // "HH:MM" - Required for half-day
  endTime: String,      // "HH:MM" - Required for half-day
  reason: String        // Optional description
}]
```

### Validation Rules

**Full-Day Holiday:**
- Date must be within schedule's `startDate` to `endDate` range
- Type must be 'full-day'

**Half-Day Holiday:**
- Date must be within schedule's `startDate` to `endDate` range
- Type must be 'half-day'
- `startTime` and `endTime` are required
- `startTime` must be before `endTime`
- Time format: HH:MM (24-hour)

### Appointment Booking Integration

The `isAvailableAt()` method automatically checks for holidays:

```javascript
// Check if date is a holiday
const holiday = this.holidays.find(h => holidayDate === dateStr)

if (holiday) {
  if (holiday.type === 'full-day') {
    return false // Doctor not available
  } else if (holiday.type === 'half-day') {
    // Check if time falls within half-day period
    if (time >= holiday.startTime && time < holiday.endTime) {
      return false
    }
  }
}
```

## 📋 Example Use Cases

### Use Case 1: Full Week Vacation

**Scenario:** Dr. Smith is taking a week-long vacation from Jan 15-21, 2026.

**Steps:**
1. Open holiday calendar
2. Select all dates from Jan 15 to Jan 21 (7 dates)
3. Choose "Full Day"
4. Add reason: "Annual Vacation"
5. Click "Add Holidays"

**Result:** 7 holidays created. No appointments can be booked during this period.

---

### Use Case 2: Morning Medical Appointment

**Scenario:** Dr. Johnson has a personal medical appointment on Feb 5, 2026, and will be unavailable from 08:00-12:00.

**Steps:**
1. Open holiday calendar
2. Select Feb 5, 2026
3. Choose "Half Day"
4. Set Start Time: 08:00
5. Set End Time: 12:00
6. Add reason: "Personal Appointment"
7. Click "Add Holiday"

**Result:** Patients can book afternoon slots (12:00 onwards), but morning slots are blocked.

---

### Use Case 3: Conference Days

**Scenario:** Dr. Williams is attending a 3-day medical conference from Mar 10-12, 2026.

**Steps:**
1. Open holiday calendar
2. Select Mar 10, 11, and 12 (3 dates)
3. Choose "Full Day"
4. Add reason: "Medical Conference"
5. Click "Add Holidays"

**Result:** 3 full-day holidays created.

---

### Use Case 4: Weekly Half-Day Off

**Scenario:** Dr. Martinez takes every Friday afternoon off (13:00-18:00) for the month of April 2026.

**Steps:**
1. Open holiday calendar
2. Navigate to April 2026
3. Select all Fridays (4th, 11th, 18th, 25th)
4. Choose "Half Day"
5. Set Start Time: 13:00
6. Set End Time: 18:00
7. Add reason: "Weekly Half-Day Off"
8. Click "Add Holidays"

**Result:** 4 half-day holidays created. Morning appointments still available on Fridays.

## 🎨 UI Color Coding

| Element | Color | Meaning |
|---------|-------|---------|
| Full-Day Holiday Badge | Red (`bg-red-100 text-red-800`) | Doctor unavailable all day |
| Half-Day Holiday Badge | Yellow (`bg-yellow-100 text-yellow-800`) | Doctor unavailable for specific hours |
| Selected Date | Purple (`bg-purple-600`) | Date selected for holiday |
| Existing Holiday | Red with border (`bg-red-100 border-red-500`) | Date already marked as holiday |
| Disabled Date | Gray (`bg-gray-100`) | Outside availability range |

## 🔐 Security & Permissions

- **Access Control**: Only Admin and Staff roles can manage holidays
- **Authorization**: Requires valid JWT token
- **Validation**: All holiday data is validated on both frontend and backend
- **Audit Trail**: Holiday changes are tracked via `updatedBy` and `updatedAt` fields

## 📊 Data Flow

```
Admin selects dates → Configure holiday type → Add reason →
Submit → Frontend validation → API call →
Backend validation → Update database → 
Return success → Update UI → Refresh availability
```

## 🚀 Future Enhancements

Potential improvements for future versions:

1. **Recurring Holidays**
   - Mark holidays that repeat (e.g., every Friday)
   - Annual holidays (e.g., Christmas, New Year)

2. **Bulk Import**
   - Upload CSV of holidays
   - Import from Google Calendar

3. **Holiday Templates**
   - Save common holiday patterns
   - Apply templates across multiple doctors

4. **Notifications**
   - Email doctor when holiday is added/removed
   - Notify patients if appointments fall on newly added holidays

5. **Holiday Analytics**
   - Report of total holidays per doctor
   - Most common holiday reasons
   - Monthly/yearly holiday trends

## 🐛 Troubleshooting

### Issue: Can't select dates
**Solution:** Ensure dates are within the availability schedule's start and end date range.

### Issue: "Holiday outside date range" error
**Solution:** The holiday date must be between the schedule's `startDate` and `endDate`.

### Issue: Can't add half-day holiday
**Solution:** Ensure both start and end times are filled, and start time is before end time.

### Issue: Changes not saving
**Solution:** Check browser console for errors. Ensure you have admin/staff permissions.

## 📞 Support

For issues or questions about the holiday management feature, contact the development team or refer to the main documentation.

---

**Version:** 1.0  
**Last Updated:** January 30, 2026  
**Feature Status:** ✅ Active
