'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DashboardLayout from '@/components/DashboardLayout'
import { getAppointmentTypes, createAppointmentType, updateAppointmentType, deleteAppointmentType } from '@/store/slices/appointmentTypeSlice'
import type { AppDispatch, RootState } from '@/store/store'

const appointmentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  price: z.number().min(0, 'Price must be positive'),
  isActive: z.boolean().optional(),
})

type AppointmentTypeFormData = z.infer<typeof appointmentTypeSchema>

export default function SettingsPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth)
  const { appointmentTypes, loading, success, error } = useSelector((state: RootState) => state.appointmentTypes)
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState<any>(null)

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AppointmentTypeFormData>({
    resolver: zodResolver(appointmentTypeSchema),
    defaultValues: {
      isActive: true,
      duration: 30,
      price: 0,
    }
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    if (user && user.role_id === 1) {
      dispatch(getAppointmentTypes())
    } else {
      router.push('/dashboard')
    }
  }, [isAuthenticated, user, router, dispatch])

  const openCreateModal = () => {
    setEditingType(null)
    reset({
      name: '',
      description: '',
      duration: 30,
      price: 0,
      isActive: true,
    })
    setShowModal(true)
  }

  const openEditModal = (type: any) => {
    setEditingType(type)
    reset({
      name: type.name,
      description: type.description,
      duration: type.duration,
      price: type.price,
      isActive: type.isActive,
    })
    setShowModal(true)
  }

  const onSubmit = async (data: AppointmentTypeFormData) => {
    try {
      if (editingType) {
        await dispatch(updateAppointmentType({ id: editingType._id, data })).unwrap()
      } else {
        await dispatch(createAppointmentType(data)).unwrap()
      }
      setShowModal(false)
      dispatch(getAppointmentTypes())
    } catch (err) {
      console.error('Form submit failed:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment type?')) return

    try {
      await dispatch(deleteAppointmentType(id)).unwrap()
      dispatch(getAppointmentTypes())
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-2">Manage appointment types and pricing</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary"
          >
            + Add Appointment Type
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Appointment Types</h2>
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : appointmentTypes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No appointment types configured. Click "Add Appointment Type" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointmentTypes.map((type: any) => (
                  <tr key={type._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {type.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {type.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {type.duration} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      ${type.price}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        type.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {type.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openEditModal(type)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(type._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">
              {editingType ? 'Edit Appointment Type' : 'Create Appointment Type'}
            </h3>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    className="input-field"
                    placeholder="e.g., Med Card Initial Certification"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('description')}
                    className="input-field"
                    rows={3}
                    placeholder="Patient-facing description"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (minutes) <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('duration', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      className="input-field"
                    />
                    {errors.duration && (
                      <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('price', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field"
                    />
                    {errors.price && (
                      <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('isActive')}
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Active (visible to patients)
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
