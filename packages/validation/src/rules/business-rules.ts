/**
 * Business validation rules
 */

export interface BusinessRule<T = any> {
  name: string;
  validate(data: T): Promise<boolean | string>;
  message?: string;
  priority?: number;
}

export class BusinessRuleValidator {
  private rules: Map<string, BusinessRule[]> = new Map();

  /**
   * Add a business rule for a specific entity type
   */
  addRule<T>(entityType: string, rule: BusinessRule<T>): void {
    if (!this.rules.has(entityType)) {
      this.rules.set(entityType, []);
    }
    this.rules.get(entityType)!.push(rule);
  }

  /**
   * Remove a business rule
   */
  removeRule(entityType: string, ruleName: string): void {
    const rules = this.rules.get(entityType);
    if (rules) {
      const index = rules.findIndex(rule => rule.name === ruleName);
      if (index > -1) {
        rules.splice(index, 1);
      }
    }
  }

  /**
   * Validate data against business rules
   */
  async validate<T>(entityType: string, data: T): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const rules = this.rules.get(entityType) || [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sort rules by priority (higher first)
    const sortedRules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
      try {
        const result = await rule.validate(data);
        
        if (result !== true) {
          const message = typeof result === 'string' ? result : rule.message || `Business rule '${rule.name}' failed`;
          
          if (rule.priority && rule.priority < 0) {
            warnings.push(message);
          } else {
            errors.push(message);
          }
        }
      } catch (error) {
        warnings.push(`Business rule '${rule.name}' failed to execute: ${(error as Error).message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get all rules for an entity type
   */
  getRules(entityType: string): BusinessRule[] {
    return this.rules.get(entityType) || [];
  }

  /**
   * Clear all rules for an entity type
   */
  clearRules(entityType?: string): void {
    if (entityType) {
      this.rules.delete(entityType);
    } else {
      this.rules.clear();
    }
  }
}

// Common business rules
export const CommonBusinessRules = {
  /**
   * Rule to check if a date is not in the past
   */
  notInPast: (fieldName: string): BusinessRule<any> => ({
    name: `${fieldName}_not_in_past`,
    validate: async (data: any) => {
      const date = new Date(data[fieldName]);
      const now = new Date();
      return date >= now || `${fieldName} cannot be in the past`;
    },
    message: `${fieldName} cannot be in the past`,
  }),

  /**
   * Rule to check if a date is not too far in the future
   */
  notTooFarInFuture: (fieldName: string, maxDays: number): BusinessRule<any> => ({
    name: `${fieldName}_not_too_far_future`,
    validate: async (data: any) => {
      const date = new Date(data[fieldName]);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + maxDays);
      return date <= maxDate || `${fieldName} cannot be more than ${maxDays} days in the future`;
    },
    message: `${fieldName} cannot be more than ${maxDays} days in the future`,
  }),

  /**
   * Rule to check if a value is unique (requires external validation)
   */
  unique: (fieldName: string, checkUnique: (value: any) => Promise<boolean>): BusinessRule<any> => ({
    name: `${fieldName}_unique`,
    validate: async (data: any) => {
      const isUnique = await checkUnique(data[fieldName]);
      return isUnique || `${fieldName} must be unique`;
    },
    message: `${fieldName} must be unique`,
  }),

  /**
   * Rule to check if a reference exists (requires external validation)
   */
  exists: (fieldName: string, checkExists: (value: any) => Promise<boolean>): BusinessRule<any> => ({
    name: `${fieldName}_exists`,
    validate: async (data: any) => {
      const exists = await checkExists(data[fieldName]);
      return exists || `${fieldName} does not exist`;
    },
    message: `${fieldName} does not exist`,
  }),

  /**
   * Rule to check if user has permission (requires external validation)
   */
  hasPermission: (permission: string, checkPermission: (userId: string, permission: string) => Promise<boolean>): BusinessRule<any> => ({
    name: `has_permission_${permission}`,
    validate: async (data: any) => {
      const hasPermission = await checkPermission(data.userId, permission);
      return hasPermission || `User does not have permission: ${permission}`;
    },
    message: `User does not have permission: ${permission}`,
  }),

  /**
   * Rule to check if a numeric value is within a range
   */
  withinRange: (fieldName: string, min: number, max: number): BusinessRule<any> => ({
    name: `${fieldName}_within_range`,
    validate: async (data: any) => {
      const value = data[fieldName];
      return (value >= min && value <= max) || `${fieldName} must be between ${min} and ${max}`;
    },
    message: `${fieldName} must be between ${min} and ${max}`,
  }),

  /**
   * Rule to check if an array has a specific length range
   */
  arrayLengthRange: (fieldName: string, min: number, max: number): BusinessRule<any> => ({
    name: `${fieldName}_array_length_range`,
    validate: async (data: any) => {
      const array = data[fieldName];
      if (!Array.isArray(array)) {
        return `${fieldName} must be an array`;
      }
      return (array.length >= min && array.length <= max) || 
        `${fieldName} must have between ${min} and ${max} items`;
    },
    message: `${fieldName} must have between ${min} and ${max} items`,
  }),

  /**
   * Rule to check if a string matches a pattern
   */
  matchesPattern: (fieldName: string, pattern: RegExp, patternName: string): BusinessRule<any> => ({
    name: `${fieldName}_matches_pattern`,
    validate: async (data: any) => {
      const value = data[fieldName];
      return pattern.test(value) || `${fieldName} must match ${patternName} format`;
    },
    message: `${fieldName} must match ${patternName} format`,
  }),

  /**
   * Rule to check if a value is one of allowed values
   */
  oneOf: (fieldName: string, allowedValues: any[]): BusinessRule<any> => ({
    name: `${fieldName}_one_of`,
    validate: async (data: any) => {
      const value = data[fieldName];
      return allowedValues.includes(value) || 
        `${fieldName} must be one of: ${allowedValues.join(', ')}`;
    },
    message: `${fieldName} must be one of allowed values`,
  }),

  /**
   * Rule to check if a conditional field is required
   */
  conditionallyRequired: (fieldName: string, condition: (data: any) => boolean): BusinessRule<any> => ({
    name: `${fieldName}_conditionally_required`,
    validate: async (data: any) => {
      if (condition(data)) {
        return data[fieldName] !== undefined && data[fieldName] !== null && data[fieldName] !== '' ||
          `${fieldName} is required when condition is met`;
      }
      return true;
    },
    message: `${fieldName} is required when condition is met`,
  }),

  /**
   * Rule to check if two fields match
   */
  fieldsMatch: (field1: string, field2: string): BusinessRule<any> => ({
    name: `${field1}_${field2}_match`,
    validate: async (data: any) => {
      return data[field1] === data[field2] || `${field1} and ${field2} must match`;
    },
    message: `${field1} and ${field2} must match`,
  }),
};

// Task-specific business rules
export const TaskBusinessRules = {
  /**
   * Rule to check if task can be assigned to user
   */
  canAssignToUser: (checkCanAssign: (taskId: string, userId: string) => Promise<boolean>): BusinessRule<any> => ({
    name: 'can_assign_to_user',
    validate: async (data: any) => {
      if (data.assigneeId) {
        const canAssign = await checkCanAssign(data.id, data.assigneeId);
        return canAssign || 'User cannot be assigned to this task';
      }
      return true;
    },
    message: 'User cannot be assigned to this task',
  }),

  /**
   * Rule to check if task status transition is valid
   */
  validStatusTransition: (getCurrentStatus: (taskId: string) => Promise<string>): BusinessRule<any> => ({
    name: 'valid_status_transition',
    validate: async (data: any) => {
      if (data.status && data.id) {
        const currentStatus = await getCurrentStatus(data.id);
        const validTransitions: Record<string, string[]> = {
          'TODO': ['IN_PROGRESS', 'CANCELLED'],
          'IN_PROGRESS': ['IN_REVIEW', 'TODO', 'CANCELLED', 'ON_HOLD'],
          'IN_REVIEW': ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'],
          'COMPLETED': [],
          'CANCELLED': ['TODO'],
          'ON_HOLD': ['IN_PROGRESS', 'CANCELLED'],
        };
        
        const allowed = validTransitions[currentStatus] || [];
        return allowed.includes(data.status) || 
          `Cannot transition from ${currentStatus} to ${data.status}`;
      }
      return true;
    },
    message: 'Invalid status transition',
  }),

  /**
   * Rule to check if due date is reasonable
   */
  reasonableDueDate: (): BusinessRule<any> => ({
    name: 'reasonable_due_date',
    validate: async (data: any) => {
      if (data.dueDate) {
        const dueDate = new Date(data.dueDate);
        const now = new Date();
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 2); // Max 2 years in future
        
        return (dueDate >= now && dueDate <= maxDate) || 
          'Due date must be between now and 2 years in the future';
      }
      return true;
    },
    message: 'Due date must be reasonable',
  }),
};

// Project-specific business rules
export const ProjectBusinessRules = {
  /**
   * Rule to check if project dates are valid
   */
  validProjectDates: (): BusinessRule<any> => ({
    name: 'valid_project_dates',
    validate: async (data: any) => {
      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        return startDate < endDate || 'Project end date must be after start date';
      }
      return true;
    },
    message: 'Project dates must be valid',
  }),

  /**
   * Rule to check if user can manage project
   */
  canManageProject: (checkCanManage: (userId: string, projectId: string) => Promise<boolean>): BusinessRule<any> => ({
    name: 'can_manage_project',
    validate: async (data: any) => {
      const canManage = await checkCanManage(data.userId, data.projectId);
      return canManage || 'User does not have permission to manage this project';
    },
    message: 'User does not have permission to manage this project',
  }),
};