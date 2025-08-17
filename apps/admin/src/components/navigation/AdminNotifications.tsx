'use client';

import { useAppSelector } from '@/store';
import { Menu, Transition } from '@headlessui/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

export function AdminNotifications() {
  const { notifications } = useAppSelector((state) => state.notifications || { notifications: [] });
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="relative -m-2.5 p-2.5 text-admin-secondary-400 hover:text-admin-secondary-500">
        <span className="sr-only">View notifications</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2.5 w-80 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-admin-secondary-900/5 focus:outline-none">
          <div className="px-4 py-2 border-b border-admin-secondary-200">
            <h3 className="text-sm font-medium text-admin-secondary-900">Notifications</h3>
          </div>
          
          {notifications?.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-admin-secondary-500">
              No notifications
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications?.slice(0, 5).map((notification) => (
                <Menu.Item key={notification.id}>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? 'bg-admin-secondary-50' : ''
                      } px-4 py-3 border-b border-admin-secondary-100 last:border-b-0`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                          notification.read ? 'bg-admin-secondary-300' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-admin-secondary-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-admin-secondary-500 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-admin-secondary-400 mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Menu.Item>
              ))}
            </div>
          )}
          
          {notifications?.length > 0 && (
            <div className="px-4 py-2 border-t border-admin-secondary-200">
              <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}