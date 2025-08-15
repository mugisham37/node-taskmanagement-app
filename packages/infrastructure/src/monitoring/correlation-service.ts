export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface CorrelationService {
  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string;

  /**
   * Set correlation context for current execution
   */
  setContext(context: CorrelationContext): void;

  /**
   * Get current correlation context
   */
  getContext(): CorrelationContext | null;

  /**
   * Clear correlation context
   */
  clearContext(): void;

  /**
   * Run function with correlation context
   */
  runWithContext<T>(context: CorrelationContext, fn: () => T): T;

  /**
   * Run async function with correlation context
   */
  runWithContextAsync<T>(context: CorrelationContext, fn: () => Promise<T>): Promise<T>;
}

export class DefaultCorrelationService implements CorrelationService {
  private contextStorage = new Map<string, CorrelationContext>();
  private currentContext: CorrelationContext | null = null;

  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setContext(context: CorrelationContext): void {
    this.currentContext = context;
    this.contextStorage.set(context.correlationId, context);
  }

  getContext(): CorrelationContext | null {
    return this.currentContext;
  }

  clearContext(): void {
    if (this.currentContext) {
      this.contextStorage.delete(this.currentContext.correlationId);
      this.currentContext = null;
    }
  }

  runWithContext<T>(context: CorrelationContext, fn: () => T): T {
    const previousContext = this.currentContext;
    this.setContext(context);
    
    try {
      return fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  async runWithContextAsync<T>(context: CorrelationContext, fn: () => Promise<T>): Promise<T> {
    const previousContext = this.currentContext;
    this.setContext(context);
    
    try {
      return await fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  /**
   * Get correlation ID from current context
   */
  getCurrentCorrelationId(): string | null {
    return this.currentContext?.correlationId || null;
  }

  /**
   * Add metadata to current context
   */
  addMetadata(key: string, value: any): void {
    if (this.currentContext) {
      if (!this.currentContext.metadata) {
        this.currentContext.metadata = {};
      }
      this.currentContext.metadata[key] = value;
    }
  }

  /**
   * Create child context with new span
   */
  createChildContext(spanId?: string): CorrelationContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      spanId: spanId || this.generateSpanId(),
      correlationId: this.generateCorrelationId(),
    };
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}