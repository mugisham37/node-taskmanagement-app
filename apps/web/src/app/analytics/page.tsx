'use client';

import { ProjectStatusChart, TaskCompletionChart, WorkloadChart } from '@/components/charts/AnalyticsChart';
import { Layout } from '@/components/layout/Layout';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ClockIcon,
  TrendingUpIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

const breadcrumbItems = [
  { name: 'Analytics', current: true },
];

const timeRangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

// Mock data
const taskCompletionData = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 19 },
  { name: 'Wed', value: 15 },
  { name: 'Thu', value: 22 },
  { name: 'Fri', value: 18 },
  { name: 'Sat', value: 8 },
  { name: 'Sun', value: 5 },
];

const projectStatusData = [
  { name: 'Active', value: 8 },
  { name: 'Planning', value: 3 },
  { name: 'On Hold', value: 2 },
  { name: 'Completed', value: 12 },
];

const workloadData = [
  { name: 'John Doe', value: 15 },
  { name: 'Jane Smith', value: 12 },
  { name: 'Mike Johnson', value: 18 },
  { name: 'Sarah Wilson', value: 9 },
  { name: 'Tom Brown', value: 14 },
];

const performanceMetrics = [
  {
    name: 'Tasks Completed',
    value: 156,
    change: 12,
    changeType: 'increase',
    icon: ChartBarIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    name: 'Avg. Completion Time',
    value: '2.3 days',
    change: -8,
    changeType: 'decrease',
    icon: ClockIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    name: 'Team Productivity',
    value: '87%',
    change: 5,
    changeType: 'increase',
    icon: TrendingUpIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    name: 'Active Members',
    value: 24,
    change: 3,
    changeType: 'increase',
    icon: UsersIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
];

const recentActivity = [
  {
    id: 1,
    type: 'task_completed',
    user: 'John Doe',
    action: 'completed task',
    target: 'Update user authentication',
    time: '2 hours ago',
  },
  {
    id: 2,
    type: 'project_created',
    user: 'Jane Smith',
    action: 'created project',
    target: 'Mobile App Redesign',
    time: '4 hours ago',
  },
  {
    id: 3,
    type: 'task_assigned',
    user: 'Mike Johnson',
    action: 'assigned task to',
    target: 'Sarah Wilson',
    time: '6 hours ago',
  },
  {
    id: 4,
    type: 'milestone_reached',
    user: 'Team',
    action: 'reached milestone',
    target: 'Q1 Goals Completed',
    time: '1 day ago',
  },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Fetch analytics data based on time range
    setLoading(false);
  }, [timeRange]);

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BreadcrumbNav items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-gray-600">Track your team's performance and project progress.</p>
            </div>
            <div className="flex items-center space-x-4">
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                options={timeRangeOptions}
              />
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {performanceMetrics.map((metric) => (
            <div key={metric.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={cn('p-3 rounded-lg', metric.bgColor)}>
                  <metric.icon className={cn('h-6 w-6', metric.color)} />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                  <div className="flex items-center">
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                    <div className={cn(
                      'ml-2 flex items-center text-sm',
                      metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {metric.changeType === 'increase' ? (
                        <ArrowUpIcon className="h-4 w-4 mr-1" />
                      ) : (
                        <ArrowDownIcon className="h-4 w-4 mr-1" />
                      )}
                      {Math.abs(metric.change)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Task Completion Trend */}
          <TaskCompletionChart data={taskCompletionData} />

          {/* Project Status Distribution */}
          <ProjectStatusChart data={projectStatusData} />

          {/* Team Workload */}
          <div className="lg:col-span-2">
            <WorkloadChart data={workloadData} height={250} />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {activity.user.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user}</span>{' '}
                          {activity.action}{' '}
                          <span className="font-medium">{activity.target}</span>
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge color="gray">
                          {activity.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            {/* Top Performers */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Top Performers</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {workloadData.slice(0, 3).map((performer, index) => (
                    <div key={performer.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white',
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                        )}>
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{performer.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">{performer.value} tasks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Upcoming Deadlines</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Mobile App Release</span>
                    <Badge color="red">2 days</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Q1 Report</span>
                    <Badge color="yellow">5 days</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Client Presentation</span>
                    <Badge color="green">1 week</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}