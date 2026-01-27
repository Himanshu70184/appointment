'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointment } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'

export default function AppointmentDetailPage() {
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string
  const { currentAppointment } = useSelector((state: RootState) => state.appointments)

  useEffect(() => {
    dispatch(getAppointment(appointmentId))
  }, [appointmentId, dispatch])

  if (!currentAppointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  const appointment: any = currentAppointment

  return (
    <DashboardLayout>
      <div className="max-w-4xl">

        <div className="card mb-6">
          <h1 className="text-3xl font-bold mb-6">Appointment Details</h1>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <p className="mt-1 text-lg font-semibold">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    appointment.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : appointment.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {appointment.status}
                </span>
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Appointment Type</h3>
              <p className="mt-1 text-lg">
                {typeof appointment.appointmentType === 'string' 
                  ? appointment.appointmentType 
                  : appointment.appointmentType?.name || 'N/A'}
              </p>
            </div>

            {appointment.scheduledDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Scheduled Date</h3>
                <p className="mt-1 text-lg">
                  {new Date(appointment.scheduledDate).toLocaleString()}
                </p>
              </div>
            )}

            {appointment.medicalCardType && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Medical Card Type</h3>
                <p className="mt-1 text-lg">
                  {typeof appointment.medicalCardType === 'object'
                    ? appointment.medicalCardType.name
                    : 'N/A'}
                </p>
              </div>
            )}
          </div>
        </div>

        {appointment.status === 'pending' && !appointment.intakeForm && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
            <p className="text-gray-600 mb-4">
              Please complete your intake form to proceed with your appointment.
            </p>
            <Link
              href={`/appointments/${appointmentId}/intake`}
              className="btn-primary"
            >
              Complete Intake Form
            </Link>
          </div>
        )}

        {appointment.documents && appointment.documents.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Uploaded Documents</h2>
            <div className="space-y-2">
              {appointment.documents.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{doc.filename}</p>
                    <p className="text-sm text-gray-500">{doc.type}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      doc.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : doc.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
