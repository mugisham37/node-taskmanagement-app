'use client';

import { useState, useEffect } from 'react';
import { 
  Cog6ToothIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { monitoringService } from '@/services/monitoringService';

interface ConfigurationItem {
  id: string;
  category: string;
  key: string;
  value: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  editable: boolean;
  lastModified: Date;
  modifiedBy: string;
}

interface ConfigurationCategory {
  name: string;
  description: string;
  items: ConfigurationItem[];
}

const mockConfigurations: ConfigurationCategory[] = [
  {
    name: 'Monitoring Thresholds',
    description: 'Alert thresholds and monitoring parameters',
    items: [
      {
        id: 'cpu-threshold',
        category: 'monitoring',
        key: 'cpu_usage_threshold',
        value: '80',
        description: 'CPU usage percentage threshold for alerts',
        type: 'number',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
      {
        id: 'memory-threshold',
        category: 'monitoring',
        key: 'memory_usage_threshold',
        value: '85',
        description: 'Memory usage percentage threshold for alerts',
        type: 'number',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
      {
        id: 'disk-threshold',
        category: 'monitoring',
        key: 'disk_usage_threshold',
        value: '90',
        description: 'Disk usage percentage threshold for alerts',
        type: 'number',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
    ],
  },
  {
    name: 'Alert Rules',
    description: 'Alerting configuration and notification settings',
    items: [
      {
        id: 'alert-cooldown',
        category: 'alerting',
        key: 'alert_cooldown_period',
        value: '300',
        description: 'Cooldown period between alerts in seconds',
        type: 'number',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
      {
        id: 'notification-enabled',
        category: 'alerting',
        key: 'email_notifications_enabled',
        value: 'true',
        description: 'Enable email notifications for alerts',
        type: 'boolean',
        required: false,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
    ],
  },
  {
    name: 'System Parameters',
    description: 'Core system configuration parameters',
    items: [
      {
        id: 'metrics-retention',
        category: 'system',
        key: 'metrics_retention_days',
        value: '30',
        description: 'Number of days to retain metrics data',
        type: 'number',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
      {
        id: 'log-level',
        category: 'system',
        key: 'log_level',
        value: 'info',
        description: 'Application log level',
        type: 'string',
        required: true,
        editable: true,
        lastModified: new Date(),
        modifiedBy: 'admin',
      },
    ],
  },
];

export function SystemConfigurationPanel() {
  const [configurations, setConfigurations] = useState<ConfigurationCategory[]>(mockConfigurations);
  const [editingItem, setEditingItem] = useState<ConfigurationItem | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchConfigurations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch from the monitoring service
      // const configs = await monitoringService.getSystemConfiguration();
      // setConfigurations(configs);
      
      // For now, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setConfigurations(mockConfigurations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configurations');
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfiguration = async (item: ConfigurationItem, newValue: string) => {
    try {
      // In a real implementation, this would update via the monitoring service
      // await monitoringService.updateSystemConfiguration(item.id, newValue);

      // Update local state
      setConfigurations(prev => 
        prev.map(category => ({
          ...category,
          items: category.items.map(configItem => 
            configItem.id === item.id 
              ? { 
                  ...configItem, 
                  value: newValue, 
                  lastModified: new Date(),
                  modifiedBy: 'current-user' // This would come from auth context
                }
              : configItem
          ),
        }))
      );

      setEditingItem(null);
      setEditValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    }
  };

  const startEditing = (item: ConfigurationItem) => {
    setEditingItem(item);
    setEditValue(item.value);
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const saveConfiguration = () => {
    if (editingItem) {
      updateConfiguration(editingItem, editValue);
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const filteredConfigurations = configurations
    .map(category => ({
      ...category,
      items: category.items.filter(item => {
        const matchesSearch = searchTerm === '' || 
          item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    }))
    .filter(category => category.items.length > 0);

  const allCategories = Array.from(new Set(configurations.flatMap(cat => cat.items.map(item => item.category))));

  const renderValue = (item: ConfigurationItem) => {
    if (editingItem?.id === item.id) {
      if (item.type === 'boolean') {
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      } else if (item.type === 'json') {
        return (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
          />
        );
      } else {
        return (
          <input
            type={item.type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
          />
        );
      }
    }

    // Display value
    if (item.type === 'boolean') {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.value === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {item.value === 'true' ? 'Enabled' : 'Disabled'}
        </span>
      );
    }

    if (item.type === 'json') {
      return (
        <pre className="text-xs text-admin-secondary-700 bg-admin-secondary-50 p-2 rounded max-w-xs overflow-x-auto">
          {JSON.stringify(JSON.parse(item.value || '{}'), null, 2)}
        </pre>
      );
    }

    return (
      <span className="text-sm text-admin-secondary-900 font-mono">
        {item.value}
        {item.type === 'number' && item.key.includes('threshold') && '%'}
        {item.key.includes('period') && item.type === 'number' && 's'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Cog6ToothIcon className="h-6 w-6 text-admin-primary-600" />
          <h3 className="text-lg font-medium text-admin-secondary-900">System Configuration</h3>
        </div>
        <button
          onClick={fetchConfigurations}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-admin-secondary-700">
              Search Configuration
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by key or description..."
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-admin-secondary-700">
              Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              {allCategories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
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

      {/* Configuration Categories */}
      {filteredConfigurations.map((category) => (
        <div key={category.name} className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h4 className="text-lg font-medium text-admin-secondary-900">{category.name}</h4>
            <p className="text-sm text-admin-secondary-500">{category.description}</p>
          </div>
          <div className="divide-y divide-admin-secondary-200"></div>   {category.items.map((item) => (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-sm font-medium text-admin-secondary-900">
                            {item.key}
                          </h5>
                          {item.required && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Required
                            </span>
                          )}
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-admin-secondary-100 text-admin-secondary-800">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-sm text-admin-secondary-500 mt-1">
                          {item.description}
                        </p>
                        <div className="text-xs text-admin-secondary-400 mt-2">
                          Last modified: {item.lastModified.toLocaleString()} by {item.modifiedBy}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right min-w-0 flex-1">
                      {renderValue(item)}
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingItem?.id === item.id ? (
                        <>
                          <button
                            onClick={saveConfiguration}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="inline-flex items-center px-2 py-1 border border-admin-secondary-300 text-xs leading-4 font-medium rounded text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        item.editable && (
                          <button
                            onClick={() => startEditing(item)}
                            className="inline-flex items-center px-2 py-1 border border-admin-secondary-300 text-xs leading-4 font-medium rounded text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500"
                          >
                            <PencilIcon className="h-3 w-3 mr-1" />
                            Edit
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Configuration Guidelines */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h4 className="text-lg font-medium text-admin-secondary-900">Configuration Guidelines</h4>
          <p className="text-sm text-admin-secondary-500">Best practices for system configuration</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-admin-secondary-900">
                  Monitor Threshold Values
                </div>
                <div className="text-sm text-admin-secondary-700">
                  Set appropriate thresholds based on your system capacity and performance requirements.
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-admin-secondary-900">
                  Test Configuration Changes
                </div>
                <div className="text-sm text-admin-secondary-700">
                  Always test configuration changes in a staging environment before applying to production.
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-admin-secondary-900">
                  Document Changes
                </div>
                <div className="text-sm text-admin-secondary-700">
                  Keep track of configuration changes and their impact on system performance.
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-admin-secondary-900">
                  Backup Before Changes
                </div>
                <div className="text-sm text-admin-secondary-700">
                  Always backup current configuration before making significant changes.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}