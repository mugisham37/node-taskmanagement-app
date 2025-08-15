/**
 * Task Data Transfer Objects
 * 
 * DTOs for transferring task data across application boundaries
 */

export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId: string;
  createdById: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskListDto {
  tasks: TaskDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskStatsDto {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}