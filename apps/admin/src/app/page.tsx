'use client';

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ADMIN_ROUTES } from '@/config/routes.config';
import { useAppSelector } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace(ADMIN_ROUTES.DASHBOARD.OVERVIEW);
      } else {
        router.replace(ADMIN_ROUTES.AUTH.LOGIN);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-admin-secondary-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-admin-secondary-600">Loading admin dashboard...</p>
      </div>
    </div>
  );
}