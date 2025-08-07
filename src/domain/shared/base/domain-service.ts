/**
 * Base class for domain services that encapsulate complex business logic
 * that doesn't naturally fit within a single entity or value object.
 */
export abstract class DomainService {
  protected constructor() {}

  /**
   * Template method for domain service validation
   */
  protected validate(...args: any[]): void {
    // Override in derived classes for specific validation logic
  }

  /**
   * Template method for logging domain service operations
   */
  protected logOperation(
    operation: string,
    context: Record<string, any> = {}
  ): void {
    // This would integrate with the logging infrastructure
    console.log(`Domain Service Operation: ${operation}`, context);
  }
}
