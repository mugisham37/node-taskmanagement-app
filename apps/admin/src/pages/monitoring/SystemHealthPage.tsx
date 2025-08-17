'use client';

import { SystemHealthDashboard } from '@/components/monitoring/SystemHealthDashboard';

export function SystemHealthPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">System Health</h1>
        <p className="text-sm text-admin-secondary-500">
          Monitor system performance, service status, and infrastructure health
        </p>
      </div>

      {/* System Health Dashboard */}
      <SystemHealthDashboard />
    </div>
  );
}