'use client';

import { AlertsList } from '@/components/alerts/AlertsList';
import { SystemHealthDashboard } from '@/components/monitoring/SystemHealthDashboard';
import {
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ServerIcon,
    UsersIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  activeAlerts: number;
  uptime: string;
  responseTime: number;
}

// Mock dashboard data
const mockStats: DashboardStats = {
  totalUsers: 12847,
  activeUsers: 8934,
  totalTasks: 45678,
  completedTasks: 38901,
  systemHealth: 'healthy',
  activeAlerts: 3,
  uptime: '99.9%',
  responseTime: 145,
};

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 10 - 5),
        responseTime: Math.max(50, prev.responseTime + Math.floor(Math.random() * 20 - 10)),
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getHealthStatusColor = (status: DashboardStats['systemHealth']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthStatusIcon = (status: DashboardStats['systemHealth']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'warning':
      case 'critical':
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <CheckCircleIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">Dashboard Overview</h1>
        <p className="text-sm text-admin-secondary-500">
          Monitor system health, user activity, and key performance metrics
        </p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Total Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {formatNumber(stats.totalUsers)}
                    </div>
                    <div className="ml-2 text-sm text-green-600">
                      +12.5%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Active Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {formatNumber(stats.activeUsers)}
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Task Completion */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Task Completion</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)}%
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {formatNumber(stats.completedTasks)} / {formatNumber(stats.totalTasks)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className={`overflow-hidden shadow-sm ring-1 rounded-lg border ${getHealthStatusColor(stats.systemHealth)}`}>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {getHealthStatusIcon(stats.systemHealth)}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium truncate">System Health</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold capitalize">
                      {stats.systemHealth}
                    </div>
                    <div className="ml-2 text-sm">
                      {stats.uptime} uptime
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Health Dashboard */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h3 className="text-lg font-medium text-admin-secondary-900">System Health</h3>
          <p className="text-sm text-admin-secondary-500">Real-time system monitoring and performance metrics</p>
        </div>
        <div className="p-6">
          <SystemHealthDashboard />
        </div>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Alerts */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-admin-secondary-900">Recent Alerts</h3>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {stats.activeAlerts} active
              </span>
            </div>
            <p className="text-sm text-admin-secondary-500">Latest system alerts and notifications</p>
          </div>
          <div className="p-6">
            <AlertsList limit={5} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h3 className="text-lg font-medium text-admin-secondary-900">Quick Actions</h3>
            <p className="text-sm text-admin-secondary-500">Common administrative tasks</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <button className="flex items-center justify-between p-4 border border-admin-secondary-200 rounded-lg hover:bg-admin-secondary-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <UsersIcon className="h-5 w-5 text-admin-secondary-400" />
                  <span className="text-sm font-medium text-admin-secondary-900">Manage Users</span>
                </div>
                <span className="text-admin-secondary-400">→</span>
              </button>
              
              <button className="flex items-center justify-between p-4 border border-admin-secondary-200 rounded-lg hover:bg-admin-secondary-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <ServerIcon className="h-5 w-5 text-admin-secondary-400" />
                  <span className="text-sm font-medium text-admin-secondary-900">System Settings</span>
                </div>
                <span className="text-admin-secondary-400">→</span>
              </button>
              
              <button className="flex items-center justify-between p-4 border border-admin-secondary-200 rounded-lg hover:bg-admin-secondary-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <ChartBarIcon className="h-5 w-5 text-admin-secondary-400" />
                  <span className="text-sm font-medium text-admin-secondary-900">View Analytics</span>
                </div>
                <span className="text-admin-secondary-400">→</span>
              </button>
              
              <button className="flex items-center justify-between p-4 border border-admin-secondary-200 rounded-lg hover:bg-admin-secondary-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-admin-secondary-400" />
                  <span className="text-sm font-medium text-admin-secondary-900">Review Alerts</span>
                </div>
                <span className="text-admin-secondary-400">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Avg Response Time</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {stats.responseTime}ms
                    </div>
                    <div className="ml-2 text-sm text-green-600">
                      -8.2%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ServerIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">System Uptime</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {stats.uptime}
                    </div>
                    <div className="ml-2 text-sm text-green-600">
                      Excellent
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Active Alerts</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {stats.activeAlerts}
                    </div>
                    <div className="ml-2 text-sm text-yellow-600">
                      Needs attention
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}