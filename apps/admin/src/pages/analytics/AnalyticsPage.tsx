'use client';

import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-admin-secondary-900">Analytics</h1>
        <p className="text-sm text-admin-secondary-500">
          Monitor user engagement, feature usage, and business metrics
        </p>
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard />
    </div>
  );
}