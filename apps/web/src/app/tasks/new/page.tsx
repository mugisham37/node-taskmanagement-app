'use client';

import { TaskForm } from '@/components/forms/TaskForm';
import { Layout } from '@/components/layout/Layout';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';
import { useAppDispatch } from '@/store';
import { createTask } from '@/store/slices/tasksSlice';
import { addToast } from '@/store/slices/uiSlice';
import { useRouter } from 'next/navigation';

const breadcrumbItems = [
  { name: 'Tasks', href: '/tasks' },
  { name: 'New Task', current: true },
];

export default function NewTaskPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const handleSubmit = async (data: any) => {
    try {
      await dispatch(createTask(data)).unwrap();
      
      dispatch(addToast({
        type: 'success',
        title: 'Task created',
        message: `"${data.title}" has been created successfully.`,
      }));

      router.push('/tasks');
    } catch (error) {
      dispatch(addToast({
        type: 'error',
        title: 'Creation failed',
        message: 'Failed to create the task. Please try again.',
      }));
      throw error;
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <BreadcrumbNav items={breadcrumbItems} />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-gray-900">Create New Task</h1>
            <p className="text-gray-600">Add a new task to track your work and collaborate with your team.</p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-4xl">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-8">
              <TaskForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}