'use client';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  source: string;
  acknowledged: boolean;
  resolved: boolean;
}

interface AlertsListProps {
  limit?: number;
}

// Mock alerts data
const mockAlerts: Alert[] = [
  {
    id: '1',
    title: 'High CPU Usage',
    message: 'CPU usage has exceeded 90% for the past 5 minutes on server-01',
    severity: 'error',
    timestamp: '2024-01-15T10:25:00Z',
    source: 'System Monitor',
    acknowledged: false,
    resolved: false,
  },
  {
    id: '2',
    title: 'Database Connection Pool Warning',
    message: 'Database connection pool is at 85% capacity',
    severity: 'warning',
    timestamp: '2024-01-15T10:20:00Z',
    source: 'Database Monitor',
    acknowledged: true,
    resolved: false,
  },
  {
    id: '3',
    title: 'Backup Completed Successfully',
    message: 'Daily database backup completed successfully at 02:00 AM',
    severity: 'success',
    timestamp: '2024-01-15T02:00:00Z',
    source: 'Backup Service',
    acknowledged: true,
    resolved: true,
  },
  {
    id: '4',
    title: 'New User Registration Spike',
    message: 'User registrations increased by 150% in the last hour',
    severity: 'info',
    timestamp: '2024-01-15T09:45:00Z',
    source: 'Analytics',
    acknowledged: false,
    resolved: false,
  },
  {
    id: '5',
    title: 'SSL Certificate Expiring Soon',
    message: 'SSL certificate for api.example.com will expire in 7 days',
    severity: 'warning',
    timestamp: '2024-01-15T08:00:00Z',
    source: 'Security Monitor',
    acknowledged: false,
    resolved: false,
  },
];

export function AlertsList({ limit }: AlertsListProps) {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'acknowledged'>('all');

  const filteredAlerts = alerts
    .filter(alert => {
      switch (filter) {
        case 'unresolved':
          return !alert.resolved;
        case 'acknowledged':
          return alert.acknowledged;
        default:
          return true;
      }
    })
    .slice(0, limit);

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const handleResolve = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolved: true, acknowledged: true }
          : alert
      )
    );
  };

  const handleDismiss = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      {!limit && (
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'all'
                ? 'bg-admin-primary-100 text-admin-primary-700'
                : 'bg-admin-secondary-100 text-admin-secondary-700 hover:bg-admin-secondary-200'
            }`}
          >
            All Alerts
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'unresolved'
                ? 'bg-admin-primary-100 text-admin-primary-700'
                : 'bg-admin-secondary-100 text-admin-secondary-700 hover:bg-admin-secondary-200'
            }`}
          >
            Unresolved
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'acknowledged'
                ? 'bg-admin-primary-100 text-admin-primary-700'
                : 'bg-admin-secondary-100 text-admin-secondary-700 hover:bg-admin-secondary-200'
            }`}
          >
            Acknowledged
          </button>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-admin-secondary-500">
            No alerts to display
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)} ${
                alert.resolved ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-admin-secondary-900">
                        {alert.title}
                      </h4>
                      {alert.acknowledged && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Acknowledged
                        </span>
                      )}
                      {alert.resolved && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-admin-secondary-600 mt-1">
                      {alert.message}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-admin-secondary-500">
                      <span>{alert.source}</span>
                      <span>•</span>
                      <span>{getTimeAgo(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 ml-4">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="p-1 text-admin-secondary-400 hover:text-admin-secondary-600"
                      title="Acknowledge"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  )}
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="p-1 text-admin-secondary-400 hover:text-green-600"
                      title="Resolve"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 text-admin-secondary-400 hover:text-red-600"
                    title="Dismiss"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}