'use client';

import { ADMIN_ROUTES } from '@/config/routes.config';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  name: string;
  href?: string;
  current: boolean;
}

export function AdminBreadcrumb() {
  const pathname = usePathname();

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with dashboard
    breadcrumbs.push({
      name: 'Dashboard',
      href: ADMIN_ROUTES.DASHBOARD.OVERVIEW,
      current: pathname === ADMIN_ROUTES.DASHBOARD.OVERVIEW,
    });

    // Map path segments to breadcrumb names
    const pathMap: Record<string, string> = {
      users: 'Users',
      analytics: 'Analytics',
      monitoring: 'Monitoring',
      settings: 'Settings',
      alerts: 'Alerts',
      audit: 'Audit Logs',
      'system-health': 'System Health',
      'performance': 'Performance',
      'user-management': 'User Management',
      'role-management': 'Role Management',
      'system-settings': 'System Settings',
      'feature-flags': 'Feature Flags',
    };

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const name = pathMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      if (segment !== 'admin') {
        breadcrumbs.push({
          name,
          href: isLast ? undefined : currentPath,
          current: isLast,
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-4">
        <li>
          <div>
            <Link href={ADMIN_ROUTES.DASHBOARD.OVERVIEW} className="text-admin-secondary-400 hover:text-admin-secondary-500">
              <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {breadcrumbs.map((item) => (
          <li key={item.name}>
            <div className="flex items-center">
              <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-admin-secondary-400" aria-hidden="true" />
              {item.href ? (
                <Link
                  href={item.href}
                  className="ml-4 text-sm font-medium text-admin-secondary-500 hover:text-admin-secondary-700"
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </Link>
              ) : (
                <span className="ml-4 text-sm font-medium text-admin-secondary-900" aria-current="page">
                  {item.name}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}