'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '@/store/slices/authSlice'
import type { RootState, AppDispatch } from '@/store/store'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch<AppDispatch>()
  const { user, loading: authLoading } = useSelector((state: RootState) => state.auth)

  // AuthGuard handles authentication checks - DashboardLayout just renders
  // If we reach here, user is already authenticated via AuthGuard
  
  // Safety check: if user is still loading, show minimal loading state
  if (!user || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  const getRoleName = (roleId: number) => {
    const roles: { [key: number]: string } = {
      1: 'Admin',
      2: 'Doctor',
      3: 'Patient',
      4: 'Staff',
    }
    return roles[roleId] || 'Unknown'
  }

  const menuItems = [
    // Admin menu items
    { icon: '📊', label: 'Dashboard', href: '/dashboard', roles: [1, 3, 4] },
    { icon: '📅', label: 'Appointments', href: '/appointments', roles: [1, 3, 4] },
    { icon: '👨‍⚕️', label: 'Doctors', href: '/doctors', roles: [1, 4] },
    { icon: '👥', label: 'Staff', href: '/staff', roles: [1] },
    { icon: '👤', label: 'Patients', href: '/patients', roles: [1, 4] },
    { icon: '📋', label: 'Task', href: '/tasks', roles: [1, 4] },
    { icon: '🏷️', label: 'Coupons', href: '/coupons', roles: [1] },
    { icon: '📍', label: 'States', href: '/states', roles: [1] },
    { icon: '📝', label: 'Intake Forms', href: '/intake-forms', roles: [1, 4] },
    { icon: '👤', label: 'Leads', href: '/leads', roles: [1, 4] },
    { icon: '⚙️', label: 'Setting', href: '/settings', roles: [1, 3, 4] },
    
    // Doctor menu items
    { icon: '📊', label: 'Dashboard', href: '/doctor/dashboard', roles: [2] },
    { icon: '📅', label: 'My Appointments', href: '/doctor/appointments', roles: [2] },
    { icon: '👤', label: 'Profile', href: '/doctor/profile', roles: [2] },
    { icon: '🔔', label: 'Notifications', href: '/doctor/notifications', roles: [2] },
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role_id || 0)
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-sidebar-bg transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-700">
          <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center text-white font-bold">
            🌿
          </div>
          {sidebarOpen && (
            <h1 className="text-white font-bold text-lg">EHR System</h1>
          )}
        </div>

        {/* Menu Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 text-white hover:bg-sidebar-hover transition-colors"
        >
          <span className="text-xl">☰</span>
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {filteredMenuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full"
          >
            <span className="text-xl">🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center text-white font-bold">
                🌿
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <span className="text-xl">🔔</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-gray-700 font-medium">
                  {getRoleName(user?.role_id || 0)}
                </span>
              </div>
              {/* Patient booking button */}
              {user?.role_id === 3 && (
                <Link href="/patient/book" className="btn-primary">
                  Booking Now
                </Link>
              )}
              {/* Admin/Staff booking button */}
              {(user?.role_id === 1 || user?.role_id === 4) && (
                <Link href="/appointments/book" className="btn-primary">
                  Book for Patient
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
