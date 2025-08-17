'use client';

import { ADMIN_ROUTES } from '@/config/routes.config';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ArrowRightOnRectangleIcon, Cog6ToothIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Fragment } from 'react';

const userNavigation = [
  { name: 'Your profile', href: ADMIN_ROUTES.SETTINGS.PROFILE, icon: UserCircleIcon },
  { name: 'Settings', href: ADMIN_ROUTES.SETTINGS.SYSTEM, icon: Cog6ToothIcon },
];

export function AdminUserDropdown() {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const handleLogout = async () => {
    await dispatch(logout());
    router.push(ADMIN_ROUTES.AUTH.LOGIN);
  };

  if (!user) {
    return null;
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="-m-1.5 flex items-center p-1.5">
        <span className="sr-only">Open user menu</span>
        <UserCircleIcon className="h-8 w-8 rounded-full bg-admin-secondary-50 text-admin-secondary-400" />
        <span className="hidden lg:flex lg:items-center">
          <span className="ml-4 text-sm font-semibold leading-6 text-admin-secondary-900" aria-hidden="true">
            {user.firstName} {user.lastName}
          </span>
          <ChevronDownIcon className="ml-2 h-5 w-5 text-admin-secondary-400" aria-hidden="true" />
        </span>
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
        <Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-admin-secondary-900/5 focus:outline-none">
          {userNavigation.map((item) => (
            <Menu.Item key={item.name}>
              {({ active }) => (
                <a
                  href={item.href}
                  className={`${
                    active ? 'bg-admin-secondary-50' : ''
                  } flex items-center px-3 py-1 text-sm leading-6 text-admin-secondary-900`}
                >
                  <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {item.name}
                </a>
              )}
            </Menu.Item>
          ))}
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleLogout}
                className={`${
                  active ? 'bg-admin-secondary-50' : ''
                } flex w-full items-center px-3 py-1 text-sm leading-6 text-admin-secondary-900`}
              >
                <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}