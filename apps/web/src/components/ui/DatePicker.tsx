'use client';

import { cn } from '@/utils/cn';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface DatePickerProps {
  id?: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  error,
  disabled,
  placeholder = 'Select date...'
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      onChange(new Date(dateValue));
    } else {
      onChange(undefined);
    }
  };

  const formatDateValue = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={id}
          type="date"
          value={formatDateValue(value)}
          onChange={handleDateChange}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}