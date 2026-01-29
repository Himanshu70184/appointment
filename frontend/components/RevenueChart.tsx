'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface RevenueChartProps {
  data?: number[]
  total?: number
}

export default function RevenueChart({ data, total }: RevenueChartProps) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const chartData = {
    labels: months,
    datasets: [
      {
        label: 'Revenue ($)',
        data: data && data.length === 12 ? data : months.map(() => 0),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context: any) {
            return `$${context.parsed.y.toLocaleString()}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
        },
      },
      y: {
        grid: {
          color: '#f3f4f6',
        },
        ticks: {
          color: '#6b7280',
          callback: function(value: any) {
            return `$${value.toLocaleString()}`
          },
        },
      },
    },
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold text-gray-800">Revenue Overview</h3>
          <span className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
            ${Number(total || 0).toLocaleString()}
          </span>
        </div>
        <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option>Monthly</option>
          <option>Weekly</option>
          <option>Yearly</option>
        </select>
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
