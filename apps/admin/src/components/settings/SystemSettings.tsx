'use client';

import {
  BellIcon,
  Cog6ToothIcon,
  ServerIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const systemSettingsSchema = z.object({
  siteName: z.string().min(1, 'Site name is required'),
  siteDescription: z.string().min(1, 'Site description is required'),
  maintenanceMode: z.boolean(),
  registrationEnabled: z.boolean(),
  emailVerificationRequired: z.boolean(),
  maxFileUploadSize: z.number().min(1).max(100),
  sessionTimeout: z.number().min(5).max(1440),
  maxLoginAttempts: z.number().min(1).max(10),
  passwordMinLength: z.number().min(6).max(32),
  backupRetentionDays: z.number().min(1).max(365),
  logRetentionDays: z.number().min(1).max(90),
});

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

const defaultSettings: SystemSettingsFormData = {
  siteName: 'TaskManagement Admin',
  siteDescription: 'Comprehensive task management system administration',
  maintenanceMode: false,
  registrationEnabled: true,
  emailVerificationRequired: true,
  maxFileUploadSize: 10,
  sessionTimeout: 60,
  maxLoginAttempts: 5,
  passwordMinLength: 8,
  backupRetentionDays: 30,
  logRetentionDays: 7,
};

export function SystemSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: defaultSettings,
  });

  const onSubmit = async (data: SystemSettingsFormData) => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Settings updated:', data);
      // Show success message
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'general', name: 'General', icon: Cog6ToothIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'system', name: 'System', icon: ServerIcon },
  ];

  return (
    <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 sm:rounded-xl">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold leading-6 text-admin-secondary-900">
              System Settings
            </h3>
            <p className="mt-2 max-w-4xl text-sm text-admin-secondary-500">
              Configure system-wide settings and preferences.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-admin-secondary-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-admin-primary-500 text-admin-primary-600'
                    : 'border-transparent text-admin-secondary-500 hover:text-admin-secondary-700 hover:border-admin-secondary-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="siteName" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Site Name
                  </label>
                  <input
                    type="text"
                    {...register('siteName')}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.siteName && (
                    <p className="mt-1 text-sm text-red-600">{errors.siteName.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="maxFileUploadSize" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Max File Upload Size (MB)
                  </label>
                  <input
                    type="number"
                    {...register('maxFileUploadSize', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.maxFileUploadSize && (
                    <p className="mt-1 text-sm text-red-600">{errors.maxFileUploadSize.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="siteDescription" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                  Site Description
                </label>
                <textarea
                  rows={3}
                  {...register('siteDescription')}
                  className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                />
                {errors.siteDescription && (
                  <p className="mt-1 text-sm text-red-600">{errors.siteDescription.message}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('maintenanceMode')}
                    className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                  />
                  <label className="ml-3 text-sm font-medium text-admin-secondary-900">
                    Maintenance Mode
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('registrationEnabled')}
                    className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                  />
                  <label className="ml-3 text-sm font-medium text-admin-secondary-900">
                    Allow User Registration
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="sessionTimeout" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    {...register('sessionTimeout', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.sessionTimeout && (
                    <p className="mt-1 text-sm text-red-600">{errors.sessionTimeout.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="maxLoginAttempts" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    {...register('maxLoginAttempts', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.maxLoginAttempts && (
                    <p className="mt-1 text-sm text-red-600">{errors.maxLoginAttempts.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="passwordMinLength" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    {...register('passwordMinLength', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.passwordMinLength && (
                    <p className="mt-1 text-sm text-red-600">{errors.passwordMinLength.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('emailVerificationRequired')}
                  className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                />
                <label className="ml-3 text-sm font-medium text-admin-secondary-900">
                  Require Email Verification
                </label>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="backupRetentionDays" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Backup Retention (days)
                  </label>
                  <input
                    type="number"
                    {...register('backupRetentionDays', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.backupRetentionDays && (
                    <p className="mt-1 text-sm text-red-600">{errors.backupRetentionDays.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="logRetentionDays" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                    Log Retention (days)
                  </label>
                  <input
                    type="number"
                    {...register('logRetentionDays', { valueAsNumber: true })}
                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                  />
                  {errors.logRetentionDays && (
                    <p className="mt-1 text-sm text-red-600">{errors.logRetentionDays.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-admin-secondary-900">Email Notifications</h4>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                    />
                    <label className="ml-3 text-sm text-admin-secondary-900">
                      System alerts and errors
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                    />
                    <label className="ml-3 text-sm text-admin-secondary-900">
                      User registration notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-admin-secondary-300 text-admin-primary-600 focus:ring-admin-primary-600"
                    />
                    <label className="ml-3 text-sm text-admin-secondary-900">
                      Weekly usage reports
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-admin-secondary-200">
            <button
              type="button"
              onClick={() => reset()}
              disabled={!isDirty}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 hover:bg-admin-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isLoading || !isDirty}
              className="rounded-md bg-admin-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-admin-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}