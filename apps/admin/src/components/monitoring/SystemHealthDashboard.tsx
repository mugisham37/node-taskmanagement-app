'use client';

import {
  CheckCircleIcon,
  CircleStackIcon,
  CloudIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { AlertsList } from '../alerts/AlertsList';
import { SystemMetricsChart } from '../charts/SystemMetricsChart';
import { ServiceStatusGrid } from './ServiceStatusGrid';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
  responseTime: number;
  lastCheck: string;
}

// Mock data - in real app, this would come from monitoring APIs
const mockMetrics: SystemMetrics = {
  cpu: {
    usage: 45.2,
    cores: 8,
    temperature: 62,
  },
  memory: {
    used: 12.4,
    total: 32,
    percentage: 38.8,
  },
  disk: {
    used: 245,
    total: 500,
    percentage: 49.0,
  },
  network: {
    inbound: 125.6,
    outbound: 89.3,
  },
};

const mockServices: ServiceStatus[] = [
  {
    name: 'API Server',
    status: 'healthy',
    uptime: '99.9%',
    responseTime: 145,
    lastCheck: '2024-01-15T10:30:00Z',
  },
  {
    name: 'Database',
    status: 'healthy',
    uptime: '99.8%',
    responseTime: 23,
    lastCheck: '2024-01-15T10:30:00Z',
  },
  {
    name: 'Redis Cache',
    status: 'warning',
    uptime: '98.5%',
    responseTime: 89,
    lastCheck: '2024-01-15T10:30:00Z',
  },
  {
    name: 'File Storage',
    status: 'healthy',
    uptime: '99.9%',
    responseTime: 67,
    lastCheck: '2024-01-15T10:30:00Z',
  },
];

export function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics>(mockMetrics);
  const [services, setServices] = useState<ServiceStatus[]>(mockServices);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu: {
          ...prev.cpu,
          usage: Math.max(0, Math.min(100, prev.cpu.usage + (Math.random() - 0.5) * 10)),
        },
        memory: {
          ...prev.memory,
          percentage: Math.max(0, Math.min(100, prev.memory.percentage + (Math.random() - 0.5) * 5)),
        },
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = () => {
    const criticalServices = services.filter(s => s.status === 'critical').length;
    const warningServices = services.filter(s => s.status === 'warning').length;

    if (criticalServices > 0) return 'critical';
    if (warningServices > 0) return 'warning';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />;
      case 'critical':
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <CheckCircleIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
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

  return (
    <div className="space-y-6">
      {/* Overall Health Status */}
      <div className={`rounded-lg border-2 p-6 ${getStatusColor(healthStatus)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(healthStatus)}
            <div>
              <h3 className="text-lg font-semibold">System Health</h3>
              <p className="text-sm opacity-75">
                Overall system status: {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {services.filter(s => s.status === 'healthy').length}/{services.length}
            </div>
            <div className="text-sm opacity-75">Services Healthy</div>
          </div>
        </div>
      </div>

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* CPU Usage */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CpuChipIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">CPU Usage</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {metrics.cpu.usage.toFixed(1)}%
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {metrics.cpu.cores} cores
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-admin-secondary-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.cpu.usage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ServerIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Memory Usage</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {metrics.memory.percentage.toFixed(1)}%
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {metrics.memory.used}GB / {metrics.memory.total}GB
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-admin-secondary-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.memory.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CircleStackIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Disk Usage</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {metrics.disk.percentage.toFixed(1)}%
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {metrics.disk.used}GB / {metrics.disk.total}GB
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-admin-secondary-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.disk.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Network Traffic */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CloudIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Network Traffic</dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-admin-secondary-900">
                      ↓ {metrics.network.inbound} MB/s
                    </div>
                  </dd>
                  <dd className="flex items-baseline mt-1">
                    <div className="text-lg font-semibold text-admin-secondary-900">
                      ↑ {metrics.network.outbound} MB/s
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Services Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Metrics Chart */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h3 className="text-lg font-medium text-admin-secondary-900">System Metrics</h3>
            <p className="text-sm text-admin-secondary-500">Real-time system performance metrics</p>
          </div>
          <div className="p-6">
            <SystemMetricsChart metrics={metrics} />
          </div>
        </div>

        {/* Service Status */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h3 className="text-lg font-medium text-admin-secondary-900">Service Status</h3>
            <p className="text-sm text-admin-secondary-500">Health status of all system services</p>
          </div>
          <div className="p-6">
            <ServiceStatusGrid services={services} />
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h3 className="text-lg font-medium text-admin-secondary-900">Recent Alerts</h3>
          <p className="text-sm text-admin-secondary-500">Latest system alerts and notifications</p>
        </div>
        <div className="p-6">
          <AlertsList limit={5} />
        </div>
      </div>
    </div>
  );
}