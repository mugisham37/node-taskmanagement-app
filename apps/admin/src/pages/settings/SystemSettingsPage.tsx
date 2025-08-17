'use client';

import { SystemSettings } from '@/components/settings/SystemSettings';

export function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">System Settings</h1>
        <p className="text-sm text-admin-secondary-500">
          Configure system-wide settings, security policies, and preferences
        </p>
      </div>

      {/* System Settings */}
      <SystemSettings />
    </div>
  );
}