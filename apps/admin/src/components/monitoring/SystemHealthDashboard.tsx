'use client';

import { SystemMetrics } from '@/services/monitoringService';
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
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>(mockServices);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'prometheus' | 'grafana' | 'performance' | 'alerts'>('overview');

  // Real-time data fetching
  const fetchMonitoringData = async () => {
    setIsLoading(true);
    try {
      const [systemMetrics, perfMetrics, healthData] = await Promise.all([
        monitoringService.getSystemMetrics(),
        monitoringService.getPerformanceMetrics(),
        monitoringService.performHealthChecks(),
      ]);

      setMetrics(systemMetrics);
      setPerformanceMetrics(perfMetrics);
      setHealthChecks(healthData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      // Fall back to mock data on error
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and periodic updates
  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Update every 30 seconds
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
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-admin-secondary-900">System Monitoring</h2>
          <p className="text-sm text-admin-secondary-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMonitoringData}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-admin-primary-600 hover:bg-admin-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500">
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Configure
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-admin-secondary-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'prometheus', name: 'Prometheus' },
            { id: 'grafana', name: 'Grafana' },
            { id: 'performance', name: 'Performance' },
            { id: 'alerts', name: 'Alerts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-admin-primary-500 text-admin-primary-600'
                  : 'border-transparent text-admin-secondary-500 hover:text-admin-secondary-700 hover:border-admin-secondary-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
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
                  {healthChecks.filter(h => h.status === 'UP').length}/{healthChecks.length || services.length}
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
        </>
      )}

      {/* Prometheus Tab */}
      {activeTab === 'prometheus' && (
        <PrometheusMetricsPanel />
      )}

      {/* Grafana Tab */}
      {activeTab === 'grafana' && (
        <GrafanaDashboardEmbed height={600} />
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <PerformanceMonitoringPanel />
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <AlertManagementPanel />
      )}
    </div>
  );
}