import { Search, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../utils/cn';
import { IconButton } from './IconButton';
import { Input, type InputProps } from './Input';

export interface SearchInputProps extends Omit<InputProps, 'type'> {
  onClear?: () => void;
  showClearButton?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, showClearButton = true, value, ...props }, ref) => {
    const hasValue = Boolean(value);

    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          type="search"
          className={cn('pl-10', showClearButton && hasValue && 'pr-10', className)}
          value={value}
          {...props}
        />
        {showClearButton && hasValue && onClear && (
          <IconButton
            icon={<X className="h-4 w-4" />}
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            onClick={onClear}
            aria-label="Clear search"
          />
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
