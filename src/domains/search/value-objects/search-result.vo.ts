import { ValueObject } from '../../../shared/domain/value-object';

export interface SearchResultItemProps {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  highlights: Record<string, string[]>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SearchResultItem extends ValueObject<SearchResultItemProps> {
  get id(): string {
    return this.props.id;
  }

  get entityType(): string {
    return this.props.entityType;
  }

  get entityId(): string {
    return this.props.entityId;
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

  get relevanceScore(): number {
    return this.props.relevanceScore;
  }

  get highlights(): Record<string, string[]> {
    return this.props.highlights;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  protected getEqualityComponents(): any[] {
    return [this.props.id, this.props.entityType, this.props.entityId];
  }
}

export interface SearchResultProps {
  items: SearchResultItem[];
  totalCount: number;
  facets: Record<string, Record<string, number>>;
  suggestions: string[];
  executionTime: number;
  query: string;
  filters: Record<string, any>;
}

export class SearchResult extends ValueObject<SearchResultProps> {
  get items(): SearchResultItem[] {
    return this.props.items;
  }

  get totalCount(): number {
    return this.props.totalCount;
  }

  get facets(): Record<string, Record<string, number>> {
    return this.props.facets;
  }

  get suggestions(): string[] {
    return this.props.suggestions;
  }

  get executionTime(): number {
    return this.props.executionTime;
  }

  get query(): string {
    return this.props.query;
  }

  get filters(): Record<string, any> {
    return this.props.filters;
  }

  get hasResults(): boolean {
    return this.props.items.length > 0;
  }

  get isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  public getItemsByType(entityType: string): SearchResultItem[] {
    return this.props.items.filter(item => item.entityType === entityType);
  }

  public getTopResults(count: number): SearchResultItem[] {
    return this.props.items.slice(0, count);
  }

  public static create(props: SearchResultProps): SearchResult {
    return new SearchResult(props);
  }

  public static empty(
    query: string,
    filters: Record<string, any> = {}
  ): SearchResult {
    return new SearchResult({
      items: [],
      totalCount: 0,
      facets: {},
      suggestions: [],
      executionTime: 0,
      query,
      filters,
    });
  }

  protected getEqualityComponents(): any[] {
    return [
      this.props.items,
      this.props.totalCount,
      this.props.query,
      this.props.filters,
    ];
  }
}
