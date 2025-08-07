import { ITaskRepository } from '../../task-management/repositories/ITaskRepository';
import { IProjectRepository } from '../../task-management/repositories/IProjectRepository';
import { IWorkspaceRepository } from '../../task-management/repositories/IWorkspaceRepository';
import { IUserRepository } from '../../authentication/repositories/IUserRepository';

export interface IUnitOfWork {
  // Repository access
  readonly tasks: ITaskRepository;
  readonly projects: IProjectRepository;
  readonly workspaces: IWorkspaceRepository;
  readonly users: IUserRepository;

  // Transaction management
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  saveChanges(): Promise<void>;

  // State management
  isInTransaction(): boolean;
  hasChanges(): boolean;

  // Cleanup
  dispose(): Promise<void>;
}

export interface ITransactionScope {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export abstract class BaseUnitOfWork implements IUnitOfWork {
  protected _isInTransaction = false;
  protected _hasChanges = false;

  public abstract readonly tasks: ITaskRepository;
  public abstract readonly projects: IProjectRepository;
  public abstract readonly workspaces: IWorkspaceRepository;
  public abstract readonly users: IUserRepository;

  public abstract begin(): Promise<void>;
  public abstract commit(): Promise<void>;
  public abstract rollback(): Promise<void>;
  public abstract dispose(): Promise<void>;

  public async saveChanges(): Promise<void> {
    if (!this._isInTransaction) {
      await this.begin();
    }

    try {
      await this.commit();
      this._hasChanges = false;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  public isInTransaction(): boolean {
    return this._isInTransaction;
  }

  public hasChanges(): boolean {
    return this._hasChanges;
  }

  protected markAsChanged(): void {
    this._hasChanges = true;
  }

  protected setTransactionState(inTransaction: boolean): void {
    this._isInTransaction = inTransaction;
  }
}

// Transaction scope implementation
export class TransactionScope implements ITransactionScope {
  constructor(private unitOfWork: IUnitOfWork) {}

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.unitOfWork.begin();

    try {
      const result = await operation();
      await this.unitOfWork.commit();
      return result;
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }
  }
}

// Decorator for automatic transaction management
export function Transactional(unitOfWork: IUnitOfWork) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const scope = new TransactionScope(unitOfWork);
      return scope.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
