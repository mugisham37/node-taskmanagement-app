import { SearchQuery } from '../value-objects/search-query.vo';
import { SearchResult } from '../value-objects/search-result.vo';
import { SavedSearch } from '../entities/saved-search.entity';
import { SavedSearchRepository } from '../repositories/saved-search.repository';
import { SearchIndexRepository } from '../repositories/search-index.repository';

export interface FilterCriteria {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'in'
    | 'nin'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'between'
    | 'exists'
    | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface FilterGroup {
  criteria: FilterCriteria[];
  logicalOperator: 'AND' | 'OR';
  groups?: FilterGroup[];
}

export interface DynamicFilter {
  id: string;
  name: string;
  field: string;
  type:
    | 'text'
    | 'number'
    | 'date'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'range';
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface SearchPreset {
  id: string;
  name: string;
  description?: string;
  filters: FilterGroup;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  entityTypes: string[];
  isSystem: boolean;
  workspaceId: string;
}

export interface AdvancedFilteringService {
  /**
   * Apply advanced filters to a search query
   */
  applyAdvancedFilters(
    query: SearchQuery,
    filterGroup: FilterGroup
  ): SearchQuery;

  /**
   * Create a dynamic filter configuration
   */
  createDynamicFilter(filter: Omit<DynamicFilter, 'id'>): DynamicFilter;

  /**
   * Get available filters for entity types
   */
  getAvailableFilters(
    entityTypes: string[],
    workspaceId: string
  ): Promise<DynamicFilter[]>;

  /**
   * Validate filter criteria
   */
  validateFilterCriteria(criteria: FilterCriteria[]): Promise<{
    isValid: boolean;
    errors: string[];
  }>;

  /**
   * Create search preset
   */
  createSearchPreset(preset: Omit<SearchPreset, 'id'>): Promise<SearchPreset>;

  /**
   * Get search presets for workspace
   */
  getSearchPresets(workspaceId: string): Promise<SearchPreset[]>;

  /**
   * Apply search preset to query
   */
  applySearchPreset(
    presetId: string,
    baseQuery: string,
    workspaceId: string
  ): Promise<SearchQuery>;

  /**
   * Get filter suggestions based on field and partial value
   */
  getFilterSuggestions(
    field: string,
    partialValue: string,
    workspaceId: string
  ): Promise<Array<{ label: string; value: any }>>;

  /**
   * Build faceted search with multiple filter dimensions
   */
  buildFacetedSearch(query: SearchQuery): Promise<{
    results: SearchResult;
    facets: Record<string, Record<string, number>>;
    appliedFilters: FilterCriteria[];
    suggestedFilters: FilterCriteria[];
  }>;

  /**
   * Create saved search with advanced filters
   */
  createSavedSearchWithFilters(
    userId: string,
    workspaceId: string,
    name: string,
    query: string,
    filterGroup: FilterGroup,
    options?: {
      description?: string;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SavedSearch>;

  /**
   * Get search history with filter patterns
   */
  getSearchHistory(
    userId: string,
    workspaceId: string,
    limit?: number
  ): Promise<
    Array<{
      query: string;
      filters: FilterGroup;
      timestamp: Date;
      resultCount: number;
    }>
  >;
}

export class AdvancedFilteringServiceImpl implements AdvancedFilteringService {
  private readonly systemPresets: SearchPreset[] = [];
  private readonly dynamicFilters: Map<string, DynamicFilter[]> = new Map();

  constructor(
    private readonly savedSearchRepository: SavedSearchRepository,
    private readonly searchIndexRepository: SearchIndexRepository
  ) {
    this.initializeSystemPresets();
    this.initializeDynamicFilters();
  }

  applyAdvancedFilters(
    query: SearchQuery,
    filterGroup: FilterGroup
  ): SearchQuery {
    const filters = this.convertFilterGroupToQueryFilters(filterGroup);
    return query.withFilters(filters);
  }

  createDynamicFilter(filter: Omit<DynamicFilter, 'id'>): DynamicFilter {
    return {
      ...filter,
      id: crypto.randomUUID(),
    };
  }

  async getAvailableFilters(
    entityTypes: string[],
    workspaceId: string
  ): Promise<DynamicFilter[]> {
    const allFilters: DynamicFilter[] = [];

    // Add common filters
    allFilters.push(...this.getCommonFilters());

    // Add entity-specific filters
    for (const entityType of entityTypes) {
      const entityFilters = this.dynamicFilters.get(entityType) || [];
      allFilters.push(...entityFilters);
    }

    // Add workspace-specific custom filters (would be loaded from database)
    const customFilters = await this.getCustomFilters(workspaceId);
    allFilters.push(...customFilters);

    return allFilters;
  }

  async validateFilterCriteria(criteria: FilterCriteria[]): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const criterion of criteria) {
      // Validate field exists
      if (!criterion.field) {
        errors.push('Filter field is required');
        continue;
      }

      // Validate operator
      const validOperators = [
        'eq',
        'ne',
        'in',
        'nin',
        'gt',
        'gte',
        'lt',
        'lte',
        'contains',
        'startsWith',
        'endsWith',
        'between',
        'exists',
        'regex',
      ];
      if (!validOperators.includes(criterion.operator)) {
        errors.push(`Invalid operator: ${criterion.operator}`);
      }

      // Validate value based on operator
      if (
        ['in', 'nin'].includes(criterion.operator) &&
        !Array.isArray(criterion.value)
      ) {
        errors.push(`Operator ${criterion.operator} requires array value`);
      }

      if (
        criterion.operator === 'between' &&
        (!Array.isArray(criterion.value) || criterion.value.length !== 2)
      ) {
        errors.push('Between operator requires array with exactly 2 values');
      }

      if (
        criterion.operator === 'exists' &&
        typeof criterion.value !== 'boolean'
      ) {
        errors.push('Exists operator requires boolean value');
      }

      // Validate regex
      if (criterion.operator === 'regex') {
        try {
          new RegExp(criterion.value);
        } catch {
          errors.push('Invalid regex pattern');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async createSearchPreset(
    preset: Omit<SearchPreset, 'id'>
  ): Promise<SearchPreset> {
    const newPreset: SearchPreset = {
      ...preset,
      id: crypto.randomUUID(),
    };

    // In a real implementation, this would be saved to database
    this.systemPresets.push(newPreset);

    return newPreset;
  }

  async getSearchPresets(workspaceId: string): Promise<SearchPreset[]> {
    // Return system presets and workspace-specific presets
    return this.systemPresets.filter(
      preset => preset.isSystem || preset.workspaceId === workspaceId
    );
  }

  async applySearchPreset(
    presetId: string,
    baseQuery: string,
    workspaceId: string
  ): Promise<SearchQuery> {
    const preset = this.systemPresets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error('Search preset not found');
    }

    const filters = this.convertFilterGroupToQueryFilters(preset.filters);

    return SearchQuery.create({
      query: baseQuery,
      workspaceId,
      entityTypes: preset.entityTypes,
      filters,
      sortBy: preset.sortBy,
      sortOrder: preset.sortOrder,
    });
  }

  async getFilterSuggestions(
    field: string,
    partialValue: string,
    workspaceId: string
  ): Promise<Array<{ label: string; value: any }>> {
    // This would query the search index for unique values in the specified field
    // For now, return mock suggestions based on field type

    const suggestions: Array<{ label: string; value: any }> = [];

    switch (field) {
      case 'status':
        const statuses = [
          'todo',
          'in_progress',
          'review',
          'completed',
          'cancelled',
        ];
        suggestions.push(
          ...statuses
            .filter(status => status.includes(partialValue.toLowerCase()))
            .map(status => ({
              label: status.replace('_', ' ').toUpperCase(),
              value: status,
            }))
        );
        break;

      case 'priority':
        const priorities = ['low', 'medium', 'high', 'urgent'];
        suggestions.push(
          ...priorities
            .filter(priority => priority.includes(partialValue.toLowerCase()))
            .map(priority => ({
              label: priority.toUpperCase(),
              value: priority,
            }))
        );
        break;

      case 'assignee':
        // Would query users in workspace
        suggestions.push(
          { label: 'John Doe', value: 'user-1' },
          { label: 'Jane Smith', value: 'user-2' }
        );
        break;

      case 'tags':
        // Would query existing tags
        const commonTags = ['bug', 'feature', 'urgent', 'backend', 'frontend'];
        suggestions.push(
          ...commonTags
            .filter(tag => tag.includes(partialValue.toLowerCase()))
            .map(tag => ({ label: tag, value: tag }))
        );
        break;
    }

    return suggestions.slice(0, 10);
  }

  async buildFacetedSearch(query: SearchQuery): Promise<{
    results: SearchResult;
    facets: Record<string, Record<string, number>>;
    appliedFilters: FilterCriteria[];
    suggestedFilters: FilterCriteria[];
  }> {
    // Execute the search
    const results = await this.searchIndexRepository.search(query);

    // Get facets
    const facets = await this.searchIndexRepository.getFacets(query);

    // Extract applied filters from query
    const appliedFilters = this.extractAppliedFilters(query);

    // Generate suggested filters based on results
    const suggestedFilters = await this.generateSuggestedFilters(
      results,
      query
    );

    return {
      results,
      facets,
      appliedFilters,
      suggestedFilters,
    };
  }

  async createSavedSearchWithFilters(
    userId: string,
    workspaceId: string,
    name: string,
    query: string,
    filterGroup: FilterGroup,
    options: {
      description?: string;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<SavedSearch> {
    const filters = this.convertFilterGroupToQueryFilters(filterGroup);

    const savedSearch = SavedSearch.create({
      userId,
      workspaceId,
      name,
      description: options.description,
      query,
      filters,
      isShared: options.isShared || false,
      sharedWith: options.sharedWith || [],
      isDefault: false,
      sortBy: options.sortBy || 'relevance',
      sortOrder: options.sortOrder || 'desc',
    });

    return await this.savedSearchRepository.create(savedSearch);
  }

  async getSearchHistory(
    userId: string,
    workspaceId: string,
    limit = 20
  ): Promise<
    Array<{
      query: string;
      filters: FilterGroup;
      timestamp: Date;
      resultCount: number;
    }>
  > {
    // This would be implemented with a search history table
    // For now, return empty array
    return [];
  }

  private initializeSystemPresets(): void {
    // My Tasks preset
    this.systemPresets.push({
      id: 'my-tasks',
      name: 'My Tasks',
      description: 'Tasks assigned to me',
      filters: {
        criteria: [
          {
            field: 'assignee',
            operator: 'eq',
            value: '{{currentUserId}}', // Template variable
          },
          {
            field: 'status',
            operator: 'nin',
            value: ['completed', 'cancelled'],
          },
        ],
        logicalOperator: 'AND',
      },
      sortBy: 'dueDate',
      sortOrder: 'asc',
      entityTypes: ['task'],
      isSystem: true,
      workspaceId: '',
    });

    // Overdue Tasks preset
    this.systemPresets.push({
      id: 'overdue-tasks',
      name: 'Overdue Tasks',
      description: 'Tasks that are past their due date',
      filters: {
        criteria: [
          {
            field: 'dueDate',
            operator: 'lt',
            value: '{{today}}',
          },
          {
            field: 'status',
            operator: 'nin',
            value: ['completed', 'cancelled'],
          },
        ],
        logicalOperator: 'AND',
      },
      sortBy: 'dueDate',
      sortOrder: 'asc',
      entityTypes: ['task'],
      isSystem: true,
      workspaceId: '',
    });

    // High Priority preset
    this.systemPresets.push({
      id: 'high-priority',
      name: 'High Priority',
      description: 'High and urgent priority items',
      filters: {
        criteria: [
          {
            field: 'priority',
            operator: 'in',
            value: ['high', 'urgent'],
          },
        ],
        logicalOperator: 'AND',
      },
      sortBy: 'priority',
      sortOrder: 'desc',
      entityTypes: ['task', 'project'],
      isSystem: true,
      workspaceId: '',
    });

    // Recent Activity preset
    this.systemPresets.push({
      id: 'recent-activity',
      name: 'Recent Activity',
      description: 'Recently updated items',
      filters: {
        criteria: [
          {
            field: 'updatedAt',
            operator: 'gte',
            value: '{{last7Days}}',
          },
        ],
        logicalOperator: 'AND',
      },
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      entityTypes: ['task', 'project', 'comment'],
      isSystem: true,
      workspaceId: '',
    });
  }

  private initializeDynamicFilters(): void {
    // Task filters
    const taskFilters: DynamicFilter[] = [
      {
        id: 'task-status',
        name: 'Status',
        field: 'status',
        type: 'select',
        options: [
          { label: 'To Do', value: 'todo' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Review', value: 'review' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
      {
        id: 'task-priority',
        name: 'Priority',
        field: 'priority',
        type: 'select',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Urgent', value: 'urgent' },
        ],
      },
      {
        id: 'task-assignee',
        name: 'Assignee',
        field: 'assignee',
        type: 'select',
        // Options would be loaded dynamically from workspace users
      },
      {
        id: 'task-due-date',
        name: 'Due Date',
        field: 'dueDate',
        type: 'date',
      },
      {
        id: 'task-estimated-hours',
        name: 'Estimated Hours',
        field: 'estimatedHours',
        type: 'range',
        validation: { min: 0, max: 1000 },
      },
      {
        id: 'task-tags',
        name: 'Tags',
        field: 'tags',
        type: 'multiselect',
        // Options would be loaded dynamically from existing tags
      },
    ];

    this.dynamicFilters.set('task', taskFilters);

    // Project filters
    const projectFilters: DynamicFilter[] = [
      {
        id: 'project-status',
        name: 'Status',
        field: 'status',
        type: 'select',
        options: [
          { label: 'Planning', value: 'planning' },
          { label: 'Active', value: 'active' },
          { label: 'On Hold', value: 'on_hold' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
      {
        id: 'project-owner',
        name: 'Owner',
        field: 'owner',
        type: 'select',
      },
      {
        id: 'project-start-date',
        name: 'Start Date',
        field: 'startDate',
        type: 'date',
      },
      {
        id: 'project-end-date',
        name: 'End Date',
        field: 'endDate',
        type: 'date',
      },
    ];

    this.dynamicFilters.set('project', projectFilters);

    // Comment filters
    const commentFilters: DynamicFilter[] = [
      {
        id: 'comment-author',
        name: 'Author',
        field: 'author',
        type: 'select',
      },
      {
        id: 'comment-created',
        name: 'Created Date',
        field: 'createdAt',
        type: 'date',
      },
    ];

    this.dynamicFilters.set('comment', commentFilters);

    // File filters
    const fileFilters: DynamicFilter[] = [
      {
        id: 'file-type',
        name: 'File Type',
        field: 'fileType',
        type: 'select',
        options: [
          { label: 'Document', value: 'document' },
          { label: 'Image', value: 'image' },
          { label: 'Video', value: 'video' },
          { label: 'Archive', value: 'archive' },
          { label: 'Other', value: 'other' },
        ],
      },
      {
        id: 'file-size',
        name: 'File Size (MB)',
        field: 'fileSize',
        type: 'range',
        validation: { min: 0, max: 1000 },
      },
      {
        id: 'file-uploaded-by',
        name: 'Uploaded By',
        field: 'uploadedBy',
        type: 'select',
      },
    ];

    this.dynamicFilters.set('file', fileFilters);
  }

  private getCommonFilters(): DynamicFilter[] {
    return [
      {
        id: 'created-date',
        name: 'Created Date',
        field: 'createdAt',
        type: 'date',
      },
      {
        id: 'updated-date',
        name: 'Updated Date',
        field: 'updatedAt',
        type: 'date',
      },
      {
        id: 'entity-type',
        name: 'Type',
        field: 'entityType',
        type: 'multiselect',
        options: [
          { label: 'Tasks', value: 'task' },
          { label: 'Projects', value: 'project' },
          { label: 'Comments', value: 'comment' },
          { label: 'Files', value: 'file' },
        ],
      },
    ];
  }

  private async getCustomFilters(
    workspaceId: string
  ): Promise<DynamicFilter[]> {
    // This would load custom filters from database
    return [];
  }

  private convertFilterGroupToQueryFilters(
    filterGroup: FilterGroup
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    for (const criterion of filterGroup.criteria) {
      const filterValue = this.convertCriterionToFilterValue(criterion);
      if (filterValue !== undefined) {
        filters[criterion.field] = filterValue;
      }
    }

    // Handle nested groups (simplified for now)
    if (filterGroup.groups) {
      for (const group of filterGroup.groups) {
        const groupFilters = this.convertFilterGroupToQueryFilters(group);
        Object.assign(filters, groupFilters);
      }
    }

    return filters;
  }

  private convertCriterionToFilterValue(criterion: FilterCriteria): any {
    switch (criterion.operator) {
      case 'eq':
        return criterion.value;
      case 'ne':
        return { not: criterion.value };
      case 'in':
        return { in: criterion.value };
      case 'nin':
        return { notIn: criterion.value };
      case 'gt':
        return { '>': criterion.value };
      case 'gte':
        return { '>=': criterion.value };
      case 'lt':
        return { '<': criterion.value };
      case 'lte':
        return { '<=': criterion.value };
      case 'contains':
        return { contains: criterion.value };
      case 'startsWith':
        return { startsWith: criterion.value };
      case 'endsWith':
        return { endsWith: criterion.value };
      case 'between':
        return { '>=': criterion.value[0], '<=': criterion.value[1] };
      case 'exists':
        return criterion.value ? { not: null } : null;
      case 'regex':
        return { regex: criterion.value };
      default:
        return undefined;
    }
  }

  private extractAppliedFilters(query: SearchQuery): FilterCriteria[] {
    const criteria: FilterCriteria[] = [];

    for (const [field, value] of Object.entries(query.filters)) {
      if (typeof value === 'object' && value !== null) {
        // Handle complex filter objects
        for (const [operator, operatorValue] of Object.entries(value)) {
          criteria.push({
            field,
            operator: this.mapOperatorToCriterion(operator),
            value: operatorValue,
          });
        }
      } else {
        // Handle simple equality filters
        criteria.push({
          field,
          operator: 'eq',
          value,
        });
      }
    }

    return criteria;
  }

  private mapOperatorToCriterion(operator: string): FilterCriteria['operator'] {
    const mapping: Record<string, FilterCriteria['operator']> = {
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte',
      in: 'in',
      notIn: 'nin',
      contains: 'contains',
      startsWith: 'startsWith',
      endsWith: 'endsWith',
      not: 'ne',
      regex: 'regex',
    };

    return mapping[operator] || 'eq';
  }

  private async generateSuggestedFilters(
    results: SearchResult,
    query: SearchQuery
  ): Promise<FilterCriteria[]> {
    const suggestions: FilterCriteria[] = [];

    // Analyze results to suggest useful filters
    if (results.facets.entityType) {
      const entityTypes = Object.keys(results.facets.entityType);
      if (entityTypes.length > 1 && !query.filters.entityType) {
        suggestions.push({
          field: 'entityType',
          operator: 'in',
          value: entityTypes.slice(0, 2), // Suggest top 2 entity types
        });
      }
    }

    // Suggest status filter if not applied
    if (results.facets.status && !query.filters.status) {
      const topStatuses = Object.entries(results.facets.status)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([status]) => status);

      if (topStatuses.length > 0) {
        suggestions.push({
          field: 'status',
          operator: 'in',
          value: topStatuses,
        });
      }
    }

    return suggestions;
  }
}
