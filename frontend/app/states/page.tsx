'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import {
  getStates,
  createState,
  updateState,
  deleteState,
  toggleStateActive,
  clearError,
  clearSuccess
} from '@/store/slices/stateSlice';
import DashboardLayout from '@/components/DashboardLayout';
import StateFormModal from '@/components/StateFormModal';

interface State {
  _id: string;
  code: string;
  name: string;
  abbreviation: string;
  region: string;
  isActive: boolean;
  notes?: string;
}

export default function StatesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { states, loading, error, success, message } = useSelector((state: RootState) => state.states);
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [showModal, setShowModal] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'region'>('name');

  useEffect(() => {
    dispatch(getStates());
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearSuccess());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, dispatch]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleCreateNew = () => {
    setEditingState(null);
    setShowModal(true);
  };

  const handleEdit = (state: State) => {
    setEditingState(state);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingState(null);
  };

  const handleDeleteState = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      await dispatch(deleteState(id));
    }
  };

  const handleToggleActive = (id: string) => {
    dispatch(toggleStateActive(id));
  };

  // Filter and search
  let filteredStates = states.filter(state => {
    const matchesSearch = 
      state.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      state.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      state.abbreviation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterActive === 'all' ||
      (filterActive === 'active' && state.isActive) ||
      (filterActive === 'inactive' && !state.isActive);
    
    return matchesSearch && matchesFilter;
  });

  // Sort
  filteredStates.sort((a, b) => {
    switch (sortBy) {
      case 'code':
        return a.code.localeCompare(b.code);
      case 'region':
        return (a.region || '').localeCompare(b.region || '');
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Check admin access
  if (user?.role_id !== 1) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-gray-600">Only administrators can manage states.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">States Management</h1>
                <p className="mt-2 text-gray-600">Manage available medical marijuana states</p>
              </div>
              <button
                onClick={handleCreateNew}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200 flex items-center gap-2"
              >
                <span>+</span> Add New State
              </button>
            </div>
          </div>

          {/* Alerts */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <p className="text-green-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <span className="text-red-600 text-xl">✕</span>
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Filters and Search */}
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search by name, code, or abbreviation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All States</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'code' | 'region')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="name">Name</option>
                  <option value="code">Code</option>
                  <option value="region">Region</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm font-medium">Total States</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{states.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm font-medium">Active States</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {states.filter(s => s.isActive).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm font-medium">Inactive States</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {states.filter(s => !s.isActive).length}
              </p>
            </div>
          </div>

          {/* States Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading && states.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredStates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <p className="text-xl font-semibold text-gray-600 mb-2">No states found</p>
                <p className="text-gray-500">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">S/No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">State Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStates.map((state, index) => (
                      <tr key={state._id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{state.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(state)}
                              className="inline-flex items-center px-3 py-1 rounded text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteState(state._id, state.name)}
                              className="inline-flex items-center px-3 py-1 rounded text-sm font-medium text-red-600 hover:text-red-800 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* State Form Modal */}
      {showModal && (
        <StateFormModal
          state={editingState}
          onClose={handleCloseModal}
        />
      )}
    </DashboardLayout>
  );
}
