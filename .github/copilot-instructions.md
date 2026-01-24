# AI Coding Agent Instructions - EHR System

## Project Overview
Full-stack Electronic Health Records (EHR) appointment management system with admin dashboard. The system handles user authentication, appointment booking, medical card management, and state-level marijuana medical licensing administration.

**Stack**: Next.js 14 (Frontend) + Express.js (Backend) + MongoDB (Database) + Redux (State Management)

## Architecture Patterns

### Frontend Architecture (Next.js + Redux)
- **Pages**: Located in `app/` directory following Next.js App Router pattern
- **State Management**: Redux Toolkit with async thunks in `store/slices/`
  - Each feature (auth, appointments, notifications, states) has its own slice
  - Async thunks handle API calls and payload processing
  - Example pattern: `getStates()` thunk → dispatches pending/fulfilled/rejected actions → updates slice state
- **API Communication**: Centralized axios instance in `lib/api.ts`
  - Automatically injects JWT token from cookies as `Authorization: Bearer {token}`
  - Handles 401 errors by clearing token and redirecting to login
- **Form Handling**: React Hook Form with Zod validation
  - Don't use uncontrolled validation; prefer explicit form validation with resolvers
- **Styling**: Tailwind CSS with custom configuration in `tailwind.config.js`

### Backend Architecture (Express.js)
- **Route Organization**: Modular routes in `routes/` directory mapped to features (auth, appointments, doctors, states, etc.)
- **Middleware Stack**: 
  - `auth.js` middleware validates JWT token and attaches user to `req.user`
  - `authorize(...roles)` checks user role_id against permission (1=admin, 2=doctor, 3=patient, 4=staff)
  - Applied before route handlers: `router.post('/', auth, authorize('admin'), handler)`
- **Models**: Mongoose schemas in `models/` directory
  - User has `role_id` (number) for role-based access control
  - State model has `code` (2-char unique), `name`, `region`, `medicalCardPrice`, `isActive`
  - Common fields: `createdBy`/`updatedBy` ObjectId references, timestamps
- **Database**: MongoDB with Mongoose ODM
- **Security**:
  - Helmet for HTTP headers
  - Rate limiting (100 requests per 15 mins on `/api/`)
  - CORS configured for frontend URL
  - Passwords hashed with bcryptjs

## Critical Developer Workflows

### Local Development Setup
```bash
# Backend (Terminal 1)
cd backend && npm install
npm run dev  # Starts on http://localhost:5000 (nodemon auto-reload)

# Frontend (Terminal 2)
cd frontend && npm install
npm run dev  # Starts on http://localhost:3000

# Create test data (useful for development)
cd backend && npm run create-test-data
```

### Common Development Commands
- **Frontend build**: `npm run build` (Next.js static export)
- **Frontend lint**: `npm run lint` (ESLint config-next)
- **Backend test data**: `node scripts/create-test-data.js` (populates admin, doctors, patients)
- **Environment setup**: Copy `.env.local.example` to `.env.local`, set `NEXT_PUBLIC_API_URL=http://localhost:5000`

## Key Integration Patterns

### Redux Async Thunk Flow (Example: States Management)
1. **Slice Definition** (`store/slices/stateSlice.ts`):
   ```typescript
   export const getStates = createAsyncThunk('states/getStates', async () => {
     const response = await api.get('/api/states')
     return response.data.states
   })
   
   const stateSlice = createSlice({
     name: 'states',
     initialState: { states: [], loading: false, error: null },
     extraReducers: (builder) => {
       builder.addCase(getStates.pending, state => { state.loading = true })
       builder.addCase(getStates.fulfilled, (state, action) => {
         state.loading = false
         state.states = action.payload
       })
     }
   })
   ```

2. **Component Usage**:
   ```typescript
   const dispatch = useDispatch()
   const { states, loading } = useSelector(state => state.states)
   
   useEffect(() => {
     dispatch(getStates())
   }, [])
   ```

### API Route Pattern (Backend)
```javascript
// routes/states.js
router.post('/', auth, authorize('admin'), [
  body('code').isLength({ min: 2, max: 2 }),
  body('name').notEmpty()
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  
  const state = new State({ ...req.body, createdBy: req.user._id })
  await state.save()
  res.status(201).json({ message: 'State created', state })
})
```

### Authentication Flow
1. User registers/logs in → Backend returns JWT token
2. Frontend stores token in httpOnly cookie via `Cookies.set('token', token)`
3. Axios interceptor adds token to every request: `Authorization: Bearer {token}`
4. Backend auth middleware verifies token, attaches user to `req.user`
5. Routes use `authorize('admin')` for role checks

## Project-Specific Conventions

### File Naming & Structure
- **Routes**: Named after resource (e.g., `routes/states.js` for state management)
- **Models**: Singular PascalCase (e.g., `models/State.js`, `models/User.js`)
- **Components**: PascalCase descriptive names (e.g., `StateFormModal.tsx`, `DashboardLayout.tsx`)
- **Redux slices**: Lowercase with "Slice" suffix (e.g., `stateSlice.ts`)
- **Pages**: Match route structure (e.g., `/app/states/page.tsx` → `/states` URL)

### Error Handling Patterns
- **Backend**: Return `{ message: 'error description', error: error.message }` with appropriate status codes (400, 401, 403, 404, 500)
- **Frontend**: Redux slices store `error` and `success` state; components read and display via Toast/Alert components
- **API Errors**: Axios interceptor handles 401 automatically; other errors bubble to thunk `.rejected` case

### Validation Patterns
- **Backend**: `express-validator` with `body().validationResult()` check before business logic
- **Frontend**: Zod schemas with `@hookform/resolvers` for React Hook Form integration
- **Example**: Form validation in StateFormModal uses Zod schema passed to useForm resolver

### Data Relationships
- User `role_id` (1=admin, 2=doctor, 3=patient, 4=staff) determines access control throughout app
- State has `createdBy`/`updatedBy` userId references for audit trails
- Appointment has relationships to User (patient), Doctor, and State
- Medical cards require State association

## Testing & Debugging

### Database Seeding
- Run `npm run create-test-data` in backend to populate:
  - Admin user: `admin@test.com` / `admin123`
  - Doctor accounts with schedule availability
  - Test patient accounts
- Check MongoDB directly with MongoDB Compass or CLI for schema inspection

### Common Debug Points
- JWT token issues: Check cookie storage in DevTools → Application → Cookies
- API communication: Check Network tab in DevTools, verify `Authorization` header present
- Redux state: Install Redux DevTools browser extension to inspect dispatch history
- Frontend env vars: Must be prefixed with `NEXT_PUBLIC_` to be visible in browser

## Cross-Component Communication
- **State to Components**: Redux provides centralized state; use `useSelector` to access
- **Component to Backend**: Dispatch Redux thunks → thunks call API → results update Redux state → components re-render
- **User Context**: `req.user` in backend routes; `useSelector(state => state.auth.user)` in frontend
- **Role-Based UI**: Conditionally render components based on `user.role_id` or check in routes middleware

## Important Files Reference
- [Frontend store configuration](frontend/store/store.ts)
- [Backend authentication middleware](backend/middleware/auth.js)
- [States route handlers](backend/routes/states.js)
- [Redux state slice pattern](frontend/store/slices/authSlice.ts)
- [API request interceptor setup](frontend/lib/api.ts)
- [Architecture documentation](ARCHITECTURE_DIAGRAM.md)
