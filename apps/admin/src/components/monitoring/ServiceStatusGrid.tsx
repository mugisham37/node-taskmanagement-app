'use client';

import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
  responseTime: number;
  lastCheck: string;
}

interface ServiceStatusGridProps {
  services: ServiceStatus[];
}

export function ServiceStatusGrid({ services }: ServiceStatusGridProps) {
  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'critical':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime < 100) return 'text-green-600';
    if (responseTime < 300) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {services.map((service) => (
        <div
          key={service.name}
          className={`border rounded-lg p-4 ${getStatusColor(service.status)}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(service.status)}
              <div>
                <h4 className="text-sm font-medium text-admin-secondary-900">
                  {service.name}
                </h4>
                <p className="text-xs text-admin-secondary-500">
                  Last checked: {new Date(service.lastCheck).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-admin-secondary-900">
                {service.uptime} uptime
              </div>
              <div className={`text-xs font-medium ${getResponseTimeColor(service.responseTime)}`}>
                {service.responseTime}ms response
              </div>
            </div>
          </div>
          
          {/* Status indicator bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-admin-secondary-500 mb-1">
              <span>Response Time</span>
              <span>{service.responseTime}ms</span>
            </div>
            <div className="w-full bg-admin-secondary-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  service.responseTime < 100
                    ? 'bg-green-500'
                    : service.responseTime < 300
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (service.responseTime / 500) * 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}