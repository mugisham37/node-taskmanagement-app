/**
 * Array utility functions
 */

export class ArrayUtils {
  /**
   * Remove duplicates from array
   */
  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  /**
   * Remove duplicates by key
   */
  static uniqueBy<T>(array: T[], key: keyof T): T[] {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * Chunk array into smaller arrays
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Flatten nested arrays
   */
  static flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((acc, val) => {
      return acc.concat(Array.isArray(val) ? ArrayUtils.flatten(val) : val);
    }, []);
  }

  /**
   * Group array by key
   */
  static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Sort array by key
   */
  static sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Find intersection of arrays
   */
  static intersection<T>(...arrays: T[][]): T[] {
    if (arrays.length === 0) return [];
    return arrays.reduce((acc, array) => 
      acc.filter(item => array.includes(item))
    );
  }

  /**
   * Find difference between arrays
   */
  static difference<T>(array1: T[], array2: T[]): T[] {
    return array1.filter(item => !array2.includes(item));
  }

  /**
   * Shuffle array randomly
   */
  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get random item from array
   */
  static random<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Get random items from array
   */
  static randomItems<T>(array: T[], count: number): T[] {
    const shuffled = ArrayUtils.shuffle(array);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Check if array is empty
   */
  static isEmpty<T>(array: T[] | null | undefined): boolean {
    return !array || array.length === 0;
  }

  /**
   * Get first item or default
   */
  static first<T>(array: T[], defaultValue?: T): T | undefined {
    return array.length > 0 ? array[0] : defaultValue;
  }

  /**
   * Get last item or default
   */
  static last<T>(array: T[], defaultValue?: T): T | undefined {
    return array.length > 0 ? array[array.length - 1] : defaultValue;
  }

  /**
   * Sum numeric array
   */
  static sum(array: number[]): number {
    return array.reduce((sum, num) => sum + num, 0);
  }

  /**
   * Get average of numeric array
   */
  static average(array: number[]): number {
    if (array.length === 0) return 0;
    return ArrayUtils.sum(array) / array.length;
  }

  /**
   * Get min value from array
   */
  static min(array: number[]): number | undefined {
    if (array.length === 0) return undefined;
    return Math.min(...array);
  }

  /**
   * Get max value from array
   */
  static max(array: number[]): number | undefined {
    if (array.length === 0) return undefined;
    return Math.max(...array);
  }

  /**
   * Paginate array
   */
  static paginate<T>(array: T[], page: number, limit: number): {
    data: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  } {
    const offset = (page - 1) * limit;
    const data = array.slice(offset, offset + limit);
    const total = array.length;
    const pages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      pages
    };
  }
}