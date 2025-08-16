import { describe, expect, it } from 'vitest';
import { ValidationService } from '../validation-service';

describe('ValidationService', () => {
  describe('validateTask', () => {
    it('should validate valid task data', () => {
      const taskData = {
        title: 'Valid Task Title',
        description: 'Valid description',
        estimatedHours: 5,
        actualHours: 3,
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject task with empty title', () => {
      const taskData = {
        title: '',
        description: 'Valid description',
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('title');
      expect(result.errors[0].code).toBe('VALUE_TOO_SHORT');
    });

    it('should reject task with title too long', () => {
      const taskData = {
        title: 'a'.repeat(256),
        description: 'Valid description',
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('title');
      expect(result.errors[0].code).toBe('VALUE_TOO_LONG');
    });

    it('should reject task with description too long', () => {
      const taskData = {
        title: 'Valid Title',
        description: 'a'.repeat(5001),
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('description');
      expect(result.errors[0].code).toBe('VALUE_TOO_LONG');
    });

    it('should reject task with invalid estimated hours', () => {
      const taskData = {
        title: 'Valid Title',
        estimatedHours: -1,
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('estimatedHours');
      expect(result.errors[0].code).toBe('VALUE_OUT_OF_RANGE');
    });

    it('should reject task with estimated hours too high', () => {
      const taskData = {
        title: 'Valid Title',
        estimatedHours: 1000,
      };

      const result = ValidationService.validateTask(taskData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('estimatedHours');
      expect(result.errors[0].code).toBe('VALUE_OUT_OF_RANGE');
    });
  });

  describe('validateProject', () => {
    it('should validate valid project data', () => {
      const projectData = {
        name: 'Valid Project Name',
        description: 'Valid description',
      };

      const result = ValidationService.validateProject(projectData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject project with empty name', () => {
      const projectData = {
        name: '',
        description: 'Valid description',
      };

      const result = ValidationService.validateProject(projectData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].code).toBe('VALUE_TOO_SHORT');
    });

    it('should reject project with name too long', () => {
      const projectData = {
        name: 'a'.repeat(256),
        description: 'Valid description',
      };

      const result = ValidationService.validateProject(projectData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].code).toBe('VALUE_TOO_LONG');
    });
  });

  describe('validateUser', () => {
    it('should validate valid user data', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPassword123!',
      };

      const result = ValidationService.validateUser(userData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject user with invalid email', () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'ValidPassword123!',
      };

      const result = ValidationService.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
      expect(result.errors[0].code).toBe('INVALID_EMAIL');
    });

    it('should reject user with password too short', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
      };

      const result = ValidationService.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('password');
      expect(result.errors[0].code).toBe('VALUE_TOO_SHORT');
    });
  });

  describe('validateWorkspace', () => {
    it('should validate valid workspace data', () => {
      const workspaceData = {
        name: 'Valid Workspace',
        description: 'Valid description',
      };

      const result = ValidationService.validateWorkspace(workspaceData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject workspace with empty name', () => {
      const workspaceData = {
        name: '',
        description: 'Valid description',
      };

      const result = ValidationService.validateWorkspace(workspaceData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].code).toBe('VALUE_TOO_SHORT');
    });
  });

  describe('validateAndThrow', () => {
    it('should not throw for valid data', () => {
      const taskData = {
        title: 'Valid Task Title',
        description: 'Valid description',
      };

      expect(() => {
        ValidationService.validateAndThrow(taskData, ValidationService.validateTask);
      }).not.toThrow();
    });

    it('should throw ValidationError for invalid data', () => {
      const taskData = {
        title: '',
        description: 'Valid description',
      };

      expect(() => {
        ValidationService.validateAndThrow(taskData, ValidationService.validateTask);
      }).toThrow();
    });
  });

  describe('getValidationConstants', () => {
    it('should return all validation constants', () => {
      const constants = ValidationService.getValidationConstants();

      expect(constants).toHaveProperty('task');
      expect(constants).toHaveProperty('project');
      expect(constants).toHaveProperty('user');
      expect(constants).toHaveProperty('workspace');
    });
  });
});