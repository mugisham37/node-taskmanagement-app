'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ArrowTopRightOnSquareIcon, 
  ArrowPathIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';
import { monitoringService, GrafanaDashboard } from '@/services/monitoringService';

interface GrafanaDashboardEmbedProps {
  dashboardUid?: string;
  height?: number;
  autoRefresh?: boolean;
  timeRange?: string;
}

export function GrafanaDashboardEmbed({ 
  dashboardUid, 
  height = 600, 
  autoRefresh = true,
  timeRange = 'now-1h'
}: GrafanaDashboardEmbedProps) {
  const [dashboards, setDashboards] = useState<GrafanaDashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<string>(dashboardUid || '');
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<string>('5s');

  const fetchDashboards = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dashboardList = await monitoringService.getGrafanaDashboards();
      setDashboards(dashboardList);
      
      if (!selectedDashboard && dashboardList.length > 0) {
        setSelectedDashboard(dashboardList[0].uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const generateEmbedUrl = async (uid: string) => {
    if (!uid) return;

    try {
      const baseUrl = await monitoringService.getGrafanaDashboardUrl(uid, {
        'from': timeRange.startsWith('now-') ? timeRange : 'now-1h',
        'to': 'now',
        'refresh': refreshInterval,
        'kiosk': 'true',
        'theme': 'light',
      });
      
      // Convert to embed URL
      const embedUrl = baseUrl.replace('/d/', '/d-solo/') + '&panelId=1';
      setEmbedUrl(embedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate embed URL');
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  useEffect(() => {
    if (selectedDashboard) {
      generateEmbedUrl(selectedDashboard);
    }
  }, [selectedDashboard, timeRange, refreshInterval]);

  const handleDashboardChange = (uid: string) => {
    setSelectedDashboard(uid);
  };

  const openInGrafana = () => {
    if (selectedDashboard) {
      const dashboard = dashboards.find(d => d.uid === selectedDashboard);
      if (dashboard) {
        window.open(dashboard.url, '_blank');
      }
    }
  };

  const refreshDashboard = () => {
    if (selectedDashboard) {
      generateEmbedUrl(selectedDashboard);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-6 w-6 text-admin-primary-600" />
          <h3 className="text-lg font-medium text-admin-secondary-900">Grafana Dashboards</h3>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshDashboard}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-admin-secondary-300 shadow-sm text-sm leading-4 font-medium rounded-md text-admin-secondary-700 bg-white hover:bg-admin-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openInGrafana}
            disabled={!selectedDashboard}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-admin-primary-600 hover:bg-admin-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-admin-primary-500 disabled:opacity-50"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
            Open in Grafana
          </button>
        </div>
      </div>

      {/* Dashboard Selection and Configuration */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Dashboard Selection */}
          <div>
            <label htmlFor="dashboard-select" className="block text-sm font-medium text-admin-secondary-700">
              Dashboard
            </label>
            <select
              id="dashboard-select"
              value={selectedDashboard}
              onChange={(e) => handleDashboardChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="">Select a dashboard</option>
              {dashboards.map((dashboard) => (
                <option key={dashboard.uid} value={dashboard.uid}>
                  {dashboard.title}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selection */}
          <div>
            <label htmlFor="time-range" className="block text-sm font-medium text-admin-secondary-700">
              Time Range
            </label>
            <select
              id="time-range"
              value={timeRange}
              onChange={(e) => setRefreshInterval(e.target.value)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="now-5m">Last 5 minutes</option>
              <option value="now-15m">Last 15 minutes</option>
              <option value="now-1h">Last 1 hour</option>
              <option value="now-6h">Last 6 hours</option>
              <option value="now-24h">Last 24 hours</option>
              <option value="now-7d">Last 7 days</option>
            </select>
          </div>

          {/* Refresh Interval */}
          <div>
            <label htmlFor="refresh-interval" className="block text-sm font-medium text-admin-secondary-700">
              Refresh Interval
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              className="mt-1 block w-full rounded-md border-admin-secondary-300 shadow-sm focus:border-admin-primary-500 focus:ring-admin-primary-500 sm:text-sm"
            >
              <option value="5s">5 seconds</option>
              <option value="10s">10 seconds</option>
              <option value="30s">30 seconds</option>
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Embed */}
      {embedUrl && !error && (
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-admin-secondary-900">
                {dashboards.find(d => d.uid === selectedDashboard)?.title || 'Dashboard'}
              </h4>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Live
                </span>
                <Cog6ToothIcon className="h-4 w-4 text-admin-secondary-400" />
              </div>
            </div>
          </div>
          <div className="relative">
            <iframe
              src={embedUrl}
              width="100%"
              height={height}
              frameBorder="0"
              className="w-full"
              title="Grafana Dashboard"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="flex items-center space-x-2">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-admin-primary-600" />
                  <span className="text-sm text-admin-secondary-600">Loading dashboard...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard List */}
      {!selectedDashboard && dashboards.length > 0 && (
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200"></div>     <h4 className="text-lg font-medium text-admin-secondary-900">Available Dashboards</h4>
            <p className="text-sm text-admin-secondary-500">Select a dashboard to view</p>
          </div>
          <div className="divide-y divide-admin-secondary-200">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.uid}
                className="px-6 py-4 hover:bg-admin-secondary-50 cursor-pointer"
                onClick={() => handleDashboardChange(dashboard.uid)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-medium text-admin-secondary-900">
                      {dashboard.title}
                    </h5>
                    <p className="text-sm text-admin-secondary-500">
                      {dashboard.folderTitle && `Folder: ${dashboard.folderTitle}`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {dashboard.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-admin-secondary-100 text-admin-secondary-800"
                      >
                        {tag}
                      </span>
                    ))}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 text-admin-secondary-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}