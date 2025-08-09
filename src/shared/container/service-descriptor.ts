import { ServiceLifetime } from './types';

/**
 * Service descriptor containing registration information
 */
export class ServiceDescriptor {
  constructor(
    public readonly token: string,
    public readonly implementation: new (...args: any[]) => any,
    public readonly lifetime: ServiceLifetime,
    public readonly dependencies: string[] = [],
    public readonly isFactory: boolean = false
  ) {}

  /**
   * Check if service is singleton
   */
  get isSingleton(): boolean {
    return this.lifetime === ServiceLifetime.Singleton;
  }

  /**
   * Check if service is scoped
   */
  get isScoped(): boolean {
    return this.lifetime === ServiceLifetime.Scoped;
  }

  /**
   * Check if service is transient
   */
  get isTransient(): boolean {
    return this.lifetime === ServiceLifetime.Transient;
  }

  /**
   * Get service information for debugging
   */
  getInfo(): {
    token: string;
    implementation: string;
    lifetime: ServiceLifetime;
    dependencies: string[];
    isFactory: boolean;
  } {
    return {
      token: this.token,
      implementation: this.implementation.name,
      lifetime: this.lifetime,
      dependencies: [...this.dependencies],
      isFactory: this.isFactory,
    };
  }
}
