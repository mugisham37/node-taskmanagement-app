export interface IRepository<T, ID> {
    findById(id: ID): Promise<T | null>;
    findAll(): Promise<T[]>;
    save(entity: T): Promise<T>;
    update(id: ID, entity: Partial<T>): Promise<T>;
    delete(id: ID): Promise<void>;
}

export interface IUnitOfWork {
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

export interface IReadRepository<T, ID> {
    findById(id: ID): Promise<T | null>;
    findAll(): Promise<T[]>;
    findByCriteria(criteria: Record<string, any>): Promise<T[]>;
}

export interface IWriteRepository<T, ID> {
    save(entity: T): Promise<T>;
    update(id: ID, entity: Partial<T>): Promise<T>;
    delete(id: ID): Promise<void>;
}

export interface IQueryRepository<T> {
    findOne(criteria: Record<string, any>): Promise<T | null>;
    findMany(criteria: Record<string, any>): Promise<T[]>;
    count(criteria: Record<string, any>): Promise<number>;
}
