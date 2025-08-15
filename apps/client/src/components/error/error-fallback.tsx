"use client";

import React from 'react';
import { ErrorSeverity, createUserFriendlyMessage } from '@taskmanagement/shared';
import { Button } from '@taskmanagement/ui';
import { ErrorFallbackProps } from './error-boundary';
import { AlertTriangle, RefreshCw, Bug, Home, ArrowLeft } from 'lucide-react';

export function ErrorFallback({ 
  error, 
  errorId, 
  severity, 
  resetError, 
  level 
}: ErrorFallbackProps) {
  const userMessage = createUserFriendlyMessage(error);
  
  const getSeverityConfig = () => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return {
          icon: AlertTriangle,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          title: 'Critical Error',
          showDetails: true,
        };
      case ErrorSeverity.HIGH:
        return {
          icon: AlertTriangle,
          iconColor: 'text-orange-500',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          title: 'Error',
          showDetails: true,
        };
      case ErrorSeverity.MEDIUM:
        return {
          icon: AlertTriangle,
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          title: 'Warning',
          showDetails: false,
        };
      default:
        return {
          icon: AlertTriangle,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Notice',
          showDetails: false,
        };
    }
  };

  const config = getSeverityConfig();
  const Icon = config.icon;

  const handleReportError = () => {
    // Open error report dialog or redirect to support
    const subject = encodeURIComponent(`Error Report: ${error.code}`);
    const body = encodeURIComponent(`
Error ID: ${errorId}
Error Code: ${error.code}
Message: ${error.message}
Timestamp: ${error.timestamp}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Please describe what you were doing when this error occurred:
    `);
    
    window.open(`mailto:support@taskmanagement.com?subject=${subject}&body=${body}`);
  };

  const handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const getActions = () => {
    const actions = [];

    // Always show retry for component and section level errors
    if (level !== 'page') {
      actions.push(
        <Button
          key="retry"
          onClick={resetError}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      );
    }

    // Show navigation options for page-level errors
    if (level === 'page') {
      actions.push(
        <Button
          key="back"
          onClick={handleGoBack}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      );

      actions.push(
        <Button
          key="home"
          onClick={handleGoHome}
          variant="default"
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Button>
      );
    }

    // Show report option for high severity errors
    if (config.showDetails) {
      actions.push(
        <Button
          key="report"
          onClick={handleReportError}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Bug className="h-4 w-4" />
          Report Issue
        </Button>
      );
    }

    return actions;
  };

  return (
    <div className={`rounded-lg border p-6 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        <Icon className={`h-6 w-6 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {config.title}
          </h3>
          
          <p className="text-gray-700 mb-4">
            {userMessage}
          </p>

          {config.showDetails && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-sm font-mono text-gray-800">
                <div><strong>Error ID:</strong> {errorId}</div>
                <div><strong>Code:</strong> {error.code}</div>
                <div><strong>Status:</strong> {error.statusCode}</div>
                <div><strong>Time:</strong> {error.timestamp?.toLocaleString()}</div>
                {error.field && <div><strong>Field:</strong> {error.field}</div>}
              </div>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            {getActions()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized fallback components for different contexts
export function PageErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <ErrorFallback {...props} />
      </div>
    </div>
  );
}

export function SectionErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="p-4">
      <ErrorFallback {...props} />
    </div>
  );
}

export function ComponentErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="p-2">
      <ErrorFallback {...props} />
    </div>
  );
}