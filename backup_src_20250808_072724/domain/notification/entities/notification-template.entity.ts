import { Entity } from '../../shared/base/entity';
import { NotificationTemplateId } from '../value-objects/notification-template-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { DomainEvent } from '../../shared/events/domain-event';

export interface NotificationTemplateProps {
  id: NotificationTemplateId;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
  version: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationTemplateEntity extends Entity<NotificationTemplateProps> {
  private constructor(props: NotificationTemplateProps) {
    super(props);
  }

  public static create(
    name: string,
    type: NotificationType,
    channel: NotificationChannel,
    subject: string,
    bodyTemplate: string,
    variables: string[] = [],
    metadata: Record<string, any> = {}
  ): NotificationTemplateEntity {
    const id = NotificationTemplateId.generate();
    const now = new Date();

    const template = new NotificationTemplateEntity({
      id,
      name,
      type,
      channel,
      subject,
      bodyTemplate,
      variables,
      isActive: true,
      version: 1,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    template.addDomainEvent(new NotificationTemplateCreatedEvent(template));
    return template;
  }

  public static fromPersistence(
    props: NotificationTemplateProps
  ): NotificationTemplateEntity {
    return new NotificationTemplateEntity(props);
  }

  // Getters
  public get id(): NotificationTemplateId {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get type(): NotificationType {
    return this.props.type;
  }

  public get channel(): NotificationChannel {
    return this.props.channel;
  }

  public get subject(): string {
    return this.props.subject;
  }

  public get bodyTemplate(): string {
    return this.props.bodyTemplate;
  }

  public get variables(): string[] {
    return this.props.variables;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get version(): number {
    return this.props.version;
  }

  public get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public render(variables: Record<string, any>): {
    subject: string;
    body: string;
  } {
    const renderedSubject = this.renderTemplate(this.props.subject, variables);
    const renderedBody = this.renderTemplate(
      this.props.bodyTemplate,
      variables
    );

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }

  public updateTemplate(
    subject: string,
    bodyTemplate: string,
    variables: string[] = []
  ): void {
    this.props.subject = subject;
    this.props.bodyTemplate = bodyTemplate;
    this.props.variables = variables;
    this.props.version += 1;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationTemplateUpdatedEvent(this));
  }

  public activate(): void {
    if (this.props.isActive) {
      return;
    }

    this.props.isActive = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationTemplateActivatedEvent(this));
  }

  public deactivate(): void {
    if (!this.props.isActive) {
      return;
    }

    this.props.isActive = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationTemplateDeactivatedEvent(this));
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this.props.metadata = { ...this.props.metadata, ...metadata };
    this.props.updatedAt = new Date();
  }

  public validateVariables(variables: Record<string, any>): string[] {
    const missingVariables: string[] = [];

    for (const requiredVar of this.props.variables) {
      if (!(requiredVar in variables)) {
        missingVariables.push(requiredVar);
      }
    }

    return missingVariables;
  }

  public getRequiredVariables(): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();

    let match;
    while ((match = variableRegex.exec(this.props.bodyTemplate)) !== null) {
      variables.add(match[1]);
    }

    while ((match = variableRegex.exec(this.props.subject)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  private renderTemplate(
    template: string,
    variables: Record<string, any>
  ): string {
    let rendered = template;

    // Replace variables in the format {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // Handle conditional blocks {{#if condition}}...{{/if}}
    rendered = this.renderConditionals(rendered, variables);

    // Handle loops {{#each items}}...{{/each}}
    rendered = this.renderLoops(rendered, variables);

    return rendered;
  }

  private renderConditionals(
    template: string,
    variables: Record<string, any>
  ): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;

    return template.replace(conditionalRegex, (match, condition, content) => {
      const value = variables[condition];
      return value ? content : '';
    });
  }

  private renderLoops(
    template: string,
    variables: Record<string, any>
  ): string {
    const loopRegex = /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs;

    return template.replace(loopRegex, (match, arrayName, content) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map((item, index) => {
          let itemContent = content;

          // Replace {{this}} with the current item
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));

          // Replace {{@index}} with the current index
          itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));

          // If item is an object, replace its properties
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              itemContent = itemContent.replace(regex, String(value));
            }
          }

          return itemContent;
        })
        .join('');
    });
  }
}

// Domain Events
export class NotificationTemplateCreatedEvent extends DomainEvent {
  constructor(public readonly template: NotificationTemplateEntity) {
    super('notification_template.created', template.id.value);
  }
}

export class NotificationTemplateUpdatedEvent extends DomainEvent {
  constructor(public readonly template: NotificationTemplateEntity) {
    super('notification_template.updated', template.id.value);
  }
}

export class NotificationTemplateActivatedEvent extends DomainEvent {
  constructor(public readonly template: NotificationTemplateEntity) {
    super('notification_template.activated', template.id.value);
  }
}

export class NotificationTemplateDeactivatedEvent extends DomainEvent {
  constructor(public readonly template: NotificationTemplateEntity) {
    super('notification_template.deactivated', template.id.value);
  }
}
