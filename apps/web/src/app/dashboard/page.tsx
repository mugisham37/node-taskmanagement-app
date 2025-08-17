'use client';

import { Layout } from '@/components/layout/Layout';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import {
  CheckSquareIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  TrendingUpIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  activeProjects: number;
  teamMembers: number;
  overdueTasks: number;
  tasksThisWeek: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  assignee?: {
    name: string;
    avatar?: string;
  };
}

const mockStats: DashboardStats = {
  totalTasks: 156,
  completedTasks: 89,
  activeProjects: 12,
  teamMembers: 8,
  overdueTasks: 7,
  tasksThisWeek: 23,
};

const mockRecentTasks: RecentTask[] = [
  {
    id: '1',
    title: 'Update user authentication flow',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date('2024-02-20'),
    assignee: { name: 'John Doe' },
  },
  {
    id: '2',
    title: 'Design new dashboard layout',
    status: 'review',
    priority: 'medium',
    dueDate: new Date('2024-02-22'),
    assignee: { name: 'Jane Smith' },
  },
  {
    id: '3',
    title: 'Fix mobile responsive issues',
    status: 'todo',
    priority: 'urgent',
    dueDate: new Date('2024-02-18'),
    assignee: { name: 'Mike Johnson' },
  },
];

const breadcrumbItems = [
  { name: 'Dashboard', current: true },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>(mockRecentTasks);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Fetch dashboard data from API
    setLoading(false);
  }, []);

  const completionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100);

  const statCards = [
    {
      name: 'Total Tasks',
      value: stats.totalTasks,
      icon: CheckSquareIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Completed',
      value: stats.completedTasks,
      icon: CheckSquareIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Active Projects',
      value: stats.activeProjects,
      icon: FolderIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Team Members',
      value: stats.teamMembers,
      icon: UsersIcon,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ];

  const statusConfig = {
    todo: { label: 'To Do', color: 'gray' },
    in_progress: { label: 'In Progress', color: 'blue' },
    review: { label: 'Review', color: 'yellow' },
    done: { label: 'Done', color: 'green' },
  } as const;

  const priorityConfig = {
    low: { label: 'Low', color: 'green' },
    medium: { label: 'Medium', color: 'yellow' },
    high: { label: 'High', color: 'orange' },
    urgent: { label: 'Urgent', color: 'red' },
  } as const;

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BreadcrumbNav items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome back! Here's what's happening with your projects.</p>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" href="/tasks/new">
                New Task
              </Button>
              <Button href="/projects/new">
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={cn('p-3 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Tasks */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Recent Tasks</h2>
                  <Button variant="outline" size="sm" href="/tasks">
                    View All
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {recentTasks.map((task) => (
                  <div key={task.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </h3>
                        <div className="mt-1 flex items-center space-x-2">
                          <Badge color={statusConfig[task.status].color}>
                            {statusConfig[task.status].label}
                          </Badge>
                          <Badge color={priorityConfig[task.priority].color}>
                            {priorityConfig[task.priority].label}
                          </Badge>
                          {task.assignee && (
                            <span className="text-xs text-gray-500">
                              Assigned to {task.assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center text-sm text-gray-500">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {task.dueDate.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Progress Overview</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Task Completion</span>
                    <span className="font-medium">{completionRate}%</span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">This Week</span>
                    <span className="font-medium">{stats.tasksThisWeek} tasks</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-xs text-green-600">+12% from last week</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {stats.overdueTasks > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Attention Needed</h3>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    You have <span className="font-medium text-red-600">{stats.overdueTasks} overdue tasks</span> that need immediate attention.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" href="/tasks?filter=overdue">
                    View Overdue Tasks
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" href="/tasks/new">
                  <CheckSquareIcon className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
                <Button variant="outline" className="w-full justify-start" href="/projects/new">
                  <FolderIcon className="h-4 w-4 mr-2" />
                  New Project
                </Button>
                <Button variant="outline" className="w-full justify-start" href="/team/invite">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  Invite Team Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}