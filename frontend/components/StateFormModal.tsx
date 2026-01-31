import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { createState, updateState } from '@/store/slices/stateSlice';

interface State {
  _id: string;
  code: string;
  name: string;
  abbreviation: string;
  region: string;
  isActive: boolean;
  notes?: string;
}

interface StateFormModalProps {
  state?: State | null;
  onClose: () => void;
}

const regions = ['Northeast', 'Midwest', 'South', 'West', 'Territory'];

export default function StateFormModal({ state, onClose }: StateFormModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.states);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    abbreviation: '',
    region: 'South',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state) {
      setFormData({
        code: state.code,
        name: state.name,
        abbreviation: state.abbreviation,
        region: state.region,
        notes: state.notes || ''
      });
    }
  }, [state]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'State code is required';
    } else if (formData.code.trim().length !== 2) {
      newErrors.code = 'State code must be 2 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'State name is required';
    }

    if (!formData.abbreviation.trim()) {
      newErrors.abbreviation = 'Abbreviation is required';
    } else if (formData.abbreviation.trim().length !== 2) {
      newErrors.abbreviation = 'Abbreviation must be 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (state) {
      // Update existing state
      await dispatch(updateState({
        id: state._id,
        data: {
          name: formData.name,
          abbreviation: formData.abbreviation.toUpperCase(),
          region: formData.region as 'Northeast' | 'Midwest' | 'South' | 'West' | 'Territory',
          notes: formData.notes
        }
      }));
    } else {
      // Create new state
      await dispatch(createState({
        code: formData.code.toUpperCase(),
        name: formData.name,
        abbreviation: formData.abbreviation.toUpperCase(),
        region: formData.region as 'Northeast' | 'Midwest' | 'South' | 'West' | 'Territory',
        notes: formData.notes
      }));
    }

    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {state ? 'Edit State' : 'Add New State'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              disabled={!!state}
              placeholder="CA"
              maxLength={2}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.code ? 'border-red-500' : 'border-gray-300'
              } ${state ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            {state && <p className="text-gray-500 text-xs mt-1">Cannot edit code</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="California"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Abbreviation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Abbreviation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="abbreviation"
              value={formData.abbreviation}
              onChange={handleChange}
              placeholder="CA"
              maxLength={2}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.abbreviation ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.abbreviation && <p className="text-red-500 text-xs mt-1">{errors.abbreviation}</p>}
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <select
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {regions.map(region => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  {state ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                state ? 'Update State' : 'Create State'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
