import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import appointmentReducer from './slices/appointmentSlice'
import notificationReducer from './slices/notificationSlice'
import stateReducer from './slices/stateSlice'
import doctorReducer from './slices/doctorSlice'
import doctorPortalReducer from './slices/doctorPortalSlice'
import taskReducer from './slices/taskSlice'
import leadReducer from './slices/leadSlice'
import appointmentTypeReducer from './slices/appointmentTypeSlice'
import patientPortalReducer from './slices/patientPortalSlice'
import doctorAvailabilityReducer from './slices/doctorAvailabilitySlice'
import intakeFormTemplateReducer from './slices/intakeFormTemplateSlice'
import intakeFormSubmissionReducer from './slices/intakeFormSubmissionSlice'
import couponReducer from './slices/couponSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentReducer,
    notifications: notificationReducer,
    states: stateReducer,
    doctors: doctorReducer,
    doctorPortal: doctorPortalReducer,
    tasks: taskReducer,
    leads: leadReducer,
    appointmentTypes: appointmentTypeReducer,
    patientPortal: patientPortalReducer,
    doctorAvailability: doctorAvailabilityReducer,
    intakeFormTemplates: intakeFormTemplateReducer,
    intakeFormSubmissions: intakeFormSubmissionReducer,
    coupons: couponReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
