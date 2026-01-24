'use client';

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchProfile,
  updateProfile,
  changePassword,
  selectDoctorProfile,
  selectDoctorPortalLoading,
  selectDoctorPortalError,
} from '@/store/slices/doctorPortalSlice';
import { AppDispatch } from '@/store/store';
import DashboardLayout from '@/components/DashboardLayout';

export default function DoctorProfilePage() {
  const dispatch = useDispatch<AppDispatch>();
  const profile = useSelector(selectDoctorProfile);
  const loading = useSelector(selectDoctorPortalLoading);
  const error = useSelector(selectDoctorPortalError);

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile?.user) {
      setFormData({
        name: profile.user.name || '',
        phone: profile.user.phone || '',
      });
    }
  }, [profile]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile?.user) {
      setFormData({
        name: profile.user.name || '',
        phone: profile.user.phone || '',
      });
    }
    setValidationErrors({});
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.phone.trim()) errors.phone = 'Phone is required';

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await dispatch(updateProfile(formData)).unwrap();
      alert('Profile updated successfully');
      setIsEditing(false);
      setValidationErrors({});
    } catch (error: any) {
      alert(error || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async () => {
    const errors: Record<string, string> = {};
    if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await dispatch(changePassword(passwordData)).unwrap();
      alert('Password changed successfully');
      setIsChangingPassword(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setValidationErrors({});
    } catch (error: any) {
      alert(error || 'Failed to change password');
    }
  };

  if (loading && !profile) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="text-gray-600 mt-4">Loading profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Management</h1>
            <p className="text-gray-600">Manage your personal details and account security</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Profile Picture Placeholder */}
              <div className="flex items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-3xl font-bold text-green-600">
                  {profile?.user?.name?.charAt(0).toUpperCase() || 'D'}
                </div>
                <div className="ml-6">
                  <h3 className="text-xl font-bold text-gray-900">{profile?.user?.name}</h3>
                  <p className="text-gray-600">{profile?.user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      {validationErrors.name && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.name}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-900">{profile?.user?.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <p className="text-gray-900">{profile?.user?.email}</p>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      {validationErrors.phone && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.phone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-900">{profile?.user?.phone || 'Not provided'}</p>
                  )}
                </div>

                {profile?.doctorProfile && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                      <p className="text-gray-900">{profile.doctorProfile.licenseNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specialties</label>
                      <div className="flex flex-wrap gap-2">
                        {profile.doctorProfile.specialties?.map((specialty: string) => (
                          <span
                            key={specialty}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Licensed States</label>
                      <div className="flex flex-wrap gap-2">
                        {profile.doctorProfile.states?.map((state: string) => (
                          <span
                            key={state}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                          >
                            {state}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Password Update */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Security</h2>
            </div>

            <div className="p-6">
              {!isChangingPassword ? (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Change Password
                </button>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Enter new password"
                    />
                    {validationErrors.newPassword && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Confirm new password"
                    />
                    {validationErrors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordChange}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Update Password
                    </button>
                    <button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ newPassword: '', confirmPassword: '' });
                        setValidationErrors({});
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
