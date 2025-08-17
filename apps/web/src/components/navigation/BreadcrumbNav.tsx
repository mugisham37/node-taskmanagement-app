import { cn } from '@/utils/cn';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface BreadcrumbItem {
  name: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  return (
    <nav className={cn('flex', className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {/* Home link */}
        <li>
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <HomeIcon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={item.name} className="flex items-center">
            <ChevronRightIcon
              className="h-5 w-5 text-gray-300 flex-shrink-0"
              aria-hidden="true"
            />
            {item.href && !item.current ? (
              <Link
                href={item.href}
                className="ml-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {item.name}
              </Link>
            ) : (
              <span
                className={cn(
                  'ml-2 text-sm font-medium',
                  item.current
                    ? 'text-gray-900'
                    : 'text-gray-500'
                )}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}