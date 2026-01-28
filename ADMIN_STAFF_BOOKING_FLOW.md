# Admin/Staff Booking Flow - Feature Documentation

## 📋 Overview

The admin and staff booking flow allows administrators and staff members to book appointments for patients **without requiring payment**. This feature is designed for in-office or phone bookings where the patient is not making the booking themselves.

### Key Differences from Patient Self-Booking

| Feature | Patient Self-Booking | Admin/Staff Booking |
|---------|---------------------|---------------------|
| **User Selection** | User registers themselves | Admin registers patient on-the-fly |
| **Payment** | Required (credit card) | **Not required** (waived) |
| **Patient Dropdown** | N/A | Removed (uses registration flow instead) |
| **Email Verification** | Required before booking | **Auto-activated** |
| **Workflow** | Register → Verify → Book → Pay → Intake | Book → Register → Intake |
| **Status** | Pending payment | Scheduled immediately |

---

## 🎯 User Flow

### Step 1: Appointment Details
Admin/Staff enters:
- **State**: Which state the appointment is for
- **Appointment Type**: New patient, renewal, consultation, etc.
- **Doctor**: Select from available doctors
- **Date & Time**: Choose from available slots

### Step 2: Patient Registration
Admin/Staff enters patient information:
- **Personal Info**: First name, last name, email, phone, date of birth
- **Account Setup**: Set a temporary password for the patient
- **Minor Check**: If patient is under 18:
  - Guardian name
  - Guardian phone
  - Guardian address

### Step 3: Automatic Processing
Backend handles:
1. **Check if patient exists** by email
   - If exists: Use existing user account
   - If new: Create account with `status: 'active'` (skip email verification)

2. **Validate slot availability**
   - Ensure slot not double-booked
   - Return conflict error if slot taken

3. **Create appointment**
   - Set `paymentCompleted: true` (no payment required)
   - Set `status: 'scheduled'` (adults) or `'approval'` (minors)
   - Track `bookedBy` field (admin/staff who created it)

4. **Send notifications**
   - Email to patient with appointment details
   - Notification to admin/staff confirming creation
   - In-app notification for patient

### Step 4: Redirect to Intake Form
After successful booking, admin/staff is redirected to:
```
/appointments/{appointmentId}/intake
```

---

## 🛠️ Technical Implementation

### Frontend Changes

#### File: `frontend/app/appointments/book/page.tsx`

**Before (Old Dropdown Approach)**:
```typescript
// Showed dropdown of existing patients
const [patients, setPatients] = useState([])

// Form had patient_id selection
<select name="patient_id">
  {patients.map(patient => (
    <option value={patient._id}>{patient.name}</option>
  ))}
</select>
```

**After (New Registration Flow)**:
```typescript
// 3-Step Wizard UI
Step 1: Appointment details (state, cardType, doctor, date, time)
Step 2: Patient registration form
  - firstName, lastName, email, phone, dateOfBirth, password
  - Minor check (if under 18, requires guardian info)
Step 3: Auto-redirect to intake form after success
```

**Schema Changes**:
```typescript
const bookingSchema = z.object({
  // Patient registration fields
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit phone'),
  dateOfBirth: z.string().min(1, 'Date of birth required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  
  // Appointment details
  state: z.string().min(1, 'State is required'),
  cardType: z.string().min(1, 'Appointment type is required'),
  scheduledDate: z.string().min(1, 'Date is required'),
  scheduledTime: z.string().min(1, 'Time slot is required'),
  doctor_id: z.string().min(1, 'Doctor selection is required'),
  
  // Minor handling
  isMinor: z.boolean().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianAddress: z.string().optional()
})
```

**Submission Handler**:
```typescript
const onSubmit = async (data) => {
  try {
    // Call admin-specific booking endpoint
    const response = await api.post('/api/appointments/admin-book-patient', data)
    
    // Redirect to intake form with appointment ID
    router.push(`/appointments/${response.data.appointment._id}/intake`)
  } catch (error) {
    // Handle slot conflict or validation errors
  }
}
```

---

### Backend Changes

#### File: `backend/routes/appointments.js`

**New Endpoint**: `POST /api/appointments/admin-book-patient`

**Authorization**: `auth + authorize('admin', 'staff')`

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "5551234567",
  "dateOfBirth": "1990-05-15",
  "password": "tempPass123",
  "state": "CA",
  "cardType": "64abc...123", // AppointmentType ObjectId
  "scheduledDate": "2024-02-15",
  "scheduledTime": "10:00 AM",
  "doctor_id": "64def...456",
  "isMinor": false,
  "guardianName": "", // Required if isMinor=true
  "guardianPhone": "",
  "guardianAddress": ""
}
```

**Response Success (201)**:
```json
{
  "success": true,
  "message": "Patient registered and appointment created successfully",
  "appointment": {
    "_id": "64xyz...789",
    "patient_id": "64user...123",
    "scheduledDate": "2024-02-15T00:00:00.000Z",
    "scheduledTime": "10:00 AM",
    "status": "scheduled"
  },
  "patient": {
    "_id": "64user...123",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "isNewUser": true
  }
}
```

**Response Errors**:
- `400`: Validation errors (missing fields, invalid format)
- `404`: Appointment type not found
- `409`: Slot conflict (already booked)
- `500`: Server error

**Backend Logic Flow**:
```javascript
1. Validate input fields (express-validator)
2. Check if user exists by email
   - If exists: Use existing user
   - If new: Create new user with:
     - role_id: 3 (Patient)
     - status: 'active' (skip email verification)
     - All provided registration details
3. Validate minor requirements
   - If isMinor=true, require guardian info
4. Get appointment type details from database
5. Check slot availability
   - Query: { scheduledDate, scheduledTime, doctor_id, status: ['scheduled', 'approval', 'pending'] }
   - If conflict found, return 409 error
6. Create appointment:
   - Set paymentCompleted: true
   - Set status: 'scheduled' (or 'approval' for minors)
   - Set intakeSubmitted: false
   - Set bookedBy: req.user._id
7. Create notifications:
   - To patient: "Appointment Scheduled"
   - To admin/staff: "Appointment Created"
8. Send email to patient
9. Return success response with appointment._id
```

---

## 🔐 Security & Validation

### Authorization
- **Required Roles**: Admin (role_id: 1) or Staff (role_id: 4)
- **JWT Token**: Must be present in Authorization header
- **Middleware Chain**: `auth` → `authorize('admin', 'staff')` → route handler

### Input Validation
All fields validated using `express-validator`:
- **Name fields**: Non-empty strings
- **Email**: Must be valid email format
- **Phone**: Must be exactly 10 digits
- **Date of Birth**: ISO 8601 date format
- **Password**: Minimum 6 characters
- **Minor logic**: If isMinor=true, guardian fields become required

### Business Logic Validation
1. **Slot Conflict Check**: Prevents double-booking same slot
2. **Appointment Type Exists**: Validates appointmentType ID
3. **Guardian Requirements**: Enforces guardian info for minors

---

## 📊 Database Schema Updates

### Appointment Model Additions

```javascript
const AppointmentSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // NEW FIELDS for admin/staff booking
  paymentCompleted: {
    type: Boolean,
    default: false
  },
  intakeSubmitted: {
    type: Boolean,
    default: false
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Only set for admin/staff bookings
  }
})
```

### User Model - Auto-Activation

When admin/staff creates a patient account:
```javascript
{
  status: 'active', // Skip email verification
  role_id: 3, // Patient
  isMinor: true/false,
  guardianName: 'John Smith Sr.', // If minor
  guardianPhone: '5559876543',
  guardianAddress: '123 Main St, City, ST 12345'
}
```

---

## 🧪 Testing Checklist

### Manual Test Scenarios

#### Test 1: Book for New Patient (Adult)
1. Login as admin/staff
2. Navigate to `/appointments/book`
3. Select state, appointment type, doctor, date, time
4. Enter new patient details (age 18+)
5. Click "Continue"
6. Verify: Redirected to `/appointments/{id}/intake`
7. Check database: Appointment created with `paymentCompleted: true`, `status: 'scheduled'`
8. Check email: Patient received confirmation email

#### Test 2: Book for New Patient (Minor)
1. Repeat Test 1 steps 1-3
2. Enter patient details with age < 18
3. Enter guardian information
4. Click "Continue"
5. Verify: Redirected to intake form
6. Check database: Appointment created with `status: 'approval'`

#### Test 3: Book for Existing Patient
1. Create a patient account first
2. Login as admin/staff
3. Book appointment using existing patient email
4. Verify: Uses existing account, doesn't create duplicate
5. Check database: Only new appointment created, no new user

#### Test 4: Slot Conflict Handling
1. Book appointment for 10:00 AM slot
2. Try to book same slot for different patient
3. Verify: Error message "This slot has been booked by someone else"
4. UI shows error alert

#### Test 5: Minor Without Guardian Info
1. Enter patient with age < 18
2. Leave guardian fields empty
3. Click "Continue"
4. Verify: Validation error shown
5. Form not submitted

### API Endpoint Testing (Postman/curl)

```bash
# Test admin booking endpoint
curl -X POST http://localhost:5000/api/appointments/admin-book-patient \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Patient",
    "email": "testpatient@example.com",
    "phone": "5551234567",
    "dateOfBirth": "2000-01-01",
    "password": "Test123!",
    "state": "CA",
    "cardType": "{appointmentTypeId}",
    "scheduledDate": "2024-02-20",
    "scheduledTime": "10:00 AM",
    "doctor_id": "{doctorId}",
    "isMinor": false
  }'

# Expected Response:
# Status: 201 Created
# Body: { success: true, appointment: { _id: "...", ... }, patient: { ... } }
```

---

## 🚀 Deployment Checklist

- [x] Frontend code updated (`appointments/book/page.tsx`)
- [x] Backend endpoint created (`/admin-book-patient`)
- [x] Validation rules implemented
- [x] Slot conflict check added
- [x] Email notifications configured
- [x] Minor/guardian logic implemented
- [x] Redirect to intake form working
- [ ] **Environment variables set** (NEXT_PUBLIC_API_URL)
- [ ] **Test with real email service**
- [ ] **Test edge cases** (duplicate emails, slot conflicts)
- [ ] **User acceptance testing** with admin/staff
- [ ] **Monitor logs** for any errors

---

## 📝 Known Limitations & Future Enhancements

### Current Limitations
1. **Password Reset**: Patients registered by admin need to request password reset
2. **Email Activation**: Patients don't receive "welcome" email, only appointment confirmation
3. **Audit Trail**: Limited tracking of who modified what

### Planned Enhancements
1. **Send Welcome Email**: Include login credentials and password reset link
2. **Calendar Integration**: Sync appointments to external calendars
3. **SMS Notifications**: Send appointment reminders via SMS
4. **Batch Booking**: Allow booking multiple appointments at once
5. **Patient Portal Access**: Auto-generate and send patient portal login instructions

---

## 🔗 Related Documentation

- [Patient Portal Guide](./PATIENT_PORTAL_README.md) - Patient self-booking flow
- [Doctor Availability Feature](./DOCTOR_AVAILABILITY_FEATURE.md) - Slot generation logic
- [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md) - Overall system architecture
- [Test Credentials](./TEST_CREDENTIALS.md) - Default test accounts

---

## 📞 Support

For questions or issues with the admin/staff booking flow:
1. Check logs in `backend/logs/` directory
2. Review error messages in browser console
3. Verify JWT token validity
4. Ensure user has admin or staff role (role_id: 1 or 4)

**Common Issues**:
- **401 Unauthorized**: Token expired or missing
- **403 Forbidden**: User doesn't have admin/staff role
- **409 Slot Conflict**: Slot already booked (refresh available slots)
- **400 Validation Error**: Check all required fields are filled correctly
