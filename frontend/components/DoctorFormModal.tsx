'use client';

import React, { useState, useEffect } from 'react';

interface DoctorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  editingDoctor: any;
}

export default function DoctorFormModal({ isOpen, onClose, onSubmit, editingDoctor }: DoctorFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    price: '',
    password: '',
    licenseNumber: '',
    specialties: [] as string[],
    states: ['CA'] as string[], // Default state
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingDoctor) {
      setFormData({
        name: editingDoctor.user_id?.name || '',
        email: editingDoctor.user_id?.email || '',
        phone: editingDoctor.user_id?.phone || '',
        price: editingDoctor.consultationFee?.toString() || '',
        password: '',
        licenseNumber: editingDoctor.licenseNumber || '',
        specialties: editingDoctor.specialties || [],
        states: editingDoctor.states || ['CA'],
      });
    } else {
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        price: '', 
        password: '', 
        licenseNumber: '',
        specialties: [],
        states: ['CA']
      });
    }
    setErrors({});
  }, [editingDoctor, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }
    
    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    }
    
    if (!editingDoctor && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        consultationFee: parseFloat(formData.price),
        licenseNumber: formData.licenseNumber || `LIC-${Date.now()}`,
        specialties: formData.specialties.length > 0 ? formData.specialties : ['General Practice'],
        states: formData.states,
      };
      
      if (!editingDoctor && formData.password) {
        submitData.password = formData.password;
      }
      
      onSubmit(submitData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingDoctor ? 'Edit Doctor' : 'Create Doctor'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter doctor name"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="doctor@example.com"
              disabled={!!editingDoctor}
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter phone number"
            />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {editingDoctor && <span className="text-gray-500 text-xs">(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={editingDoctor ? "Enter new password" : "Enter password"}
            />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 font-medium"
            >
              {editingDoctor ? 'Update Doctor' : 'Create Doctor'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}