# States Management Feature - Architecture & Data Flow

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD (Next.js)                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  States Management Page (/app/states/page.tsx)                 │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ UI Components                                           │  │  │
│  │  │ ├─ Search Input                                         │  │  │
│  │  │ ├─ Filter Dropdown                                      │  │  │
│  │  │ ├─ Sort Selector                                        │  │  │
│  │  │ ├─ Statistics Cards                                     │  │  │
│  │  │ ├─ States Table                                         │  │  │
│  │  │ └─ Form Modal (Create/Edit)                             │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                           │                                     │  │
│  │                           ▼                                     │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Redux State Management (stateSlice.ts)                 │  │  │
│  │  │                                                         │  │  │
│  │  │  State: {                                              │  │  │
│  │  │    states: State[],                                    │  │  │
│  │  │    currentState: State | null,                         │  │  │
│  │  │    loading: boolean,                                   │  │  │
│  │  │    error: string | null,                               │  │  │
│  │  │    success: boolean,                                   │  │  │
│  │  │    message: string                                     │  │  │
│  │  │  }                                                     │  │  │
│  │  │                                                         │  │  │
│  │  │  Actions: {                                            │  │  │
│  │  │    getStates() → GET /api/states                       │  │  │
│  │  │    getState(id) → GET /api/states/:id                  │  │  │
│  │  │    createState(data) → POST /api/states                │  │  │
│  │  │    updateState({id, data}) → PUT /api/states/:id       │  │  │
│  │  │    deleteState(id) → DELETE /api/states/:id            │  │  │
│  │  │    toggleStateActive(id) → PUT /api/states/:id/toggle  │  │  │
│  │  │  }                                                     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Redux Store (store.ts)                                             │
│  {                                                                  │
│    auth: authReducer,                                              │
│    appointments: appointmentReducer,                               │
│    notifications: notificationReducer,                             │
│    states: stateReducer  ← NEW                                     │
│  }                                                                  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              │ (axios with JWT)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Express.js)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ States Routes (routes/states.js)                              │  │
│  │                                                                │  │
│  │ ├─ GET    /api/states          [Public]                       │  │
│  │ ├─ GET    /api/states/:id      [Public]                       │  │
│  │ ├─ POST   /api/states          [Admin]                        │  │
│  │ ├─ PUT    /api/states/:id      [Admin]                        │  │
│  │ ├─ DELETE /api/states/:id      [Admin]                        │  │
│  │ └─ PUT    /api/states/:id/toggle-active [Admin]               │  │
│  │                                                                │  │
│  │ Middleware:                                                    │  │
│  │ ├─ auth middleware (JWT validation)                           │  │
│  │ ├─ authorize middleware (role check)                          │  │
│  │ └─ express-validator (input validation)                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ State Model (models/State.js)                                  │  │
│  │                                                                │  │
│  │ Fields:                                                        │  │
│  │ ├─ code (String, unique, 2 chars)                            │  │
│  │ ├─ name (String, unique)                                     │  │
│  │ ├─ abbreviation (String, 2 chars)                            │  │
│  │ ├─ isActive (Boolean)                                        │  │
│  │ ├─ region (Enum: Northeast, Midwest, South, West, Territory) │  │
│  │ ├─ medicalCardPrice (Number)                                 │  │
│  │ ├─ notes (String)                                            │  │
│  │ ├─ createdBy (ObjectId ref User)                             │  │
│  │ ├─ updatedBy (ObjectId ref User)                             │  │
│  │ ├─ createdAt (Date)                                          │  │
│  │ └─ updatedAt (Date)                                          │  │
│  │                                                                │  │
│  │ Indexes:                                                       │  │
│  │ ├─ code (unique)                                              │  │
│  │ ├─ name (unique)                                              │  │
│  │ └─ code, isActive (compound)                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ Database Operations
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     MONGODB DATABASE                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ehr-system (database)                                          │  │
│  │                                                                │  │
│  │ Collections:                                                   │  │
│  │ ├─ users                                                      │  │
│  │ ├─ appointments                                               │  │
│  │ ├─ medicalcards                                               │  │
│  │ ├─ doctors                                                    │  │
│  │ └─ states ← NEW COLLECTION                                    │  │
│  │      Sample Document:                                         │  │
│  │      {                                                        │  │
│  │        _id: ObjectId(...),                                   │  │
│  │        code: "CA",                                            │  │
│  │        name: "California",                                    │  │
│  │        abbreviation: "CA",                                    │  │
│  │        isActive: true,                                        │  │
│  │        region: "West",                                        │  │
│  │        medicalCardPrice: 150,                                 │  │
│  │        notes: "Largest market",                               │  │
│  │        createdBy: ObjectId(...),                              │  │
│  │        updatedBy: ObjectId(...),                              │  │
│  │        createdAt: 2024-01-23T10:00:00Z,                       │  │
│  │        updatedAt: 2024-01-23T10:00:00Z                        │  │
│  │      }                                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagrams

### CREATE State Flow
```
User clicks "Add New State"
        ↓
Modal opens (empty form)
        ↓
User fills form (code, name, etc.)
        ↓
User clicks "Create State"
        ↓
Form validation (client-side)
        ↓
Redux action: createState(formData)
        ↓
Frontend: POST /api/states
          + JWT token in Authorization header
          + FormData in body
        ↓
Backend: Route handler validates
         - Check admin role
         - Validate inputs
         - Check uniqueness
        ↓
If valid:
  Create document in MongoDB
  Return created state object
        ↓
Frontend: Redux updates states array
         Modal closes
         Success message shows
        ↓
Table refreshes with new state
```

### UPDATE State Flow
```
User clicks "Edit" on state row
        ↓
Modal opens with state data pre-filled
        ↓
Code field disabled (read-only)
        ↓
User modifies other fields
        ↓
User clicks "Update State"
        ↓
Form validation
        ↓
Redux action: updateState({id, data})
        ↓
Frontend: PUT /api/states/:id
          + JWT token
          + Updated fields
        ↓
Backend: Route handler validates
         - Check admin role
         - Validate inputs
         - Cannot change code
        ↓
If valid:
  Update document in MongoDB
  Return updated state
        ↓
Frontend: Redux finds and replaces item in array
         Modal closes
         Success message shows
        ↓
Table shows updated values
```

### DELETE State Flow
```
User clicks "Delete" button
        ↓
Confirmation dialog: "Are you sure?"
        ↓
User confirms
        ↓
Redux action: deleteState(id)
        ↓
Frontend: DELETE /api/states/:id
          + JWT token
        ↓
Backend: Route handler validates
         - Check admin role
         - Check state exists
        ↓
If valid:
  Delete document from MongoDB
  Return deleted state
        ↓
Frontend: Redux removes item from array
         Success message shows
        ↓
Table refreshes (state removed)
```

### SEARCH & FILTER Flow
```
User types in search box
        ↓
onChange event fires
        ↓
Component filters local states array
  (matching name, code, abbreviation)
        ↓
Results update immediately (no API call)
        ↓
User selects filter option
        ↓
Component filters by status
  (all, active, inactive)
        ↓
Results update immediately
        ↓
User selects sort option
        ↓
Component sorts results
  (by name, code, region)
        ↓
Table refreshes with sorted/filtered results
```

## 📊 State Management Flow

### Redux Action → API → Backend → Database
```
Dispatch Action
     ↓
    ┌─────────────────────────────────┐
    │  Async Thunk (createState)      │
    │  - pending: loading=true        │
    │  - fulfilled: states updated    │
    │  - rejected: error set          │
    └─────────────────────────────────┘
     ↓
API Call (axios)
     ↓
Backend Processing
     ↓
Database Operation
     ↓
Response returned
     ↓
Reducer updates Redux state
     ↓
Component re-renders with new state
```

## 🔐 Security & Authorization

```
Frontend Request
     ↓
Authorization Header with JWT
     ↓
Auth Middleware (backend)
  ├─ Verify token
  └─ Attach user to request
     ↓
Authorize Middleware
  ├─ Check role_id === 1 (admin)
  └─ Return 403 if not admin
     ↓
Route Handler
  ├─ Express-validator
  ├─ Input validation
  └─ Business logic
     ↓
Database Operation
     ↓
Response sent back
```

## 🎯 Component Hierarchy

```
DashboardLayout
    └── StatesPage (/app/states/page.tsx)
        ├── Header section
        ├── Alert section
        ├── Filters & Search
        ├── Statistics Cards
        │   ├── Total States
        │   ├── Active States
        │   ├── Inactive States
        │   └── Average Price
        ├── States Table
        │   └── Table Row (for each state)
        │       ├── Code badge
        │       ├── Name cell
        │       ├── Region cell
        │       ├── Price cell
        │       ├── Status badge (clickable)
        │       └── Actions (Edit, Delete)
        │
        └── StateFormModal (conditional render)
            ├── Form Header
            ├── Form Fields
            │   ├── Code Input
            │   ├── Name Input
            │   ├── Abbreviation Input
            │   ├── Region Select
            │   ├── Price Input
            │   └── Notes Textarea
            └── Form Actions (Cancel, Submit)
```

## 📈 Performance Considerations

```
Performance Optimization
     ↓
1. Client-side filtering/sorting
   (No API calls needed for search/filter)
     ↓
2. Redux state management
   (Single source of truth)
     ↓
3. Indexed MongoDB fields
   (Fast queries on code, name)
     ↓
4. Auto-dismiss notifications
   (After 3-5 seconds)
     ↓
5. Lazy loading for modal
   (Only renders when needed)
     ↓
Result: Fast, responsive UI
```

## 🚀 Deployment Path

```
Development
     ↓
Testing (manual & automated)
     ↓
Build (next build)
     ↓
Production Deploy
     ↓
Environment Variables Set
   (.env files configured)
     ↓
Database Connected
     ↓
Monitoring & Logs
     ↓
Live States Management Feature
```

---

**This architecture ensures**:
✅ Clean separation of concerns
✅ Scalable and maintainable code
✅ Security through JWT and role-based access
✅ Performance through optimization
✅ User-friendly interface
✅ Complete CRUD functionality
