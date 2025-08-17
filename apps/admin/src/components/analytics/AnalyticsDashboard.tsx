'use client';

import {
    ChartBarIcon,
    ClockIcon,
    UserGroupIcon,
    UsersIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { BusinessMetricsChart } from '../charts/BusinessMetricsChart';
import { FeatureUsageChart } from '../charts/FeatureUsageChart';
import { UserEngagementChart } from '../charts/UserEngagementChart';

interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userGrowth: number;
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  averageSessionTime: number;
  pageViews: number;
  bounceRate: number;
}

interface FeatureUsage {
  feature: string;
  usage: number;
  growth: number;
}

interface UserEngagement {
  date: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
}

// Mock data - in real app, this would come from analytics APIs
const mockMetrics: AnalyticsMetrics = {
  totalUsers: 12847,
  activeUsers: 8934,
  newUsers: 234,
  userGrowth: 12.5,
  totalTasks: 45678,
  completedTasks: 38901,
  taskCompletionRate: 85.2,
  averageSessionTime: 24.5,
  pageViews: 156789,
  bounceRate: 23.4,
};

const mockFeatureUsage: FeatureUsage[] = [
  { feature: 'Task Management', usage: 89.5, growth: 5.2 },
  { feature: 'Project Boards', usage: 76.3, growth: 8.1 },
  { feature: 'Team Collaboration', usage: 68.7, growth: 12.3 },
  { feature: 'File Sharing', usage: 54.2, growth: -2.1 },
  { feature: 'Time Tracking', usage: 43.8, growth: 15.7 },
  { feature: 'Reporting', usage: 32.1, growth: 7.4 },
];

const mockEngagementData: UserEngagement[] = [
  { date: '2024-01-01', activeUsers: 8234, newUsers: 145, sessions: 12456 },
  { date: '2024-01-02', activeUsers: 8456, newUsers: 167, sessions: 12789 },
  { date: '2024-01-03', activeUsers: 8123, newUsers: 134, sessions: 11987 },
  { date: '2024-01-04', activeUsers: 8678, newUsers: 189, sessions: 13234 },
  { date: '2024-01-05', activeUsers: 8934, newUsers: 234, sessions: 13567 },
];

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(mockMetrics);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>(mockFeatureUsage);
  const [engagementData, setEngagementData] = useState<UserEngagement[]>(mockEngagementData);
  const [timeRange, setTimeRange] = useState('7d');

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? '↗' : '↘';
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-admin-secondary-900">Analytics Dashboard</h2>
          <p className="text-sm text-admin-secondary-500">
            Monitor user engagement, feature usage, and business metrics
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="rounded-md border-admin-secondary-300 text-sm focus:border-admin-primary-500 focus:ring-admin-primary-500"
        >
          <option value="1d">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Total Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {formatNumber(metrics.totalUsers)}
                    </div>
                    <div className={`ml-2 text-sm font-medium ${getGrowthColor(metrics.userGrowth)}`}>
                      {getGrowthIcon(metrics.userGrowth)} {formatPercentage(Math.abs(metrics.userGrowth))}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Active Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {formatNumber(metrics.activeUsers)}
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {formatPercentage((metrics.activeUsers / metrics.totalUsers) * 100)} of total
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Task Completion Rate */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Task Completion</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {formatPercentage(metrics.taskCompletionRate)}
                    </div>
                    <div className="ml-2 text-sm text-admin-secondary-500">
                      {formatNumber(metrics.completedTasks)} / {formatNumber(metrics.totalTasks)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Average Session Time */}
        <div className="bg-white overflow-hidden shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-admin-secondary-500 truncate">Avg Session Time</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-admin-secondary-900">
                      {metrics.averageSessionTime}m
                    </div>
                    <div className="ml-2 text-sm text-green-600">
                      ↗ 8.2%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Engagement Chart */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h3 className="text-lg font-medium text-admin-secondary-900">User Engagement</h3>
            <p className="text-sm text-admin-secondary-500">Daily active users and new registrations</p>
          </div>
          <div className="p-6">
            <UserEngagementChart data={engagementData} />
          </div>
        </div>

        {/* Feature Usage Chart */}
        <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
          <div className="px-6 py-4 border-b border-admin-secondary-200">
            <h3 className="text-lg font-medium text-admin-secondary-900">Feature Usage</h3>
            <p className="text-sm text-admin-secondary-500">Most popular features and adoption rates</p>
          </div>
          <div className="p-6">
            <FeatureUsageChart data={featureUsage} />
          </div>
        </div>
      </div>

      {/* Feature Usage Table */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h3 className="text-lg font-medium text-admin-secondary-900">Feature Usage Details</h3>
          <p className="text-sm text-admin-secondary-500">Detailed breakdown of feature adoption and growth</p>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-admin-secondary-300">
            <thead className="bg-admin-secondary-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-admin-secondary-500 uppercase tracking-wider">
                  Feature
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-admin-secondary-500 uppercase tracking-wider">
                  Usage Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-admin-secondary-500 uppercase tracking-wider">
                  Growth
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-admin-secondary-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-admin-secondary-200">
              {featureUsage.map((feature) => (
                <tr key={feature.feature}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-admin-secondary-900">
                    {feature.feature}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-admin-secondary-500">
                    {formatPercentage(feature.usage)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getGrowthColor(feature.growth)}>
                      {getGrowthIcon(feature.growth)} {formatPercentage(Math.abs(feature.growth))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-admin-secondary-500">
                    <div className="w-full bg-admin-secondary-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${feature.usage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business Metrics */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h3 className="text-lg font-medium text-admin-secondary-900">Business Metrics</h3>
          <p className="text-sm text-admin-secondary-500">Key performance indicators and conversion rates</p>
        </div>
        <div className="p-6">
          <BusinessMetricsChart />
        </div>
      </div>
    </div>
  );
}