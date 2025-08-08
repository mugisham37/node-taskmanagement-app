import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectService, CreateProjectRequest } from './ProjectService';
import { TaskTemplate } from '../entities/TaskTemplate';
import { Project } from '../entities/Project';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  settings: any;
  taskTemplates: TaskTemplateData[];
  isPublic: boolean;
  createdBy: UserId;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskTemplateData {
  title: string;
  description?: string;
  priority: string;
  estimatedHours?: number;
  storyPoints?: number;
  tags: string[];
  labels: string[];
  customFields: Record<string, any>;
  subtasks?: TaskTemplateData[];
  dependencies?: string[];
  position: number;
}

export interface CreateProjectTemplateRequest {
  name: string;
  description?: string;
  category: string;
  settings?: any;
  taskTemplates?: TaskTemplateData[];
  isPublic?: boolean;
}

export interface UpdateProjectTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  settings?: any;
  taskTemplates?: TaskTemplateData[];
  isPublic?: boolean;
}

export interface ProjectFromTemplateRequest {
  templateId: string;
  projectName: string;
  projectDescription?: string;
  customizations?: {
    skipTasks?: string[];
    modifyTasks?: Record<string, Partial<TaskTemplateData>>;
    additionalSettings?: any;
  };
}

// Domain Events
export class ProjectTemplateCreatedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly name: string,
    public readonly createdBy: UserId
  ) {
    super('ProjectTemplateCreated', {
      templateId,
      name,
      createdBy: createdBy.value,
    });
  }
}

export class ProjectTemplateUsedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly projectId: string,
    public readonly usedBy: UserId
  ) {
    super('ProjectTemplateUsed', {
      templateId,
      projectId,
      usedBy: usedBy.value,
    });
  }
}

export class ProjectTemplateService {
  private readonly templates = new Map<string, ProjectTemplate>();

  constructor(private readonly projectService: ProjectService) {
    // Initialize with some default templates
    this.initializeDefaultTemplates();
  }

  /**
   * Create a new project template
   */
  async createTemplate(
    workspaceId: WorkspaceId,
    userId: UserId,
    request: CreateProjectTemplateRequest
  ): Promise<ProjectTemplate> {
    // Validate template data
    this.validateTemplateRequest(request);

    const template: ProjectTemplate = {
      id: this.generateId(),
      name: request.name,
      description: request.description,
      category: request.category,
      settings: request.settings || {},
      taskTemplates: request.taskTemplates || [],
      isPublic: request.isPublic || false,
      createdBy: userId,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save template
    this.templates.set(template.id, template);

    // Emit domain event
    console.log(
      new ProjectTemplateCreatedEvent(template.id, template.name, userId)
    );

    return template;
  }

  /**
   * Update project template
   */
  async updateTemplate(
    templateId: string,
    userId: UserId,
    request: UpdateProjectTemplateRequest
  ): Promise<ProjectTemplate> {
    const template = await this.getTemplateById(templateId);

    // Check if user can update template
    if (!template.createdBy.equals(userId) && !template.isPublic) {
      throw new Error('You can only update your own templates');
    }

    // Update template
    if (request.name) {
      template.name = request.name;
    }

    if (request.description !== undefined) {
      template.description = request.description;
    }

    if (request.category) {
      template.category = request.category;
    }

    if (request.settings) {
      template.settings = { ...template.settings, ...request.settings };
    }

    if (request.taskTemplates) {
      template.taskTemplates = request.taskTemplates;
    }

    if (request.isPublic !== undefined) {
      template.isPublic = request.isPublic;
    }

    template.updatedAt = new Date();

    // Save updated template
    this.templates.set(templateId, template);

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<ProjectTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Project template not found');
    }
    return template;
  }

  /**
   * Get all templates available to user
   */
  async getAvailableTemplates(
    workspaceId: WorkspaceId,
    userId: UserId,
    category?: string
  ): Promise<ProjectTemplate[]> {
    const allTemplates = Array.from(this.templates.values());

    // Filter templates user can access
    const accessibleTemplates = allTemplates.filter(template => {
      // User can access their own templates or public templates
      return template.isPublic || template.createdBy.equals(userId);
    });

    // Filter by category if specified
    if (category) {
      return accessibleTemplates.filter(
        template => template.category === category
      );
    }

    return accessibleTemplates;
  }

  /**
   * Get template categories
   */
  async getTemplateCategories(): Promise<string[]> {
    const allTemplates = Array.from(this.templates.values());
    const categories = new Set(allTemplates.map(template => template.category));
    return Array.from(categories).sort();
  }

  /**
   * Create project from template
   */
  async createProjectFromTemplate(
    workspaceId: WorkspaceId,
    userId: UserId,
    request: ProjectFromTemplateRequest
  ): Promise<Project> {
    const template = await this.getTemplateById(request.templateId);

    // Check if user can use template
    if (!template.isPublic && !template.createdBy.equals(userId)) {
      throw new Error('You do not have access to this template');
    }

    // Create project request from template
    const projectRequest: CreateProjectRequest = {
      name: request.projectName,
      description: request.projectDescription || template.description,
      settings: {
        ...template.settings,
        ...request.customizations?.additionalSettings,
      },
      templateId: template.id,
    };

    // Create project
    const project = await this.projectService.createProject(
      workspaceId,
      userId,
      projectRequest
    );

    // TODO: Create tasks from template (would need TaskService integration)
    await this.createTasksFromTemplate(
      project,
      template,
      request.customizations
    );

    // Update template usage count
    template.usageCount += 1;
    template.updatedAt = new Date();
    this.templates.set(template.id, template);

    // Emit domain event
    console.log(
      new ProjectTemplateUsedEvent(template.id, project.id.value, userId)
    );

    return project;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: UserId): Promise<void> {
    const template = await this.getTemplateById(templateId);

    // Check if user can delete template
    if (!template.createdBy.equals(userId)) {
      throw new Error('You can only delete your own templates');
    }

    // Delete template
    this.templates.delete(templateId);
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(
    templateId: string,
    userId: UserId,
    newName: string
  ): Promise<ProjectTemplate> {
    const originalTemplate = await this.getTemplateById(templateId);

    // Check if user can access template
    if (
      !originalTemplate.isPublic &&
      !originalTemplate.createdBy.equals(userId)
    ) {
      throw new Error('You do not have access to this template');
    }

    // Create duplicate
    const duplicateRequest: CreateProjectTemplateRequest = {
      name: newName,
      description: originalTemplate.description,
      category: originalTemplate.category,
      settings: { ...originalTemplate.settings },
      taskTemplates: originalTemplate.taskTemplates.map(task => ({ ...task })),
      isPublic: false, // Duplicates are always private initially
    };

    return await this.createTemplate(
      WorkspaceId.generate(), // Placeholder workspace ID
      userId,
      duplicateRequest
    );
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(limit: number = 10): Promise<ProjectTemplate[]> {
    const publicTemplates = Array.from(this.templates.values())
      .filter(template => template.isPublic)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);

    return publicTemplates;
  }

  /**
   * Search templates
   */
  async searchTemplates(
    query: string,
    userId: UserId,
    category?: string
  ): Promise<ProjectTemplate[]> {
    const allTemplates = Array.from(this.templates.values());

    // Filter templates user can access
    const accessibleTemplates = allTemplates.filter(template => {
      return template.isPublic || template.createdBy.equals(userId);
    });

    // Search by name and description
    const searchResults = accessibleTemplates.filter(template => {
      const searchText =
        `${template.name} ${template.description || ''}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    // Filter by category if specified
    if (category) {
      return searchResults.filter(template => template.category === category);
    }

    return searchResults;
  }

  /**
   * Validate template request
   */
  private validateTemplateRequest(request: CreateProjectTemplateRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (request.name.length > 200) {
      throw new Error('Template name cannot exceed 200 characters');
    }

    if (!request.category || request.category.trim().length === 0) {
      throw new Error('Template category is required');
    }

    // Validate task templates
    if (request.taskTemplates) {
      for (const taskTemplate of request.taskTemplates) {
        if (!taskTemplate.title || taskTemplate.title.trim().length === 0) {
          throw new Error('Task template title is required');
        }

        if (taskTemplate.title.length > 500) {
          throw new Error('Task template title cannot exceed 500 characters');
        }
      }
    }
  }

  /**
   * Create tasks from template
   */
  private async createTasksFromTemplate(
    project: Project,
    template: ProjectTemplate,
    customizations?: ProjectFromTemplateRequest['customizations']
  ): Promise<void> {
    // This would integrate with TaskService to create actual tasks
    // For now, just log the task creation
    console.log(
      `Creating ${template.taskTemplates.length} tasks for project ${project.id.value}`
    );

    for (const taskTemplate of template.taskTemplates) {
      // Skip tasks if specified in customizations
      if (customizations?.skipTasks?.includes(taskTemplate.title)) {
        continue;
      }

      // Apply modifications if specified
      let finalTaskData = { ...taskTemplate };
      if (customizations?.modifyTasks?.[taskTemplate.title]) {
        finalTaskData = {
          ...finalTaskData,
          ...customizations.modifyTasks[taskTemplate.title],
        };
      }

      // TODO: Create actual task using TaskService
      console.log(`Would create task: ${finalTaskData.title}`);
    }
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<
      ProjectTemplate,
      'id' | 'createdBy' | 'createdAt' | 'updatedAt'
    >[] = [
      {
        name: 'Software Development Project',
        description:
          'A comprehensive template for software development projects',
        category: 'Software Development',
        settings: {
          enableTimeTracking: true,
          requireTaskApproval: false,
          defaultTaskPriority: 'medium',
        },
        taskTemplates: [
          {
            title: 'Project Setup',
            description:
              'Initialize project repository and development environment',
            priority: 'high',
            estimatedHours: 4,
            tags: ['setup', 'infrastructure'],
            labels: ['backend'],
            customFields: {},
            position: 1,
          },
          {
            title: 'Requirements Analysis',
            description: 'Gather and document project requirements',
            priority: 'high',
            estimatedHours: 8,
            tags: ['analysis', 'documentation'],
            labels: ['planning'],
            customFields: {},
            position: 2,
          },
          {
            title: 'Database Design',
            description: 'Design database schema and relationships',
            priority: 'medium',
            estimatedHours: 6,
            tags: ['database', 'design'],
            labels: ['backend'],
            customFields: {},
            position: 3,
          },
          {
            title: 'API Development',
            description: 'Implement REST API endpoints',
            priority: 'medium',
            estimatedHours: 16,
            tags: ['api', 'backend'],
            labels: ['backend'],
            customFields: {},
            position: 4,
          },
          {
            title: 'Frontend Implementation',
            description: 'Build user interface components',
            priority: 'medium',
            estimatedHours: 20,
            tags: ['frontend', 'ui'],
            labels: ['frontend'],
            customFields: {},
            position: 5,
          },
          {
            title: 'Testing',
            description: 'Write and execute unit and integration tests',
            priority: 'high',
            estimatedHours: 12,
            tags: ['testing', 'quality'],
            labels: ['testing'],
            customFields: {},
            position: 6,
          },
          {
            title: 'Deployment',
            description: 'Deploy application to production environment',
            priority: 'high',
            estimatedHours: 4,
            tags: ['deployment', 'devops'],
            labels: ['deployment'],
            customFields: {},
            position: 7,
          },
        ],
        isPublic: true,
        usageCount: 0,
      },
      {
        name: 'Marketing Campaign',
        description: 'Template for planning and executing marketing campaigns',
        category: 'Marketing',
        settings: {
          enableTimeTracking: true,
          requireTaskApproval: true,
          defaultTaskPriority: 'medium',
        },
        taskTemplates: [
          {
            title: 'Campaign Strategy',
            description: 'Define campaign objectives and target audience',
            priority: 'high',
            estimatedHours: 6,
            tags: ['strategy', 'planning'],
            labels: ['strategy'],
            customFields: {},
            position: 1,
          },
          {
            title: 'Content Creation',
            description: 'Create marketing materials and content',
            priority: 'medium',
            estimatedHours: 16,
            tags: ['content', 'creative'],
            labels: ['content'],
            customFields: {},
            position: 2,
          },
          {
            title: 'Campaign Launch',
            description: 'Execute campaign launch across all channels',
            priority: 'high',
            estimatedHours: 4,
            tags: ['launch', 'execution'],
            labels: ['execution'],
            customFields: {},
            position: 3,
          },
          {
            title: 'Performance Analysis',
            description: 'Analyze campaign performance and ROI',
            priority: 'medium',
            estimatedHours: 8,
            tags: ['analysis', 'metrics'],
            labels: ['analysis'],
            customFields: {},
            position: 4,
          },
        ],
        isPublic: true,
        usageCount: 0,
      },
    ];

    // Add default templates
    for (const templateData of defaultTemplates) {
      const template: ProjectTemplate = {
        ...templateData,
        id: this.generateId(),
        createdBy: UserId.generate(), // System user
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.templates.set(template.id, template);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
