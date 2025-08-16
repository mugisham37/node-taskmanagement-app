import { describe, expect, it } from 'vitest';
import { BaseValueObject } from '../value-object';

class TestValueObject extends BaseValueObject {
  constructor(
    public readonly value: string,
    public readonly count: number
  ) {
    super();
  }
}

describe('BaseValueObject', () => {
  describe('constructor', () => {
    it('should create a value object with the provided properties', () => {
      const vo = new TestValueObject('test', 5);
      
      expect(vo.value).toBe('test');
      expect(vo.count).toBe(5);
    });
  });

  describe('equals', () => {
    it('should return true when comparing value objects with the same properties', () => {
      const vo1 = new TestValueObject('test', 5);
      const vo2 = new TestValueObject('test', 5);
      
      expect(vo1.equals(vo2)).toBe(true);
    });

    it('should return false when comparing value objects with different properties', () => {
      const vo1 = new TestValueObject('test', 5);
      const vo2 = new TestValueObject('test', 6);
      
      expect(vo1.equals(vo2)).toBe(false);
    });

    it('should return false when comparing with null or different type', () => {
      const vo = new TestValueObject('test', 5);
      
      expect(vo.equals(null as any)).toBe(false);
      expect(vo.equals({} as any)).toBe(false);
    });

    it('should handle nested objects correctly', () => {
      class ComplexValueObject extends BaseValueObject {
        constructor(
          public readonly data: { name: string; items: number[] }
        ) {
          super();
        }
      }

      const vo1 = new ComplexValueObject({ name: 'test', items: [1, 2, 3] });
      const vo2 = new ComplexValueObject({ name: 'test', items: [1, 2, 3] });
      const vo3 = new ComplexValueObject({ name: 'test', items: [1, 2, 4] });
      
      expect(vo1.equals(vo2)).toBe(true);
      expect(vo1.equals(vo3)).toBe(false);
    });
  });
});