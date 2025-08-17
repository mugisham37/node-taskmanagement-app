'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/date';
import { Menu, Transition } from '@headlessui/react';
import {
    ChevronDownIcon,
    ChevronUpDownIcon,
    ChevronUpIcon,
    EllipsisHorizontalIcon,
    EyeIcon,
    PencilIcon,
    TrashIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  project?: {
    id: string;
    name: string;
    color?: string;
  };
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskTableProps {
  tasks: Task[];
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onView?: (task: Task) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  loading?: boolean;
  className?: string;
}

type SortField = keyof Task | 'assignee.name' | 'project.name';
type SortDirection = 'asc' | 'desc';

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

export function TaskTable({
  tasks,
  onEdit,
  onDelete,
  onView,
  onSelectionChange,
  loading = false,
  className
}: TaskTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'assignee.name':
          aValue = a.assignee?.name || '';
          bValue = b.assignee?.name || '';
          break;
        case 'project.name':
          aValue = a.project?.name || '';
          bValue = b.project?.name || '';
          break;
        default:
          aValue = a[sortField as keyof Task];
          bValue = b[sortField as keyof Task];
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortDirection]);

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? tasks.map(task => task.id) : [];
    setSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedIds, taskId]
      : selectedIds.filter(id => id !== taskId);
    setSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="group inline-flex items-center space-x-1 text-left font-medium text-gray-900 hover:text-gray-700"
    >
      <span>{children}</span>
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )
      ) : (
        <ChevronUpDownIcon className="h-4 w-4 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );

  if (loading) {
    return (
      <div className={cn('bg-white shadow rounded-lg', className)}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-t-lg"></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 border-t border-gray-200"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white shadow rounded-lg overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <Checkbox
                  checked={selectedIds.length === tasks.length && tasks.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < tasks.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="title">Task</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="status">Status</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="priority">Priority</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="assignee.name">Assignee</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="project.name">Project</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="dueDate">Due Date</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton field="updatedAt">Updated</SortButton>
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Checkbox
                    checked={selectedIds.includes(task.id)}
                    onChange={(checked) => handleSelectTask(task.id, checked)}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate max-w-xs"
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs" title={task.description}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge color={statusConfig[task.status].color}>
                    {statusConfig[task.status].label}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge color={priorityConfig[task.priority].color}>
                    {priorityConfig[task.priority].label}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.assignee ? (
                    <div className="flex items-center">
                      <Avatar
                        src={task.assignee.avatar}
                        name={task.assignee.name}
                        size="sm"
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900">{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.project ? (
                    <Link
                      href={`/projects/${task.project.id}`}
                      className="inline-flex items-center text-sm text-gray-900 hover:text-blue-600"
                    >
                      {task.project.color && (
                        <div
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: task.project.color }}
                        />
                      )}
                      {task.project.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-500">No project</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {task.dueDate ? (
                    <span className={cn(
                      task.dueDate < new Date() ? 'text-red-600' : 'text-gray-900'
                    )}>
                      {formatDate(task.dueDate)}
                    </span>
                  ) : (
                    <span className="text-gray-500">No due date</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(task.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Menu as="div" className="relative inline-block text-left">
                    <Menu.Button className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <EllipsisHorizontalIcon className="h-5 w-5 text-gray-400" />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {onView && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => onView(task)}
                                className={cn(
                                  active ? 'bg-gray-100' : '',
                                  'flex w-full items-center px-4 py-2 text-sm text-gray-700'
                                )}
                              >
                                <EyeIcon className="mr-3 h-4 w-4" />
                                View
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        {onEdit && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => onEdit(task)}
                                className={cn(
                                  active ? 'bg-gray-100' : '',
                                  'flex w-full items-center px-4 py-2 text-sm text-gray-700'
                                )}
                              >
                                <PencilIcon className="mr-3 h-4 w-4" />
                                Edit
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        {onDelete && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => onDelete(task)}
                                className={cn(
                                  active ? 'bg-gray-100' : '',
                                  'flex w-full items-center px-4 py-2 text-sm text-red-700'
                                )}
                              >
                                <TrashIcon className="mr-3 h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </Menu.Item>
                        )}
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No tasks found.</p>
        </div>
      )}
    </div>
  );
}