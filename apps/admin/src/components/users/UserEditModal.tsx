'use client';

import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['Admin', 'Manager', 'User']),
  status: z.enum(['active', 'inactive', 'suspended']),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

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

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUserUpdated: (user: User) => void;
}

export function UserEditModal({ isOpen, onClose, user, onUserUpdated }: UserEditModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  useEffect(() => {
    if (user) {
      setValue('firstName', user.firstName);
      setValue('lastName', user.lastName);
      setValue('email', user.email);
      setValue('role', user.role as any);
      setValue('status', user.status);
    }
  }, [user, setValue]);

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return;

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser: User = {
        ...user,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        status: data.status,
      };

      onUserUpdated(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-admin-secondary-400 hover:text-admin-secondary-500 focus:outline-none focus:ring-2 focus:ring-admin-primary-500 focus:ring-offset-2"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-admin-secondary-900">
                      Edit User
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-admin-secondary-500">
                        Update user information, role, and status.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                            First Name
                          </label>
                          <input
                            type="text"
                            {...register('firstName')}
                            className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                          />
                          {errors.firstName && (
                            <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="lastName" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                            Last Name
                          </label>
                          <input
                            type="text"
                            {...register('lastName')}
                            className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                          />
                          {errors.lastName && (
                            <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                          Email Address
                        </label>
                        <input
                          type="email"
                          {...register('email')}
                          className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 placeholder:text-admin-secondary-400 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="role" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                            Role
                          </label>
                          <select
                            {...register('role')}
                            className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                          >
                            <option value="User">User</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                          </select>
                          {errors.role && (
                            <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="status" className="block text-sm font-medium leading-6 text-admin-secondary-900">
                            Status
                          </label>
                          <select
                            {...register('status')}
                            className="mt-2 block w-full rounded-md border-0 py-1.5 text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 focus:ring-2 focus:ring-inset focus:ring-admin-primary-600 sm:text-sm sm:leading-6"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                          </select>
                          {errors.status && (
                            <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="inline-flex w-full justify-center rounded-md bg-admin-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-admin-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary-600 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? 'Updating...' : 'Update User'}
                        </button>
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-admin-secondary-900 shadow-sm ring-1 ring-inset ring-admin-secondary-300 hover:bg-admin-secondary-50 sm:mt-0 sm:w-auto"
                          onClick={handleClose}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
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