'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

interface UserNavProps {
  className?: string;
}

export function UserNav({ className }: UserNavProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className={cn('flex items-center space-x-4', className)}>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-4', className)}>
      {/* Notifications */}
      <button
        type="button"
        className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="View notifications"
      >
        <BellIcon className="h-5 w-5" />
      </button>

      {/* User menu */}
      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          <span className="sr-only">Open user menu</span>
          {user.avatar ? (
            <img
              className="h-8 w-8 rounded-full"
              src={user.avatar}
              alt={user.name || 'User avatar'}
            />
          ) : (
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
          )}
          <span className="hidden md:block text-gray-700 font-medium">
            {user.name || user.email}
          </span>
        </Menu.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/profile"
                  className={cn(
                    active ? 'bg-gray-100' : '',
                    'flex items-center px-4 py-2 text-sm text-gray-700'
                  )}
                >
                  <UserIcon className="mr-3 h-4 w-4 text-gray-400" />
                  Your Profile
                </Link>
              )}
            </Menu.Item>
            
            <Menu.Item></Menu.Item>    {({ active }) => (
                <Link
                  href="/settings"
                  className={cn(
                    active ? 'bg-gray-100' : '',
                    'flex items-center px-4 py-2 text-sm text-gray-700'
                  )}
                >
                  <Cog6ToothIcon className="mr-3 h-4 w-4 text-gray-400" />
                  Settings
                </Link>
              )}
            </Menu.Item>
            
            <div className="border-t border-gray-100">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleLogout}
                    className={cn(
                      active ? 'bg-gray-100' : '',
                      'flex w-full items-center px-4 py-2 text-sm text-gray-700'
                    )}
                  >
                    <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4 text-gray-400" />
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </div>
  );
}