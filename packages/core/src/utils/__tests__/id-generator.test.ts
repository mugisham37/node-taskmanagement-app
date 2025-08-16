import { describe, expect, it } from 'vitest';
import { IdGenerator } from '../id-generator';

describe('IdGenerator', () => {
  describe('generate', () => {
    it('should generate a valid UUID', () => {
      const id = IdGenerator.generate();
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = IdGenerator.generate();
      const id2 = IdGenerator.generate();
      
      expect(id1).not.toBe(id2);
    });

    it('should generate multiple unique IDs', () => {
      const ids = new Set();
      const count = 1000;
      
      for (let i = 0; i < count; i++) {
        ids.add(IdGenerator.generate());
      }
      
      expect(ids.size).toBe(count);
    });
  });

  describe('generateShort', () => {
    it('should generate a short ID', () => {
      const id = IdGenerator.generateShort();
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeLessThan(36); // Shorter than UUID
    });

    it('should generate unique short IDs', () => {
      const id1 = IdGenerator.generateShort();
      const id2 = IdGenerator.generateShort();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValid', () => {
    it('should return true for valid UUIDs', () => {
      const validId = IdGenerator.generate();
      
      expect(IdGenerator.isValid(validId)).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(IdGenerator.isValid('invalid-id')).toBe(false);
      expect(IdGenerator.isValid('')).toBe(false);
      expect(IdGenerator.isValid('123')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(IdGenerator.isValid(null as any)).toBe(false);
      expect(IdGenerator.isValid(undefined as any)).toBe(false);
    });
  });
});