"use client";

import { Input, Button } from "@taskmanagement/ui";
import { Search, Filter } from "lucide-react";
import { type TaskStatus, type TaskPriority } from "@taskmanagement/shared";

interface TaskFiltersProps {
  filters: {
    status?: TaskStatus;
    priority?: TaskPriority;
    search?: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function TaskFilters({ filters, onFiltersChange }: TaskFiltersProps) {
  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search: search || undefined });
  };

  const handleStatusFilter = (status: TaskStatus | undefined) => {
    onFiltersChange({ ...filters, status });
  };

  const handlePriorityFilter = (priority: TaskPriority | undefined) => {
    onFiltersChange({ ...filters, priority });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search tasks..."
            value={filters.search || ""}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button variant="outline" onClick={clearFilters}>
          <Filter className="w-4 h-4 mr-2" />
          Clear Filters
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filters.status === undefined ? "default" : "outline"}
              onClick={() => handleStatusFilter(undefined)}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filters.status === "todo" ? "default" : "outline"}
              onClick={() => handleStatusFilter("todo")}
            >
              To Do
            </Button>
            <Button
              size="sm"
              variant={filters.status === "in-progress" ? "default" : "outline"}
              onClick={() => handleStatusFilter("in-progress")}
            >
              In Progress
            </Button>
            <Button
              size="sm"
              variant={filters.status === "done" ? "default" : "outline"}
              onClick={() => handleStatusFilter("done")}
            >
              Done
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Priority:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filters.priority === undefined ? "default" : "outline"}
              onClick={() => handlePriorityFilter(undefined)}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filters.priority === "low" ? "default" : "outline"}
              onClick={() => handlePriorityFilter("low")}
            >
              Low
            </Button>
            <Button
              size="sm"
              variant={filters.priority === "medium" ? "default" : "outline"}
              onClick={() => handlePriorityFilter("medium")}
            >
              Medium
            </Button>
            <Button
              size="sm"
              variant={filters.priority === "high" ? "default" : "outline"}
              onClick={() => handlePriorityFilter("high")}
            >
              High
            </Button>
            <Button
              size="sm"
              variant={filters.priority === "urgent" ? "default" : "outline"}
              onClick={() => handlePriorityFilter("urgent")}
            >
              Urgent
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}