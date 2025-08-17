import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={(el) => {
          if (el) el.indeterminate = indeterminate ?? false;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        className={cn(
          'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded',
          className
        )}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
