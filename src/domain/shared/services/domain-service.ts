export abstract class DomainService {
  protected readonly serviceName: string;

  constructor(serviceName?: string) {
    this.serviceName = serviceName || this.constructor.name;
  }

  protected logOperation(operation: string, context?: any): void {
    console.log(`[${this.serviceName}] ${operation}`, context);
  }
}
