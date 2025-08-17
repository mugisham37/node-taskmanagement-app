'use client';

import { Bars3Icon } from '@heroicons/react/24/outline';
import { AdminNotifications } from '../navigation/AdminNotifications';
import { AdminSearchBar } from '../navigation/AdminSearchBar';
import { AdminUserDropdown } from '../navigation/AdminUserDropdown';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-admin-secondary-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-admin-secondary-700 lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-admin-secondary-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search bar */}
        <AdminSearchBar />

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <AdminNotifications />

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-admin-secondary-200" aria-hidden="true" />

          {/* User dropdown */}
          <AdminUserDropdown />
        </div>
      </div>
    </div>
  );
}