'use client';

import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/utils/cn';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).optional(),
  estimatedHours: z.number().min(0).optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Partial<TaskFormData>;
  onSubmit: (data: TaskFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
];

export function TaskForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  className 
}: TaskFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'todo',
      priority: 'medium',
      ...initialData,
    },
  });

  const handleFormSubmit = async (data: TaskFormData) => {
    try {
      await onSubmit({ ...data, tags: selectedTags });
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className={cn('space-y-6', className)}
    >
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Title *
        </label>
        <Input
          id="title"
          {...register('title')}
          placeholder="Enter task title..."
          error={errors.title?.message}
          disabled={isDisabled}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe the task..."
          rows={4}
          error={errors.description?.message}
          disabled={isDisabled}
        />
      </div>

      {/* Status and Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <Select
            id="status"
            {...register('status')}
            options={statusOptions}
            error={errors.status?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <Select
            id="priority"
            {...register('priority')}
            options={priorityOptions}
            error={errors.priority?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Assignee and Project */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="assigneeId" className="block text-sm font-medium text-gray-700 mb-2">
            Assignee
          </label>
          <Select
            id="assigneeId"
            {...register('assigneeId')}
            options={[]} // TODO: Load from API
            placeholder="Select assignee..."
            error={errors.assigneeId?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 mb-2">
            Project
          </label>
          <Select
            id="projectId"
            {...register('projectId')}
            options={[]} // TODO: Load from API
            placeholder="Select project..."
            error={errors.projectId?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Due Date and Estimated Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
            Due Date
          </label>
          <DatePicker
            id="dueDate"
            value={watch('dueDate')}
            onChange={(date) => setValue('dueDate', date)}
            error={errors.dueDate?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="estimatedHours" className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Hours
          </label>
          <Input
            id="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            {...register('estimatedHours', { valueAsNumber: true })}
            placeholder="0"
            error={errors.estimatedHours?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>
        <MultiSelect
          id="tags"
          value={selectedTags}
          onChange={setSelectedTags}
          options={[]} // TODO: Load from API
          placeholder="Add tags..."
          disabled={isDisabled}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDisabled}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isDisabled}
        >
          {initialData ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}