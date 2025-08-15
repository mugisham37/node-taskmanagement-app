"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, Button } from "@taskmanagement/ui";
import { Badge } from "@taskmanagement/ui";
import { MoreHorizontal, Calendar, User } from "lucide-react";
import { type Task } from "@taskmanagement/shared";
import { trpc } from "@/lib/trpc";

interface TaskCardProps {
  task: Task;
  onUpdate?: () => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const updateTaskMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      onUpdate?.();
      setIsUpdating(false);
    },
    onError: (error) => {
      console.error("Failed to update task:", error);
      setIsUpdating(false);
    },
  });

  const handleStatusChange = async (newStatus: Task["status"]) => {
    setIsUpdating(true);
    await updateTaskMutation.mutateAsync({
      id: task.id,
      status: newStatus,
    });
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "todo":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-purple-100 text-purple-800";
      case "done":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-gray-600 mb-3">{task.description}</p>
            )}
            
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace("-", " ")}
              </Badge>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>
          </div>
          
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {task.assigneeId && (
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>Assigned</span>
              </div>
            )}
            
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {task.status !== "done" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange(task.status === "todo" ? "in-progress" : "done")}
                disabled={isUpdating}
              >
                {isUpdating ? "..." : task.status === "todo" ? "Start" : "Complete"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}