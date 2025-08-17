import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceMetrics {
  webVitals: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
  apiMetrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
  };
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  bundleMetrics: {
    totalSize: number;
    gzippedSize: number;
    chunkCount: number;
    loadTime: number;
  };
}

interface PerformanceTrend {
  timestamp: string;
  value: number;
  metric: string;
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch performance data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        
        const [metricsResponse, trendsResponse] = await Promise.all([
          fetch('/api/admin/performance/metrics'),
          fetch(`/api/admin/performance/trends?range=${timeRange}`),
        ]);

        if (!metricsResponse.ok || !trendsResponse.ok) {
          throw new Error('Failed to fetch performance data');
        }

        const metricsData = await metricsResponse.json();
        const trendsData = await trendsResponse.json();

        setMetrics(metricsData);
        setTrends(trendsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchPerformanceData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Web Vitals chart data
  const webVitalsData = useMemo(() => {
    if (!metrics) return null;

    return {
      labels: ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'],
      datasets: [
        {
          label: 'Current Values',
          data: [
            metrics.webVitals.lcp,
            metrics.webVitals.fid,
            metrics.webVitals.cls * 1000, // Scale CLS for visibility
            metrics.webVitals.fcp,
            metrics.webVitals.ttfb,
          ],
          backgroundColor: [
            metrics.webVitals.lcp <= 2500 ? '#10B981' : metrics.webVitals.lcp <= 4000 ? '#F59E0B' : '#EF4444',
            metrics.webVitals.fid <= 100 ? '#10B981' : metrics.webVitals.fid <= 300 ? '#F59E0B' : '#EF4444',
            metrics.webVitals.cls <= 0.1 ? '#10B981' : metrics.webVitals.cls <= 0.25 ? '#F59E0B' : '#EF4444',
            metrics.webVitals.fcp <= 1800 ? '#10B981' : metrics.webVitals.fcp <= 3000 ? '#F59E0B' : '#EF4444',
            metrics.webVitals.ttfb <= 600 ? '#10B981' : metrics.webVitals.ttfb <= 1000 ? '#F59E0B' : '#EF4444',
          ],
          borderColor: '#1F2937',
          borderWidth: 1,
        },
      ],
    };
  }, [metrics]);

  // API performance trends
  const apiTrendsData = useMemo(() => {
    if (!trends.length) return null;

    const responseTimeTrends = trends.filter(t => t.metric === 'responseTime');
    const throughputTrends = trends.filter(t => t.metric === 'throughput');

    return {
      labels: responseTimeTrends.map(t => new Date(t.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Response Time (ms)',
          data: responseTimeTrends.map(t => t.value),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Throughput (req/s)',
          data: throughputTrends.map(t => t.value),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          yAxisID: 'y1',
        },
      ],
    };
  }, [trends]);

  // System metrics doughnut chart
  const systemMetricsData = useMemo(() => {
    if (!metrics) return null;

    return {
      labels: ['CPU Usage', 'Memory Usage', 'Disk Usage'],
      datasets: [
        {
          data: [
            metrics.systemMetrics.cpuUsage,
            metrics.systemMetrics.memoryUsage,
            metrics.systemMetrics.diskUsage,
          ],
          backgroundColor: [
            metrics.systemMetrics.cpuUsage > 80 ? '#EF4444' : metrics.systemMetrics.cpuUsage > 60 ? '#F59E0B' : '#10B981',
            metrics.systemMetrics.memoryUsage > 80 ? '#EF4444' : metrics.systemMetrics.memoryUsage > 60 ? '#F59E0B' : '#10B981',
            metrics.systemMetrics.diskUsage > 80 ? '#EF4444' : metrics.systemMetrics.diskUsage > 60 ? '#F59E0B' : '#10B981',
          ],
          borderColor: '#1F2937',
          borderWidth: 2,
        },
      ],
    };
  }, [metrics]);

  // Performance score calculation
  const performanceScore = useMemo(() => {
    if (!metrics) return 0;

    const lcpScore = metrics.webVitals.lcp <= 2500 ? 100 : metrics.webVitals.lcp <= 4000 ? 50 : 0;
    const fidScore = metrics.webVitals.fid <= 100 ? 100 : metrics.webVitals.fid <= 300 ? 50 : 0;
    const clsScore = metrics.webVitals.cls <= 0.1 ? 100 : metrics.webVitals.cls <= 0.25 ? 50 : 0;
    const fcpScore = metrics.webVitals.fcp <= 1800 ? 100 : metrics.webVitals.fcp <= 3000 ? 50 : 0;
    const ttfbScore = metrics.webVitals.ttfb <= 600 ? 100 : metrics.webVitals.ttfb <= 1000 ? 50 : 0;

    return Math.round((lcpScore + fidScore + clsScore + fcpScore + ttfbScore) / 5);
  }, [metrics]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading performance data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Performance Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className={`text-6xl font-bold ${getScoreColor(performanceScore)}`}>
            {performanceScore}
          </div>
          <div className="text-lg text-gray-600 mt-2">Overall Performance Score</div>
          <div className="text-sm text-gray-500 mt-1">
            Based on Core Web Vitals metrics
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Web Vitals */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
          {metrics && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">LCP</span>
                <span className={`text-sm font-medium ${
                  metrics.webVitals.lcp <= 2500 ? 'text-green-600' : 
                  metrics.webVitals.lcp <= 4000 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.webVitals.lcp.toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">FID</span>
                <span className={`text-sm font-medium ${
                  metrics.webVitals.fid <= 100 ? 'text-green-600' : 
                  metrics.webVitals.fid <= 300 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.webVitals.fid.toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">CLS</span>
                <span className={`text-sm font-medium ${
                  metrics.webVitals.cls <= 0.1 ? 'text-green-600' : 
                  metrics.webVitals.cls <= 0.25 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.webVitals.cls.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* API Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Performance</h3>
          {metrics && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className="text-sm font-medium text-blue-600">
                  {metrics.apiMetrics.responseTime.toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Throughput</span>
                <span className="text-sm font-medium text-green-600">
                  {metrics.apiMetrics.throughput.toFixed(0)} req/s
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Error Rate</span>
                <span className={`text-sm font-medium ${
                  metrics.apiMetrics.errorRate < 1 ? 'text-green-600' : 
                  metrics.apiMetrics.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.apiMetrics.errorRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cache Hit Rate</span>
                <span className="text-sm font-medium text-purple-600">
                  {(metrics.apiMetrics.cacheHitRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bundle Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bundle Performance</h3>
          {metrics && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Size</span>
                <span className="text-sm font-medium text-blue-600">
                  {(metrics.bundleMetrics.totalSize / 1024).toFixed(0)}KB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Gzipped</span>
                <span className="text-sm font-medium text-green-600">
                  {(metrics.bundleMetrics.gzippedSize / 1024).toFixed(0)}KB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Chunks</span>
                <span className="text-sm font-medium text-purple-600">
                  {metrics.bundleMetrics.chunkCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Load Time</span>
                <span className="text-sm font-medium text-orange-600">
                  {metrics.bundleMetrics.loadTime.toFixed(0)}ms
                </span>
              </div>
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          {metrics && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">CPU Usage</span>
                <span className={`text-sm font-medium ${
                  metrics.systemMetrics.cpuUsage < 60 ? 'text-green-600' : 
                  metrics.systemMetrics.cpuUsage < 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.systemMetrics.cpuUsage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Memory</span>
                <span className={`text-sm font-medium ${
                  metrics.systemMetrics.memoryUsage < 60 ? 'text-green-600' : 
                  metrics.systemMetrics.memoryUsage < 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.systemMetrics.memoryUsage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Disk Usage</span>
                <span className={`text-sm font-medium ${
                  metrics.systemMetrics.diskUsage < 60 ? 'text-green-600' : 
                  metrics.systemMetrics.diskUsage < 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.systemMetrics.diskUsage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Network Latency</span>
                <span className="text-sm font-medium text-blue-600">
                  {metrics.systemMetrics.networkLatency.toFixed(0)}ms
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Web Vitals Chart */}
        {webVitalsData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Web Vitals Overview</h3>
            <Bar
              data={webVitalsData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label;
                        const value = context.parsed.y;
                        
                        if (label === 'CLS') {
                          return `${label}: ${(value / 1000).toFixed(3)}`;
                        }
                        return `${label}: ${value.toFixed(0)}ms`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        )}

        {/* System Metrics Chart */}
        {systemMetricsData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Resource Usage</h3>
            <Doughnut
              data={systemMetricsData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        return `${context.label}: ${context.parsed.toFixed(1)}%`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      {/* API Trends Chart */}
      {apiTrendsData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Performance Trends</h3>
          <Line
            data={apiTrendsData}
            options={{
              responsive: true,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              plugins: {
                legend: {
                  position: 'top',
                },
              },
              scales: {
                x: {
                  display: true,
                  title: {
                    display: true,
                    text: 'Time',
                  },
                },
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: {
                    display: true,
                    text: 'Response Time (ms)',
                  },
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                    display: true,
                    text: 'Throughput (req/s)',
                  },
                  grid: {
                    drawOnChartArea: false,
                  },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
};