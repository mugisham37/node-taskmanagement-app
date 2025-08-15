// Offline page for when the app is offline

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { Button } from '@taskmanagement/ui';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You're Offline
          </h1>
          <p className="text-gray-600">
            It looks like you've lost your internet connection. Don't worry, you can still view cached content and any changes you make will be synced when you're back online.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>

          <Link href="/dashboard">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Offline Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• View cached tasks and projects</li>
            <li>• Create and edit items (will sync later)</li>
            <li>• Access recently viewed content</li>
          </ul>
        </div>
      </div>
    </div>
  );
}