/**
 * Business Rules Enforcement Service
 * Utilizes all business rule constants from the constants folder
 */

import {
  TASK_BUSINESS_RULES,
  PROJECT_BUSINESS_RULES,
  USER_BUSINESS_RULES,
  WORKSPACE_BUSINESS_RULES,
  BUSINESS_ERROR_CODES,
  ERROR_SEVERITY
} from '../constants';
import { BusinessRuleViolationError } from '../errors/business-rule-violation-error';
import { InfrastructureError } from '../errors/infrastructure-error';

export interface BusinessRuleViolation {
  rule: string;
  code: string;
  message: string;
  severity: string;
  limit: number;
  current: number;
}

export class BusinessRulesService {
  /**
   * Validate task business rules
   */
  static validateTaskRules(data: {
    dependencies?: any[];
    projectTaskCount?: number;
    estimatedHours?: number;
  }): BusinessRuleViolation[] {
    const violations: BusinessRuleViolation[] = [];

    // Check max dependencies per task
    if (data.dependencies && data.dependencies.length > TASK_BUSINESS_RULES.MAX_DEPENDENCIES_PER_TASK) {
      violations.push({
        rule: 'MAX_DEPENDENCIES_PER_TASK',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Task cannot have more than ${TASK_BUSINESS_RULES.MAX_DEPENDENCIES_PER_TASK} dependencies`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: TASK_BUSINESS_RULES.MAX_DEPENDENCIES_PER_TASK,
        current: data.dependencies.length,
      });
    }

    // Check max tasks per project
    if (data.projectTaskCount && data.projectTaskCount >= TASK_BUSINESS_RULES.MAX_TASKS_PER_PROJECT) {
      violations.push({
        rule: 'MAX_TASKS_PER_PROJECT',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Project cannot have more than ${TASK_BUSINESS_RULES.MAX_TASKS_PER_PROJECT} tasks`,
        severity: ERROR_SEVERITY.HIGH,
        limit: TASK_BUSINESS_RULES.MAX_TASKS_PER_PROJECT,
        current: data.projectTaskCount,
      });
    }

    return violations;
  }

  /**
   * Validate project business rules
   */
  static validateProjectRules(data: {
    memberCount?: number;
    workspaceProjectCount?: number;
    managerCount?: number;
  }): BusinessRuleViolation[] {
    const violations: BusinessRuleViolation[] = [];

    // Check max members per project
    if (data.memberCount && data.memberCount > PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT) {
      violations.push({
        rule: 'MAX_MEMBERS_PER_PROJECT',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Project cannot have more than ${PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT} members`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: PROJECT_BUSINESS_RULES.MAX_MEMBERS_PER_PROJECT,
        current: data.memberCount,
      });
    }

    // Check max projects per workspace
    if (data.workspaceProjectCount && data.workspaceProjectCount >= PROJECT_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE) {
      violations.push({
        rule: 'MAX_PROJECTS_PER_WORKSPACE',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Workspace cannot have more than ${PROJECT_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE} projects`,
        severity: ERROR_SEVERITY.HIGH,
        limit: PROJECT_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE,
        current: data.workspaceProjectCount,
      });
    }

    // Check minimum managers per project
    if (data.managerCount !== undefined && data.managerCount < PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT) {
      violations.push({
        rule: 'MIN_MANAGERS_PER_PROJECT',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Project must have at least ${PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT} manager(s)`,
        severity: ERROR_SEVERITY.HIGH,
        limit: PROJECT_BUSINESS_RULES.MIN_MANAGERS_PER_PROJECT,
        current: data.managerCount,
      });
    }

    return violations;
  }

  /**
   * Validate user business rules
   */
  static validateUserRules(data: {
    workspaceCount?: number;
    projectCount?: number;
    taskCount?: number;
  }): BusinessRuleViolation[] {
    const violations: BusinessRuleViolation[] = [];

    // Check max workspaces per user
    if (data.workspaceCount && data.workspaceCount > USER_BUSINESS_RULES.MAX_WORKSPACES_PER_USER) {
      violations.push({
        rule: 'MAX_WORKSPACES_PER_USER',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `User cannot belong to more than ${USER_BUSINESS_RULES.MAX_WORKSPACES_PER_USER} workspaces`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: USER_BUSINESS_RULES.MAX_WORKSPACES_PER_USER,
        current: data.workspaceCount,
      });
    }

    // Check max projects per user
    if (data.projectCount && data.projectCount > USER_BUSINESS_RULES.MAX_PROJECTS_PER_USER) {
      violations.push({
        rule: 'MAX_PROJECTS_PER_USER',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `User cannot be assigned to more than ${USER_BUSINESS_RULES.MAX_PROJECTS_PER_USER} projects`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: USER_BUSINESS_RULES.MAX_PROJECTS_PER_USER,
        current: data.projectCount,
      });
    }

    // Check max tasks per user
    if (data.taskCount && data.taskCount > USER_BUSINESS_RULES.MAX_TASKS_PER_USER) {
      violations.push({
        rule: 'MAX_TASKS_PER_USER',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `User cannot be assigned to more than ${USER_BUSINESS_RULES.MAX_TASKS_PER_USER} tasks`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: USER_BUSINESS_RULES.MAX_TASKS_PER_USER,
        current: data.taskCount,
      });
    }

    return violations;
  }

  /**
   * Validate workspace business rules
   */
  static validateWorkspaceRules(data: {
    memberCount?: number;
    projectCount?: number;
    ownerCount?: number;
  }): BusinessRuleViolation[] {
    const violations: BusinessRuleViolation[] = [];

    // Check max members per workspace
    if (data.memberCount && data.memberCount > WORKSPACE_BUSINESS_RULES.MAX_MEMBERS_PER_WORKSPACE) {
      violations.push({
        rule: 'MAX_MEMBERS_PER_WORKSPACE',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Workspace cannot have more than ${WORKSPACE_BUSINESS_RULES.MAX_MEMBERS_PER_WORKSPACE} members`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: WORKSPACE_BUSINESS_RULES.MAX_MEMBERS_PER_WORKSPACE,
        current: data.memberCount,
      });
    }

    // Check max projects per workspace
    if (data.projectCount && data.projectCount > WORKSPACE_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE) {
      violations.push({
        rule: 'MAX_PROJECTS_PER_WORKSPACE',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Workspace cannot have more than ${WORKSPACE_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE} projects`,
        severity: ERROR_SEVERITY.HIGH,
        limit: WORKSPACE_BUSINESS_RULES.MAX_PROJECTS_PER_WORKSPACE,
        current: data.projectCount,
      });
    }

    // Check minimum owners per workspace
    if (data.ownerCount !== undefined && data.ownerCount < WORKSPACE_BUSINESS_RULES.MIN_OWNERS_PER_WORKSPACE) {
      violations.push({
        rule: 'MIN_OWNERS_PER_WORKSPACE',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Workspace must have at least ${WORKSPACE_BUSINESS_RULES.MIN_OWNERS_PER_WORKSPACE} owner(s)`,
        severity: ERROR_SEVERITY.CRITICAL,
        limit: WORKSPACE_BUSINESS_RULES.MIN_OWNERS_PER_WORKSPACE,
        current: data.ownerCount,
      });
    }

    // Check maximum owners per workspace
    if (data.ownerCount && data.ownerCount > WORKSPACE_BUSINESS_RULES.MAX_OWNERS_PER_WORKSPACE) {
      violations.push({
        rule: 'MAX_OWNERS_PER_WORKSPACE',
        code: BUSINESS_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        message: `Workspace cannot have more than ${WORKSPACE_BUSINESS_RULES.MAX_OWNERS_PER_WORKSPACE} owners`,
        severity: ERROR_SEVERITY.MEDIUM,
        limit: WORKSPACE_BUSINESS_RULES.MAX_OWNERS_PER_WORKSPACE,
        current: data.ownerCount,
      });
    }

    return violations;
  }

  /**
   * Check if a task is overdue based on business rules
   */
  static isTaskOverdue(dueDate: Date): boolean {
    const now = new Date();
    const diffInMs = now.getTime() - dueDate.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    return diffInDays > TASK_BUSINESS_RULES.OVERDUE_THRESHOLD_DAYS;
  }

  /**
   * Check if user session is expired based on business rules
   */
  static isUserSessionExpired(lastActivity: Date): boolean {
    const now = new Date();
    const diffInMs = now.getTime() - lastActivity.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    return diffInHours > USER_BUSINESS_RULES.SESSION_TIMEOUT_HOURS;
  }

  /**
   * Enforce business rules and throw error if violations exist
   */
  static enforceRules(violations: BusinessRuleViolation[]): void {
    if (violations.length > 0) {
      const criticalViolations = violations.filter(v => v.severity === ERROR_SEVERITY.CRITICAL);
      const highViolations = violations.filter(v => v.severity === ERROR_SEVERITY.HIGH);
      
      let message = 'Business rule violation(s) detected';

      if (criticalViolations.length > 0) {
        message = `Critical business rule violation: ${criticalViolations[0]!.message}`;
      } else if (highViolations.length > 0) {
        message = `High priority business rule violation: ${highViolations[0]!.message}`;
      }

      throw new BusinessRuleViolationError(
        message,
        violations,
        {
          totalViolations: violations.length,
          criticalCount: criticalViolations.length,
          highCount: highViolations.length,
        }
      );
    }
  }

  /**
   * Get all business rule constants for reference
   */
  static getBusinessRuleConstants() {
    return {
      task: TASK_BUSINESS_RULES,
      project: PROJECT_BUSINESS_RULES,
      user: USER_BUSINESS_RULES,
      workspace: WORKSPACE_BUSINESS_RULES,
    };
  }

  /**
   * Get business rule limits for a specific entity type
   */
  static getLimitsFor(entityType: 'task' | 'project' | 'user' | 'workspace') {
    switch (entityType) {
      case 'task':
        return TASK_BUSINESS_RULES;
      case 'project':
        return PROJECT_BUSINESS_RULES;
      case 'user':
        return USER_BUSINESS_RULES;
      case 'workspace':
        return WORKSPACE_BUSINESS_RULES;
      default:
        throw new InfrastructureError(`Unknown entity type: ${entityType}`);
    }
  }
}
