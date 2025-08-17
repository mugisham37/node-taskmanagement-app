import { Project, Task, User } from '@taskmanagement/domain';
import { RealtimeManager } from '../../presentation/websocket/realtime-manager';
import { Container } from '../shared/container/Container';

/**
 * Service to integrate real-time updates with application services
 */
export class RealtimeIntegrationService {
  private realtimeManager: RealtimeManager;

  constructor(private container: Container) {
    this.realtimeManager = container.resolve<RealtimeManager>('RealtimeManager');
  }

  // Task-related real-time updates
  async broadcastTaskCreated(task: Task, createdBy: User): Promise<void> {
    await this.realtimeManager.broadcastTaskUpdate(task.id, {
      type: 'created',
      task,
      createdBy,
      timestamp: new Date(),
    });
  }

  async broadcastTaskUpdated(
    taskId: string,
    updates: Partial<Task>,
    updatedBy: User
  ): Promise<void> {
    await this.realtimeManager.broadcastTaskUpdate(taskId, {
      type: 'updated',
      updates,
      updatedBy,
      timestamp: new Date(),
    });
  }

  async broadcastTaskDeleted(taskId: string, deletedBy: User): Promise<void> {
    await this.realtimeManager.broadcastTaskUpdate(taskId, {
      type: 'deleted',
      deletedBy,
      timestamp: new Date(),
    });
  }

  async broadcastTaskStatusChanged(
    taskId: string,
    oldStatus: string,
    newStatus: string,
    changedBy: User
  ): Promise<void> {
    await this.realtimeManager.broadcastTaskUpdate(taskId, {
      type: 'status_changed',
      oldStatus,
      newStatus,
      changedBy,
      timestamp: new Date(),
    });
  }

  async broadcastTaskAssigned(taskId: string, assignee: User, assignedBy: User): Promise<void> {
    await this.realtimeManager.broadcastTaskUpdate(taskId, {
      type: 'assigned',
      assignee,
      assignedBy,
      timestamp: new Date(),
    });
  }

  // Project-related real-time updates
  async broadcastProjectCreated(project: Project, createdBy: User): Promise<void> {
    await this.realtimeManager.broadcastProjectUpdate(project.id, {
      type: 'created',
      project,
      createdBy,
      timestamp: new Date(),
    });
  }

  async broadcastProjectUpdated(
    projectId: string,
    updates: Partial<Project>,
    updatedBy: User
  ): Promise<void> {
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'updated',
      updates,
      updatedBy,
      timestamp: new Date(),
    });
  }

  async broadcastProjectDeleted(projectId: string, deletedBy: User): Promise<void> {
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'deleted',
      deletedBy,
      timestamp: new Date(),
    });
  }

  async broadcastProjectMemberAdded(projectId: string, member: User, addedBy: User): Promise<void> {
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'member_added',
      member,
      addedBy,
      timestamp: new Date(),
    });
  }

  async broadcastProjectMemberRemoved(
    projectId: string,
    member: User,
    removedBy: User
  ): Promise<void> {
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'member_removed',
      member,
      removedBy,
      timestamp: new Date(),
    });
  }

  // Utility methods for room management
  async notifyUserJoinedProject(projectId: string, user: User): Promise<void> {
    // This would be called when a user joins a project room
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'user_joined',
      user,
      timestamp: new Date(),
    });
  }

  async notifyUserLeftProject(projectId: string, user: User): Promise<void> {
    // This would be called when a user leaves a project room
    await this.realtimeManager.broadcastProjectUpdate(projectId, {
      type: 'user_left',
      user,
      timestamp: new Date(),
    });
  }

  // Get real-time statistics
  getRealtimeStats() {
    return {
      connectionCount: this.realtimeManager.getConnectionCount(),
      roomCount: this.realtimeManager.getRoomCount(),
    };
  }

  // Get users in a specific room
  getRoomUsers(roomId: string): User[] {
    return this.realtimeManager.getRoomUsers(roomId);
  }

  // Get rooms a user is in
  getUserRooms(userId: string): string[] {
    return this.realtimeManager.getUserRooms(userId);
  }
}

