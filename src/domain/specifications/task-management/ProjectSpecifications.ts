import { BaseSpecification } from '../../shared/repositories/IRepository';
import { Project } from '../entities/Project';
import { ProjectStatus } from '../value-objects/ProjectStatus';
import { Priority } from '../value-objects/Priority';
import { UserId } from '../../authentication/value-objects/UserId';
import { WorkspaceId } from '../value-objects/WorkspaceId';

// Status-based specifications
export class ProjectByStatusSpecification extends BaseSpecification<Project> {
  constructor(private readonly status: ProjectStatus) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return project.status.equals(this.status);
  }
}

export class ActiveProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return (
      project.status.isActive() && !project.isArchived && !project.isDeleted()
    );
  }
}

export class CompletedProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.status.isCompleted();
  }
}

export class ArchivedProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.isArchived;
  }
}

// Priority-based specifications
export class ProjectByPrioritySpecification extends BaseSpecification<Project> {
  constructor(private readonly priority: Priority) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return project.priority.equals(this.priority);
  }
}

export class HighPriorityProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.priority.isHigherThan(Priority.medium());
  }
}

// Owner and workspace specifications
export class ProjectByOwnerSpecification extends BaseSpecification<Project> {
  constructor(private readonly ownerId: UserId) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return project.ownerId.equals(this.ownerId);
  }
}

export class ProjectByWorkspaceSpecification extends BaseSpecification<Project> {
  constructor(private readonly workspaceId: WorkspaceId) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return project.workspaceId.equals(this.workspaceId);
  }
}

// Date-based specifications
export class OverdueProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.isOverdue();
  }
}

export class ProjectsEndingThisWeekSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    if (!project.endDate) return false;

    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return project.endDate >= today && project.endDate <= weekFromNow;
  }
}

export class ProjectsStartingThisMonthSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    if (!project.startDate) return false;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return project.startDate >= startOfMonth && project.startDate <= endOfMonth;
  }
}

export class ProjectsByDateRangeSpecification extends BaseSpecification<Project> {
  constructor(
    private readonly startDate: Date,
    private readonly endDate: Date,
    private readonly dateField:
      | 'startDate'
      | 'endDate'
      | 'createdAt' = 'startDate'
  ) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    let dateToCheck: Date | undefined;

    switch (this.dateField) {
      case 'startDate':
        dateToCheck = project.startDate;
        break;
      case 'endDate':
        dateToCheck = project.endDate;
        break;
      case 'createdAt':
        dateToCheck = project.createdAt;
        break;
    }

    if (!dateToCheck) return false;

    return dateToCheck >= this.startDate && dateToCheck <= this.endDate;
  }
}

// Budget specifications
export class ProjectsByBudgetRangeSpecification extends BaseSpecification<Project> {
  constructor(
    private readonly minBudget: number,
    private readonly maxBudget: number
  ) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    if (!project.budgetAmount) return false;
    return (
      project.budgetAmount >= this.minBudget &&
      project.budgetAmount <= this.maxBudget
    );
  }
}

export class ProjectsWithBudgetSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.budgetAmount !== undefined && project.budgetAmount > 0;
  }
}

export class ProjectsWithoutBudgetSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return project.budgetAmount === undefined || project.budgetAmount === 0;
  }
}

// Template specifications
export class ProjectsByTemplateSpecification extends BaseSpecification<Project> {
  constructor(private readonly templateId: string) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return project.templateId === this.templateId;
  }
}

export class ProjectsWithoutTemplateSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return !project.templateId;
  }
}

// Search specifications
export class ProjectSearchSpecification extends BaseSpecification<Project> {
  constructor(private readonly query: string) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    const searchQuery = this.query.toLowerCase();

    return (
      project.name.toLowerCase().includes(searchQuery) ||
      (project.description &&
        project.description.toLowerCase().includes(searchQuery))
    );
  }
}

// Health and status specifications
export class HealthyProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return (
      project.status.isActive() &&
      !project.isOverdue() &&
      !project.isArchived &&
      !project.isDeleted()
    );
  }
}

export class ProjectsNeedingAttentionSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return (
      project.isOverdue() ||
      (project.priority.equals(Priority.urgent()) && project.status.isActive())
    );
  }
}

// Recently created/updated specifications
export class RecentlyCreatedProjectsSpecification extends BaseSpecification<Project> {
  constructor(private readonly days: number = 7) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    const daysAgo = new Date(Date.now() - this.days * 24 * 60 * 60 * 1000);
    return project.createdAt >= daysAgo;
  }
}

export class RecentlyUpdatedProjectsSpecification extends BaseSpecification<Project> {
  constructor(private readonly days: number = 7) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    const daysAgo = new Date(Date.now() - this.days * 24 * 60 * 60 * 1000);
    return project.updatedAt >= daysAgo;
  }
}

// Composite specifications for common use cases
export class MyActiveProjectsSpecification extends BaseSpecification<Project> {
  constructor(private readonly userId: UserId) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    return (
      project.ownerId.equals(this.userId) &&
      project.status.isActive() &&
      !project.isArchived &&
      !project.isDeleted()
    );
  }
}

export class CriticalProjectsSpecification extends BaseSpecification<Project> {
  public isSatisfiedBy(project: Project): boolean {
    return (
      project.priority.equals(Priority.urgent()) &&
      project.status.isActive() &&
      (project.isOverdue() || this.isEndingSoon(project))
    );
  }

  private isEndingSoon(project: Project): boolean {
    if (!project.endDate) return false;

    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return project.endDate <= threeDaysFromNow;
  }
}

export class StaleProjectsSpecification extends BaseSpecification<Project> {
  constructor(private readonly inactiveDays: number = 30) {
    super();
  }

  public isSatisfiedBy(project: Project): boolean {
    const inactiveThreshold = new Date(
      Date.now() - this.inactiveDays * 24 * 60 * 60 * 1000
    );

    return (
      project.status.isActive() &&
      project.updatedAt < inactiveThreshold &&
      !project.isArchived &&
      !project.isDeleted()
    );
  }
}
