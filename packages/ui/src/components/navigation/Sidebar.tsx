import * as React from 'react';
import { cn } from '../../utils/cn';

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
  position?: 'left' | 'right';
  width?: string;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, collapsed = false, position = 'left', width = '16rem', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full flex-col border-r bg-background transition-all duration-300',
          collapsed ? 'w-16' : `w-[${width}]`,
          position === 'right' && 'border-l border-r-0',
          className
        )}
        {...props}
      />
    );
  }
);
Sidebar.displayName = 'Sidebar';

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex h-14 items-center border-b px-4', className)}
    {...props}
  />
));
SidebarHeader.displayName = 'SidebarHeader';

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-auto py-4', className)}
    {...props}
  />
));
SidebarContent.displayName = 'SidebarContent';

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-t p-4', className)}
    {...props}
  />
));
SidebarFooter.displayName = 'SidebarFooter';

const SidebarNav = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn('space-y-1 px-2', className)}
    {...props}
  />
));
SidebarNav.displayName = 'SidebarNav';

const SidebarNavItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean;
    icon?: React.ReactNode;
    collapsed?: boolean;
  }
>(({ className, active, icon, collapsed, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
      active && 'bg-accent text-accent-foreground',
      className
    )}
    {...props}
  >
    {icon && (
      <span className={cn('mr-3 h-4 w-4', collapsed && 'mr-0')}>
        {icon}
      </span>
    )}
    {!collapsed && <span>{children}</span>}
  </div>
));
SidebarNavItem.displayName = 'SidebarNavItem';

export {
    Sidebar, SidebarContent,
    SidebarFooter, SidebarHeader, SidebarNav,
    SidebarNavItem
};
