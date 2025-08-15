"use client";

import { TaskList } from "@/components/features/tasks/task-list";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
        <p className="text-gray-600">Manage and track your tasks</p>
      </div>
      
      <TaskList />
    </div>
  );
}