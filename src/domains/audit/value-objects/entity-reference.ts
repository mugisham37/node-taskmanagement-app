export interface EntityReferenceProps {
  type: string;
  id: string;
}

export class EntityReference {
  private constructor(private props: EntityReferenceProps) {
    this.validate();
  }

  static create(type: string, id: string): EntityReference {
    return new EntityReference({ type, id });
  }

  static fromString(reference: string): EntityReference {
    const parts = reference.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid entity reference format. Expected "type:id"');
    }
    return new EntityReference({ type: parts[0], id: parts[1] });
  }

  private validate(): void {
    if (!this.props.type || this.props.type.trim().length === 0) {
      throw new Error('Entity type is required');
    }

    if (!this.props.id || this.props.id.trim().length === 0) {
      throw new Error('Entity ID is required');
    }

    if (this.props.type.length > 50) {
      throw new Error('Entity type must be 50 characters or less');
    }
  }

  get type(): string {
    return this.props.type;
  }

  get id(): string {
    return this.props.id;
  }

  toString(): string {
    return `${this.props.type}:${this.props.id}`;
  }

  equals(other: EntityReference): boolean {
    return (
      this.props.type === other.props.type && this.props.id === other.props.id
    );
  }

  toPrimitive(): EntityReferenceProps {
    return { ...this.props };
  }

  // Common entity types
  static task(id: string): EntityReference {
    return EntityReference.create('task', id);
  }

  static project(id: string): EntityReference {
    return EntityReference.create('project', id);
  }

  static user(id: string): EntityReference {
    return EntityReference.create('user', id);
  }

  static workspace(id: string): EntityReference {
    return EntityReference.create('workspace', id);
  }

  static team(id: string): EntityReference {
    return EntityReference.create('team', id);
  }

  static comment(id: string): EntityReference {
    return EntityReference.create('comment', id);
  }

  static attachment(id: string): EntityReference {
    return EntityReference.create('attachment', id);
  }

  static notification(id: string): EntityReference {
    return EntityReference.create('notification', id);
  }

  static calendarEvent(id: string): EntityReference {
    return EntityReference.create('calendar_event', id);
  }

  static webhook(id: string): EntityReference {
    return EntityReference.create('webhook', id);
  }
}
