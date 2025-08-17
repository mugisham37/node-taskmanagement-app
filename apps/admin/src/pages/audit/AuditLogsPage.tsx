'use client';

import { AuditLogsTable } from '@/components/audit/AuditLogsTable';

export function AuditLogsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">Audit Logs</h1>
        <p className="text-sm text-admin-secondary-500">
          Track all system activities, user actions, and security events
        </p>
      </div>

      {/* Audit Logs Table */}
      <AuditLogsTable />
    </div>
  );
}