// Test component to demonstrate error handling capabilities

"use client";

import React, { useState } from 'react';
import { Button, Card } from '@taskmanagement/ui';
import { useErrorHandling } from '@/hooks/use-error-handling';
import { useError, useCircuitBreaker, useRetry } from '@/components/providers/error-provider';
import { AppError, ValidationError, NetworkError, TimeoutError } from '@taskmanagement/shared';
import { AlertTriangle, Zap, RefreshCw, Wifi, Clock, Bug } from 'lucide-react';

export function ErrorTestComponent() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const { handleError, executeWithErrorHandling, executeTRPCOperation } = useErrorHandling();
  const { getCircuitBreakerStats } = useCircuitBreaker();
  const { getStats: getRetryStats } = useRetry();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Test different error types
  const testValidationError = () => {
    const error = new ValidationError('Email is required', 'email');
    handleError(error, 'Testing validation error');
    addResult('Validation error triggered');
  };

  const testNetworkError = () => {
    const error = new NetworkError('Connection failed');
    handleError(error, 'Testing network error');
    addResult('Network error triggered');
  };

  const testTimeoutError = () => {
    const error = new TimeoutError('Request timed out after 30s');
    handleError(error, 'Testing timeout error');
    addResult('Timeout error triggered');
  };

  const testCriticalError = () => {
    const error = new AppError('Database connection lost', 'DATABASE_ERROR', 500);
    handleError(error, 'Testing critical error');
    addResult('Critical error triggered');
  };

  // Test async operation with retry
  const testAsyncWithRetry = async () => {
    let attempts = 0;
    
    const result = await executeWithErrorHandling(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError(`Attempt ${attempts} failed`);
        }
        return `Success after ${attempts} attempts`;
      },
      'test_async_retry',
      {
        onSuccess: (result) => addResult(`Async operation succeeded: ${result}`),
        onError: (error) => addResult(`Async operation failed: ${error.message}`),
      }
    );

    if (result) {
      addResult(`Final result: ${result}`);
    }
  };

  // Test circuit breaker
  const testCircuitBreaker = async () => {
    // Trigger multiple failures to open circuit
    for (let i = 0; i < 6; i++) {
      try {
        await executeWithErrorHandling(
          async () => {
            throw new AppError('Service unavailable', 'SERVICE_UNAVAILABLE_ERROR', 503);
          },
          'test_circuit_breaker',
          {
            customErrorMessage: `Circuit breaker test ${i + 1}`,
          }
        );
      } catch (error) {
        // Expected to fail
      }
    }

    const stats = getCircuitBreakerStats();
    addResult(`Circuit breaker stats: ${JSON.stringify(stats.default || {})}`);
  };

  // Test tRPC operation simulation
  const testTRPCOperation = async () => {
    const result = await executeTRPCOperation(
      async () => {
        // Simulate tRPC call that fails then succeeds
        if (Math.random() > 0.5) {
          throw new AppError('Simulated tRPC error', 'TRPC_ERROR', 500);
        }
        return { id: '123', name: 'Test Data' };
      },
      'test_trpc_operation',
      {
        onSuccess: (data) => addResult(`tRPC operation succeeded: ${JSON.stringify(data)}`),
        onError: (error) => addResult(`tRPC operation failed: ${error.message}`),
      }
    );
  };

  // Test unhandled error
  const testUnhandledError = () => {
    // This will be caught by the global error handler
    setTimeout(() => {
      throw new Error('Unhandled error for testing');
    }, 100);
    addResult('Unhandled error triggered (check console)');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStats = () => {
    const circuitStats = getCircuitBreakerStats();
    const retryStats = getRetryStats();
    
    addResult(`Circuit Breaker Stats: ${JSON.stringify(circuitStats)}`);
    addResult(`Retry Stats: ${JSON.stringify(retryStats)}`);
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bug className="h-6 w-6" />
        Error Handling Test Suite
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Buttons */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">Error Type Tests</h3>
          
          <Button
            onClick={testValidationError}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Test Validation Error
          </Button>

          <Button
            onClick={testNetworkError}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Wifi className="h-4 w-4" />
            Test Network Error
          </Button>

          <Button
            onClick={testTimeoutError}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Test Timeout Error
          </Button>

          <Button
            onClick={testCriticalError}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Zap className="h-4 w-4 text-red-500" />
            Test Critical Error
          </Button>

          <h3 className="text-lg font-semibold mb-3 mt-6">Advanced Tests</h3>

          <Button
            onClick={testAsyncWithRetry}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Test Async with Retry
          </Button>

          <Button
            onClick={testCircuitBreaker}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Test Circuit Breaker
          </Button>

          <Button
            onClick={testTRPCOperation}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Test tRPC Operation
          </Button>

          <Button
            onClick={testUnhandledError}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <Bug className="h-4 w-4" />
            Test Unhandled Error
          </Button>

          <div className="flex gap-2 mt-4">
            <Button onClick={getStats} variant="secondary" className="flex-1">
              Get Stats
            </Button>
            <Button onClick={clearResults} variant="secondary" className="flex-1">
              Clear Results
            </Button>
          </div>
        </div>

        {/* Results */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Test Results</h3>
          <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-center">No tests run yet</p>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className="text-sm font-mono bg-white p-2 rounded border"
                  >
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">What This Tests:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Different error types and severities</li>
          <li>• Automatic retry mechanisms with exponential backoff</li>
          <li>• Circuit breaker pattern for service protection</li>
          <li>• Error reporting and breadcrumb collection</li>
          <li>• User-friendly error messages and recovery options</li>
          <li>• Global error handling for unhandled exceptions</li>
        </ul>
      </div>
    </Card>
  );
}