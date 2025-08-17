'use client';

import { cn } from '@/utils/cn';
import { useState } from 'react';

interface ColorPickerProps {
  id?: string;
  value?: string;
  onChange: (color: string) => void;
  colors: string[];
  disabled?: boolean;
}

export function ColorPicker({
  id,
  value,
  onChange,
  colors,
  disabled
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-between'
        )}
      >
        <div className="flex items-center space-x-2">
          <div
            className="w-4 h-4 rounded border border-gray-300"
            style={{ backgroundColor: value || colors[0] }}
          />
          <span className="text-gray-700">
            {value || 'Select color'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2 grid grid-cols-4 gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-8 h-8 rounded border-2 hover:scale-110 transition-transform',
                  value === color ? 'border-gray-900' : 'border-gray-300'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}