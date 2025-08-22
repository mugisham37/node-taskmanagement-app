/**
 * Temporary stub for package imports until packages are built
 */

// Temporary stub exports for integrations package
export interface CircuitBreakerStub {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export interface CircuitBreakerRegistryStub {
  get(name: string): CircuitBreakerStub;
}

export interface EmailConfigStub {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface SendEmailDataStub {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailServiceStub {
  sendEmail(data: SendEmailDataStub): Promise<boolean>;
}

// Stub implementations
export const CircuitBreaker: any = class {
  constructor(name: string, options?: any) {}
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
};

export const CircuitBreakerRegistry: any = class {
  static getInstance() {
    return new CircuitBreakerRegistry();
  }
  get(name: string) {
    return new CircuitBreaker(name);
  }
};

export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();

export const EmailService: any = class {
  async sendEmail(data: SendEmailDataStub): Promise<boolean> {
    console.log('Stub email service - would send:', data);
    return true;
  }
};

export const EmailConfig: any = {};
export const SendEmailData: any = {};
