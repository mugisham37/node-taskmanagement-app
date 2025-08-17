'use client';

import {
  ArcElement,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  Tooltip,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Mock business metrics data
const businessMetrics = {
  conversionRates: {
    signups: 12.5,
    activations: 78.3,
    retention: 65.7,
    churn: 8.2,
  },
  userSegments: {
    free: 45.2,
    basic: 32.1,
    premium: 18.4,
    enterprise: 4.3,
  },
};

export function BusinessMetricsChart() {
  const conversionData = {
    labels: ['Signup Rate', 'Activation Rate', 'Retention Rate', 'Churn Rate'],
    datasets: [
      {
        data: [
          businessMetrics.conversionRates.signups,
          businessMetrics.conversionRates.activations,
          businessMetrics.conversionRates.retention,
          businessMetrics.conversionRates.churn,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(139, 92, 246)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const segmentData = {
    labels: ['Free Users', 'Basic Plan', 'Premium Plan', 'Enterprise'],
    datasets: [
      {
        data: [
          businessMetrics.userSegments.free,
          businessMetrics.userSegments.basic,
          businessMetrics.userSegments.premium,
          businessMetrics.userSegments.enterprise,
        ],
        backgroundColor: [
          'rgba(156, 163, 175, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
        ],
        borderColor: [
          'rgb(156, 163, 175)',
          'rgb(59, 130, 246)',
          'rgb(139, 92, 246)',
          'rgb(245, 158, 11)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Conversion Rates */}
      <div>
        <h4 className="text-lg font-medium text-admin-secondary-900 mb-4">Conversion Rates</h4>
        <div className="h-64">
          <Doughnut data={conversionData} options={options} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Signup Rate:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.conversionRates.signups}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Activation Rate:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.conversionRates.activations}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Retention Rate:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.conversionRates.retention}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Churn Rate:</span>
            <span className="font-medium text-red-600">
              {businessMetrics.conversionRates.churn}%
            </span>
          </div>
        </div>
      </div>

      {/* User Segments */}
      <div>
        <h4 className="text-lg font-medium text-admin-secondary-900 mb-4">User Segments</h4>
        <div className="h-64">
          <Doughnut data={segmentData} options={options} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Free Users:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.userSegments.free}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Basic Plan:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.userSegments.basic}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Premium Plan:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.userSegments.premium}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-admin-secondary-500">Enterprise:</span>
            <span className="font-medium text-admin-secondary-900">
              {businessMetrics.userSegments.enterprise}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}