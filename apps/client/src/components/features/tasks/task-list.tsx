"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TaskCard } from "./task-card";
import { TaskFilters } from "./task-filters";
import { Button } from "@taskmanagement/ui";
import { Plus } from "lucide-react";
import { type TaskStatus, type TaskPriority } from "@taskmanagement/shared";

interface TaskListProps {
  projectId?: string;
}

export function TaskList({ projectId }: TaskListProps) {
  const [filters, setFilters] = useState<{
    status?: TaskStatus;
    priority?: TaskPriority;
    search?: string;
  }>({});

  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery({
    projectId,
    ...filters,
  });

  const [showCreateForm, setShowCreateForm] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Tasks</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      <TaskFilters filters={filters} onFiltersChange={setFilters} />

      <div className="space-y-4">
        {tasks?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No tasks found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setShowCreateForm(true)}
            >
              Create your first task
            </Button>
          </div>
        ) : (
          tasks?.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={refetch} />
          ))
        )}
      </div>

      {/* TODO: Add TaskCreateModal component */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Task</h3>
            <p className="text-gray-600">Task creation form will be implemented here</p>
            <Button 
              className="mt-4" 
              onClick={() => setShowCreateForm(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}