'use client';

import { ADMIN_ROUTES } from '@/config/routes.config';
import { cn } from '@/utils/cn';
import {
    BellIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    CpuChipIcon,
    DocumentTextIcon,
    HomeIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  {
    name: 'Dashboard',
    href: ADMIN_ROUTES.DASHBOARD.OVERVIEW,
    icon: HomeIcon,
  },
  {
    name: 'User Management',
    href: ADMIN_ROUTES.USERS.LIST,
    icon: UsersIcon,
  },
  {
    name: 'Analytics',
    href: ADMIN_ROUTES.ANALYTICS.OVERVIEW,
    icon: ChartBarIcon,
  },
  {
    name: 'System Monitoring',
    href: ADMIN_ROUTES.MONITORING.SYSTEM_HEALTH,
    icon: CpuChipIcon,
  },
  {
    name: 'Alerts',
    href: ADMIN_ROUTES.ALERTS.LIST,
    icon: BellIcon,
  },
  {
    name: 'Audit Logs',
    href: ADMIN_ROUTES.AUDIT.LOGS,
    icon: DocumentTextIcon,
  },
  {
    name: 'Settings',
    href: ADMIN_ROUTES.SETTINGS.SYSTEM,
    icon: Cog6ToothIcon,
  },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col">
      <ul role="list" className="flex flex-1 flex-col gap-y-7">
        <li>
          <ul role="list" className="-mx-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-admin-primary-800 text-white'
                        : 'text-admin-primary-200 hover:text-white hover:bg-admin-primary-800',
                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-white' : 'text-admin-primary-200 group-hover:text-white',
                        'h-6 w-6 shrink-0'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      </ul>
    </nav>
  );
}