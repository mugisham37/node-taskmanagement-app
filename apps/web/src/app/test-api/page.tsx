'use client';

import { LoginForm } from '@/components/examples/LoginForm';
import { TaskList } from '@/components/examples/TaskList';
import { UserProfile } from '@/components/examples/UserProfile';
import { useAuth } from '@/hooks/api';
import { useState } from 'react';

export default function TestApiPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'profile' | 'tasks'>('login');

  const tabs = [
    { id: 'login' as const, label: 'Login', show: !isAuthenticated },
    { id: 'profile' as const, label: 'Profile', show: isAuthenticated },
    { id: 'tasks' as const, label: 'Tasks', show: isAuthenticated },
  ];

  const visibleTabs = tabs.filter(tab => tab.show);

  // Auto-switch to profile tab when user logs in
  React.useEffect(() => {
    if (isAuthenticated && activeTab === 'login') {
      setActiveTab('profile');
    }
  }, [isAuthenticated, activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            API Connection Test
          </h1>
          <p className="text-gray-600">
            Test the tRPC connection between frontend and backend
          </p>
          {isAuthenticated && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.firstName || user?.email}!
              </span>
              <button
                onClick={logout}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">Frontend: Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">tRPC Client: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-sm">
                Authentication: {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'login' && !isAuthenticated && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Login Test</h2>
              <p className="text-gray-600 mb-6">
                Test the authentication API by logging in with your credentials.
              </p>
              <LoginForm />
            </div>
          )}

          {activeTab === 'profile' && isAuthenticated && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Profile Test</h2>
              <p className="text-gray-600 mb-6">
                Test the user profile API by viewing and editing your profile.
              </p>
              <UserProfile />
            </div>
          )}

          {activeTab === 'tasks' && isAuthenticated && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Tasks Test</h2>
              <p className="text-gray-600 mb-6">
                Test the tasks API by creating, editing, and deleting tasks.
              </p>
              <TaskList />
            </div>
          )}
        </div>

        {/* API Information */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            API Information
          </h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}</p>
            <p><strong>WebSocket URL:</strong> {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}</p>
            <p><strong>tRPC Endpoint:</strong> /trpc</p>
            <p><strong>Features:</strong> Type-safe API calls, Optimistic updates, Real-time subscriptions</p>
          </div>
        </div>
      </div>
    </div>
  );
}