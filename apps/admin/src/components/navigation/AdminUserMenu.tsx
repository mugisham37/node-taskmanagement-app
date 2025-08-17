'use client';

import { useAppSelector } from '@/store';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export function AdminUserMenu() {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-white">
      <UserCircleIcon className="h-8 w-8 rounded-full bg-admin-primary-800" />
      <span className="sr-only">Your profile</span>
      <div className="flex flex-col">
        <span aria-hidden="true">{user.firstName} {user.lastName}</span>
        <span className="text-xs text-admin-primary-200" aria-hidden="true">
          {user.email}
        </span>
      </div>
    </div>
  );
}