import { describe, expect, it } from 'vitest';
import { ArrayUtils } from '../array';

describe('ArrayUtils', () => {
  describe('unique', () => {
    it('should remove duplicates', () => {
      expect(ArrayUtils.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(ArrayUtils.unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      expect(ArrayUtils.unique([])).toEqual([]);
    });
  });

  describe('uniqueBy', () => {
    it('should remove duplicates by key', () => {
      const items = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 1, name: 'John Doe' }
      ];
      const result = ArrayUtils.uniqueBy(items, 'id');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      expect(ArrayUtils.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(ArrayUtils.chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
      expect(ArrayUtils.chunk([], 2)).toEqual([]);
    });
  });

  describe('flatten', () => {
    it('should flatten nested arrays', () => {
      expect(ArrayUtils.flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
      expect(ArrayUtils.flatten([1, 2, 3])).toEqual([1, 2, 3]);
      expect(ArrayUtils.flatten([])).toEqual([]);
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 }
      ];
      const result = ArrayUtils.groupBy(items, 'category');
      expect(result['A']).toHaveLength(2);
      expect(result['B']).toHaveLength(1);
    });
  });

  describe('sortBy', () => {
    it('should sort by key', () => {
      const items = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      const result = ArrayUtils.sortBy(items, 'age');
      expect(result[0].age).toBe(25);
      expect(result[2].age).toBe(35);
    });

    it('should sort in descending order', () => {
      const items = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      const result = ArrayUtils.sortBy(items, 'age', 'desc');
      expect(result[0].age).toBe(35);
      expect(result[2].age).toBe(25);
    });
  });

  describe('intersection', () => {
    it('should find common elements', () => {
      expect(ArrayUtils.intersection([1, 2, 3], [2, 3, 4], [3, 4, 5])).toEqual([3]);
      expect(ArrayUtils.intersection([1, 2], [3, 4])).toEqual([]);
      expect(ArrayUtils.intersection()).toEqual([]);
    });
  });

  describe('difference', () => {
    it('should find different elements', () => {
      expect(ArrayUtils.difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
      expect(ArrayUtils.difference([1, 2], [1, 2])).toEqual([]);
    });
  });

  describe('shuffle', () => {
    it('should shuffle array', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = ArrayUtils.shuffle(original);
      expect(shuffled).toHaveLength(5);
      expect(shuffled).toContain(1);
      expect(shuffled).toContain(5);
      // Original should not be modified
      expect(original).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('random', () => {
    it('should return random item', () => {
      const array = [1, 2, 3, 4, 5];
      const random = ArrayUtils.random(array);
      expect(array).toContain(random);
      expect(ArrayUtils.random([])).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('should check if array is empty', () => {
      expect(ArrayUtils.isEmpty([])).toBe(true);
      expect(ArrayUtils.isEmpty(null)).toBe(true);
      expect(ArrayUtils.isEmpty(undefined)).toBe(true);
      expect(ArrayUtils.isEmpty([1])).toBe(false);
    });
  });

  describe('sum', () => {
    it('should calculate sum', () => {
      expect(ArrayUtils.sum([1, 2, 3, 4, 5])).toBe(15);
      expect(ArrayUtils.sum([])).toBe(0);
      expect(ArrayUtils.sum([-1, 1])).toBe(0);
    });
  });

  describe('average', () => {
    it('should calculate average', () => {
      expect(ArrayUtils.average([1, 2, 3, 4, 5])).toBe(3);
      expect(ArrayUtils.average([])).toBe(0);
      expect(ArrayUtils.average([10])).toBe(10);
    });
  });

  describe('paginate', () => {
    it('should paginate array', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = ArrayUtils.paginate(array, 2, 3);
      
      expect(result.data).toEqual([4, 5, 6]);
      expect(result.total).toBe(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(3);
      expect(result.pages).toBe(4);
    });
  });
});