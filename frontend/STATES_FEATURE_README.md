# Admin States Management Feature

## Overview
This feature allows administrators to manage medical marijuana states directly from the dashboard. Admins can add, edit, remove, and toggle the active status of states without needing to modify the database directly.

## Features Implemented

### 1. Backend (Node.js/Express)

#### New Model: `State.js`
**Location**: `backend/models/State.js`

**Fields**:
- `code` (String, 2 chars, unique) - State abbreviation (e.g., "CA")
- `name` (String, unique) - Full state name (e.g., "California")
- `abbreviation` (String, 2 chars, unique) - Duplicate of code
- `isActive` (Boolean) - Enable/disable state
- `region` (Enum) - Categorize states by region (Northeast, Midwest, South, West, Territory)
- `medicalCardPrice` (Number) - Default price for medical cards in this state
- `notes` (String) - Additional information
- `createdBy` (ObjectId) - Reference to admin who created it
- `updatedBy` (ObjectId) - Reference to last admin who updated it
- `timestamps` - Auto-tracked creation and update times

#### New API Routes: `states.js`
**Location**: `backend/routes/states.js`

**Endpoints**:

1. **GET /api/states** (Public)
   - Fetch all states with optional filtering
   - Query params: `isActive` (boolean)
   - Returns: Array of states

2. **GET /api/states/:id** (Public)
   - Fetch single state with creator/updater info
   - Returns: Single state object

3. **POST /api/states** (Admin Only)
   - Create new state
   - Required fields: `code`, `name`, `abbreviation`
   - Optional fields: `region`, `medicalCardPrice`, `notes`
   - Validation: Code and name must be unique
   - Returns: Created state object

4. **PUT /api/states/:id** (Admin Only)
   - Update existing state
   - Can update: `name`, `abbreviation`, `region`, `medicalCardPrice`, `isActive`, `notes`
   - Cannot update: `code` (immutable)
   - Returns: Updated state object

5. **DELETE /api/states/:id** (Admin Only)
   - Permanently delete a state
   - Returns: Deleted state object

6. **PUT /api/states/:id/toggle-active** (Admin Only)
   - Toggle state between active/inactive
   - Returns: Updated state object with new status

### 2. Frontend (Next.js/React)

#### Redux Slice: `stateSlice.ts`
**Location**: `frontend/store/slices/stateSlice.ts`

**State Structure**:
```typescript
{
  states: State[],
  currentState: State | null,
  loading: boolean,
  error: string | null,
  success: boolean,
  message: string
}
```

**Async Thunks** (API interactions):
- `getStates()` - Fetch all states
- `getState(id)` - Fetch single state
- `createState(stateData)` - Create new state
- `updateState({id, data})` - Update state
- `deleteState(id)` - Delete state
- `toggleStateActive(id)` - Toggle active status

**Reducers**:
- `clearError()` - Clear error message
- `clearSuccess()` - Clear success message
- `clearCurrentState()` - Clear selected state

#### States Management Page: `page.tsx`
**Location**: `frontend/app/states/page.tsx`

**Features**:
- ✅ Role-based access (Admin only)
- ✅ Search by state name, code, or abbreviation
- ✅ Filter by status (All, Active, Inactive)
- ✅ Sort by name, code, or region
- ✅ Add new state (Modal form)
- ✅ Edit existing state
- ✅ Delete state (with confirmation)
- ✅ Toggle active/inactive status
- ✅ Statistics dashboard (total, active, inactive, average price)
- ✅ Loading states and error handling
- ✅ Success notifications

**UI Components**:
- Header with "Add New State" button
- Search and filter controls
- Stats cards showing overview
- Responsive table with all state details
- Action buttons (Edit, Delete, Toggle)

#### State Form Modal: `StateFormModal.tsx`
**Location**: `frontend/components/StateFormModal.tsx`

**Features**:
- ✅ Create mode - All fields editable
- ✅ Edit mode - Code field is read-only
- ✅ Form validation
- ✅ Error messages below each field
- ✅ Loading indicator during submission
- ✅ Modal with close button
- ✅ Cancel and Submit buttons

**Form Fields**:
- State Code (2 characters, disabled in edit mode)
- State Name (required)
- Abbreviation (2 characters)
- Region (dropdown: Northeast, Midwest, South, West, Territory)
- Medical Card Price (number, default: $150)
- Notes (optional, multi-line)

### 3. Redux Store Integration
**Location**: `frontend/store/store.ts`

Added `stateSlice` to the main Redux store so that states data is available across the application.

## How to Use

### For Administrators

1. **Navigate to States Management**
   - Click "States" in the sidebar navigation
   - Only admins can see this menu item

2. **View All States**
   - Page loads automatically with all states
   - See statistics in the cards at the top
   - Table shows all state information

3. **Search and Filter**
   - Use the search box to find states by name, code, or abbreviation
   - Filter by status (All, Active, Inactive)
   - Sort by name, code, or region

4. **Add New State**
   - Click "+ Add New State" button
   - Fill in the form:
     - State Code (2 letters, e.g., "CA")
     - State Name (full name, e.g., "California")
     - Abbreviation (2 letters)
     - Region (select from dropdown)
     - Medical Card Price (default $150)
     - Optional notes
   - Click "Create State"
   - Success message appears if successful

5. **Edit Existing State**
   - Click "Edit" button on any state row
   - Update fields (code cannot be changed)
   - Click "Update State"
   - Changes appear in the table immediately

6. **Delete State**
   - Click "Delete" button on any state row
   - Confirm deletion in the confirmation dialog
   - State removed from the list

7. **Toggle Active Status**
   - Click the status badge (green "✓ Active" or gray "○ Inactive")
   - Status changes immediately
   - Useful for temporarily disabling a state without deletion

## API Usage Examples

### Create a State
```bash
POST /api/states
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "code": "CA",
  "name": "California",
  "abbreviation": "CA",
  "region": "West",
  "medicalCardPrice": 150,
  "notes": "Largest market"
}
```

### Update a State
```bash
PUT /api/states/<state-id>
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "California",
  "medicalCardPrice": 160,
  "isActive": true
}
```

### Delete a State
```bash
DELETE /api/states/<state-id>
Authorization: Bearer <admin-token>
```

### Toggle Active Status
```bash
PUT /api/states/<state-id>/toggle-active
Authorization: Bearer <admin-token>
```

## Security Features

- ✅ **Admin-Only Access**: All write operations require admin role (role_id === 1)
- ✅ **Authentication Required**: All mutations need a valid JWT token
- ✅ **Input Validation**: Backend validates all inputs
- ✅ **Unique Constraints**: Code and name must be unique
- ✅ **Audit Trail**: Tracks which admin created/updated each state
- ✅ **Role-Based UI**: States menu only visible to admins

## Database Schema

```javascript
{
  code: "2-letter state code",
  name: "Full state name",
  abbreviation: "2-letter abbreviation",
  isActive: boolean,
  region: "Northeast|Midwest|South|West|Territory",
  medicalCardPrice: number,
  notes: "string",
  createdBy: "user-id",
  updatedBy: "user-id",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Testing

### Backend Testing
1. Start MongoDB and backend server
2. Use Postman/Thunder Client to test endpoints:
   ```
   POST http://localhost:5000/api/states
   GET http://localhost:5000/api/states
   PUT http://localhost:5000/api/states/<id>
   DELETE http://localhost:5000/api/states/<id>
   ```

### Frontend Testing
1. Start frontend server (`npm run dev`)
2. Login as admin (admin@test.com / admin123)
3. Navigate to States page
4. Test all CRUD operations
5. Verify filtering, searching, and sorting works
6. Check error handling with invalid data

## Future Enhancements

- 📋 Bulk import/export states via CSV
- 📊 State performance analytics
- 🔗 Link states to doctor availability zones
- 📅 Seasonal pricing adjustments
- 🗺️ Geographic heat map visualization
- 📈 State-level performance metrics
- 🔄 State migration/merge functionality

## File Locations Summary

**Backend Files**:
- Model: `backend/models/State.js`
- Routes: `backend/routes/states.js`
- Server: `backend/server.js` (updated)

**Frontend Files**:
- Redux Slice: `frontend/store/slices/stateSlice.ts`
- Page: `frontend/app/states/page.tsx`
- Modal Component: `frontend/components/StateFormModal.tsx`
- Store Config: `frontend/store/store.ts` (updated)

## Troubleshooting

### States not loading
- Verify backend API is running on correct port
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Check browser console for API errors

### Modal not opening
- Verify `StateFormModal` component is properly imported
- Check React version compatibility

### Validation errors
- Ensure state code is exactly 2 characters
- State name must be unique
- Medical card price must be a positive number

### Permission denied
- Confirm user is logged in as admin
- Check JWT token is valid
- Verify token includes `role_id: 1`

## Support

For issues or questions, please check:
1. Backend logs for API errors
2. Browser console for frontend errors
3. Redux DevTools for state management issues
4. MongoDB for database consistency
