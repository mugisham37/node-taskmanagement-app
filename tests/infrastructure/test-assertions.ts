import { expect } from 'vitest';
import { User, Workspace, Project, Task, TaskComment } from '@prisma/client';

/**
 * Custom assertion helpers for testing domain entities and business logic
 */
export class TestAssertions {
  /**
   * Assert that a user entity has all required properties and valid values
   */
  static assertValidUser(user: User): void {
    expect(user).toBeDefined();
    expect(user.id).toBeTruthy();
    expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(user.name).toBeTruthy();
    expect(user.passwordHash).toBeTruthy();
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(typeof user.mfaEnabled).toBe('boolean');
    expect(Array.isArray(user.backupCodes)).toBe(true);
    expect(typeof user.failedLoginAttempts).toBe('number');
    expect(user.failedLoginAttempts).toBeGreaterThanOrEqual(0);
    expect(typeof user.riskScore).toBe('number');
    expect(user.riskScore).toBeGreaterThanOrEqual(0);
    expect(user.riskScore).toBeLessThanOrEqual(1);
    expect(user.timezone).toBeTruthy();
    expect(user.workHours).toBeDefined();
    expect(user.taskViewPreferences).toBeDefined();
    expect(user.notificationSettings).toBeDefined();
    expect(user.productivitySettings).toBeDefined();
    expect(user.avatarColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(user.workspacePreferences).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  }

  /**
   * Assert that a workspace entity has all required properties and valid values
   */
  static assertValidWorkspace(workspace: Workspace): void {
    expect(workspace).toBeDefined();
    expect(workspace.id).toBeTruthy();
    expect(workspace.name).toBeTruthy();
    expect(workspace.slug).toBeTruthy();
    expect(workspace.slug).toMatch(/^[a-z0-9-]+$/);
    expect(workspace.ownerId).toBeTruthy();
    expect(['free', 'pro', 'enterprise']).toContain(workspace.subscriptionTier);
    expect(workspace.settings).toBeDefined();
    expect(workspace.branding).toBeDefined();
    expect(workspace.securitySettings).toBeDefined();
    expect(typeof workspace.isActive).toBe('boolean');
    expect(typeof workspace.memberLimit).toBe('number');
    expect(workspace.memberLimit).toBeGreaterThan(0);
    expect(typeof workspace.projectLimit).toBe('number');
    expect(workspace.projectLimit).toBeGreaterThan(0);
    expect(typeof workspace.storageLimitGb).toBe('number');
    expect(workspace.storageLimitGb).toBeGreaterThan(0);
    expect(workspace.createdAt).toBeInstanceOf(Date);
    expect(workspace.updatedAt).toBeInstanceOf(Date);
  }

  /**
   * Assert that a project entity has all required properties and valid values
   */
  static assertValidProject(project: Project): void {
    expect(project).toBeDefined();
    expect(project.id).toBeTruthy();
    expect(project.workspaceId).toBeTruthy();
    expect(project.name).toBeTruthy();
    expect(project.ownerId).toBeTruthy();
    expect(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).toContain(
      project.status
    );
    expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(project.priority);
    expect(project.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(project.settings).toBeDefined();
    expect(typeof project.isArchived).toBe('boolean');
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
  }

  /**
   * Assert that a task entity has all required properties and valid values
   */
  static assertValidTask(task: Task): void {
    expect(task).toBeDefined();
    expect(task.id).toBeTruthy();
    expect(task.workspaceId).toBeTruthy();
    expect(task.projectId).toBeTruthy();
    expect(task.title).toBeTruthy();
    expect(task.creatorId).toBeTruthy();
    expect(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).toContain(
      task.status
    );
    expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(task.priority);
    expect(Array.isArray(task.tags)).toBe(true);
    expect(Array.isArray(task.labels)).toBe(true);
    expect(Array.isArray(task.attachments)).toBe(true);
    expect(Array.isArray(task.externalLinks)).toBe(true);
    expect(Array.isArray(task.watchers)).toBe(true);
    expect(task.customFields).toBeDefined();
    expect(typeof task.position).toBe('number');
    expect(task.position).toBeGreaterThanOrEqual(0);
    expect(task.lastActivityAt).toBeInstanceOf(Date);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);

    // Status-specific assertions
    if (task.status === 'DONE') {
      expect(task.completedAt).toBeInstanceOf(Date);
    }

    // Estimated hours validation
    if (task.estimatedHours !== null) {
      expect(task.estimatedHours).toBeGreaterThan(0);
    }

    // Actual hours validation
    if (task.actualHours !== null) {
      expect(task.actualHours).toBeGreaterThan(0);
    }

    // Story points validation
    if (task.storyPoints !== null) {
      expect(task.storyPoints).toBeGreaterThan(0);
      expect(task.storyPoints).toBeLessThanOrEqual(100);
    }
  }

  /**
   * Assert that a task comment has all required properties and valid values
   */
  static assertValidTaskComment(comment: TaskComment): void {
    expect(comment).toBeDefined();
    expect(comment.id).toBeTruthy();
    expect(comment.taskId).toBeTruthy();
    expect(comment.authorId).toBeTruthy();
    expect(comment.content).toBeTruthy();
    expect(Array.isArray(comment.mentions)).toBe(true);
    expect(Array.isArray(comment.attachments)).toBe(true);
    expect(typeof comment.isInternal).toBe('boolean');
    expect(comment.createdAt).toBeInstanceOf(Date);
    expect(comment.updatedAt).toBeInstanceOf(Date);
  }

  /**
   * Assert that two entities have the same ID
   */
  static assertSameEntity<T extends { id: string }>(
    entity1: T,
    entity2: T
  ): void {
    expect(entity1.id).toBe(entity2.id);
  }

  /**
   * Assert that an entity collection contains a specific entity
   */
  static assertContainsEntity<T extends { id: string }>(
    collection: T[],
    entity: T
  ): void {
    const found = collection.find(item => item.id === entity.id);
    expect(found).toBeDefined();
  }

  /**
   * Assert that an entity collection does not contain a specific entity
   */
  static assertNotContainsEntity<T extends { id: string }>(
    collection: T[],
    entity: T
  ): void {
    const found = collection.find(item => item.id === entity.id);
    expect(found).toBeUndefined();
  }

  /**
   * Assert that a collection has the expected length
   */
  static assertCollectionLength<T>(
    collection: T[],
    expectedLength: number
  ): void {
    expect(collection).toHaveLength(expectedLength);
  }

  /**
   * Assert that a collection is sorted by a specific property
   */
  static assertSortedBy<T>(
    collection: T[],
    property: keyof T,
    order: 'asc' | 'desc' = 'asc'
  ): void {
    for (let i = 1; i < collection.length; i++) {
      const current = collection[i][property];
      const previous = collection[i - 1][property];

      if (order === 'asc') {
        expect(current >= previous).toBe(true);
      } else {
        expect(current <= previous).toBe(true);
      }
    }
  }

  /**
   * Assert that a date is within a specific range
   */
  static assertDateInRange(date: Date, start: Date, end: Date): void {
    expect(date.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(date.getTime()).toBeLessThanOrEqual(end.getTime());
  }

  /**
   * Assert that a date is recent (within the last minute)
   */
  static assertRecentDate(date: Date): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    TestAssertions.assertDateInRange(date, oneMinuteAgo, now);
  }

  /**
   * Assert that an API response has the expected structure
   */
  static assertApiResponse(
    response: any,
    expectedStatus: number,
    expectedProperties?: string[]
  ): void {
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.body).toBeDefined();

    if (expectedProperties) {
      expectedProperties.forEach(property => {
        expect(response.body).toHaveProperty(property);
      });
    }
  }

  /**
   * Assert that an API error response has the expected structure
   */
  static assertApiErrorResponse(
    response: any,
    expectedStatus: number,
    expectedErrorCode?: string
  ): void {
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.body).toBeDefined();
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('timestamp');

    if (expectedErrorCode) {
      expect(response.body.error.code).toBe(expectedErrorCode);
    }
  }

  /**
   * Assert that a validation error has the expected structure
   */
  static assertValidationError(error: any, expectedField?: string): void {
    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
    expect(error.validationErrors).toBeDefined();
    expect(Array.isArray(error.validationErrors)).toBe(true);

    if (expectedField) {
      const fieldError = error.validationErrors.find(
        (e: any) => e.field === expectedField
      );
      expect(fieldError).toBeDefined();
    }
  }

  /**
   * Assert that a domain event has the expected structure
   */
  static assertDomainEvent(
    event: any,
    expectedType: string,
    expectedAggregateId?: string
  ): void {
    expect(event).toBeDefined();
    expect(event.type).toBe(expectedType);
    expect(event.aggregateId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBeGreaterThan(0);

    if (expectedAggregateId) {
      expect(event.aggregateId).toBe(expectedAggregateId);
    }
  }

  /**
   * Assert that a cache key follows the expected pattern
   */
  static assertCacheKey(key: string, expectedPattern: RegExp): void {
    expect(key).toMatch(expectedPattern);
  }

  /**
   * Assert that a JWT token has the expected structure
   */
  static assertJwtToken(
    token: string,
    expectedPayloadProperties?: string[]
  ): void {
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    if (expectedPayloadProperties) {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      expectedPayloadProperties.forEach(property => {
        expect(payload).toHaveProperty(property);
      });
    }
  }

  /**
   * Assert that a webhook payload has the expected structure
   */
  static assertWebhookPayload(payload: any, expectedEvent: string): void {
    expect(payload).toBeDefined();
    expect(payload.event).toBe(expectedEvent);
    expect(payload.timestamp).toBeTruthy();
    expect(payload.data).toBeDefined();
    expect(payload.signature).toBeTruthy();
  }

  /**
   * Assert that a notification has the expected structure
   */
  static assertNotification(
    notification: any,
    expectedType: string,
    expectedRecipient?: string
  ): void {
    expect(notification).toBeDefined();
    expect(notification.type).toBe(expectedType);
    expect(notification.title).toBeTruthy();
    expect(notification.message).toBeTruthy();
    expect(notification.createdAt).toBeInstanceOf(Date);

    if (expectedRecipient) {
      expect(notification.recipientId).toBe(expectedRecipient);
    }
  }

  /**
   * Assert that a file upload result has the expected structure
   */
  static assertFileUpload(result: any, expectedMimeType?: string): void {
    expect(result).toBeDefined();
    expect(result.url).toBeTruthy();
    expect(result.key).toBeTruthy();
    expect(result.size).toBeGreaterThan(0);
    expect(result.uploadedAt).toBeInstanceOf(Date);

    if (expectedMimeType) {
      expect(result.mimeType).toBe(expectedMimeType);
    }
  }

  /**
   * Assert that a search result has the expected structure
   */
  static assertSearchResult(result: any, expectedTotalCount?: number): void {
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
    expect(result.page).toBeGreaterThan(0);
    expect(result.pageSize).toBeGreaterThan(0);

    if (expectedTotalCount !== undefined) {
      expect(result.totalCount).toBe(expectedTotalCount);
    }
  }

  /**
   * Assert that a performance metric is within acceptable bounds
   */
  static assertPerformanceMetric(
    metric: number,
    maxValue: number,
    metricName: string
  ): void {
    expect(metric).toBeLessThanOrEqual(maxValue);
    if (metric > maxValue) {
      console.warn(
        `Performance warning: ${metricName} (${metric}) exceeded threshold (${maxValue})`
      );
    }
  }

  /**
   * Assert that a memory usage is within acceptable bounds
   */
  static assertMemoryUsage(usageBytes: number, maxBytes: number): void {
    expect(usageBytes).toBeLessThanOrEqual(maxBytes);
    const usageMB = Math.round(usageBytes / 1024 / 1024);
    const maxMB = Math.round(maxBytes / 1024 / 1024);

    if (usageBytes > maxBytes) {
      console.warn(
        `Memory usage warning: ${usageMB}MB exceeded threshold (${maxMB}MB)`
      );
    }
  }
}

/**
 * Custom matchers for Vitest
 */
export const customMatchers = {
  toBeValidUser(received: User) {
    try {
      TestAssertions.assertValidUser(received);
      return { pass: true, message: () => 'User is valid' };
    } catch (error) {
      return {
        pass: false,
        message: () => `User is invalid: ${error.message}`,
      };
    }
  },

  toBeValidWorkspace(received: Workspace) {
    try {
      TestAssertions.assertValidWorkspace(received);
      return { pass: true, message: () => 'Workspace is valid' };
    } catch (error) {
      return {
        pass: false,
        message: () => `Workspace is invalid: ${error.message}`,
      };
    }
  },

  toBeValidProject(received: Project) {
    try {
      TestAssertions.assertValidProject(received);
      return { pass: true, message: () => 'Project is valid' };
    } catch (error) {
      return {
        pass: false,
        message: () => `Project is invalid: ${error.message}`,
      };
    }
  },

  toBeValidTask(received: Task) {
    try {
      TestAssertions.assertValidTask(received);
      return { pass: true, message: () => 'Task is valid' };
    } catch (error) {
      return {
        pass: false,
        message: () => `Task is invalid: ${error.message}`,
      };
    }
  },

  toBeRecentDate(received: Date) {
    try {
      TestAssertions.assertRecentDate(received);
      return { pass: true, message: () => 'Date is recent' };
    } catch (error) {
      return {
        pass: false,
        message: () => `Date is not recent: ${error.message}`,
      };
    }
  },
};
