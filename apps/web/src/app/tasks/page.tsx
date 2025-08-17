'use client';

import { Layout } from '@/components/layout/Layout';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';
import { TaskTable } from '@/components/tables/TaskTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchTasks, setFilters } from '@/store/slices/tasksSlice';
import { addToast } from '@/store/slices/uiSlice';
import {
    FunnelIcon,
    ListBulletIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    Squares2X2Icon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const breadcrumbItems = [
  { name: 'Tasks', current: true },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TasksPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { tasks, loading, filters } = useAppSelector(state => state.tasks);
  
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  useEffect(() => {
    dispatch(fetchTasks({ filters }));
  }, [dispatch, filters]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    dispatch(setFilters({ ...filters, search: query }));
  };

  const handleFilterChange = (key: string, value: string) => {
    dispatch(setFilters({ 
      ...filters, 
      [key]: value || undefined 
    }));
  };

  const handleTaskEdit = (task: any) => {
    router.push(`/tasks/${task.id}/edit`);
  };

  const handleTaskDelete = async (task: any) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        // TODO: Implement delete task
        dispatch(addToast({
          type: 'success',
          title: 'Task deleted',
          message: `"${task.title}" has been deleted successfully.`,
        }));
      } catch (error) {
        dispatch(addToast({
          type: 'error',
          title: 'Delete failed',
          message: 'Failed to delete the task. Please try again.',
        }));
      }
    }
  };

  const handleTaskView = (task: any) => {
    router.push(`/tasks/${task.id}`);
  };

  const handleBulkAction = (action: string) => {
    if (selectedTasks.length === 0) {
      dispatch(addToast({
        type: 'warning',
        title: 'No tasks selected',
        message: 'Please select one or more tasks to perform this action.',
      }));
      return;
    }

    // TODO: Implement bulk actions
    dispatch(addToast({
      type: 'info',
      title: 'Bulk action',
      message: `${action} action will be implemented for ${selectedTasks.length} tasks.`,
    }));
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BreadcrumbNav items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
              <p className="text-gray-600">Manage and track your tasks across all projects.</p>
            </div>
            <Button href="/tasks/new">
              <PlusIcon className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  options={statusOptions}
                />
              </div>

              {/* Priority Filter */}
              <div>
                <Select
                  value={filters.priority || ''}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  options={priorityOptions}
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedTasks.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      {selectedTasks.length} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('Mark as Done')}
                    >
                      Mark as Done
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('Delete')}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  More Filters
                </Button>

                {/* View Mode Toggle */}
                <div className="flex rounded-md shadow-sm">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                      viewMode === 'table'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                      viewMode === 'grid'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Content */}
        <div className="space-y-6">
          {viewMode === 'table' ? (
            <TaskTable
              tasks={tasks}
              onEdit={handleTaskEdit}
              onDelete={handleTaskDelete}
              onView={handleTaskView}
              onSelectionChange={setSelectedTasks}
              loading={loading}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* TODO: Implement grid view */}
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">Grid view coming soon...</p>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
              <ListBulletIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No tasks found</h3>
            <p className="mt-2 text-gray-500">
              {Object.keys(filters).length > 0
                ? 'Try adjusting your filters or search query.'
                : 'Get started by creating your first task.'
              }
            </p>
            <div className="mt-6">
              <Button href="/tasks/new">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}