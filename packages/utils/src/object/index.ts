/**
 * Object utility functions
 */

export class ObjectUtils {
  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => ObjectUtils.deepClone(item)) as unknown as T;
    
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = ObjectUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Deep merge objects
   */
  static deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (ObjectUtils.isObject(target) && ObjectUtils.isObject(source)) {
      for (const key in source) {
        if (ObjectUtils.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          ObjectUtils.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return ObjectUtils.deepMerge(target, ...sources);
  }

  /**
   * Check if value is an object
   */
  static isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get nested property value
   */
  static get<T>(obj: any, path: string, defaultValue?: T): T | undefined {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result == null || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }

    return result !== undefined ? result : defaultValue;
  }

  /**
   * Set nested property value
   */
  static set(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || !ObjectUtils.isObject(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Check if object has nested property
   */
  static has(obj: any, path: string): boolean {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return true;
  }

  /**
   * Remove nested property
   */
  static unset(obj: any, path: string): boolean {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    if (current != null && typeof current === 'object' && lastKey in current) {
      delete current[lastKey];
      return true;
    }

    return false;
  }

  /**
   * Get object keys with type safety
   */
  static keys<T extends Record<string, any>>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
  }

  /**
   * Get object values with type safety
   */
  static values<T extends Record<string, any>>(obj: T): T[keyof T][] {
    return Object.values(obj);
  }

  /**
   * Get object entries with type safety
   */
  static entries<T extends Record<string, any>>(obj: T): [keyof T, T[keyof T]][] {
    return Object.entries(obj) as [keyof T, T[keyof T]][];
  }

  /**
   * Pick specific properties from object
   */
  static pick<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  /**
   * Omit specific properties from object
   */
  static omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }

  /**
   * Check if object is empty
   */
  static isEmpty(obj: any): boolean {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
  }

  /**
   * Flatten nested object
   */
  static flatten(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (ObjectUtils.isObject(obj[key]) && !Array.isArray(obj[key])) {
          Object.assign(flattened, ObjectUtils.flatten(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  /**
   * Transform object values
   */
  static mapValues<T extends Record<string, any>, R>(
    obj: T,
    mapper: (value: T[keyof T], key: keyof T) => R
  ): Record<keyof T, R> {
    const result = {} as Record<keyof T, R>;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = mapper(obj[key], key);
      }
    }

    return result;
  }

  /**
   * Filter object by predicate
   */
  static filter<T extends Record<string, any>>(
    obj: T,
    predicate: (value: T[keyof T], key: keyof T) => boolean
  ): Partial<T> {
    const result = {} as Partial<T>;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && predicate(obj[key], key)) {
        result[key] = obj[key];
      }
    }

    return result;
  }

  /**
   * Invert object keys and values
   */
  static invert<T extends Record<string, string | number>>(obj: T): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[String(obj[key])] = key;
      }
    }

    return result;
  }
}