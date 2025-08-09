import { Logger } from '../monitoring/logging-service';
import { JobRegistry } from './job-registry';
import { JobExecution, JobConfig } from './job-types';
import { CircuitBreaker } from '../external-services/circuit-breaker';

export class JobProcessor {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private processingJobs = new Set<string>();

  constructor(
    private logger: Logger,
    private config: JobConfig,
    private registry: JobRegistry
  ) {}

  /**
   * Start the job processor
   */
  async start(): Promise<void> {
    this.logger.info('Starting job processor', {
      concurrency: this.config.concurrency,
      timeout: this.config.timeout,
    });
  }

  /**
   * Stop the job processor
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping job processor');

    // Wait for processing jobs to complete
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs.size > 0 && Date.now() - startTime < maxWait) {
      await this.sleep(100);
    }

    if (this.processingJobs.size > 0) {
      this.logger.warn('Force stopping processor with jobs still processing', {
        processingJobs: this.processingJobs.size,
      });
    }
  }

  /**
   * Process a job
   */
  async process(job: JobExecution): Promise<any> {
    const startTime = Date.now();

    try {
      // Check if already processing
      if (this.processingJobs.has(job.id)) {
        throw new Error(`Job ${job.id} is already being processed`);
      }

      this.processingJobs.add(job.id);

      this.logger.debug('Starting job processing', {
        jobId: job.id,
        jobName: job.name,
        retryCount: job.retryCount,
      });

      // Get job handler
      const handler = this.registry.getHandler(job.name);
      if (!handler) {
        throw new Error(`No handler found for job type: ${job.name}`);
      }

      // Validate job payload if handler has validation
      if (handler.validate && !handler.validate(job.payload)) {
        throw new Error(`Job payload validation failed for job: ${job.name}`);
      }

      // Get or create circuit breaker for this job type
      const circuitBreaker = this.getCircuitBreaker(job.name);

      // Execute job with circuit breaker protection
      const result = await circuitBreaker.execute(async () => {
        return await this.executeWithTimeout(
          handler.execute.bind(handler),
          job.payload,
          this.config.timeout
        );
      });

      const executionTime = Date.now() - startTime;

      // Call success handler if available
      if (handler.onSuccess) {
        try {
          await handler.onSuccess(result);
        } catch (error) {
          this.logger.warn('Job success handler failed', {
            jobId: job.id,
            jobName: job.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.logger.debug('Job processing completed', {
        jobId: job.id,
        jobName: job.name,
        executionTime,
        retryCount: job.retryCount,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Job processing failed', {
        jobId: job.id,
        jobName: job.name,
        error: errorMessage,
        executionTime,
        retryCount: job.retryCount,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Call failure handler if available
      const handler = this.registry.getHandler(job.name);
      if (handler?.onFailure) {
        try {
          await handler.onFailure(
            error instanceof Error ? error : new Error(errorMessage)
          );
        } catch (handlerError) {
          this.logger.warn('Job failure handler failed', {
            jobId: job.id,
            jobName: job.name,
            handlerError:
              handlerError instanceof Error
                ? handlerError.message
                : 'Unknown error',
          });
        }
      }

      // Call retry handler if this is a retry
      if (job.retryCount > 0 && handler?.onRetry) {
        try {
          await handler.onRetry(job.retryCount);
        } catch (retryError) {
          this.logger.warn('Job retry handler failed', {
            jobId: job.id,
            jobName: job.name,
            retryCount: job.retryCount,
            retryError:
              retryError instanceof Error
                ? retryError.message
                : 'Unknown error',
          });
        }
      }

      throw error;
    } finally {
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    processingJobs: number;
    circuitBreakers: number;
    circuitBreakerStats: Record<string, any>;
  } {
    const circuitBreakerStats: Record<string, any> = {};

    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStats[name] = breaker.getStats();
    }

    return {
      processingJobs: this.processingJobs.size,
      circuitBreakers: this.circuitBreakers.size,
      circuitBreakerStats,
    };
  }

  /**
   * Reset circuit breaker for a job type
   */
  resetCircuitBreaker(jobName: string): boolean {
    const breaker = this.circuitBreakers.get(jobName);
    if (breaker) {
      breaker.reset();
      this.logger.info('Circuit breaker reset', { jobName });
      return true;
    }
    return false;
  }

  /**
   * Get or create circuit breaker for job type
   */
  private getCircuitBreaker(jobName: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(jobName);

    if (!breaker) {
      breaker = new CircuitBreaker(`job-${jobName}`, {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        expectedErrors: ['ValidationError', 'TimeoutError'],
      });

      this.circuitBreakers.set(jobName, breaker);

      this.logger.debug('Created circuit breaker for job type', {
        jobName,
        failureThreshold: 5,
        recoveryTimeout: 60000,
      });
    }

    return breaker;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: (payload: Record<string, any>) => Promise<T>,
    payload: Record<string, any>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeout}ms`));
      }, timeout);

      fn(payload)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
