import { describe, expect, it } from 'vitest';
import { IdGenerator } from '../crypto/id-generator';

describe('IdGenerator', () => {
  it('should generate unique IDs', () => {
    const id1 = IdGenerator.generate();
    const id2 = IdGenerator.generate();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
  });

  it('should generate IDs with default length', () => {
    const id = IdGenerator.generate();
    expect(id.length).toBe(21); // nanoid default length
  });

  it('should generate IDs with custom length', () => {
    const customLength = 10;
    const id = IdGenerator.generateWithLength(customLength);
    expect(id.length).toBe(customLength);
  });
});
