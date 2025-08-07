import { Specification, QueryExpression } from './specification';

/**
 * Base repository interface with common CRUD operations
 */
export interface IRepository<T, TId> {
  findById(id: TId): Promise<T | null>;
  findByIds(ids: TId[]): Promise<T[]>;
  findOne(specification: Specification<T>): Promise<T | null>;
  findMany(specification: Specification<T>): Promise<T[]>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  saveMany(entities: T[]): Promise<T[]>;
  delete(id: TId): Promise<void>;
  deleteMany(ids: TId[]): Promise<void>;
  count(specification?: Specification<T>): Promise<number>;
  exists(id: TId): Promise<boolean>;
}

/**
 * Unit of Work pattern for managing transactions across multiple repositories
 */
export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  saveChanges(): Promise<void>;
  isInTransaction(): boolean;

  // Repository access
  users: IUserRepository;
  workspaces: IWorkspaceRepository;
  projects: IProjectRepository;
  tasks: ITaskRepository;
  teams: ITeamRepository;
  comments: ICommentRepository;
  timeEntries: ITimeEntryRepository;
  files: IFileRepository;
  notifications: INotificationRepository;
  activities: IActivityRepository;
  auditLogs: IAuditLogRepository;
}

/**
 * Repository factory for creating repository instances
 */
export interface IRepositoryFactory {
  createUserRepository(): IUserRepository;
  createWorkspaceRepository(): IWorkspaceRepository;
  createProjectRepository(): IProjectRepository;
  createTaskRepository(): ITaskRepository;
  createTeamRepository(): ITeamRepository;
  createCommentRepository(): ICommentRepository;
  createTimeEntryRepository(): ITimeEntryRepository;
  createFileRepository(): IFileRepository;
  createNotificationRepository(): INotificationRepository;
  createActivityRepository(): IActivityRepository;
  createAuditLogRepository(): IAuditLogRepository;
  createUnitOfWork(): IUnitOfWork;
}

/**
 * Base repository implementation with common functionality
 */
export abstract class BaseRepository<T, TId> implements IRepository<T, TId> {
  abstract findById(id: TId): Promise<T | null>;
  abstract findByIds(ids: TId[]): Promise<T[]>;
  abstract save(entity: T): Promise<T>;
  abstract delete(id: TId): Promise<void>;

  async findOne(specification: Specification<T>): Promise<T | null> {
    const results = await this.findMany(specification);
    return results.length > 0 ? results[0] : null;
  }

  abstract findMany(specification: Specification<T>): Promise<T[]>;
  abstract findAll(): Promise<T[]>;

  async saveMany(entities: T[]): Promise<T[]> {
    const results: T[] = [];
    for (const entity of entities) {
      results.push(await this.save(entity));
    }
    return results;
  }

  async deleteMany(ids: TId[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  abstract count(specification?: Specification<T>): Promise<number>;

  async exists(id: TId): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  protected buildQuery(specification: Specification<T>): QueryExpression {
    return specification.toQuery();
  }
}

// Forward declarations for repository interfaces
export interface IUserRepository extends IRepository<any, any> {}
export interface IWorkspaceRepository extends IRepository<any, any> {}
export interface IProjectRepository extends IRepository<any, any> {}
export interface ITaskRepository extends IRepository<any, any> {}
export interface ITeamRepository extends IRepository<any, any> {}
export interface ICommentRepository extends IRepository<any, any> {}
export interface ITimeEntryRepository extends IRepository<any, any> {}
export interface IFileRepository extends IRepository<any, any> {}
export interface INotificationRepository extends IRepository<any, any> {}
export interface IActivityRepository extends IRepository<any, any> {}
export interface IAuditLogRepository extends IRepository<any, any> {}
