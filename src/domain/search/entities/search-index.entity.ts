import { BaseEntity } from '../../shared/base/base.entity';

export interface SearchIndexProps {
  id?: string;
  entityType: string;
  entityId: string;
  workspaceId: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  searchVector?: string;
  tags: string[];
  permissions: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class SearchIndex extends BaseEntity<SearchIndexProps> {
  get entityType(): string {
    return this.props.entityType;
  }

  get entityId(): string {
    return this.props.entityId;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get title(): string {
    return this.props.title;
  }

  get content(): string {
    return this.props.content;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  get searchVector(): string | undefined {
    return this.props.searchVector;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get permissions(): string[] {
    return this.props.permissions;
  }

  public updateContent(
    title: string,
    content: string,
    metadata: Record<string, any>
  ): void {
    this.props.title = title;
    this.props.content = content;
    this.props.metadata = metadata;
    this.props.updatedAt = new Date();
  }

  public updateSearchVector(vector: string): void {
    this.props.searchVector = vector;
    this.props.updatedAt = new Date();
  }

  public updatePermissions(permissions: string[]): void {
    this.props.permissions = permissions;
    this.props.updatedAt = new Date();
  }

  public addTags(newTags: string[]): void {
    const uniqueTags = [...new Set([...this.props.tags, ...newTags])];
    this.props.tags = uniqueTags;
    this.props.updatedAt = new Date();
  }

  public removeTags(tagsToRemove: string[]): void {
    this.props.tags = this.props.tags.filter(
      tag => !tagsToRemove.includes(tag)
    );
    this.props.updatedAt = new Date();
  }

  public static create(props: SearchIndexProps): SearchIndex {
    return new SearchIndex({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }
}
