import { describe, expect, it } from 'vitest';
import { TaskId } from './task-id';

describe('TaskId Value Object', () => {
  describe('creation', () => {
    it('should create TaskId with valid string', () => {
      const id = 'task-123';
      const taskId = new TaskId(id);

      expect(taskId.value).toBe(id);
    });

    it('should throw error with empty string', () => {
      expect(() => {
        new TaskId('');
      }).toThrow('TaskId cannot be empty');
    });

    it('should throw error with null', () => {
      expect(() => {
        new TaskId(null as any);
      }).toThrow();
    });

    it('should throw error with undefined', () => {
      expect(() => {
        new TaskId(undefined as any);
      }).toThrow();
    });
  });

  describe('equality', () => {
    it('should be equal when values are the same', () => {
      const taskId1 = new TaskId('task-123');
      const taskId2 = new TaskId('task-123');

      expect(taskId1.equals(taskId2)).toBe(true);
    });

    it('should not be equal when values are different', () => {
      const taskId1 = new TaskId('task-123');
      const taskId2 = new TaskId('task-456');

      expect(taskId1.equals(taskId2)).toBe(false);
    });
  });

  describe('generation', () => {
    it('should generate unique TaskIds', () => {
      const taskId1 = TaskId.generate();
      const taskId2 = TaskId.generate();

      expect(taskId1.equals(taskId2)).toBe(false);
    });

    it('should generate TaskIds with proper format', () => {
      const taskId = TaskId.generate();

      expect(taskId.value).toMatch(/^task-[a-zA-Z0-9_-]+$/);
    });
  });

  describe('toString', () => {
    it('should return the value as string', () => {
      const id = 'task-123';
      const taskId = new TaskId(id);

      expect(taskId.toString()).toBe(id);
    });
  });
});