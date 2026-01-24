# Doctor Portal - Complete Implementation Guide

## Overview
The Doctor Portal is a comprehensive web application for doctors to manage their patient appointments, conduct consultations, file certifications, and maintain their professional profile.

---

## Features Implemented

### 1. **Doctor Dashboard** (`/doctor/dashboard`)
- **Statistics Cards**: Displays real-time counts
  - Total Appointments
  - Scheduled Appointments
  - Pending Appointments
  - On Hold Appointments
  - Canceled Appointments
  - Completed Appointments
- **Upcoming Appointments Table**: Next 7 days of scheduled appointments
  - Columns: Sr.No, Patient Name, Appointment Type, State, Date, Time, Status, Action
  - Click eye icon to view full details

### 2. **My Appointments** (`/doctor/appointments`)
- **Search & Filters**
  - Search by patient name
  - Filter by state
  - Filter by status
  - Filter by date
  - Toggle between List View and Calendar View
- **Appointments List**
  - Complete appointment details in table format
  - Color-coded status badges
  - View details button for each appointment

### 3. **Appointment Details** (`/doctor/appointments/[id]`)
- **Header Actions**
  - View Intake Form button
  - Additional Documents button (disabled if no documents)
  - Status alert if intake is pending
  
- **Patient Information**
  - Name, Email, Date of Birth, Phone Number
  - Document Request section to request missing documents from admin
  
- **Appointment Data & Certification**
  - Appointment Type, Adjusted Amount, Date, Time, State
  - Status badge
  - PDMP Verified checkbox (click to verify)
  - File Certification button (requires PDMP verification first)
  - Status toggle dropdown (Scheduled, On Hold, Completed)
  
- **Clinical Notes**
  - Large text area for private doctor notes
  - Save button to persist notes

### 4. **Profile Management** (`/doctor/profile`)
- **View Mode**
  - Profile picture (initial letter)
  - Personal information display
  - Doctor-specific details (license number, specialties, licensed states)
  
- **Edit Mode**
  - Update name and phone number
  - Email is read-only
  - Save/Cancel buttons
  
- **Password Update**
  - Change password functionality
  - New password and confirm password fields
  - Validation for matching passwords

### 5. **Notifications** (`/doctor/notifications`)
- **Notification List**
  - Chronological display of all notifications
  - Visual indicators for new appointments
  - Notification types with icons
  - Mark as read functionality
  - Mark all as read button
  - Shows time/date of notification

---

## Backend API Endpoints

### Dashboard
- **GET** `/api/doctor-portal/dashboard`
  - Returns: stats, upcomingAppointments, doctorProfile
  - Auth: Doctor role required

### Appointments
- **GET** `/api/doctor-portal/appointments`
  - Query params: status, state, date, search
  - Returns: appointments array
  - Auth: Doctor role required

- **GET** `/api/doctor-portal/appointments/:id`
  - Returns: full appointment details
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/appointments/:id/pdmp`
  - Marks PDMP as verified
  - Returns: updated appointment
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/appointments/:id/certify`
  - Files certification, marks appointment as completed
  - Sends notifications to patient and admin
  - Requires PDMP verification first
  - Returns: updated appointment
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/appointments/:id/clinical-notes`
  - Body: { clinicalNotes: string }
  - Returns: updated appointment
  - Auth: Doctor role required

- **POST** `/api/doctor-portal/appointments/:id/request-documents`
  - Body: { message: string }
  - Creates notification for admin
  - Returns: updated appointment
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/appointments/:id/status`
  - Body: { status: 'scheduled' | 'on-hold' | 'completed' }
  - Returns: updated appointment
  - Auth: Doctor role required

### Profile
- **GET** `/api/doctor-portal/profile`
  - Returns: user info and doctor profile
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/profile`
  - Body: { name?, phone? }
  - Returns: updated user
  - Auth: Doctor role required

- **PUT** `/api/doctor-portal/change-password`
  - Body: { newPassword, confirmPassword }
  - Returns: success message
  - Auth: Doctor role required

---

## Database Schema Changes

### Appointment Model (Enhanced)
```javascript
{
  // Existing fields...
  
  // New doctor-specific fields
  clinicalNotes: String,
  pdmpVerified: Boolean,
  pdmpVerifiedAt: Date,
  pdmpVerifiedBy: ObjectId (ref: User),
  certificationFiled: Boolean,
  certificationFiledAt: Date,
  certificationFiledBy: ObjectId (ref: User),
  documentRequests: [{
    requestedBy: ObjectId (ref: User),
    requestedAt: Date,
    message: String,
    status: 'pending' | 'sent' | 'fulfilled'
  }]
}
```

---

## Frontend Architecture

### Redux Store
- **doctorPortalSlice**: Manages all doctor portal state
  - Dashboard stats
  - Appointments list
  - Current appointment details
  - Profile information
  - Loading and error states

### Pages Created
1. `/app/doctor/dashboard/page.tsx`
2. `/app/doctor/appointments/page.tsx`
3. `/app/doctor/appointments/[id]/page.tsx`
4. `/app/doctor/profile/page.tsx`
5. `/app/doctor/notifications/page.tsx`

### Components Updated
- **DashboardLayout**: Added doctor-specific navigation menu items

---

## User Workflows

### 1. Doctor Login Flow
1. Doctor logs in with email/password
2. System checks role_id === 2 (Doctor role)
3. Redirects to `/doctor/dashboard`
4. Dashboard loads statistics and upcoming appointments

### 2. View and Manage Appointments
1. Navigate to "My Appointments"
2. Use filters to find specific appointments
3. Click eye icon to view full details
4. Review patient information and intake form
5. Add clinical notes during/after consultation

### 3. Conduct Consultation
1. Open appointment details
2. Review patient intake form
3. Verify PDMP (click checkbox)
4. Add clinical notes
5. File certification (button becomes enabled after PDMP verification)
6. Appointment automatically marked as "completed"

### 4. Request Additional Documents
1. Open appointment details
2. Click "Request Additional Documents"
3. Enter description of needed documents
4. Click "Send Request"
5. Admin receives notification
6. Admin emails patient to upload documents

### 5. Change Appointment Status
1. Open appointment details
2. Select new status from dropdown (Scheduled, On Hold, Completed)
3. Click "Update Status"
4. Patient receives notification of status change

---

## Security & Authorization

### Role-Based Access Control
- All doctor portal routes require `auth` middleware
- All doctor portal routes require `authorize('doctor')` middleware
- Doctor can only view/edit their own appointments
- Doctor ID verification on every appointment action

### Data Privacy
- Clinical notes are private to the doctor
- PDMP verification is audited with timestamp and doctor ID
- Certification filing is tracked with timestamp and doctor ID

---

## Testing Guide

### 1. Create Test Doctor
```bash
# In backend directory
node scripts/create-test-data.js
```
This creates:
- Doctor user: `doctor@test.com` / password from script
- Doctor profile with license number and states

### 2. Login as Doctor
1. Navigate to `/login`
2. Enter doctor credentials
3. Should redirect to `/doctor/dashboard`

### 3. Test Dashboard
- Verify statistics cards display correct counts
- Verify upcoming appointments table shows scheduled appointments
- Click on appointment to verify navigation works

### 4. Test Appointments Management
- Search for patient by name
- Filter by state
- Filter by status
- Filter by date
- Verify results update correctly

### 5. Test Appointment Actions
- Open appointment details
- Check/uncheck PDMP verification
- Add clinical notes and save
- Request additional documents
- Change status
- File certification (requires PDMP first)

### 6. Test Profile Management
- Click Edit button
- Update name and phone
- Save changes
- Change password
- Verify updates persist

### 7. Test Notifications
- Navigate to notifications page
- Verify new appointment notifications appear
- Click "Mark as Read"
- Click "Mark All as Read"

---

## Environment Setup

### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/ehr-system
JWT_SECRET=your-secret-key
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Running the Application

### Start Backend
```bash
cd backend
npm install
npm run dev
```
Server runs on http://localhost:5000

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Application runs on http://localhost:3000

---

## Known Limitations & Future Enhancements

### Calendar View
- Currently shows placeholder
- Needs integration with calendar library (e.g., react-big-calendar)

### Intake Form Display
- Currently placeholder (print window)
- Needs custom modal/page to display intake form data

### Document Viewer
- Additional documents button is disabled if no documents
- Needs document viewer component implementation

### Real-time Updates
- Consider WebSocket implementation for live appointment updates
- Push notifications for new assignments

---

## Troubleshooting

### Issue: Doctor can't see any appointments
**Solution**: Check if appointments are assigned to the doctor
```javascript
// In admin panel or database
appointment.doctor_id = doctorUserId
```

### Issue: PDMP checkbox doesn't work
**Solution**: Verify backend route is accessible and returns proper response

### Issue: Certification button disabled
**Solution**: Ensure PDMP is verified first (checkbox checked)

### Issue: Navigation doesn't show doctor menu
**Solution**: Verify user role_id is 2 and user is logged in

---

## API Response Examples

### Dashboard Response
```json
{
  "stats": {
    "total": 25,
    "scheduled": 10,
    "pending": 5,
    "onHold": 2,
    "cancelled": 3,
    "completed": 5
  },
  "upcomingAppointments": [
    {
      "_id": "123",
      "patient_id": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "appointmentType": "Med Card Initial Certification",
      "state": "CA",
      "scheduledDate": "2026-01-25T00:00:00.000Z",
      "scheduledTime": "10:00 AM",
      "status": "scheduled"
    }
  ]
}
```

### Appointment Details Response
```json
{
  "appointment": {
    "_id": "123",
    "patient_id": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "dateOfBirth": "1990-05-15"
    },
    "appointmentType": "Med Card Initial Certification",
    "medicalCardType": {
      "name": "California Medical Card",
      "price": 150
    },
    "scheduledDate": "2026-01-25",
    "scheduledTime": "10:00 AM",
    "state": "CA",
    "status": "scheduled",
    "pdmpVerified": false,
    "certificationFiled": false,
    "clinicalNotes": "",
    "intakeForm": {},
    "documents": [],
    "documentRequests": []
  }
}
```

---

## Contact & Support
For issues or questions about the Doctor Portal implementation, refer to:
- `/backend/routes/doctor-portal.js` - Backend API implementation
- `/frontend/store/slices/doctorPortalSlice.ts` - Frontend state management
- `/frontend/app/doctor/` - All doctor-facing pages
