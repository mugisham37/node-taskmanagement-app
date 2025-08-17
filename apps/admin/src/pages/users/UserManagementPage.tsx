'use client';

import { UserManagementTable } from '@/components/users/UserManagementTable';

export function UserManagementPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">User Management</h1>
        <p className="text-sm text-admin-secondary-500">
          Manage user accounts, roles, and permissions across the system
        </p>
      </div>

      {/* User Management Table */}
      <UserManagementTable />
    </div>
  );
}