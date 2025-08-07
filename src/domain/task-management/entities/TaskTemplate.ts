import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';
import { Priority, PriorityEnum } from '../value-objects/Priority';
import { cuid } from '@paralleldrive/cuid2';

export interface TaskTemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface TaskTemplateData {
  title: string;
  description?: string;
  priority: PriorityEnum;
  estimatedHours?: number;
  storyPoints?: number;
  tags: string[];
  labels: string[];
  customFields: Record<string, any>;
  subtasks?: TaskTemplateData[];
  dependencies?: string[]; // Template IDs this task depends on
}

export interface TaskTemplateProps {
  id: string;
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  name: string;
  description?: string;
  category: string;
  taskData: TaskTemplateData;
  customFields: TaskTemplateField[];
  isPublic: boolean;
  createdBy: UserId;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Domain Events
export class TaskTemplateCreatedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly createdBy: UserId
  ) {
    super('TaskTemplateCreated', {
      templateId,
      workspaceId: workspaceId.value,
      name,
      createdBy: createdBy.value,
    });
  }
}

export class TaskTemplateUpdatedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly changes: Partial<TaskTemplateProps>
  ) {
    super('TaskTemplateUpdated', {
      templateId,
      changes,
    });
  }
}

export class TaskTemplateUsedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly usedBy: UserId,
    public readonly projectId?: ProjectId
  ) {
    super('TaskTemplateUsed', {
      templateId,
      usedBy: usedBy.value,
      projectId: projectId?.value,
    });
  }
}

export class TaskTemplate extends BaseEntity<TaskTemplateProps> {
  private constructor(props: TaskTemplateProps) {
    super(props);
  }

  public static create(
    props: Omit<
      TaskTemplateProps,
      'id' | 'usageCount' | 'createdAt' | 'updatedAt'
    >
  ): TaskTemplate {
    // Validate template name
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Task template name cannot be empty');
    }

    if (props.name.length > 200) {
      throw new Error('Task template name cannot exceed 200 characters');
    }

    // Validate task data
    if (!props.taskData.title || props.taskData.title.trim().length === 0) {
      throw new Error('Task template must have a title');
    }

    // Validate category
    if (!props.category || props.category.trim().length === 0) {
      throw new Error('Task template must have a category');
    }

    const template = new TaskTemplate({
      ...props,
      id: cuid(),
      name: props.name.trim(),
      category: props.category.trim(),
      taskData: {
        ...props.taskData,
        title: props.taskData.title.trim(),
        priority: props.taskData.priority || PriorityEnum.MEDIUM,
        tags: props.taskData.tags || [],
        labels: props.taskData.labels || [],
        customFields: props.taskData.customFields || {},
      },
      customFields: props.customFields || [],
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    template.addDomainEvent(
      new TaskTemplateCreatedEvent(
        template.id,
        template.workspaceId,
        template.name,
        template.createdBy
      )
    );

    return template;
  }

  public static fromPersistence(props: TaskTemplateProps): TaskTemplate {
    return new TaskTemplate(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this.props.projectId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get category(): string {
    return this.props.category;
  }

  get taskData(): TaskTemplateData {
    return { ...this.props.taskData };
  }

  get customFields(): TaskTemplateField[] {
    return [...this.props.customFields];
  }

  get isPublic(): boolean {
    return this.props.isPublic;
  }

  get createdBy(): UserId {
    return this.props.createdBy;
  }

  get usageCount(): number {
    return this.props.usageCount;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Task template name cannot be empty');
    }

    if (name.length > 200) {
      throw new Error('Task template name cannot exceed 200 characters');
    }

    this.props.name = name.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { name: this.props.name })
    );
  }

  public updateDescription(description?: string): void {
    this.props.description = description;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TaskTemplateUpdatedEvent(this.id, { description }));
  }

  public updateCategory(category: string): void {
    if (!category || category.trim().length === 0) {
      throw new Error('Task template must have a category');
    }

    this.props.category = category.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { category: this.props.category })
    );
  }

  public updateTaskData(taskData: Partial<TaskTemplateData>): void {
    if (taskData.title !== undefined) {
      if (!taskData.title || taskData.title.trim().length === 0) {
        throw new Error('Task template must have a title');
      }
      taskData.title = taskData.title.trim();
    }

    this.props.taskData = {
      ...this.props.taskData,
      ...taskData,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { taskData: this.props.taskData })
    );
  }

  public updateCustomFields(customFields: TaskTemplateField[]): void {
    // Validate custom fields
    for (const field of customFields) {
      if (!field.name || field.name.trim().length === 0) {
        throw new Error('Custom field name cannot be empty');
      }

      if (
        ![
          'text',
          'number',
          'date',
          'select',
          'multiselect',
          'boolean',
        ].includes(field.type)
      ) {
        throw new Error(`Invalid custom field type: ${field.type}`);
      }

      if (
        (field.type === 'select' || field.type === 'multiselect') &&
        !field.options
      ) {
        throw new Error('Select fields must have options');
      }
    }

    this.props.customFields = customFields;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { customFields })
    );
  }

  public makePublic(): void {
    if (this.props.isPublic) {
      return; // Already public
    }

    this.props.isPublic = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { isPublic: true })
    );
  }

  public makePrivate(): void {
    if (!this.props.isPublic) {
      return; // Already private
    }

    this.props.isPublic = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TaskTemplateUpdatedEvent(this.id, { isPublic: false })
    );
  }

  public recordUsage(usedBy: UserId, projectId?: ProjectId): void {
    this.props.usageCount += 1;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TaskTemplateUsedEvent(this.id, usedBy, projectId));
  }

  // Query methods
  public canBeUsedBy(userId: UserId, workspaceId: WorkspaceId): boolean {
    // Public templates can be used by anyone in the same workspace
    if (this.props.isPublic && this.props.workspaceId.equals(workspaceId)) {
      return true;
    }

    // Private templates can only be used by the creator
    return this.props.createdBy.equals(userId);
  }

  public isCreatedBy(userId: UserId): boolean {
    return this.props.createdBy.equals(userId);
  }

  public hasSubtasks(): boolean {
    return !!(
      this.props.taskData.subtasks && this.props.taskData.subtasks.length > 0
    );
  }

  public hasDependencies(): boolean {
    return !!(
      this.props.taskData.dependencies &&
      this.props.taskData.dependencies.length > 0
    );
  }

  public hasCustomFields(): boolean {
    return this.props.customFields.length > 0;
  }

  public validateCustomFieldValues(values: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of this.props.customFields) {
      const value = values[field.name];

      // Check required fields
      if (
        field.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`${field.name} is required`);
        continue;
      }

      // Skip validation if field is not required and value is empty
      if (
        !field.required &&
        (value === undefined || value === null || value === '')
      ) {
        continue;
      }

      // Type-specific validation
      switch (field.type) {
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${field.name} must be a valid number`);
          } else if (field.validation) {
            if (
              field.validation.min !== undefined &&
              value < field.validation.min
            ) {
              errors.push(
                `${field.name} must be at least ${field.validation.min}`
              );
            }
            if (
              field.validation.max !== undefined &&
              value > field.validation.max
            ) {
              errors.push(
                `${field.name} must be at most ${field.validation.max}`
              );
            }
          }
          break;

        case 'text':
          if (typeof value !== 'string') {
            errors.push(`${field.name} must be a string`);
          } else if (field.validation?.pattern) {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
              errors.push(`${field.name} format is invalid`);
            }
          }
          break;

        case 'date':
          if (!(value instanceof Date) && !Date.parse(value)) {
            errors.push(`${field.name} must be a valid date`);
          }
          break;

        case 'select':
          if (!field.options?.includes(value)) {
            errors.push(
              `${field.name} must be one of: ${field.options?.join(', ')}`
            );
          }
          break;

        case 'multiselect':
          if (!Array.isArray(value)) {
            errors.push(`${field.name} must be an array`);
          } else {
            const invalidOptions = value.filter(
              v => !field.options?.includes(v)
            );
            if (invalidOptions.length > 0) {
              errors.push(
                `${field.name} contains invalid options: ${invalidOptions.join(', ')}`
              );
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field.name} must be true or false`);
          }
          break;
      }
    }

    return errors;
  }

  public generateTaskFromTemplate(
    overrides: Partial<TaskTemplateData> = {},
    customFieldValues: Record<string, any> = {}
  ): TaskTemplateData {
    // Validate custom field values
    const validationErrors = this.validateCustomFieldValues(customFieldValues);
    if (validationErrors.length > 0) {
      throw new Error(
        `Custom field validation failed: ${validationErrors.join(', ')}`
      );
    }

    // Merge template data with overrides
    const taskData: TaskTemplateData = {
      ...this.props.taskData,
      ...overrides,
      customFields: {
        ...this.props.taskData.customFields,
        ...customFieldValues,
      },
    };

    return taskData;
  }
}
