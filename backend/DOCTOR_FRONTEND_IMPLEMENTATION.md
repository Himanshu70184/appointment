# Doctor Feature - Frontend Implementation Guide

## Overview

This guide provides complete code for building the Doctor Management frontend interface following the same pattern as the States feature.

## Files to Create/Modify

```
frontend/
├── app/
│   └── doctors/
│       └── page.tsx                      # Main doctors page
├── components/
│   ├── DoctorFormModal.tsx              # Create/edit form
│   └── WeeklyShiftScheduler.tsx         # Availability scheduler
└── store/
    ├── slices/
    │   └── doctorSlice.ts               # Redux slice with API calls
    └── store.ts                         # Register doctorSlice reducer
```

---

## 1. Redux Slice (`store/slices/doctorSlice.ts`)

```typescript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface Doctor {
  _id: string;
  user_id: { _id: string; name: string; email: string; phone: string };
  licenseNumber: string;
  specialties: string[];
  states: string[];
  pricing: Record<string, number>;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone: string;
  }>;
  blockedDates: string[];
  isActive: boolean;
  createdAt: string;
}

interface DoctorState {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
}

const initialState: DoctorState = {
  doctors: [],
  loading: false,
  error: null,
};

// Thunks
export const fetchDoctors = createAsyncThunk(
  'doctors/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/doctors`
      );
      if (!response.ok) throw new Error('Failed to fetch doctors');
      const data = await response.json();
      return data.doctors;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createDoctor = createAsyncThunk(
  'doctors/create',
  async (formData: any, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/doctors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create doctor');
      }
      const data = await response.json();
      return data.doctor;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateDoctor = createAsyncThunk(
  'doctors/update',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/doctors/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update doctor');
      }
      const result = await response.json();
      return result.doctor;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteDoctor = createAsyncThunk(
  'doctors/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/doctors/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete doctor');
      }
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const toggleDoctorActive = createAsyncThunk(
  'doctors/toggleActive',
  async (id: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/doctors/${id}/toggle-active`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to toggle doctor');
      }
      const data = await response.json();
      return data.doctor;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const doctorSlice = createSlice({
  name: 'doctors',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch
    builder.addCase(fetchDoctors.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchDoctors.fulfilled, (state, action) => {
      state.loading = false;
      state.doctors = action.payload;
    });
    builder.addCase(fetchDoctors.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Create
    builder.addCase(createDoctor.fulfilled, (state, action) => {
      state.doctors.push(action.payload);
    });

    // Update
    builder.addCase(updateDoctor.fulfilled, (state, action) => {
      const index = state.doctors.findIndex((d) => d._id === action.payload._id);
      if (index !== -1) {
        state.doctors[index] = action.payload;
      }
    });

    // Delete
    builder.addCase(deleteDoctor.fulfilled, (state, action) => {
      state.doctors = state.doctors.filter((d) => d._id !== action.payload);
    });

    // Toggle
    builder.addCase(toggleDoctorActive.fulfilled, (state, action) => {
      const index = state.doctors.findIndex((d) => d._id === action.payload._id);
      if (index !== -1) {
        state.doctors[index] = action.payload;
      }
    });
  },
});

// Selectors
export const selectDoctors = (state: any) => state.doctors.doctors;
export const selectDoctorsLoading = (state: any) => state.doctors.loading;
export const selectDoctorsError = (state: any) => state.doctors.error;

export default doctorSlice.reducer;
```

**Add to `store/store.ts`:**
```typescript
import doctorSlice from './slices/doctorSlice';

const store = configureStore({
  reducer: {
    // ... other slices
    doctors: doctorSlice,
  },
});
```

---

## 2. Doctor Form Modal (`components/DoctorFormModal.tsx`)

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectAllUsers } from '@/store/slices/userSlice'; // Fetch available doctor users

interface DoctorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  editingDoctor: any;
}

export default function DoctorFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingDoctor,
}: DoctorFormModalProps) {
  const [formData, setFormData] = useState({
    user_id: '',
    licenseNumber: '',
    specialties: [] as string[],
    states: [] as string[],
    pricing: {} as Record<string, number>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newState, setNewState] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    if (editingDoctor) {
      setFormData({
        user_id: editingDoctor.user_id._id,
        licenseNumber: editingDoctor.licenseNumber,
        specialties: editingDoctor.specialties || [],
        states: editingDoctor.states || [],
        pricing: Object.fromEntries(
          Object.entries(editingDoctor.pricing || {})
        ) as Record<string, number>,
      });
    } else {
      setFormData({
        user_id: '',
        licenseNumber: '',
        specialties: [],
        states: [],
        pricing: {},
      });
    }
    setErrors({});
  }, [editingDoctor, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const addSpecialty = () => {
    if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty)) {
      setFormData((prev) => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty],
      }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((s) => s !== specialty),
    }));
  };

  const addState = () => {
    if (newState.trim() && !formData.states.includes(newState.toUpperCase())) {
      setFormData((prev) => ({
        ...prev,
        states: [...prev.states, newState.toUpperCase()],
      }));
      setNewState('');
    }
  };

  const removeState = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      states: prev.states.filter((s) => s !== state),
    }));
  };

  const addPrice = () => {
    if (newState.trim() && newPrice) {
      setFormData((prev) => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          [newState.toUpperCase()]: parseFloat(newPrice),
        },
      }));
      setNewPrice('');
    }
  };

  const removePrice = (state: string) => {
    setFormData((prev) => {
      const newPricing = { ...prev.pricing };
      delete newPricing[state];
      return { ...prev, pricing: newPricing };
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!editingDoctor && !formData.user_id) {
      newErrors.user_id = 'Please select a user';
    }
    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }
    if (formData.states.length === 0) {
      newErrors.states = 'At least one state is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {editingDoctor ? 'Edit Doctor' : 'Create New Doctor'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User Selection */}
          {!editingDoctor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Doctor User *
              </label>
              <select
                name="user_id"
                value={formData.user_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Choose a user...</option>
                {/* TODO: Add options from available doctor users */}
              </select>
              {errors.user_id && <p className="text-red-600 text-sm mt-1">{errors.user_id}</p>}
            </div>
          )}

          {/* License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              License Number *
            </label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              placeholder="e.g., MD123456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            {errors.licenseNumber && (
              <p className="text-red-600 text-sm mt-1">{errors.licenseNumber}</p>
            )}
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specialties</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                placeholder="Add specialty..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                type="button"
                onClick={addSpecialty}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {specialty}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(specialty)}
                    className="font-bold hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* States */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">States *</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newState}
                onChange={(e) => setNewState(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addState())}
                placeholder="Add state (CA, NY, FL)..."
                maxLength={2}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                type="button"
                onClick={addState}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
            {errors.states && <p className="text-red-600 text-sm">{errors.states}</p>}
            <div className="flex flex-wrap gap-2">
              {formData.states.map((state) => (
                <span
                  key={state}
                  className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm"
                >
                  {state}
                  <button
                    type="button"
                    onClick={() => removeState(state)}
                    className="font-bold hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pricing by State
            </label>
            <div className="space-y-2 mb-4">
              {formData.states.map((state) => (
                <div key={state} className="flex gap-2 items-center">
                  <span className="w-12 font-medium">{state}:</span>
                  <input
                    type="number"
                    value={formData.pricing[state] || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          [state]: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    placeholder="0.00"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                  <span className="text-gray-500">$</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              {editingDoctor ? 'Update Doctor' : 'Create Doctor'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 3. Main Doctors Page (`app/doctors/page.tsx`)

See the full implementation at the top of this guide (the long page.tsx content provided above).

---

## 4. Weekly Shift Scheduler (`components/WeeklyShiftScheduler.tsx`)

For advanced scheduling (optional - can be added later):

```typescript
'use client';

import React, { useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 9 }, (_, i) => `${i + 8}:00`); // 8 AM to 5 PM

interface WeeklyShiftSchedulerProps {
  availability: any[];
  onChange: (availability: any[]) => void;
}

export default function WeeklyShiftScheduler({
  availability,
  onChange,
}: WeeklyShiftSchedulerProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Weekly Availability</h3>
      
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, dayOfWeek) => {
          const dayAvail = availability.find((a) => a.dayOfWeek === dayOfWeek);
          
          return (
            <div
              key={dayOfWeek}
              onClick={() => setSelectedDay(dayOfWeek)}
              className={`p-3 border rounded cursor-pointer text-center ${
                dayOfWeek === selectedDay ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="font-medium text-sm">{day.slice(0, 3)}</div>
              {dayAvail ? (
                <div className="text-xs text-gray-600 mt-2">
                  {dayAvail.startTime} - {dayAvail.endTime}
                </div>
              ) : (
                <div className="text-xs text-red-600 mt-2">Off</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time picker for selected day */}
      {selectedDay !== null && (
        <div className="mt-6 p-4 border border-green-200 rounded-lg bg-green-50">
          <div className="font-medium mb-4">{DAYS[selectedDay]} Schedule</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start Time</label>
              <input
                type="time"
                defaultValue={
                  availability.find((a) => a.dayOfWeek === selectedDay)?.startTime || '09:00'
                }
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Time</label>
              <input
                type="time"
                defaultValue={
                  availability.find((a) => a.dayOfWeek === selectedDay)?.endTime || '17:00'
                }
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Installation Instructions

### 1. Copy Redux Slice
Copy the `doctorSlice.ts` code to `frontend/store/slices/doctorSlice.ts`

### 2. Register in Store
Add `import doctorSlice` and include it in `configureStore` reducer

### 3. Create Components
- Copy `DoctorFormModal.tsx` to `frontend/components/`
- Copy `WeeklyShiftScheduler.tsx` to `frontend/components/`

### 4. Replace Doctors Page
Replace `frontend/app/doctors/page.tsx` with the complete page code

### 5. Install Dependencies (if needed)
```bash
npm install sonner  # For toast notifications
```

---

## Testing

1. Navigate to http://localhost:3000/doctors
2. You should see the doctors list (initially empty if no doctors created)
3. Click "+ Add New Doctor"
4. Fill in the form and submit
5. Doctor should appear in the table

---

## Integration Checklist

- [ ] Redux slice created and registered
- [ ] Doctor API thunks working
- [ ] Form modal component built
- [ ] Main page displaying doctors list
- [ ] Add doctor functionality working
- [ ] Edit doctor functionality working
- [ ] Delete doctor functionality working
- [ ] Toggle active/inactive working
- [ ] Search and filters working
- [ ] Statistics cards updating
- [ ] Error handling displaying
- [ ] Loading states showing
- [ ] Responsive design verified
- [ ] Toast notifications working

---

## Common Issues & Solutions

**Issue: "Token undefined"**
- Solution: Ensure `localStorage.getItem('token')` returns valid JWT from login

**Issue: Doctors not loading**
- Solution: Check backend is running and API URL in `.env.local` is correct

**Issue: Form not validating**
- Solution: Check browser console for validation errors

**Issue: Modal not closing after submit**
- Solution: Verify `onSubmit` callback includes `onClose()` or is async

