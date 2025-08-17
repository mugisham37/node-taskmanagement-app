'use client';

import { cn } from '@/utils/cn';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FileUpload({
  onFilesChange,
  accept,
  maxFiles = 1,
  maxSize = 5 * 1024 * 1024, // 5MB
  disabled,
  children,
  className
}: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesChange(acceptedFiles);
  }, [onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    maxFiles,
    maxSize,
    disabled
  });

  if (children) {
    return (
      <div {...getRootProps()} className={className}>
        <input {...getInputProps()} />
        {children}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer',
        isDragActive && 'border-blue-500 bg-blue-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p className="text-blue-600">Drop the files here...</p>
      ) : (
        <div>
          <p className="text-gray-600">
            Drag & drop files here, or click to select files
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Max {maxFiles} file{maxFiles > 1 ? 's' : ''}, up to {Math.round(maxSize / 1024 / 1024)}MB each
          </p>
        </div>
      )}
    </div>
  );
}