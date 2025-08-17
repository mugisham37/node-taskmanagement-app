'use client';

import { AlertRule, monitoringService } from '@/services/monitoringService';
import {
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface AlertWithActions extends AlertRule {
  id: string;
  silenced: boolean;
  silenceExpiry?: Date;
}

export function AlertManagementPanel() {
  const [alerts, setAlerts] = useState<AlertWithActions[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertWithActions | null>(null);
  const [silenceModal, setSilenceModal] = useState<{ show: boolean; alertId: string }>({ show: false, alertId: '' });
  const [silenceDuration, setSilenceDuration] = useState<string>('1h');
  const [silenceComment, setSilenceComment] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'firing' | 'pending' | 'inactive'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const alertData = await monitoringService.getActiveAlerts();
      
      // Transform alerts to include additional properties
      const transformedAlerts: AlertWithActions[] = alertData.map((alert, index) => ({
        ...alert,
        id: `alert-${index}`,
        silenced: false, // This would come from AlertManager silence API
        silenceExpiry: undefined,
      }));

      setAlerts(transformedAlerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  };

  const silenceAlert = async (alertId: string, duration: string, comment: string) => {
    try {
      await monitoringService.silenceAlert(alertId, duration, comment);
      
      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              silenced: true, 
              silenceExpiry: new Date(Date.now() + parseDuration(duration))
            }
          : alert
      ));

      setSilenceModal({ show: false, alertId: '' });
      setSilenceComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to silence alert');
    }
  };

  const parseDuration = (duration: string): number => {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (state: string, severity?: string) => {
    if (state === 'firing') {
      return severity === 'critical' 
        ? <XCircleIcon className="h-5 w-5 text-red-500" />
        : <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    }
    if (state === 'pending') {
      return <ClockIcon className="h-5 w-5 text-blue-500" />;
    }
    return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
  };

  const getAlertColor = (state: string, severity?: string) => {
    if (state === 'firing') {
      return severity === 'critical' 
        ? 'border-red-200 bg-red-50'
        : 'border-yellow-200 bg-yellow-50';
    }
    if (state === 'pending') {
      return 'border-blue-200 bg-blue-50';
    }
    return 'border-green-200 bg-green-50';
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterStatus !== 'all' && alert.state !== filterStatus) return false;
    if (filterSeverity !== 'all' && alert.labels.severity !== filterSeverity) return false;
    return true;
  });

  const alertCounts = {
    total: alerts.length,
    firing: alerts.filter(a => a.state === 'firing').length,
    critical: alerts.filter(a => a.labels.severity === 'critical').length,
    silenced: alerts.filter(a => a.silenced).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BellIcon className="h-6 w-6 text-admin-primary-600" />
          <h3 className="text-lg font-medium text-admin-secondary-900">Alert Management</h3>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
        >
          <ClockIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BellIcon className="h-6 w-6 text-admin-secondary-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Total Alerts</dt>
                  <dd className="text-lg font-semibold text-admin-secondary-900">{alertCounts.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Firing</dt>
                  <dd className="text-lg font-semibold text-red-600">{alertCounts.firing}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Critical</dt>
                  <dd className="text-lg font-semibold text-red-700">{alertCounts.critical}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BellSlashIcon className="h-6 w-6 text-admin-secondary-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Silenced</dt>
                  <dd className="text-lg font-semibold text-admin-secondary-600">{alertCounts.silenced}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-admin-secondary-700">
              Status
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="all">All</option>
              <option value="firing">Firing</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="severity-filter" className="block text-sm font-medium text-admin-secondary-700">
              Severity
            </label>
            <select
              id="severity-filter"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h4 className="text-lg font-medium text-admin-secondary-900">
            Active Alerts ({filteredAlerts.length})
          </h4>
          <p className="text-sm text-admin-secondary-500">
            Manage and silence system alerts
          </p>
        </div>
        <div className="divide-y divide-admin-secondary-200">
          {filteredAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-2 text-sm font-medium text-admin-secondary-900">No alerts</h3>
              <p className="mt-1 text-sm text-admin-secondary-500">
                {filterStatus === 'all' ? 'All systems are operating normally.' : `No ${filterStatus} alerts found.`}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`px-6 py-4 hover:bg-admin-secondary-50 ${alert.silenced ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getAlertIcon(alert.state, alert.labels.severity)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="text-sm font-medium text-admin-secondary-900">
                          {alert.name}
                        </h5>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadgeColor(alert.labels.severity)}`}>
                          {alert.labels.severity}
                        </span>
                        {alert.silenced && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <BellSlashIcon className="h-3 w-3 mr-1" />
                            Silenced
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-admin-secondary-500 mt-1">
                        {alert.annotations.summary || alert.annotations.description}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-admin-secondary-400">
                        <span>Service: {alert.labels.service || 'Unknown'}</span>
                        {alert.activeAt && (
                          <span>Active since: {new Date(alert.activeAt).toLocaleString()}</span>
                        )}
                        {alert.value && (
                          <span>Value: {alert.value}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!alert.silenced && alert.state === 'firing' && (
                      <button
                        onClick={() => setSilenceModal({ show: true, alertId: alert.id })}
                        className="inline-flex items-center px-3 py-1 border border-admin-secondary-300 shadow-sm text-xs leading-4 font-medium rounded text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                      >
                        <BellSlashIcon className="h-3 w-3 mr-1" />
                        Silence
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded text-admin-primary-700 bg-admin-primary-100 hover:bg-admin-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                    >
                      <InformationCircleIcon className="h-3 w-3 mr-1" />
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Silence Modal */}
      {silenceModal.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-admin-secondary-900 mb-4">
                Silence Alert
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="silence-duration" className="block text-sm font-medium text-admin-secondary-700">
                    Duration
                  </label>
                  <select
                    id="silence-duration"
                    value={silenceDuration}
                    onChange={(e) => setSilenceDuration(e.target.value)}
                    className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
                  >
                    <option value="15m">15 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="4h">4 hours</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="silence-comment" className="block text-sm font-medium text-admin-secondary-700">
                    Comment
                  </label>
                  <textarea
                    id="silence-comment"
                    value={silenceComment}
                    onChange={(e) => setSilenceComment(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
                    placeholder="Reason for silencing this alert..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSilenceModal({ show: false, alertId: '' })}
                  className="px-4 py-2 text-sm font-medium text-admin-secondary-700 bg-white border border-admin-secondary-300 rounded-md hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => silenceAlert(silenceModal.alertId, silenceDuration, silenceComment)}
                  className="px-4 py-2 text-sm font-medium text-white bg-admin-primary-600 border border-transparent rounded-md hover:bg-admin-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                >
                  Silence Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-2/3 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-admin-secondary-900">
                  Alert Details
                </h3>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-admin-secondary-400 hover:text-admin-secondary-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-admin-secondary-700">Alert Name</h4>
                    <p className="text-sm text-admin-secondary-900">{selectedAlert.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-admin-secondary-700">State</h4>
                    <p className="text-sm text-admin-secondary-900">{selectedAlert.state}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-admin-secondary-700">Severity</h4>
                    <p className="text-sm text-admin-secondary-900">{selectedAlert.labels.severity}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-admin-secondary-700">Service</h4>
                    <p className="text-sm text-admin-secondary-900">{selectedAlert.labels.service}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-admin-secondary-700">Query</h4>
                  <pre className="text-xs text-admin-secondary-900 bg-admin-secondary-50 p-2 rounded mt-1">
                    {selectedAlert.query}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-admin-secondary-700">Labels</h4>
                  <pre className="text-xs text-admin-secondary-900 bg-admin-secondary-50 p-2 rounded mt-1">
                    {JSON.stringify(selectedAlert.labels, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-admin-secondary-700">Annotations</h4>
                  <pre className="text-xs text-admin-secondary-900 bg-admin-secondary-50 p-2 rounded mt-1">
                    {JSON.stringify(selectedAlert.annotations, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}