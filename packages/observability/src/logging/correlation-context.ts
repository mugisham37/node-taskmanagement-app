import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  workspaceId?: string;
  userRole?: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: any;
}

export class CorrelationContextManager {
  private static instance: CorrelationContextManager | null = null;
  private contextStorage: AsyncLocalStorage<CorrelationContext>;

  private constructor() {
    this.contextStorage = new AsyncLocalStorage();
  }

  public static getInstance(): CorrelationContextManager {
    if (!CorrelationContextManager.instance) {
      CorrelationContextManager.instance = new CorrelationContextManager();
    }
    return CorrelationContextManager.instance;
  }

  public setContext(context: Partial<CorrelationContext>): void {
    const currentContext = this.getContext() || { correlationId: uuidv4() };
    const newContext = { ...currentContext, ...context };
    this.contextStorage.enterWith(newContext);
  }

  public getContext(): CorrelationContext | undefined {
    return this.contextStorage.getStore();
  }

  public getCorrelationId(): string {
    const context = this.getContext();
    return context?.correlationId || uuidv4();
  }

  public runWithContext<T>(context: Partial<CorrelationContext>, fn: () => T): T {
    const fullContext: CorrelationContext = {
      correlationId: uuidv4(),
      ...context,
    };
    return this.contextStorage.run(fullContext, fn);
  }

  public runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
    return this.runWithContext({ correlationId }, fn);
  }

  public clearContext(): void {
    this.contextStorage.enterWith(undefined as any);
  }
}

// Export singleton instance
export const correlationContext = CorrelationContextManager.getInstance();

export default CorrelationContextManager;