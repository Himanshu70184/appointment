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
    user_id: '',
    licenseNumber: '',
    specialties: [] as string[],
    states: [] as string[],
    pricing: {} as Record<string, number>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newState, setNewState] = useState('');

  useEffect(() => {
    if (editingDoctor) {
      setFormData({
        user_id: editingDoctor.user_id._id,
        licenseNumber: editingDoctor.licenseNumber,
        specialties: editingDoctor.specialties || [],
        states: editingDoctor.states || [],
        pricing: editingDoctor.pricing || {},
      });
    } else {
      setFormData({ user_id: '', licenseNumber: '', specialties: [], states: [], pricing: {} });
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
      setFormData((prev) => ({ ...prev, specialties: [...prev.specialties, newSpecialty] }));
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setFormData((prev) => ({ ...prev, specialties: prev.specialties.filter((s) => s !== specialty) }));
  };

  const addState = () => {
    if (newState.trim() && !formData.states.includes(newState.toUpperCase())) {
      setFormData((prev) => ({ ...prev, states: [...prev.states, newState.toUpperCase()] }));
      setNewState('');
    }
  };

  const removeState = (state: string) => {
    setFormData((prev) => ({ ...prev, states: prev.states.filter((s) => s !== state) }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!editingDoctor && !formData.user_id) newErrors.user_id = 'Please select a user';
    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    if (formData.states.length === 0) newErrors.states = 'At least one state is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{editingDoctor ? 'Edit Doctor' : 'Create New Doctor'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!editingDoctor && (
            <div>
              <label className="block text-sm font-medium mb-2">User ID *</label>
              <input
                type="text"
                name="user_id"
                value={formData.user_id}
                onChange={handleChange}
                placeholder="Enter user ID (from database)"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
              {errors.user_id && <p className="text-red-600 text-sm mt-1">{errors.user_id}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">License Number *</label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              placeholder="e.g., MD123456"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
            {errors.licenseNumber && <p className="text-red-600 text-sm mt-1">{errors.licenseNumber}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Specialties</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                placeholder="Add specialty..."
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button type="button" onClick={addSpecialty} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.specialties.map((specialty) => (
                <span key={specialty} className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                  {specialty}
                  <button type="button" onClick={() => removeSpecialty(specialty)} className="font-bold hover:text-blue-900">×</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">States *</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newState}
                onChange={(e) => setNewState(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addState())}
                placeholder="Add state (CA, NY, FL)..."
                maxLength={2}
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button type="button" onClick={addState} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Add
              </button>
            </div>
            {errors.states && <p className="text-red-600 text-sm">{errors.states}</p>}
            <div className="flex flex-wrap gap-2">
              {formData.states.map((state) => (
                <span key={state} className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                  {state}
                  <button type="button" onClick={() => removeState(state)} className="font-bold hover:text-purple-900">×</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pricing by State</label>
            <div className="space-y-2">
              {formData.states.map((state) => (
                <div key={state} className="flex gap-2 items-center">
                  <span className="w-12 font-medium">{state}:</span>
                  <input
                    type="number"
                    value={formData.pricing[state] || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, [state]: parseFloat(e.target.value) || 0 },
                      }))
                    }
                    placeholder="0.00"
                    className="flex-1 px-4 py-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
                  <span className="text-gray-500">$</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t">
            <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium">
              {editingDoctor ? 'Update Doctor' : 'Create Doctor'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}