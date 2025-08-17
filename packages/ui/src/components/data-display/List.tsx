import * as React from 'react';
import { cn } from '../../utils/cn';

export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  variant?: 'unordered' | 'ordered';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ className, variant = 'unordered', spacing = 'md', children, ...props }, ref) => {
    const Component = variant === 'ordered' ? 'ol' : 'ul';
    
    const spacingClasses = {
      none: 'space-y-0',
      sm: 'space-y-1',
      md: 'space-y-2',
      lg: 'space-y-4',
    };

    return (
      <Component
        ref={ref}
        className={cn(
          'list-inside',
          variant === 'unordered' && 'list-disc',
          variant === 'ordered' && 'list-decimal',
          spacingClasses[spacing],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
List.displayName = 'List';

const ListItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('text-sm leading-relaxed', className)}
    {...props}
  />
));
ListItem.displayName = 'ListItem';

export { List, ListItem };
