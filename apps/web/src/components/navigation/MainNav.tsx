'use client';

import { cn } from '@/utils/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  description?: string;
}

interface MainNavProps {
  items: NavItem[];
  className?: string;
}

export function MainNav({ items, className }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex space-x-8', className)}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive
                ? 'text-foreground'
                : 'text-foreground/60'
            )}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}