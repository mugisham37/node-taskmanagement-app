import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '@/domain/entities/project';
import { ProjectId } from '@/domain/value-objects/project-id';
import { WorkspaceId } from '@/domain/value-objects/workspace-id';
import { UserId } from '@/domain/value-objects/user-id';
import { ProjectStatus } from '@/domain/value-objects/project-status';
import { TestDataFactory } from '../../../helpers/test-helpers';

describe('Project Entity', () => {
  let projectId: ProjectId;
  let workspaceId: WorkspaceId;
  let ownerId: UserId;
  let projectStatus: ProjectStatus;

  beforeEach(() => {
    projectId = new ProjectId('project-123');
    workspaceId = new WorkspaceId('workspace-123');
    ownerId = new UserId('user-123');
    projectStatus = new ProjectStatus('ACTIVE');
  });

  describe('Constructor', () => {
    it('should create a project with valid properties', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const project = new Project(
        projectId,
        workspaceId,
        ownerId,
        'Test Project',
        'Project description',
        projectStatus,
        startDate,
        endDate
      );

      expect(project.getId()).toBe(projectId);
      expect(project.getWorkspaceId()).toBe(workspaceId);
      expect(project.getOwnerId()).toBe(ownerId);
      expect(project.getName()).toBe('Test Project');
      expect(project.getDescription()).toBe('Project description');
      expect(project.getStatus()).toBe(projectStatus);
      expect(project.getStartDate()).toBe(startDate);
      expect(project.getEndDate()).toBe(endDate);
    });

    it('should throw error for empty name', () => {
      expect(() => {
        new Project(
          projectId,
          workspaceId,
          ownerId,
          '',
          'Project description',
          projectStatus,
          new Date(),
          new Date()
        );
      }).toThrow();
    });

    it('should throw error when end date is before start date', () => {
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01');

      expect(() => {
        new Project(
          projectId,
          workspaceId,
          ownerId,
          'Test Project',
          'Project description',
          projectStatus,
          startDate,
          endDate
        );
      }).toThrow();
    });
  });

  describe('Business Logic', () => {
    let project: Project;

    beforeEach(() => {
      project = TestDataFactory.createProject(workspaceId, ownerId);
    });

    it('should activate project', () => {
      project.activate();
      expect(project.getStatus().getValue()).toBe('ACTIVE');
    });

    it('should complete project', () => {
      project.complete();
      expect(project.getStatus().getValue()).toBe('COMPLETED');
    });

    it('should archive project', () => {
      project.archive();
      expect(project.getStatus().getValue()).toBe('ARCHIVED');
    });

    it('should suspend project', () => {
      project.suspend();
      expect(project.getStatus().getValue()).toBe('SUSPENDED');
    });

    it('should update project details', () => {
      project.updateDetails('New Name', 'New Description');
      expect(project.getName()).toBe('New Name');
      expect(project.getDescription()).toBe('New Description');
    });

    it('should update project dates', () => {
      const newStartDate = new Date('2024-02-01');
      const newEndDate = new Date('2024-11-30');

      project.updateDates(newStartDate, newEndDate);
      expect(project.getStartDate()).toBe(newStartDate);
      expect(project.getEndDate()).toBe(newEndDate);
    });

    it('should not update dates when end date is before start date', () => {
      const newStartDate = new Date('2024-12-31');
      const newEndDate = new Date('2024-01-01');

      expect(() => {
        project.updateDates(newStartDate, newEndDate);
      }).toThrow();
    });

    it('should add team member', () => {
      const memberId = new UserId('user-456');
      project.addTeamMember(memberId, 'DEVELOPER');

      expect(project.getTeamMembers()).toContain(memberId);
      expect(project.getMemberRole(memberId)).toBe('DEVELOPER');
    });

    it('should remove team member', () => {
      const memberId = new UserId('user-456');
      project.addTeamMember(memberId, 'DEVELOPER');
      project.removeTeamMember(memberId);

      expect(project.getTeamMembers()).not.toContain(memberId);
    });

    it('should not remove project owner', () => {
      expect(() => {
        project.removeTeamMember(ownerId);
      }).toThrow();
    });

    it('should update member role', () => {
      const memberId = new UserId('user-456');
      project.addTeamMember(memberId, 'DEVELOPER');
      project.updateMemberRole(memberId, 'MANAGER');

      expect(project.getMemberRole(memberId)).toBe('MANAGER');
    });

    it('should check if user is team member', () => {
      const memberId = new UserId('user-456');
      expect(project.isTeamMember(memberId)).toBe(false);

      project.addTeamMember(memberId, 'DEVELOPER');
      expect(project.isTeamMember(memberId)).toBe(true);
    });

    it('should check if project is active', () => {
      const activeProject = TestDataFactory.createProject(
        workspaceId,
        ownerId,
        {
          status: new ProjectStatus('ACTIVE'),
        }
      );
      expect(activeProject.isActive()).toBe(true);

      const completedProject = TestDataFactory.createProject(
        workspaceId,
        ownerId,
        {
          status: new ProjectStatus('COMPLETED'),
        }
      );
      expect(completedProject.isActive()).toBe(false);
    });

    it('should check if project is completed', () => {
      expect(project.isCompleted()).toBe(false);

      project.complete();
      expect(project.isCompleted()).toBe(true);
    });

    it('should calculate project duration in days', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      project.updateDates(startDate, endDate);
      expect(project.getDurationInDays()).toBe(30);
    });

    it('should check if project is overdue', () => {
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2030-01-01');

      const overdueProject = TestDataFactory.createProject(
        workspaceId,
        ownerId,
        {
          endDate: pastDate,
        }
      );
      const notOverdueProject = TestDataFactory.createProject(
        workspaceId,
        ownerId,
        {
          endDate: futureDate,
        }
      );

      expect(overdueProject.isOverdue()).toBe(true);
      expect(notOverdueProject.isOverdue()).toBe(false);
    });
  });

  describe('Domain Events', () => {
    let project: Project;

    beforeEach(() => {
      project = TestDataFactory.createProject(workspaceId, ownerId);
    });

    it('should publish project created event', () => {
      const events = project.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('ProjectCreated');
    });

    it('should publish project updated event', () => {
      project.clearEvents();
      project.updateDetails('New Name', 'New Description');

      const events = project.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('ProjectUpdated');
    });

    it('should publish project completed event', () => {
      project.clearEvents();
      project.complete();

      const events = project.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('ProjectCompleted');
    });

    it('should publish team member added event', () => {
      project.clearEvents();
      const memberId = new UserId('user-456');
      project.addTeamMember(memberId, 'DEVELOPER');

      const events = project.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TeamMemberAdded');
    });

    it('should publish team member removed event', () => {
      const memberId = new UserId('user-456');
      project.addTeamMember(memberId, 'DEVELOPER');
      project.clearEvents();

      project.removeTeamMember(memberId);

      const events = project.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TeamMemberRemoved');
    });
  });

  describe('Validation', () => {
    it('should validate project status values', () => {
      expect(() => new ProjectStatus('ACTIVE')).not.toThrow();
      expect(() => new ProjectStatus('COMPLETED')).not.toThrow();
      expect(() => new ProjectStatus('ARCHIVED')).not.toThrow();
      expect(() => new ProjectStatus('SUSPENDED')).not.toThrow();
      expect(() => new ProjectStatus('INVALID' as any)).toThrow();
    });

    it('should validate project name', () => {
      expect(() => {
        TestDataFactory.createProject(workspaceId, ownerId, {
          name: 'Valid Project Name',
        });
      }).not.toThrow();

      expect(() => {
        TestDataFactory.createProject(workspaceId, ownerId, {
          name: '',
        });
      }).toThrow();
    });

    it('should validate date ranges', () => {
      const validStartDate = new Date('2024-01-01');
      const validEndDate = new Date('2024-12-31');

      expect(() => {
        TestDataFactory.createProject(workspaceId, ownerId, {
          startDate: validStartDate,
          endDate: validEndDate,
        });
      }).not.toThrow();

      expect(() => {
        TestDataFactory.createProject(workspaceId, ownerId, {
          startDate: validEndDate,
          endDate: validStartDate,
        });
      }).toThrow();
    });

    it('should validate team member roles', () => {
      const project = TestDataFactory.createProject(workspaceId, ownerId);
      const memberId = new UserId('user-456');

      expect(() => {
        project.addTeamMember(memberId, 'DEVELOPER');
      }).not.toThrow();

      expect(() => {
        project.addTeamMember(memberId, 'MANAGER');
      }).not.toThrow();

      expect(() => {
        project.addTeamMember(memberId, 'INVALID_ROLE' as any);
      }).toThrow();
    });
  });
});
