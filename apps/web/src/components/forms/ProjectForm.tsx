'use client';

import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
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

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  budget: z.number().min(0).optional(),
  color: z.string().optional(),
  isPublic: z.boolean().default(false),
  teamMembers: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

const statusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const colorOptions = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export function ProjectForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  className 
}: ProjectFormProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>(initialData?.teamMembers || []);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      status: 'planning',
      priority: 'medium',
      isPublic: false,
      color: colorOptions[0],
      ...initialData,
    },
  });

  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      await onSubmit({ 
        ...data, 
        teamMembers: selectedMembers,
        tags: selectedTags 
      });
    } catch (error) {
      console.error('Error submitting project:', error);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className={cn('space-y-6', className)}
    >
      {/* Name and Color */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Project Name *
          </label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Enter project name..."
            error={errors.name?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <ColorPicker
            id="color"
            value={watch('color')}
            onChange={(color) => setValue('color', color)}
            colors={colorOptions}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe the project..."
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

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <DatePicker
            id="startDate"
            value={watch('startDate')}
            onChange={(date) => setValue('startDate', date)}
            error={errors.startDate?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <DatePicker
            id="endDate"
            value={watch('endDate')}
            onChange={(date) => setValue('endDate', date)}
            error={errors.endDate?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Budget */}
      <div>
        <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-2">
          Budget ($)
        </label>
        <Input
          id="budget"
          type="number"
          min="0"
          step="0.01"
          {...register('budget', { valueAsNumber: true })}
          placeholder="0.00"
          error={errors.budget?.message}
          disabled={isDisabled}
        />
      </div>

      {/* Team Members */}
      <div>
        <label htmlFor="teamMembers" className="block text-sm font-medium text-gray-700 mb-2">
          Team Members
        </label>
        <MultiSelect
          id="teamMembers"
          value={selectedMembers}
          onChange={setSelectedMembers}
          options={[]} // TODO: Load from API
          placeholder="Add team members..."
          disabled={isDisabled}
        />
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

      {/* Public Project */}
      <div className="flex items-center">
        <input
          id="isPublic"
          type="checkbox"
          {...register('isPublic')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={isDisabled}
        />
        <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
          Make this project public
        </label>
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
          {initialData ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}