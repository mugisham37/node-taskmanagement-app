'use client';

import { Dialog, Transition } from '@headlessui/react';
import { UserCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
}

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export function UserDetailsModal({ isOpen, onClose, user }: UserDetailsModalProps) {
  if (!user) return null;

  const getStatusBadge = (status: User['status']) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleStyles = {
      Admin: 'bg-purple-100 text-purple-800',
      Manager: 'bg-blue-100 text-blue-800',
      User: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyles[role as keyof typeof roleStyles] || roleStyles.User}`}>
        {role}
      </span>
    );
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-admin-secondary-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-admin-secondary-400 hover:text-admin-secondary-500 focus:outline-none focus:ring-2 focus:ring-admin-primary-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-admin-secondary-900">
                      User Details
                    </Dialog.Title>

                    <div className="mt-6">
                      {/* User Header */}
                      <div className="flex items-center space-x-4 pb-6 border-b border-admin-secondary-200">
                        <UserCircleIcon className="h-16 w-16 text-admin-secondary-400" />
                        <div>
                          <h4 className="text-lg font-medium text-admin-secondary-900">
                            {user.firstName} {user.lastName}
                          </h4>
                          <p className="text-sm text-admin-secondary-500">{user.email}</p>
                          <div className="mt-2 flex items-center space-x-2">
                            {getRoleBadge(user.role)}
                            {getStatusBadge(user.status)}
                          </div>
                        </div>
                      </div>

                      {/* User Information */}
                      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <h5 className="text-sm font-medium text-admin-secondary-900">Personal Information</h5>
                          <dl className="mt-3 space-y-3">
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Full Name</dt>
                              <dd className="text-sm text-admin-secondary-900">{user.firstName} {user.lastName}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Email Address</dt>
                              <dd className="text-sm text-admin-secondary-900">{user.email}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">User ID</dt>
                              <dd className="text-sm text-admin-secondary-900 font-mono">{user.id}</dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-admin-secondary-900">Account Information</h5>
                          <dl className="mt-3 space-y-3">
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Role</dt>
                              <dd className="text-sm text-admin-secondary-900">{user.role}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Status</dt>
                              <dd className="text-sm text-admin-secondary-900">{user.status}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Last Login</dt>
                              <dd className="text-sm text-admin-secondary-900">
                                {new Date(user.lastLogin).toLocaleString()}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-admin-secondary-500">Account Created</dt>
                              <dd className="text-sm text-admin-secondary-900">
                                {new Date(user.createdAt).toLocaleString()}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      {/* Activity Summary */}
                      <div className="mt-6 pt-6 border-t border-admin-secondary-200">
                        <h5 className="text-sm font-medium text-admin-secondary-900">Activity Summary</h5>
                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div className="bg-admin-secondary-50 rounded-lg p-4">
                            <div className="text-2xl font-semibold text-admin-secondary-900">24</div>
                            <div className="text-sm text-admin-secondary-500">Tasks Created</div>
                          </div>
                          <div className="bg-admin-secondary-50 rounded-lg p-4">
                            <div className="text-2xl font-semibold text-admin-secondary-900">18</div>
                            <div className="text-sm text-admin-secondary-500">Tasks Completed</div>
                          </div>
                          <div className="bg-admin-secondary-50 rounded-lg p-4">
                            <div className="text-2xl font-semibold text-admin-secondary-900">3</div>
                            <div className="text-sm text-admin-secondary-500">Projects</div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="mt-6 pt-6 border-t border-admin-secondary-200">
                        <h5 className="text-sm font-medium text-admin-secondary-900">Recent Activity</h5>
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-admin-secondary-900">Logged in</span>
                            <span className="text-admin-secondary-500">2 hours ago</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-admin-secondary-900">Completed task "Update user interface"</span>
                            <span className="text-admin-secondary-500">1 day ago</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-admin-secondary-900">Created new project "Mobile App"</span>
                            <span className="text-admin-secondary-500">3 days ago</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 hover:bg-admin-secondary-50"
                        onClick={onClose}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}