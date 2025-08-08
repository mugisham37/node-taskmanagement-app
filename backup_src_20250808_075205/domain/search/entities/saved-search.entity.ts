import { BaseEntity } from '../../shared/base/base.entity';

export interface SavedSearchProps {
  id?: string;
  userId: string;
  workspaceId: string;
  name: string;
  description?: string;
  query: string;
  filters: Record<string, any>;
  isShared: boolean;
  sharedWith: string[];
  isDefault: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  createdAt?: Date;
  updatedAt?: Date;
}

export class SavedSearch extends BaseEntity<SavedSearchProps> {
  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get query(): string {
    return this.props.query;
  }

  get filters(): Record<string, any> {
    return this.props.filters;
  }

  get isShared(): boolean {
    return this.props.isShared;
  }

  get sharedWith(): string[] {
    return this.props.sharedWith;
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get sortBy(): string {
    return this.props.sortBy;
  }

  get sortOrder(): 'asc' | 'desc' {
    return this.props.sortOrder;
  }

  public updateQuery(query: string, filters: Record<string, any>): void {
    this.props.query = query;
    this.props.filters = filters;
    this.props.updatedAt = new Date();
  }

  public updateSharing(isShared: boolean, sharedWith: string[] = []): void {
    this.props.isShared = isShared;
    this.props.sharedWith = sharedWith;
    this.props.updatedAt = new Date();
  }

  public setAsDefault(): void {
    this.props.isDefault = true;
    this.props.updatedAt = new Date();
  }

  public unsetAsDefault(): void {
    this.props.isDefault = false;
    this.props.updatedAt = new Date();
  }

  public updateSorting(sortBy: string, sortOrder: 'asc' | 'desc'): void {
    this.props.sortBy = sortBy;
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = new Date();
  }

  public shareWith(userIds: string[]): void {
    const uniqueUsers = [...new Set([...this.props.sharedWith, ...userIds])];
    this.props.sharedWith = uniqueUsers;
    this.props.isShared = true;
    this.props.updatedAt = new Date();
  }

  public unshareWith(userIds: string[]): void {
    this.props.sharedWith = this.props.sharedWith.filter(
      id => !userIds.includes(id)
    );
    if (this.props.sharedWith.length === 0) {
      this.props.isShared = false;
    }
    this.props.updatedAt = new Date();
  }

  public static create(props: SavedSearchProps): SavedSearch {
    return new SavedSearch({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }
}
