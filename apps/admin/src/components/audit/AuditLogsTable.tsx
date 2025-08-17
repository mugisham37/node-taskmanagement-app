'use client';

import { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
}

// Mock audit logs data
const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: '2024-01-15T10:30:00Z',
    userId: 'user-123',
    userName: 'John Doe',
    action: 'USER_LOGIN',
    resource: 'Authentication',
    resourceId: 'auth-session-456',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    details: { loginMethod: '2FA', success: true },
    severity: 'low',
  },
  {
    id: '2',
    timestamp: '2024-01-15T10:25:00Z',
    userId: 'admin-456',
    userName: 'Jane Smith',
    action: 'USER_DELETE',
    resource: 'User',
    resourceId: 'user-789',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    details: { deletedUser: 'bob.johnson@example.com', reason: 'Account violation' },
    severity: 'high',
  },
  {
    id: '3',
    timestamp: '2024-01-15T10:20:00Z',
    userId: 'user-234',
    userName: 'Alice Brown',
    action: 'TASK_CREATE',
    resource: 'Task',
    resourceId: 'task-101',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    details: { taskTitle: 'Update user interface', projectId: 'project-42' },
    severity: 'low',
  },
  {
    id: '4',
    timestamp: '2024-01-15T10:15:00Z',
    userId: 'admin-456',
    userName: 'Jane Smith',
    action: 'SETTINGS_UPDATE',
    resource: 'SystemSettings',
    resourceId: 'settings-global',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    details: { 
      changes: { 
        maintenanceMode: { from: false, to: true },
        maxFileUploadSize: { from: 10, to: 25 }
      }
    },
    severity: 'medium',
  },
  {
    id: '5',
    timestamp: '2024-01-15T10:10:00Z',
    userId: 'user-345',
    userName: 'Bob Wilson',
    action: 'LOGIN_FAILED',
    resource: 'Authentication',
    resourceId: 'auth-attempt-789',
    ipAddress: '203.0.113.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    details: { reason: 'Invalid password', attempts: 3 },
    severity: 'medium',
  },
];

export function AuditLogsTable() {
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('today');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm);
    
    const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    
    return matchesSearch && matchesAction && matchesSeverity;
  });

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    const severityStyles = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityStyles[severity]}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('FAILED')) return 'text-red-600';
    if (action.includes('UPDATE') || action.includes('MODIFY')) return 'text-yellow-600';
    if (action.includes('CREATE') || action.includes('LOGIN')) return 'text-green-600';
    return 'text-admin-secondary-600';
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Exporting audit logs...');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 sm:rounded-xl">
      {/* Header */}
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between"></div>         <div>
            <h3 className="text-base font-semibold leading-6 text-admin-secondary-900">
              Audit Logs
            </h3>
            <p className="mt-2 max-w-4xl text-sm text-admin-secondary-500">
              Track all system activities, user actions, and security events.
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button
              type="button"
              onClick={handleExport}
              className="block rounded-md bg-admin-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-admin-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary-600"
            >
              <ArrowDownTrayIcon className="inline-block w-4 h-4 mr-2" />
              Export Logs
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-admin-secondary-400 pl-3" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
          >
            <option value="all">All Actions</option>
            <option value="LOGIN">Login Events</option>
            <option value="CREATE">Create Actions</option>
            <option value="UPDATE">Update Actions</option>
            <option value="DELETE">Delete Actions</option>
            <option value="FAILED">Failed Actions</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-admin-secondary-300">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    Timestamp
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    User
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    Action
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    Resource
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    IP Address
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-admin-secondary-900">
                    Severity
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-secondary-200 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-admin-secondary-900">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-medium text-admin-secondary-900">{log.userName}</div>
                      <div className="text-admin-secondary-500 font-mono text-xs">{log.userId}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-admin-secondary-900">
                      <div>{log.resource}</div>
                      <div className="text-admin-secondary-500 font-mono text-xs">{log.resourceId}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-admin-secondary-500 font-mono">
                      {log.ipAddress}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {getSeverityBadge(log.severity)}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-3">
                      <button
                        onClick={() => handleViewDetails(log)}
                        className="text-admin-primary-600 hover:text-admin-primary-900"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-admin-secondary-500 bg-opacity-75 transition-opacity" onClick={() => setShowDetails(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-white text-admin-secondary-400 hover:text-admin-secondary-500"
                  onClick={() => setShowDetails(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-base font-semibold leading-6 text-admin-secondary-900">
                    Audit Log Details
                  </h3>
                  
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">Timestamp</dt>
                        <dd className="text-sm text-admin-secondary-900">{formatTimestamp(selectedLog.timestamp)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">User</dt>
                        <dd className="text-sm text-admin-secondary-900">{selectedLog.userName}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">Action</dt>
                        <dd className="text-sm text-admin-secondary-900">{selectedLog.action}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">Resource</dt>
                        <dd className="text-sm text-admin-secondary-900">{selectedLog.resource}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">IP Address</dt>
                        <dd className="text-sm text-admin-secondary-900 font-mono">{selectedLog.ipAddress}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-admin-secondary-500">Severity</dt>
                        <dd className="text-sm">{getSeverityBadge(selectedLog.severity)}</dd>
                      </div>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-admin-secondary-500">User Agent</dt>
                      <dd className="text-sm text-admin-secondary-900 font-mono break-all">{selectedLog.userAgent}</dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-admin-secondary-500">Details</dt>
                      <dd className="text-sm text-admin-secondary-900">
                        <pre className="bg-admin-secondary-50 p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}