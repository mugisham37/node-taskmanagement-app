import { ValueObject } from '../../../shared/domain/value-object';

export interface SearchQueryProps {
  query: string;
  entityTypes: string[];
  workspaceId: string;
  filters: Record<string, any>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
  includeArchived: boolean;
  permissions: string[];
}

export class SearchQuery extends ValueObject<SearchQueryProps> {
  get query(): string {
    return this.props.query;
  }

  get entityTypes(): string[] {
    return this.props.entityTypes;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get filters(): Record<string, any> {
    return this.props.filters;
  }

  get sortBy(): string {
    return this.props.sortBy;
  }

  get sortOrder(): 'asc' | 'desc' {
    return this.props.sortOrder;
  }

  get limit(): number {
    return this.props.limit;
  }

  get offset(): number {
    return this.props.offset;
  }

  get includeArchived(): boolean {
    return this.props.includeArchived;
  }

  get permissions(): string[] {
    return this.props.permissions;
  }

  public withPagination(limit: number, offset: number): SearchQuery {
    return new SearchQuery({
      ...this.props,
      limit,
      offset,
    });
  }

  public withSorting(sortBy: string, sortOrder: 'asc' | 'desc'): SearchQuery {
    return new SearchQuery({
      ...this.props,
      sortBy,
      sortOrder,
    });
  }

  public withFilters(filters: Record<string, any>): SearchQuery {
    return new SearchQuery({
      ...this.props,
      filters: { ...this.props.filters, ...filters },
    });
  }

  public withEntityTypes(entityTypes: string[]): SearchQuery {
    return new SearchQuery({
      ...this.props,
      entityTypes,
    });
  }

  public withPermissions(permissions: string[]): SearchQuery {
    return new SearchQuery({
      ...this.props,
      permissions,
    });
  }

  public static create(
    props: Partial<SearchQueryProps> & { query: string; workspaceId: string }
  ): SearchQuery {
    return new SearchQuery({
      query: props.query,
      entityTypes: props.entityTypes || ['task', 'project', 'comment', 'file'],
      workspaceId: props.workspaceId,
      filters: props.filters || {},
      sortBy: props.sortBy || 'relevance',
      sortOrder: props.sortOrder || 'desc',
      limit: props.limit || 20,
      offset: props.offset || 0,
      includeArchived: props.includeArchived || false,
      permissions: props.permissions || [],
    });
  }

  protected getEqualityComponents(): any[] {
    return [
      this.props.query,
      this.props.entityTypes,
      this.props.workspaceId,
      this.props.filters,
      this.props.sortBy,
      this.props.sortOrder,
      this.props.limit,
      this.props.offset,
      this.props.includeArchived,
      this.props.permissions,
    ];
  }
}
