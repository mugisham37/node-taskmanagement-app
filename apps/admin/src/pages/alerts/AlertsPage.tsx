'use client';

import { AlertsList } from '@/components/alerts/AlertsList';

export function AlertsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">System Alerts</h1>
        <p className="text-sm text-admin-secondary-500">
          Monitor and manage system alerts, notifications, and incidents
        </p>
      </div>

      {/* Alerts List */}
      <div className="bg-white shadow-sm ring-1 ring-admin-secondary-900/5 rounded-lg">
        <div className="px-6 py-4 border-b border-admin-secondary-200">
          <h3 className="text-lg font-medium text-admin-secondary-900">All Alerts</h3>
          <p className="text-sm text-admin-secondary-500">
            View, acknowledge, and resolve system alerts
          </p>
        </div>
        <div className="p-6">
          <AlertsList />
        </div>
      </div>
    </div>
  );
}