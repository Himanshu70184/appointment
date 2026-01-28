# Staff Management Feature - Complete Guide

## Overview
This guide explains the complete staff management system that allows admins to create, read, update, and delete (CRUD) staff members in the EHR application.

## What Was Fixed
The original implementation had issues:
1. ❌ Staff creation was using `/api/auth/register` (patient registration endpoint)
2. ❌ Required fields like `state` and `appointmentType` that don't apply to staff
3. ❌ Staff couldn't be created because of validation errors

Now fixed with dedicated admin endpoints:
✅ `/api/admin/staff` - Create and get all staff
✅ `/api/admin/staff/:id` - Update and delete specific staff
✅ Proper validation for staff-specific fields
✅ Secure, admin-only access

---

## Backend Implementation

### New Routes Added
All routes require admin authentication (`auth` + `authorize('admin')` middleware).

#### **1. GET /api/admin/staff**
Get all staff members
- **Access**: Admin only
- **Response**: Array of staff users without passwords

#### **2. POST /api/admin/staff**
Create a new staff member
- **Access**: Admin only
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "password": "password123",
    "status": "active"
  }
  ```
- **Validation**:
  - Name: Required, non-empty
  - Email: Required, valid email format, must be unique
  - Phone: Required
  - Password: Required, minimum 6 characters
  - Status: Optional, defaults to "active"
- **Auto-set fields**:
  - `role_id`: 4 (Staff role)
  - `emailVerified`: true (Staff accounts are pre-verified)

#### **3. PUT /api/admin/staff/:id**
Update an existing staff member
- **Access**: Admin only
- **Request Body** (all optional):
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "0987654321",
    "password": "newpassword123",
    "status": "inactive"
  }
  ```
- **Validation**:
  - Ensures user is a staff member (role_id = 4)
  - Email uniqueness check (if changing email)
  - Password is hashed if provided

#### **4. DELETE /api/admin/staff/:id**
Delete a staff member
- **Access**: Admin only
- **Safety Checks**:
  - Ensures user is a staff member
  - Prevents admin from deleting themselves

---

## Frontend Implementation

### Page Location
`frontend/app/staff/page.tsx`

### Features

#### **1. Staff List View**
- Table displaying all staff members
- Columns: S.No, Name, Email, Phone, Status, Actions
- Real-time filtering and search

#### **2. Search & Filters**
- **Search**: Filter by name, email, or phone number
- **Status Filter**: All / Active / Inactive
- **Clear Filters**: Reset all filters with one click

#### **3. Create Staff Modal**
Opens when clicking "+ Create New Staff" button
- **Fields**:
  - Full Name (required)
  - Email (required)
  - Phone (required)
  - Password (required, min 6 characters)
  - Status (dropdown: Active/Inactive)

#### **4. Edit Staff Modal**
Opens when clicking "Edit" button on staff row
- Pre-filled with current staff data
- **Fields**:
  - Full Name (editable)
  - Email (editable)
  - Phone (editable)
  - Password (optional - leave blank to keep current)
  - Status (editable)

#### **5. Delete Staff**
- Click "Delete" button on staff row
- Confirmation dialog before deletion
- Cannot delete yourself

#### **6. Toggle Status**
- Click status badge to toggle between Active/Inactive
- Instant update with visual feedback

---

## Testing Guide

### Prerequisites
1. Backend server running on `http://localhost:5000`
2. Frontend server running on `http://localhost:3000`
3. Admin account credentials (from TEST_CREDENTIALS.md)

### Step-by-Step Testing

#### **Test 1: View Staff List**
1. Login as admin (`admin@test.com` / `admin123`)
2. Navigate to Staff Management page
3. ✅ Verify: Empty list or existing staff members shown
4. ✅ Verify: Table headers displayed correctly

#### **Test 2: Create New Staff**
1. Click "+ Create New Staff" button
2. Fill in the form:
   - Name: `Test Staff`
   - Email: `teststaff@example.com`
   - Phone: `5551234567`
   - Password: `staff123`
   - Status: `Active`
3. Click "Create Staff"
4. ✅ Verify: Success message appears
5. ✅ Verify: New staff appears in table
6. ✅ Verify: Modal closes automatically

#### **Test 3: Create Staff with Validation Errors**
1. Click "+ Create New Staff"
2. Leave name field empty
3. Click "Create Staff"
4. ✅ Verify: Error message "Please fill in all required fields"
5. Fill name, but leave password empty
6. Click "Create Staff"
7. ✅ Verify: Error message "Password is required for new staff"
8. Enter password less than 6 characters
9. Click "Create Staff"
10. ✅ Verify: Backend validation error

#### **Test 4: Create Duplicate Email**
1. Click "+ Create New Staff"
2. Use email that already exists
3. Fill other fields
4. Click "Create Staff"
5. ✅ Verify: Error message "User already exists with this email"

#### **Test 5: Search Staff**
1. Create 2-3 test staff members with different names
2. Type in search box: staff member's name
3. ✅ Verify: Only matching staff shown
4. Type in search box: email address
5. ✅ Verify: Correct staff member shown
6. Clear search
7. ✅ Verify: All staff shown again

#### **Test 6: Filter by Status**
1. Create staff with different statuses (active/inactive)
2. Select "Active" from status dropdown
3. ✅ Verify: Only active staff shown
4. Select "Inactive"
5. ✅ Verify: Only inactive staff shown
6. Select "All Status"
7. ✅ Verify: All staff shown

#### **Test 7: Edit Staff**
1. Click "Edit" button on a staff member
2. ✅ Verify: Modal opens with pre-filled data
3. Change name to `Updated Staff Name`
4. Change status to `Inactive`
5. Click "Update Staff"
6. ✅ Verify: Success message appears
7. ✅ Verify: Table shows updated values
8. ✅ Verify: Modal closes

#### **Test 8: Update Password**
1. Click "Edit" on a staff member
2. Enter new password in password field
3. Click "Update Staff"
4. ✅ Verify: Success message
5. Login to staff account with new password
6. ✅ Verify: Login successful

#### **Test 9: Toggle Status**
1. Click on status badge (Active or Inactive)
2. ✅ Verify: Status changes immediately
3. ✅ Verify: Success message appears
4. ✅ Verify: Badge color changes (green for active, gray for inactive)
5. Click again to toggle back
6. ✅ Verify: Status reverts

#### **Test 10: Delete Staff**
1. Click "Delete" button on a staff member
2. ✅ Verify: Confirmation dialog appears
3. Click "Cancel"
4. ✅ Verify: Staff not deleted
5. Click "Delete" again
6. Click "OK" on confirmation
7. ✅ Verify: Success message appears
8. ✅ Verify: Staff removed from table

#### **Test 11: Access Control**
1. Logout from admin account
2. Try to access `/staff` page directly
3. ✅ Verify: Redirected to dashboard or login
4. Login as patient account
5. Try to access `/staff` page
6. ✅ Verify: Redirected away (not accessible)

---

## API Testing with Postman/Thunder Client

### Get All Staff
```http
GET http://localhost:5000/api/admin/staff
Authorization: Bearer {admin_token}
```

### Create Staff
```http
POST http://localhost:5000/api/admin/staff
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "API Test Staff",
  "email": "apitest@example.com",
  "phone": "5559876543",
  "password": "testpass123",
  "status": "active"
}
```

### Update Staff
```http
PUT http://localhost:5000/api/admin/staff/{staff_id}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Updated API Test",
  "status": "inactive"
}
```

### Delete Staff
```http
DELETE http://localhost:5000/api/admin/staff/{staff_id}
Authorization: Bearer {admin_token}
```

---

## Database Verification

### Check Staff in MongoDB
```javascript
// Open MongoDB shell or Compass
use ehr-system

// Find all staff
db.users.find({ role_id: 4 })

// Count staff
db.users.countDocuments({ role_id: 4 })

// Find specific staff by email
db.users.findOne({ email: 'teststaff@example.com' })
```

### Staff User Document Structure
```json
{
  "_id": ObjectId("..."),
  "name": "Test Staff",
  "email": "teststaff@example.com",
  "phone": "5551234567",
  "password": "$2a$10$...",  // Hashed
  "role_id": 4,              // Staff role
  "status": "active",
  "emailVerified": true,     // Auto-verified
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

---

## Troubleshooting

### Issue: "Failed to load staff members"
**Solution**: 
- Check backend server is running
- Verify admin token is valid
- Check browser console for errors

### Issue: "Failed to save staff member"
**Solution**:
- Verify all required fields are filled
- Check email is unique
- Ensure password is at least 6 characters
- Check backend logs for validation errors

### Issue: Cannot create staff - validation error
**Solution**:
- Restart backend server to load new routes
- Clear browser cache
- Verify route is registered in server.js

### Issue: Email already exists
**Solution**:
- Use a different email address
- Check if user already exists in database
- Delete duplicate user if needed

---

## Security Considerations

### ✅ Implemented Security
1. **Admin-Only Access**: All staff endpoints require admin authentication
2. **Password Hashing**: Passwords are bcrypt hashed before storage
3. **Email Uniqueness**: Prevents duplicate accounts
4. **Self-Delete Prevention**: Admin cannot delete their own account
5. **Role Verification**: Ensures operations only affect staff (role_id=4)
6. **JWT Authentication**: All requests require valid JWT token

### ⚠️ Best Practices
- Never share admin credentials
- Use strong passwords (min 6 chars, recommended 12+)
- Regularly review staff accounts
- Deactivate instead of delete when possible (audit trail)

---

## File Changes Summary

### Backend Files Modified
1. **`backend/routes/admin.js`**
   - Added: POST /api/admin/staff (create)
   - Added: PUT /api/admin/staff/:id (update)
   - Added: DELETE /api/admin/staff/:id (delete)
   - Added: GET /api/admin/staff (list all)
   - Added bcrypt import for password hashing
   - Added express-validator import for validation

### Frontend Files Modified
1. **`frontend/app/staff/page.tsx`**
   - Updated: fetchStaff() to use `/api/admin/staff`
   - Updated: handleSubmit() to use admin endpoints
   - Updated: handleDelete() to use `/api/admin/staff/:id`
   - Updated: toggleStatus() to use `/api/admin/staff/:id`
   - Removed: Unnecessary role_id and state fields from payload

---

## Next Steps / Future Enhancements

### Potential Improvements
1. **Bulk Operations**: Select multiple staff for bulk status change or delete
2. **Export to CSV**: Download staff list as CSV file
3. **Advanced Filters**: Filter by creation date, updated date
4. **Activity Log**: Track staff actions in the system
5. **Email Notifications**: Send welcome email to new staff with credentials
6. **Permission Levels**: Different permission levels for staff (read-only, full access, etc.)
7. **Two-Factor Authentication**: Enhanced security for staff accounts
8. **Password Reset**: Allow staff to reset their own passwords

---

## Support

If you encounter issues:
1. Check the console logs (browser and backend terminal)
2. Verify authentication token is valid
3. Ensure database connection is working
4. Review error messages carefully
5. Check this guide for common issues

## Related Documentation
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - System architecture
- [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) - Test account credentials
- [ADMIN_STAFF_BOOKING_FLOW.md](./ADMIN_STAFF_BOOKING_FLOW.md) - Staff booking workflow

---

**Created**: January 28, 2026
**Last Updated**: January 28, 2026
**Status**: ✅ Complete and Tested
