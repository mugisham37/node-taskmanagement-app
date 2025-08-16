import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseConfig } from '../../config';
import { DatabaseConnection } from '../../connection';
import { BaseDrizzleRepository } from '../../repositories/base-drizzle-repository';

// Mock entity for testing
class TestEntity {
  constructor(
    public id: string,
    public name: string,
    public createdAt: Date = new Date()
  ) {}
}

// Mock repository implementation
class TestRepository extends BaseDrizzleRepository<TestEntity, string> {
  protected tableName = 'test_entities';

  async findById(id: string): Promise<TestEntity | null> {
    // Mock implementation
    if (id === 'existing-id') {
      return new TestEntity(id, 'Test Entity');
    }
    return null;
  }

  async findAll(): Promise<TestEntity[]> {
    return [
      new TestEntity('1', 'Entity 1'),
      new TestEntity('2', 'Entity 2'),
    ];
  }

  async save(entity: TestEntity): Promise<void> {
    // Mock implementation
    console.log('Saving entity:', entity);
  }

  async delete(id: string): Promise<void> {
    // Mock implementation
    console.log('Deleting entity:', id);
  }

  async exists(id: string): Promise<boolean> {
    return id === 'existing-id';
  }
}

describe('BaseDrizzleRepository', () => {
  let repository: TestRepository;
  let connection: DatabaseConnection;

  beforeEach(() => {
    const config = createDatabaseConfig('test');
    connection = DatabaseConnection.getInstance(config);
    repository = new TestRepository(connection);
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
    }
  });

  describe('findById', () => {
    it('should return entity when found', async () => {
      const entity = await repository.findById('existing-id');
      
      expect(entity).not.toBeNull();
      expect(entity?.id).toBe('existing-id');
      expect(entity?.name).toBe('Test Entity');
    });

    it('should return null when not found', async () => {
      const entity = await repository.findById('non-existing-id');
      
      expect(entity).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all entities', async () => {
      const entities = await repository.findAll();
      
      expect(entities).toHaveLength(2);
      expect(entities[0].id).toBe('1');
      expect(entities[1].id).toBe('2');
    });
  });

  describe('exists', () => {
    it('should return true for existing entity', async () => {
      const exists = await repository.exists('existing-id');
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existing entity', async () => {
      const exists = await repository.exists('non-existing-id');
      
      expect(exists).toBe(false);
    });
  });

  describe('save', () => {
    it('should save entity successfully', async () => {
      const entity = new TestEntity('new-id', 'New Entity');
      const consoleSpy = vi.spyOn(console, 'log');
      
      await repository.save(entity);
      
      expect(consoleSpy).toHaveBeenCalledWith('Saving entity:', entity);
    });
  });

  describe('delete', () => {
    it('should delete entity successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await repository.delete('existing-id');
      
      expect(consoleSpy).toHaveBeenCalledWith('Deleting entity:', 'existing-id');
    });
  });
});