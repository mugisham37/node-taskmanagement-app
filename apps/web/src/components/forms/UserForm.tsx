'use client';

import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/utils/cn';
import {
  CameraIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  timezone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
  isActive: z.boolean().default(true),
  avatar: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  showRoleField?: boolean;
  className?: string;
}

const roleOptions = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'member', label: 'Member' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

const timezoneOptions = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
];

export function UserForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  showRoleField = false,
  className 
}: UserFormProps) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'member',
      isActive: true,
      ...initialData,
    },
  });

  const handleFormSubmit = async (data: UserFormData) => {
    try {
      // TODO: Handle avatar upload
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting user:', error);
    }
  };

  const handleAvatarChange = (files: File[]) => {
    if (files.length > 0) {
      setAvatarFile(files[0]);
      // TODO: Upload avatar and set URL
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className={cn('space-y-6', className)}
    >
      {/* Avatar */}
      <div className="flex items-center space-x-6">
        <div className="shrink-0">
          {watch('avatar') || avatarFile ? (
            <img
              className="h-16 w-16 object-cover rounded-full"
              src={avatarFile ? URL.createObjectURL(avatarFile) : watch('avatar')}
              alt="Avatar"
            />
          ) : (
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>
        <div>
          <FileUpload
            accept="image/*"
            maxFiles={1}
            onFilesChange={handleAvatarChange}
            disabled={isDisabled}
          >
            <Button type="button" variant="outline" size="sm" disabled={isDisabled}>
              <CameraIcon className="h-4 w-4 mr-2" />
              Change Avatar
            </Button>
          </FileUpload>
          <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 2MB</p>
        </div>
      </div>

      {/* Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <Input
            id="firstName"
            {...register('firstName')}
            placeholder="Enter first name..."
            error={errors.firstName?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <Input
            id="lastName"
            {...register('lastName')}
            placeholder="Enter last name..."
            error={errors.lastName?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="Enter email address..."
            error={errors.email?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
            placeholder="Enter phone number..."
            error={errors.phone?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Job Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-2">
            Job Title
          </label>
          <Input
            id="jobTitle"
            {...register('jobTitle')}
            placeholder="Enter job title..."
            error={errors.jobTitle?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
            Department
          </label>
          <Input
            id="department"
            {...register('department')}
            placeholder="Enter department..."
            error={errors.department?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Location and Timezone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <Input
            id="location"
            {...register('location')}
            placeholder="Enter location..."
            error={errors.location?.message}
            disabled={isDisabled}
          />
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <Select
            id="timezone"
            {...register('timezone')}
            options={timezoneOptions}
            placeholder="Select timezone..."
            error={errors.timezone?.message}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
          Bio
        </label>
        <Textarea
          id="bio"
          {...register('bio')}
          placeholder="Tell us about yourself..."
          rows={3}
          error={errors.bio?.message}
          disabled={isDisabled}
        />
      </div>

      {/* Role and Status */}
      {showRoleField && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <Select
              id="role"
              {...register('role')}
              options={roleOptions}
              error={errors.role?.message}
              disabled={isDisabled}
            />
          </div>

          <div className="flex items-center pt-8">
            <input
              id="isActive"
              type="checkbox"
              {...register('isActive')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isDisabled}
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
              Active user
            </label>
          </div>
        </div>
      )}

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
          {initialData ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}