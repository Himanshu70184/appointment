// Shared type definitions for the application

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  state?: string
  role_id: number
  prn?: string
  status?: string
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  address?: string
  city?: string
  zipCode?: string
  emergencyContact?: string
  emergencyPhone?: string
  isMinor?: boolean
  guardianName?: string
  guardianPhone?: string
  guardianAddress?: string
  createdAt?: string
  updatedAt?: string
}

export interface Doctor {
  _id: string
  user_id: {
    _id: string
    name: string
    email: string
    phone?: string
    role_id: number
  } | string
  licenseNumber: string
  specialties: string[]
  states: string[]
  consultationFee: number
  pricing?: { [state: string]: number }
  availability?: DoctorAvailability[]
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DoctorAvailability {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  endTime: string
  slotDuration: number
  maxAppointments: number
}

export interface State {
  _id: string
  code: string
  name: string
  abbreviation: string
  region: 'Northeast' | 'Midwest' | 'South' | 'West' | 'Territory'
  isActive: boolean
  notes?: string
}

export interface Staff {
  _id: string
  user_id: string | User
  name: string
  email: string
  phone: string
  department: 'Admin' | 'Reception' | 'Support' | 'Billing' | 'Medical Records' | 'Other'
  designation: string
  permissions: {
    canManageAppointments?: boolean
    canManagePatients?: boolean
    canManageLeads?: boolean
    canManageTasks?: boolean
    canViewReports?: boolean
    canManageDoctors?: boolean
  }
  status: 'active' | 'inactive' | 'on-leave'
  joinDate: string
  notes?: string
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface Appointment {
  _id: string
  patient_id: string
  doctor_id: string
  appointment_type: string
  state: string
  scheduled_date: string
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'need_admin_approval'
  amount: number
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
  intake_form?: any
  clinical_notes?: string
}

export interface Coupon {
  _id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  validFrom: string
  validUntil: string
  usageLimit: number
  usedCount: number
  isActive: boolean
  description: string
}

export interface Lead {
  _id: string
  name: string
  email: string
  phone: string
  state: string
  source: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes?: string
  assignedTo?: string
}

export interface Task {
  _id: string
  title: string
  description: string
  assignedTo: string
  relatedTo?: {
    type: 'appointment' | 'lead' | 'patient'
    id: string
  }
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  dueDate: string
}

export interface Notification {
  _id: string
  user_id: string
  type: 'appointment' | 'payment' | 'system' | 'reminder'
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export interface Payment {
  _id: string
  appointment_id: string
  patient_id: string
  amount: number
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  transactionId?: string
  paymentMethod: string
  createdAt: string
}

export interface DaySchedule {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isActive: boolean
  startTime: string // "HH:MM" format (24-hour)
  endTime: string // "HH:MM" format (24-hour)
  breakStartTime: string | null
  breakEndTime: string | null
}

export interface DoctorAvailability {
  _id: string
  doctor_id: string
  states: string[]
  weeklySchedule: DaySchedule[]
  startDate: string
  endDate: string
  isActive: boolean
  notes?: string
  createdBy?: any
  updatedBy?: any
  createdAt?: string
  updatedAt?: string
}

// Intake Form Types
export interface IntakeFormField {
  fieldId: string
  fieldType: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'checkbox' | 'radio' | 'select' | 'file' | 'multiselect' | 'checkboxGroup'
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  options?: Array<{ value: string; label: string }>
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    errorMessage?: string
  }
  order: number
  conditionalLogic?: {
    enabled: boolean
    dependsOn?: string
    condition?: string
    value?: any
  }
}

export interface IntakeFormSection {
  sectionId: string
  title: string
  description?: string
  order: number
  fields: IntakeFormField[]
}

export interface IntakeFormTemplate {
  _id: string
  name: string
  description?: string
  version: number
  isActive: boolean
  isDefault: boolean
  appointmentTypes?: string[]
  states?: string[]
  sections: IntakeFormSection[]
  settings: {
    allowSaveProgress: boolean
    showProgressBar: boolean
    submitButtonText: string
    successMessage: string
    pdfHeaderText: string
    pdfFooterText?: string
  }
  createdBy: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface IntakeFormSubmissionField {
  fieldId: string
  fieldType: string
  label: string
  value: any
  fileUrls?: string[]
}

export interface IntakeFormSubmission {
  _id: string
  appointment_id: string
  patient_id: string
  template_id: string
  templateVersion: number
  formData: IntakeFormSubmissionField[]
  pdfUrl?: string
  pdfGeneratedAt?: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  submittedAt?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
  updatedAt: string
}
