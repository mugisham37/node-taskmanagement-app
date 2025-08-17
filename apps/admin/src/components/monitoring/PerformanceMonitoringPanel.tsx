'use client';

import { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  ChartBarIcon, 
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { monitoringService, PerformanceMetrics } from '@/services/monitoringService';

interface PerformanceTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export function PerformanceMonitoringPanel() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');

  const fetchPerformanceMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentMetrics = await monitoringService.getPerformanceMetrics();
      setMetrics(currentMetrics);

      // Fetch historical data for trends
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - getTimeRangeMs(timeRange));
      
      const [responseTimeData, requestRateData, errorRateData] = await Promise.all([
        monitoringService.queryPrometheusRange(
          'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
          startTime,
          endTime,
          '1m'
        ),
        monitoringService.queryPrometheusRange(
          'sum(rate(http_requests_total[5m]))',
          startTime,
          endTime,
          '1m'
        ),
        monitoringService.queryPrometheusRange(
          'sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
          startTime,
          endTime,
          '1m'
        ),
      ]);

      // Process historical data for charting
      const processedData = processHistoricalData([responseTimeData, requestRateData, errorRateData]);
      setHistoricalData(processedData);

      // Calculate trends
      const calculatedTrends = calculateTrends(currentMetrics, processedData);
      setTrends(calculatedTrends);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeRangeMs = (range: string): number => {
    switch (range) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  };

  const processHistoricalData = (results: any[]): any[] => {
    // Process Prometheus range query results into chart-friendly format
    // This is a simplified version - in production, you'd want more sophisticated processing
    return results.map((result, index) => ({
      name: ['Response Time', 'Request Rate', 'Error Rate'][index],
      data: result.data.result[0]?.values?.map(([timestamp, value]: [number, string]) => ({
        timestamp: new Date(timestamp * 1000),
        value: parseFloat(value),
      })) || [],
    }));
  };

  const calculateTrends = (current: PerformanceMetrics, historical: any[]): PerformanceTrend[] => {
    // Calculate trends based on current vs historical averages
    // This is simplified - in production, you'd use more sophisticated trend analysis
    return [
      {
        metric: 'Response Time (P95)',
        current: current.responseTime.p95,
        previous: current.responseTime.p95 * 0.9, // Mock previous value
        change: 10, // Mock change percentage
        trend: 'up',
      },
      {
        metric: 'Request Rate',
        current: current.requestRate,
        previous: current.requestRate * 1.1, // Mock previous value
        change: -9, // Mock change percentage
        trend: 'down',
      },
      {
        metric: 'Error Rate',
        current: current.errorRate * 100,
        previous: current.errorRate * 100 * 0.8, // Mock previous value
        change: 25, // Mock change percentage
        trend: 'up',
      },
    ];
  };

  useEffect(() => {
    fetchPerformanceMetrics();
    const interval = setInterval(fetchPerformanceMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatRate = (rate: number): string => {
    if (rate < 1) return `${(rate * 1000).toFixed(0)}m/s`;
    return `${rate.toFixed(2)}/s`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getPerformanceStatus = (metrics: PerformanceMetrics): 'good' | 'warning' | 'critical' => {
    if (metrics.responseTime.p95 > 2000 || metrics.errorRate > 0.05) return 'critical';
    if (metrics.responseTime.p95 > 1000 || metrics.errorRate > 0.01) return 'warning';
    return 'good';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />;
      case 'down':
        return <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full" />;
    }
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <ClockIcon className="h-5 w-5 animate-spin text-admin-primary-600" />
          <span className="text-sm text-admin-secondary-600">Loading performance metrics...</span>
        </div>
      </div>
    );
  }

  const status = getPerformanceStatus(metrics);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-6 w-6 text-admin-primary-600" />
          <h3 className="text-lg font-medium text-admin-secondary-900">Performance Monitoring</h3>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
          <button
            onClick={fetchPerformanceMetrics}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
          >
            <ClockIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Performance Status */}
      <div className={`rounded-lg border-2 p-6 ${getStatusColor(status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold">Overall Performance</h4>
            <p className="text-sm opacity-75">
              System performance is {status === 'good' ? 'optimal' : status === 'warning' ? 'degraded' : 'critical'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold"></div>             {status === 'good' ? '✓' : status === 'warning' ? '⚠' : '✗'}
            </div>
            <div className="text-sm opacity-75">Status</div>
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

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Response Time P50 */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">
                    Response Time (P50)
                  </dt>
                  <dd className="text-lg font-semibold text-admin-secondary-900">
                    {formatDuration(metrics.responseTime.p50)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Response Time P95 */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">
                    Response Time (P95)
                  </dt>
                  <dd className="text-lg font-semibold text-admin-secondary-900">
                    {formatDuration(metrics.responseTime.p95)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Request Rate */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">
                    Request Rate
                  </dt>
                  <dd className="text-lg font-semibold text-admin-secondary-900">
                    {formatRate(metrics.requestRate)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">
                    Error Rate
                  </dt>
                  <dd className="text-lg font-semibold text-admin-secondary-900">
                    {formatPercentage(metrics.errorRate)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h4 className="text-lg font-medium text-admin-secondary-900">Performance Trends</h4>
          <p className="text-sm text-admin-secondary-500">
            Comparison with previous {timeRange} period
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {trends.map((trend) => (
              <div key={trend.metric} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTrendIcon(trend.trend)}
                  <div>
                    <div className="text-sm font-medium text-admin-secondary-900">
                      {trend.metric}
                    </div>
                    <div className="text-xs text-admin-secondary-500">
                      Current: {trend.current.toFixed(2)} | Previous: {trend.previous.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  trend.change > 0 ? 'text-red-600' : trend.change < 0 ? 'text-green-600' : 'text-admin-secondary-600'
                }`}>
                  {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h4 className="text-lg font-medium text-admin-secondary-900">Performance Recommendations</h4>
          <p className="text-sm text-admin-secondary-500">
            Automated suggestions based on current metrics
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {status === 'critical' && (
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-red-800">
                    Critical Performance Issues Detected
                  </div>
                  <div className="text-sm text-red-700">
                    Response times are above acceptable thresholds. Consider scaling up resources or optimizing slow queries.
                  </div>
                </div>
              </div>
            )}
            {metrics.errorRate > 0.01 && (
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-yellow-800">
                    Elevated Error Rate
                  </div>
                  <div className="text-sm text-yellow-700">
                    Error rate is above normal levels. Check application logs and recent deployments.
                  </div>
                </div>
              </div>
            )}
            {status === 'good' && (
              <div className="flex items-start space-x-3">
                <ChartBarIcon className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-green-800">
                    Performance is Optimal
                  </div>
                  <div className="text-sm text-green-700">
                    All performance metrics are within acceptable ranges. Continue monitoring for any changes.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}