'use client';

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  toggleDoctorActive,
  selectDoctors,
  selectDoctorsLoading,
  selectDoctorsError,
} from '@/store/slices/doctorSlice';
import { AppDispatch } from '@/store/store';
import DoctorFormModal from '@/components/DoctorFormModal';
import DashboardLayout from '@/components/DashboardLayout';

export default function DoctorsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const doctors = useSelector(selectDoctors);
  const loading = useSelector(selectDoctorsLoading);
  const error = useSelector(selectDoctorsError);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    dispatch(fetchDoctors());
  }, [dispatch]);

  const filteredDoctors = doctors.filter((doctor: any) => {
    const matchesSearch =
      doctor.user_id.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.user_id.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = !filterState || doctor.states.includes(filterState);
    const matchesSpecialty = !filterSpecialty || doctor.specialties.includes(filterSpecialty);
    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && doctor.isActive) ||
      (filterActive === 'inactive' && !doctor.isActive);
    return matchesSearch && matchesState && matchesSpecialty && matchesActive;
  });

  const handleSubmit = async (formData: any) => {
    try {
      if (editingDoctor) {
        await dispatch(updateDoctor({ id: editingDoctor._id, data: formData })).unwrap();
        alert('Doctor updated successfully');
      } else {
        await dispatch(createDoctor(formData)).unwrap();
        alert('Doctor created successfully');
      }
      setIsModalOpen(false);
      setEditingDoctor(null);
      dispatch(fetchDoctors());
    } catch (error: any) {
      alert(error || 'Failed to save doctor');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete ${name}?`)) {
      try {
        await dispatch(deleteDoctor(id)).unwrap();
        alert('Doctor deleted successfully');
        dispatch(fetchDoctors());
      } catch (error: any) {
        alert(error || 'Failed to delete doctor');
      }
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await dispatch(toggleDoctorActive(id)).unwrap();
      alert(`Doctor ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      dispatch(fetchDoctors());
    } catch (error: any) {
      alert(error || 'Failed to update doctor status');
    }
  };

  const allSpecialties = Array.from(new Set(doctors.flatMap((d: any) => d.specialties))).sort();
  const allStates = Array.from(new Set(doctors.flatMap((d: any) => d.states))).sort();
  const totalDoctors = doctors.length;
  const activeDoctors = doctors.filter((d: any) => d.isActive).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Doctors Management</h1>
          <p className="text-gray-600">Manage doctor profiles, availability, and scheduling</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-2">Total Doctors</div>
            <div className="text-3xl font-bold text-gray-900">{totalDoctors}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-2">Active</div>
            <div className="text-3xl font-bold text-green-600">{activeDoctors}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-2">Inactive</div>
            <div className="text-3xl font-bold text-red-600">{totalDoctors - activeDoctors}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-medium mb-2">Licensed States</div>
            <div className="text-3xl font-bold text-blue-600">{allStates.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <button
              onClick={() => { setEditingDoctor(null); setIsModalOpen(true); }}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              + Add New Doctor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All States</option>
              {allStates.map((state: any) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Specialties</option>
              {allSpecialties.map((specialty: any) => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="text-gray-600 mt-4">Loading doctors...</p>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No doctors found</p>
            {doctors.length === 0 && (
              <button
                onClick={() => { setEditingDoctor(null); setIsModalOpen(true); }}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
              >
                Add Your First Doctor
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">License</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Specialties</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">States</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doctor: any) => (
                    <tr key={doctor._id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{doctor.user_id.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{doctor.user_id.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{doctor.licenseNumber}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {doctor.specialties.map((s: string) => (
                            <span key={s} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {doctor.states.map((s: string) => (
                            <span key={s} className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${doctor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {doctor.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingDoctor(doctor); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-900 font-medium">
                            Edit
                          </button>
                          <button onClick={() => handleToggleActive(doctor._id, doctor.isActive)} className={`font-medium ${doctor.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}>
                            {doctor.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => handleDelete(doctor._id, doctor.user_id.name)} className="text-red-600 hover:text-red-900 font-medium">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DoctorFormModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingDoctor(null); }}
          onSubmit={handleSubmit}
          editingDoctor={editingDoctor}
        />
      </div>
    </DashboardLayout>
  );
}