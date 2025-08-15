"use client";

import React, { useState } from 'react';
import { ErrorSeverity, determineErrorSeverity } from '@taskmanagement/shared';
import { useError, useErrorState, useCircuitBreaker, useRetry } from '@/components/providers/error-provider';
import { Card } from '@taskmanagement/ui';
import { 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Trash2, 
  Download,
  Filter,
  TrendingUp,
  Shield,
  Clock
} from 'lucide-react';

interface ErrorDashboardProps {
  className?: string;
}

export function ErrorDashboard({ className }: ErrorDashboardProps) {
  const { clearErrors } = useError();
  const { errors, hasErrors, getErrorsBySeverity } = useErrorState();
  const { getStats: getCircuitBreakerStats } = useCircuitBreaker();
  const { getStats: getRetryStats } = useRetry();
  
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | 'all'>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const circuitBreakerStats = getCircuitBreakerStats();
  const retryStats = getRetryStats();

  const filteredErrors = selectedSeverity === 'all' 
    ? errors 
    : getErrorsBySeverity(selectedSeverity);

  const errorCounts = {
    critical: getErrorsBySeverity(ErrorSeverity.CRITICAL).length,
    high: getErrorsBySeverity(ErrorSeverity.HIGH).length,
    medium: getErrorsBySeverity(ErrorSeverity.MEDIUM).length,
    low: getErrorsBySeverity(ErrorSeverity.LOW).length,
  };

  const exportErrors = () => {
    const data = {
      timestamp: new Date().toISOString(),
      errors: errors.map(error => error.toJSON()),
      circuitBreakerStats,
      retryStats,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'text-red-600 bg-red-50 border-red-200';
      case ErrorSeverity.HIGH:
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case ErrorSeverity.MEDIUM:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case ErrorSeverity.LOW:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!hasErrors && Object.keys(circuitBreakerStats).length === 0 && Object.keys(retryStats).length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Systems Operational</h3>
          <p className="text-gray-600">No errors or issues detected.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">{errorCounts.critical}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High</p>
              <p className="text-2xl font-bold text-orange-600">{errorCounts.high}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{errorCounts.medium}</p>
            </div>
            <Activity className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low</p>
              <p className="text-2xl font-bold text-blue-600">{errorCounts.low}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Circuit Breaker Status */}
      {Object.keys(circuitBreakerStats).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Circuit Breaker Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(circuitBreakerStats).map(([service, stats]) => (
              <div key={service} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{service}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    stats.state === 'closed' 
                      ? 'bg-green-100 text-green-800'
                      : stats.state === 'open'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.state}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Failures: {stats.failureCount}</div>
                  <div>Success: {stats.successCount}</div>
                  {stats.nextAttemptTime && (
                    <div>Next attempt: {new Date(stats.nextAttemptTime).toLocaleTimeString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Retry Statistics */}
      {Object.keys(retryStats).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Retry Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(retryStats).map(([operation, stats]) => (
              <div key={operation} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">{operation}</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Total attempts: {stats.totalAttempts}</div>
                  <div>Successful: {stats.successfulAttempts}</div>
                  <div>Failed: {stats.failedAttempts}</div>
                  <div>Total delay: {stats.totalDelay}ms</div>
                  <div className="mt-2">
                    Success rate: {
                      stats.totalAttempts > 0 
                        ? Math.round((stats.successfulAttempts / stats.totalAttempts) * 100)
                        : 0
                    }%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error List */}
      {hasErrors && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors ({filteredErrors.length})
            </h3>
            
            <div className="flex items-center gap-2">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as ErrorSeverity | 'all')}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="all">All Severities</option>
                <option value={ErrorSeverity.CRITICAL}>Critical</option>
                <option value={ErrorSeverity.HIGH}>High</option>
                <option value={ErrorSeverity.MEDIUM}>Medium</option>
                <option value={ErrorSeverity.LOW}>Low</option>
              </select>
              
              <button
                onClick={exportErrors}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              
              <button
                onClick={clearErrors}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredErrors.map((error, index) => {
              const severity = determineErrorSeverity(error);
              const errorId = `${error.code}_${error.timestamp?.getTime()}_${index}`;
              const isExpanded = showDetails === errorId;

              return (
                <div
                  key={errorId}
                  className={`border rounded-lg p-4 ${getSeverityColor(severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{error.code}</span>
                        <span className="text-xs px-2 py-1 rounded bg-white bg-opacity-50">
                          {severity}
                        </span>
                        <span className="text-xs text-gray-500">
                          {error.timestamp?.toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-2">{error.message}</p>
                      
                      {error.field && (
                        <p className="text-xs">Field: {error.field}</p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setShowDetails(isExpanded ? null : errorId)}
                      className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded hover:bg-opacity-75"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                      <div className="text-xs space-y-2">
                        <div>
                          <strong>Status Code:</strong> {error.statusCode}
                        </div>
                        
                        {error.details && (
                          <div>
                            <strong>Details:</strong>
                            <pre className="mt-1 p-2 bg-white bg-opacity-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(error.details, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {error.stack && (
                          <div>
                            <strong>Stack Trace:</strong>
                            <pre className="mt-1 p-2 bg-white bg-opacity-50 rounded text-xs overflow-x-auto">
                              {error.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}