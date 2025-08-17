'use client';

import { monitoringService, PrometheusQueryResult } from '@/services/monitoringService';
import { ChartBarIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface MetricQuery {
  name: string;
  query: string;
  description: string;
  unit?: string;
}

const defaultQueries: MetricQuery[] = [
  {
    name: 'CPU Usage',
    query: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    description: 'Current CPU usage percentage',
    unit: '%',
  },
  {
    name: 'Memory Usage',
    query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    description: 'Current memory usage percentage',
    unit: '%',
  },
  {
    name: 'HTTP Request Rate',
    query: 'sum(rate(http_requests_total[5m]))',
    description: 'HTTP requests per second',
    unit: 'req/s',
  },
  {
    name: 'HTTP Error Rate',
    query: 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
    description: 'HTTP 5xx error rate',
    unit: '%',
  },
  {
    name: 'Database Connections',
    query: 'postgres_stat_database_numbackends',
    description: 'Active database connections',
    unit: 'connections',
  },
  {
    name: 'Redis Memory Usage',
    query: 'redis_memory_used_bytes',
    description: 'Redis memory usage in bytes',
    unit: 'bytes',
  },
];

interface MetricResult {
  name: string;
  value: number;
  unit?: string;
  description: string;
  timestamp: Date;
  error?: string;
}

export function PrometheusMetricsPanel() {
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [customResult, setCustomResult] = useState<PrometheusQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        defaultQueries.map(async (query) => {
          const result = await monitoringService.queryPrometheus(query.query);
          const value = parseFloat(result.data.result[0]?.value[1] || '0');
          
          return {
            name: query.name,
            value,
            unit: query.unit,
            description: query.description,
            timestamp: new Date(),
          };
        })
      );

      const successfulResults = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            return {
              name: defaultQueries[index].name,
              value: 0,
              unit: defaultQueries[index].unit,
              description: defaultQueries[index].description,
              timestamp: new Date(),
              error: result.reason?.message || 'Query failed',
            };
          }
        });

      setMetrics(successfulResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const executeCustomQuery = async () => {
    if (!customQuery.trim()) return;

    setIsLoading(true);
    try {
      const result = await monitoringService.queryPrometheus(customQuery);
      setCustomResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Custom query failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatValue = (value: number, unit?: string): string => {
    if (unit === 'bytes') {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(value) / Math.log(1024));
      return `${(value / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
    
    if (unit === '%') {
      return `${value.toFixed(2)}%`;
    }
    
    if (unit === 'req/s') {
      return `${value.toFixed(2)} req/s`;
    }
    
    return `${value.toFixed(2)} ${unit || ''}`;
  };

  const getMetricColor = (metric: MetricResult): string => {
    if (metric.error) return 'text-red-600';
    
    if (metric.unit === '%') {
      if (metric.value > 90) return 'text-red-600';
      if (metric.value > 75) return 'text-yellow-600';
      return 'text-green-600';
    }
    
    return 'text-admin-secondary-900';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-6 w-6 text-admin-primary-600" />
          <h3 className="text-lg font-medium text-admin-secondary-900">Prometheus Metrics</h3>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
        >
          <ClockIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {metric.error ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                  ) : (
                    <ChartBarIcon className="h-6 w-6 text-admin-primary-600" />
                  )}
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-admin-secondary-500 truncate">
                      {metric.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className={`text-2xl font-semibold ${getMetricColor(metric)}`}>
                        {metric.error ? 'Error' : formatValue(metric.value, metric.unit)}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs text-admin-secondary-500">
                  {metric.description}
                </div>
                {metric.error && (
                  <div className="text-xs text-red-500 mt-1">
                    {metric.error}
                  </div>
                )}
                <div className="text-xs text-admin-secondary-400 mt-1">
                  Updated: {metric.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Query Section */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h4 className="text-lg font-medium text-admin-secondary-900">Custom Prometheus Query</h4>
          <p className="text-sm text-admin-secondary-500">Execute custom PromQL queries</p>
        </div>
        <div className="p-6">
          <div className="flex space-x-3">
            <div className="flex-1">
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Enter PromQL query (e.g., up, rate(http_requests_total[5m]))"
                className="block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
                onKeyPress={(e) => e.key === 'Enter' && executeCustomQuery()}
              />
            </div>
            <button
              onClick={executeCustomQuery}
              disabled={isLoading || !customQuery.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-admin-primary-600 hover:bg-admin-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
            >
              Execute
            </button>
          </div>

          {/* Custom Query Results */}
          {customResult && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-admin-secondary-900 mb-2">Query Results:</h5>
              <div className="bg-admin-secondary-50 rounded-md p-3">
                <pre className="text-xs text-admin-secondary-700 whitespace-pre-wrap">
                  {JSON.stringify(customResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}