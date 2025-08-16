import { describe, expect, it } from 'vitest';
import { BaseEntity } from '../entity';

class TestEntity extends BaseEntity<string> {
  constructor(id: string, public readonly name: string) {
    super(id);
  }
}

describe('BaseEntity', () => {
  describe('constructor', () => {
    it('should create an entity with the provided id', () => {
      const entity = new TestEntity('test-id', 'Test Entity');
      
      expect(entity.id).toBe('test-id');
      expect(entity.name).toBe('Test Entity');
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept custom createdAt and updatedAt dates', () => {
      const createdAt = new Date('2023-01-01');
      const updatedAt = new Date('2023-01-02');
      const entity = new TestEntity('test-id', 'Test Entity');
      
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('equals', () => {
    it('should return true when comparing entities with the same id', () => {
      const entity1 = new TestEntity('same-id', 'Entity 1');
      const entity2 = new TestEntity('same-id', 'Entity 2');
      
      expect(entity1.equals(entity2)).toBe(true);
    });

    it('should return false when comparing entities with different ids', () => {
      const entity1 = new TestEntity('id-1', 'Entity 1');
      const entity2 = new TestEntity('id-2', 'Entity 2');
      
      expect(entity1.equals(entity2)).toBe(false);
    });

    it('should return false when comparing with null or different type', () => {
      const entity = new TestEntity('test-id', 'Entity');
      
      expect(entity.equals(null as any)).toBe(false);
      expect(entity.equals({} as any)).toBe(false);
    });
  });
});