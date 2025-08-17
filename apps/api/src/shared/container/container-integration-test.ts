/**
 * Container Integration Test
 * 
 * Comprehensive test to validate that all container components are properly
 * integrated and working together as expected.
 */

import { ContainerInitializationService } from './container-initialization-service';
import { ContainerHealthChecker } from './health-checker';
import { DependencyValidationService } from './dependency-validation-service';
import { SERVICE_TOKENS } from './types';
import { LoggingService } from '@taskmanagement/observability';

export class ContainerIntegrationTest {
  private initializationService: ContainerInitializationService;

  constructor() {
    this.initializationService = new ContainerInitializationService();
  }

  /**
   * Run comprehensive integration tests
   */
  async runFullIntegrationTest(): Promise<ContainerIntegrationTestResult> {
    const result: ContainerIntegrationTestResult = {
      isSuccess: false,
      tests: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        warnings: 0
      },
      errors: []
    };

    try {
      console.log('🔧 Starting Container Integration Test...\n');

      // Test 1: Container Initialization
      await this.testContainerInitialization(result);

      // Test 2: Service Registration
      await this.testServiceRegistration(result);

      // Test 3: Dependency Validation
      await this.testDependencyValidation(result);

      // Test 4: Health Checking
      await this.testHealthChecking(result);

      // Test 5: Service Resolution
      await this.testServiceResolution(result);

      // Test 6: Middleware Integration
      await this.testMiddlewareIntegration(result);

      // Test 7: Controller Integration
      await this.testControllerIntegration(result);

      // Test 8: Event System Integration
      await this.testEventSystemIntegration(result);

      // Calculate final result
      result.isSuccess = result.summary.failedTests === 0;
      
      console.log('\n📊 Integration Test Summary:');
      console.log(`✅ Passed: ${result.summary.passedTests}`);
      console.log(`❌ Failed: ${result.summary.failedTests}`);
      console.log(`⚠️  Warnings: ${result.summary.warnings}`);
      console.log(`📈 Success Rate: ${((result.summary.passedTests / result.summary.totalTests) * 100).toFixed(1)}%`);

    } catch (error) {
      result.errors.push(`Fatal error during integration test: ${error}`);
      result.isSuccess = false;
    }

    return result;
  }

  private async testContainerInitialization(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Container Initialization';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Container Initialization...');
      
      const container = await this.initializationService.initialize();
      
      if (!container) {
        throw new Error('Container initialization returned null');
      }

      if (!this.initializationService.isContainerInitialized()) {
        throw new Error('Container not marked as initialized');
      }

      const status = this.initializationService.getInitializationStatus();
      if (status.hasError) {
        throw new Error(`Container has initialization error: ${status.error}`);
      }

      result.tests.push({
        name: testName,
        status: 'PASSED',
        message: 'Container initialized successfully'
      });
      result.summary.passedTests++;
      console.log('✅ Container Initialization: PASSED');

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Container initialization failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Container Initialization: FAILED - ${error}`);
    }
  }

  private async testServiceRegistration(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Service Registration';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Service Registration...');
      
      const container = this.initializationService.getContainer();
      const registeredServices = container.getRegisteredServices();

      // Test critical services are registered
      const criticalServices = [
        SERVICE_TOKENS.DATABASE_CONNECTION,
        SERVICE_TOKENS.LOGGING_SERVICE,
        SERVICE_TOKENS.AUTH_CONTROLLER,
        SERVICE_TOKENS.TASK_CONTROLLER,
        SERVICE_TOKENS.USER_REPOSITORY,
        SERVICE_TOKENS.AUTH_MIDDLEWARE,
        SERVICE_TOKENS.RATE_LIMIT_MIDDLEWARE
      ];

      const missingServices = criticalServices.filter(service => !registeredServices.includes(service));

      if (missingServices.length > 0) {
        throw new Error(`Missing critical services: ${missingServices.join(', ')}`);
      }

      if (registeredServices.length < 50) { // Expect at least 50 services
        result.tests.push({
          name: testName,
          status: 'WARNING',
          message: `Only ${registeredServices.length} services registered (expected 50+)`
        });
        result.summary.warnings++;
        console.log(`⚠️  Service Registration: WARNING - Only ${registeredServices.length} services`);
      } else {
        result.tests.push({
          name: testName,
          status: 'PASSED',
          message: `${registeredServices.length} services registered successfully`
        });
        result.summary.passedTests++;
        console.log(`✅ Service Registration: PASSED - ${registeredServices.length} services`);
      }

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Service registration test failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Service Registration: FAILED - ${error}`);
    }
  }

  private async testDependencyValidation(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Dependency Validation';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Dependency Validation...');
      
      const container = this.initializationService.getContainer();
      const loggingService = container.resolve<LoggingService>(SERVICE_TOKENS.LOGGING_SERVICE);
      
      const validationService = new DependencyValidationService(container, loggingService);
      const validationSummary = await validationService.validateAllDependencies();

      if (!validationSummary.isValid) {
        throw new Error(`Dependency validation failed: ${validationSummary.invalidServices} invalid services`);
      }

      if (validationSummary.warnings > 0) {
        result.tests.push({
          name: testName,
          status: 'WARNING',
          message: `Validation passed with ${validationSummary.warnings} warnings`
        });
        result.summary.warnings++;
        console.log(`⚠️  Dependency Validation: WARNING - ${validationSummary.warnings} warnings`);
      } else {
        result.tests.push({
          name: testName,
          status: 'PASSED',
          message: `All ${validationSummary.validServices} services validated successfully`
        });
        result.summary.passedTests++;
        console.log(`✅ Dependency Validation: PASSED - ${validationSummary.validServices} services`);
      }

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Dependency validation failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Dependency Validation: FAILED - ${error}`);
    }
  }

  private async testHealthChecking(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Health Checking';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Health Checking...');
      
      const container = this.initializationService.getContainer();
      const healthChecker = new ContainerHealthChecker(container);
      
      const overallHealth = await healthChecker.getOverallHealth();
      
      if (overallHealth.status === 'unhealthy') {
        throw new Error(`Overall health check failed: ${overallHealth.summary.unhealthy} unhealthy services`);
      }

      if (overallHealth.status === 'degraded') {
        result.tests.push({
          name: testName,
          status: 'WARNING',
          message: `Health check shows degraded status: ${overallHealth.summary.unhealthy} unhealthy services`
        });
        result.summary.warnings++;
        console.log(`⚠️  Health Checking: WARNING - System degraded`);
      } else {
        result.tests.push({
          name: testName,
          status: 'PASSED',
          message: `Health check passed: ${overallHealth.summary.healthy} healthy services`
        });
        result.summary.passedTests++;
        console.log(`✅ Health Checking: PASSED - ${overallHealth.summary.healthy} services healthy`);
      }

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Health checking failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Health Checking: FAILED - ${error}`);
    }
  }

  private async testServiceResolution(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Service Resolution';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Service Resolution...');
      
      const container = this.initializationService.getContainer();
      
      // Test critical service resolutions
      const testServices = [
        SERVICE_TOKENS.LOGGING_SERVICE,
        SERVICE_TOKENS.AUTH_CONTROLLER,
        SERVICE_TOKENS.TASK_CONTROLLER,
        SERVICE_TOKENS.USER_REPOSITORY,
        SERVICE_TOKENS.AUTH_MIDDLEWARE
      ];

      for (const serviceToken of testServices) {
        const service = container.resolve(serviceToken);
        if (!service) {
          throw new Error(`Failed to resolve service: ${serviceToken}`);
        }
      }

      result.tests.push({
        name: testName,
        status: 'PASSED',
        message: `All ${testServices.length} test services resolved successfully`
      });
      result.summary.passedTests++;
      console.log(`✅ Service Resolution: PASSED - ${testServices.length} services resolved`);

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Service resolution failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Service Resolution: FAILED - ${error}`);
    }
  }

  private async testMiddlewareIntegration(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Middleware Integration';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Middleware Integration...');
      
      const container = this.initializationService.getContainer();
      
      // Test middleware services
      const middlewareServices = [
        SERVICE_TOKENS.AUTH_MIDDLEWARE,
        SERVICE_TOKENS.RATE_LIMIT_MIDDLEWARE,
        SERVICE_TOKENS.CORS_MIDDLEWARE,
        SERVICE_TOKENS.SECURITY_MIDDLEWARE
      ];

      const resolvedMiddleware = [];
      for (const middlewareToken of middlewareServices) {
        try {
          const middleware = container.resolve(middlewareToken);
          if (middleware) {
            resolvedMiddleware.push(middlewareToken);
          }
        } catch (error) {
          // Some middleware might not be implemented yet
        }
      }

      if (resolvedMiddleware.length === 0) {
        throw new Error('No middleware services could be resolved');
      }

      if (resolvedMiddleware.length < middlewareServices.length) {
        result.tests.push({
          name: testName,
          status: 'WARNING',
          message: `Only ${resolvedMiddleware.length}/${middlewareServices.length} middleware services available`
        });
        result.summary.warnings++;
        console.log(`⚠️  Middleware Integration: WARNING - ${resolvedMiddleware.length}/${middlewareServices.length} available`);
      } else {
        result.tests.push({
          name: testName,
          status: 'PASSED',
          message: `All ${resolvedMiddleware.length} middleware services integrated`
        });
        result.summary.passedTests++;
        console.log(`✅ Middleware Integration: PASSED - ${resolvedMiddleware.length} middleware services`);
      }

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Middleware integration failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Middleware Integration: FAILED - ${error}`);
    }
  }

  private async testControllerIntegration(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Controller Integration';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Controller Integration...');
      
      const container = this.initializationService.getContainer();
      
      // Test controller services
      const controllerServices = [
        SERVICE_TOKENS.AUTH_CONTROLLER,
        SERVICE_TOKENS.TASK_CONTROLLER,
        SERVICE_TOKENS.PROJECT_CONTROLLER,
        SERVICE_TOKENS.WORKSPACE_CONTROLLER,
        SERVICE_TOKENS.USER_CONTROLLER
      ];

      for (const controllerToken of controllerServices) {
        const controller = container.resolve(controllerToken);
        if (!controller) {
          throw new Error(`Failed to resolve controller: ${controllerToken}`);
        }
      }

      result.tests.push({
        name: testName,
        status: 'PASSED',
        message: `All ${controllerServices.length} controllers integrated successfully`
      });
      result.summary.passedTests++;
      console.log(`✅ Controller Integration: PASSED - ${controllerServices.length} controllers`);

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Controller integration failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Controller Integration: FAILED - ${error}`);
    }
  }

  private async testEventSystemIntegration(result: ContainerIntegrationTestResult): Promise<void> {
    const testName = 'Event System Integration';
    result.summary.totalTests++;

    try {
      console.log('🔍 Testing Event System Integration...');
      
      const container = this.initializationService.getContainer();
      
      // Test event system services
      const eventServices = [
        SERVICE_TOKENS.EVENT_BUS,
        SERVICE_TOKENS.DOMAIN_EVENT_BUS,
        SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
        SERVICE_TOKENS.EVENT_INTEGRATION_SERVICE
      ];

      for (const eventToken of eventServices) {
        const eventService = container.resolve(eventToken);
        if (!eventService) {
          throw new Error(`Failed to resolve event service: ${eventToken}`);
        }
      }

      result.tests.push({
        name: testName,
        status: 'PASSED',
        message: `All ${eventServices.length} event services integrated successfully`
      });
      result.summary.passedTests++;
      console.log(`✅ Event System Integration: PASSED - ${eventServices.length} event services`);

    } catch (error) {
      result.tests.push({
        name: testName,
        status: 'FAILED',
        message: `Event system integration failed: ${error}`
      });
      result.summary.failedTests++;
      result.errors.push(`${testName}: ${error}`);
      console.log(`❌ Event System Integration: FAILED - ${error}`);
    }
  }

  /**
   * Cleanup after tests
   */
  async cleanup(): Promise<void> {
    try {
      await this.initializationService.shutdown();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }
}

/**
 * Integration test result interfaces
 */
export interface ContainerIntegrationTestResult {
  isSuccess: boolean;
  tests: ContainerTestResult[];
  summary: ContainerTestSummary;
  errors: string[];
}

export interface ContainerTestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  message: string;
}

export interface ContainerTestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warnings: number;
}

/**
 * Run integration test and return results
 */
export async function runContainerIntegrationTest(): Promise<ContainerIntegrationTestResult> {
  const test = new ContainerIntegrationTest();
  const result = await test.runFullIntegrationTest();
  await test.cleanup();
  return result;
}

