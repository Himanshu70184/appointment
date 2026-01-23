'use client'

interface StatCardProps {
  icon: string
  label: string
  value: number | string
  color: 'green' | 'red' | 'orange' | 'yellow'
}

export default function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    green: 'bg-status-green text-white',
    red: 'bg-status-red text-white',
    orange: 'bg-status-orange text-white',
    yellow: 'bg-status-yellow text-white',
  }

  const iconBgClasses = {
    green: 'bg-white/20',
    red: 'bg-white/20',
    orange: 'bg-white/20',
    yellow: 'bg-white/20',
  }

  return (
    <div className="stat-card">
      <div className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center text-2xl ${iconBgClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
