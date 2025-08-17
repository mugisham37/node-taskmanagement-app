import * as React from 'react';
import { cn } from '../../utils/cn';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'sticky' | 'fixed';
  position?: 'top' | 'bottom';
}

const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ className, variant = 'default', position = 'top', ...props }, ref) => {
    const variantClasses = {
      default: '',
      sticky: position === 'top' ? 'sticky top-0' : 'sticky bottom-0',
      fixed: position === 'top' ? 'fixed top-0 left-0 right-0' : 'fixed bottom-0 left-0 right-0',
    };

    return (
      <nav
        ref={ref}
        className={cn(
          'z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Navbar.displayName = 'Navbar';

const NavbarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex h-14 items-center px-4', className)}
    {...props}
  />
));
NavbarContent.displayName = 'NavbarContent';

const NavbarBrand = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center space-x-2', className)}
    {...props}
  />
));
NavbarBrand.displayName = 'NavbarBrand';

const NavbarNav = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center space-x-4 lg:space-x-6', className)}
    {...props}
  />
));
NavbarNav.displayName = 'NavbarNav';

const NavbarItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean;
  }
>(({ className, active, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-sm font-medium transition-colors hover:text-primary',
      active ? 'text-foreground' : 'text-muted-foreground',
      className
    )}
    {...props}
  />
));
NavbarItem.displayName = 'NavbarItem';

export { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarNav };
