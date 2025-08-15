"use client";

import {
    useBundleStats,
    useCacheManager,
    useOnlineStatus,
    usePerformanceMetrics,
    useServiceWorker
} from '@/components/providers/performance-provider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';

export function PerformanceDashboard() {
  const performanceMetrics = usePerformanceMetrics();
  const bundleStats = useBundleStats();
  const isOnline = useOnlineStatus();
  const cacheManager = useCacheManager();
  const { updateAvailable, updateApp } = useServiceWorker();
  
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadCacheStats = async () => {
      if (cacheManager) {
        const stats = cacheManager.getStats();
        setCacheStats(stats);
      }
    };

    loadCacheStats();
    const interval = setInterval(loadCacheStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [cacheManager, refreshKey]);

  const refreshStats = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Badge variant={isOnline ? "default" : "destructive"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {updateAvailable && (
            <button
              onClick={updateApp}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Update Available
            </button>
          )}
          <button
            onClick={refreshStats}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Cache Statistics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cache Performance</h3>
        {cacheStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Memory Cache</p>
              <p className="text-2xl font-bold">{cacheStats.memorySize}</p>
              <p className="text-xs text-gray-500">
                / {cacheStats.memoryMaxSize} items
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Hit Rate</p>
              <p className="text-2xl font-bold">
                {(cacheStats.hitRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Cache efficiency</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Total Hits</p>
              <p className="text-2xl font-bold">{cacheStats.metrics.hits}</p>
              <p className="text-xs text-gray-500">
                Memory: {cacheStats.metrics.memoryHits}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Cache Misses</p>
              <p className="text-2xl font-bold">{cacheStats.metrics.misses}</p>
              <p className="text-xs text-gray-500">
                Errors: {cacheStats.metrics.errors}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading cache statistics...</p>
        )}
      </Card>

      {/* Bundle Statistics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Bundle Optimization</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Loaded Chunks</p>
            <p className="text-2xl font-bold">{bundleStats.loadedChunks?.length || 0}</p>
            <div className="text-xs text-gray-500 space-y-1">
              {bundleStats.loadedChunks?.map((chunk: string, i: number) => (
                <div key={i} className="truncate">{chunk}</div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Preloaded Chunks</p>
            <p className="text-2xl font-bold">{bundleStats.preloadedChunks?.length || 0}</p>
            <div className="text-xs text-gray-500 space-y-1">
              {bundleStats.preloadedChunks?.map((chunk: string, i: number) => (
                <div key={i} className="truncate">{chunk}</div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Total Chunks</p>
            <p className="text-2xl font-bold">{bundleStats.totalChunks || 0}</p>
            <p className="text-xs text-gray-500">Optimization active</p>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
        {Object.keys(performanceMetrics).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(performanceMetrics).map(([label, metrics]: [string, any]) => (
              <div key={label} className="border-b pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{label}</h4>
                  <Badge variant="outline">{metrics.count} samples</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Average</p>
                    <p className="font-semibold">{metrics.average.toFixed(2)}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Min</p>
                    <p className="font-semibold">{metrics.min.toFixed(2)}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Max</p>
                    <p className="font-semibold">{metrics.max.toFixed(2)}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-600">P95</p>
                    <p className="font-semibold">{metrics.p95.toFixed(2)}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No performance metrics available yet.</p>
        )}
      </Card>

      {/* Cache Management Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cache Management</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => cacheManager?.clear()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All Cache
          </button>
          <button
            onClick={() => cacheManager?.cleanup()}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Cleanup Cache
          </button>
          <button
            onClick={() => cacheManager?.resetMetrics()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reset Metrics
          </button>
        </div>
      </Card>

      {/* System Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">User Agent</p>
            <p className="font-mono text-xs break-all">{navigator.userAgent}</p>
          </div>
          <div>
            <p className="text-gray-600">Connection</p>
            <p className="font-semibold">
              {(navigator as any).connection?.effectiveType || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Memory</p>
            <p className="font-semibold">
              {(performance as any).memory ? 
                `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB used` : 
                'Not available'
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600">Service Worker</p>
            <p className="font-semibold">
              {'serviceWorker' in navigator ? 'Supported' : 'Not supported'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}