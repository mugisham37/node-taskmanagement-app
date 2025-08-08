import type { SQL } from 'drizzle-orm'
import { and, or, eq, ne, gt, gte, lt, lte, inArray, notInArray, like, ilike, between, desc, asc, count } from 'drizzle-orm'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'
import type { PgSelect } from 'drizzle-orm/pg-core'
import { safeAnd, safeOr, ensureSQLOrNull, filterValidSQL, type OptionalSQL } from '../types/sql-types'

/**
 * API Features class for handling filtering, sorting, pagination with Drizzle ORM
 * This utility helps create consistent and reusable query building for PostgreSQL
 */

export interface QueryParams {
  page?: string
  limit?: string
  sort?: string
  fields?: string
  search?: string
  fromDate?: string
  toDate?: string
  tags?: string
  [key: string]: any
}

export interface PaginationResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export class APIFeatures<T extends PgTable> {
  private query: PgSelect
  private queryString: QueryParams
  private table: T
  private totalCount = 0
  private page = 1
  private limit = 10
  private totalPages = 1
  private db: any
  private whereConditions: SQL[] = []

  /**
   * @param db Drizzle database instance
   * @param table Drizzle table schema
   * @param queryString Express request query object
   */
  constructor(db: any, table: T, queryString: QueryParams) {
    this.db = db
    this.table = table
    this.queryString = queryString
    this.query = db.select().from(table)
  }

  /**
   * Filter the query based on query parameters
   * Excludes special query parameters like page, limit, sort, fields, search
   */
  filter(): APIFeatures<T> {
    const queryObj = { ...this.queryString }
    const excludedFields = ['page', 'limit', 'sort', 'fields', 'search', 'fromDate', 'toDate', 'tags']
    excludedFields.forEach((field) => delete queryObj[field])

    // Handle special case for 'all' value
    Object.keys(queryObj).forEach((key) => {
      if (queryObj[key] === 'all') {
        delete queryObj[key]
      }
    })

    const conditions: SQL[] = []

    // Handle date range filtering
    if (this.queryString.fromDate || this.queryString.toDate) {
      const dateColumn = this.getColumnByName('dueDate') || this.getColumnByName('createdAt')
      if (dateColumn) {
        try {
          if (this.queryString.fromDate && this.queryString.toDate) {
            conditions.push(
              between(dateColumn, new Date(this.queryString.fromDate), new Date(this.queryString.toDate))
            )
          } else if (this.queryString.fromDate) {
            conditions.push(gte(dateColumn, new Date(this.queryString.fromDate)))
          } else if (this.queryString.toDate) {
            conditions.push(lte(dateColumn, new Date(this.queryString.toDate)))
          }
        } catch (error) {
          // Skip invalid date conditions
        }
      }
    }

    // Handle tags filtering (comma-separated list)
    if (this.queryString.tags) {
      const tagsColumn = this.getColumnByName('tags')
      if (tagsColumn) {
        try {
          const tags = this.queryString.tags.split(',').map((tag: string) => tag.trim())
          // For PostgreSQL arrays, we'd use array operators, but for simplicity using LIKE
          const tagConditions: SQL[] = []
          tags.forEach(tag => {
            tagConditions.push(like(tagsColumn, `%${tag}%`))
          })
          if (tagConditions.length > 0) {
            const safeTagCondition = safeOr(...tagConditions)
            if (safeTagCondition) {
              conditions.push(safeTagCondition)
            }
          }
        } catch (error) {
          // Skip invalid tag conditions
        }
      }
    }

    // Handle other filters
    Object.entries(queryObj).forEach(([key, value]) => {
      const column = this.getColumnByName(key)
      if (column && value !== undefined) {
        // Handle advanced filtering with operators
        if (typeof value === 'string' && value.includes('$')) {
          const operatorMatch = value.match(/\$(\w+):(.+)/)
          if (operatorMatch) {
            const [, operator, operatorValue] = operatorMatch
            const condition = this.buildOperatorCondition(column, operator, operatorValue)
            if (condition) {
              conditions.push(condition)
            }
          }
        } else {
          conditions.push(eq(column, value))
        }
      }
    })

    // Store conditions for later use in count query
    this.whereConditions = [...conditions]

    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions)
      this.query = this.query.where(whereCondition)
    }

    return this
  }

  /**
   * Sort the query results
   * Supports multiple sort fields (comma-separated) and descending sort (prefix with -)
   */
  sort(): APIFeatures<T> {
    if (this.queryString.sort) {
      const sortFields = this.queryString.sort.split(',')
      const orderBy: SQL[] = []

      sortFields.forEach(field => {
        const isDescending = field.startsWith('-')
        const fieldName = isDescending ? field.substring(1) : field
        const column = this.getColumnByName(fieldName)
        
        if (column) {
          orderBy.push(isDescending ? desc(column) : asc(column))
        }
      })

      if (orderBy.length > 0) {
        this.query = this.query.orderBy(...orderBy)
      }
    } else {
      // Default sort by createdAt descending (newest first)
      const createdAtColumn = this.getColumnByName('createdAt')
      if (createdAtColumn) {
        this.query = this.query.orderBy(desc(createdAtColumn))
      }
    }

    return this
  }

  /**
   * Limit the fields returned in the query results
   * Note: Drizzle ORM handles field selection differently than Mongoose
   */
  limitFields(): APIFeatures<T> {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',')
      const selectFields: Record<string, PgColumn> = {}
      
      fields.forEach(field => {
        const column = this.getColumnByName(field.trim())
        if (column) {
          selectFields[field.trim()] = column
        }
      })

      if (Object.keys(selectFields).length > 0) {
        // Rebuild query with selected fields and existing conditions
        this.query = this.db.select(selectFields).from(this.table)
        if (this.whereConditions.length > 0) {
          const whereCondition = this.whereConditions.length === 1 ? this.whereConditions[0] : and(...this.whereConditions)
          this.query = this.query.where(whereCondition)
        }
      }
    }

    return this
  }

  /**
   * Paginate the query results
   * Supports page and limit parameters
   */
  paginate(): APIFeatures<T> {
    this.page = parseInt(this.queryString.page || '1', 10)
    this.limit = parseInt(this.queryString.limit || '10', 10)

    // Ensure page and limit are positive
    if (this.page < 1) this.page = 1
    if (this.limit < 1) this.limit = 10
    if (this.limit > 100) this.limit = 100

    const offset = (this.page - 1) * this.limit
    this.query = this.query.limit(this.limit).offset(offset)

    return this
  }

  /**
   * Search in specified fields
   * @param fields Array of field names to search in
   */
  search(fields: string[]): APIFeatures<T> {
    if (this.queryString.search && fields.length > 0) {
      const searchTerm = `%${this.queryString.search}%`
      const searchConditions: SQL[] = []

      fields.forEach(field => {
        const column = this.getColumnByName(field)
        if (column) {
          searchConditions.push(ilike(column, searchTerm))
        }
      })

      if (searchConditions.length > 0) {
        const searchCondition = safeOr(...searchConditions)
        if (searchCondition) {
          this.whereConditions.push(searchCondition)
          
          // Rebuild query with all conditions
          const allConditions = safeAnd(...this.whereConditions)
          if (allConditions) {
            this.query = this.db.select().from(this.table).where(allConditions)
          }
        }
      }
    }

    return this
  }

  /**
   * Execute the query and return results with pagination metadata
   */
  async execute(): Promise<PaginationResult<any>> {
    // Get total count first
    let countQuery = this.db.select({ count: count() }).from(this.table)
    
    // Apply the same where conditions to count query using stored conditions
    if (this.whereConditions.length > 0) {
      const whereCondition = this.whereConditions.length === 1 ? this.whereConditions[0] : and(...this.whereConditions)
      countQuery = countQuery.where(whereCondition)
    }

    // Execute both queries
    const [data, totalResult] = await Promise.all([
      this.query,
      countQuery
    ])

    this.totalCount = totalResult[0]?.count || 0
    this.totalPages = Math.ceil(this.totalCount / this.limit) || 1

    return {
      data: data as any[],
      total: this.totalCount,
      page: this.page,
      limit: this.limit,
      pages: this.totalPages,
      hasNext: this.page < this.totalPages,
      hasPrev: this.page > 1,
    }
  }

  /**
   * Get column by name from table schema
   * @param columnName Name of the column
   * @returns Column reference or undefined
   */
  private getColumnByName(columnName: string): PgColumn | undefined {
    try {
      // Access table columns - this depends on your table schema structure
      const columns = (this.table as any)[Symbol.for('drizzle:Columns')] || (this.table as any)._.columns
      return columns?.[columnName]
    } catch (error) {
      return undefined
    }
  }

  /**
   * Build operator condition for advanced filtering
   * @param column Column reference
   * @param operator Operator string
   * @param value Value to compare
   * @returns SQL condition or null if invalid
   */
  private buildOperatorCondition(column: PgColumn, operator: string, value: string): SQL | null {
    try {
      switch (operator) {
        case 'gt':
          return gt(column, value)
        case 'gte':
          return gte(column, value)
        case 'lt':
          return lt(column, value)
        case 'lte':
          return lte(column, value)
        case 'ne':
          return ne(column, value)
        case 'in':
          return inArray(column, value.split(','))
        case 'nin':
          return notInArray(column, value.split(','))
        case 'like':
          return like(column, `%${value}%`)
        case 'ilike':
          return ilike(column, `%${value}%`)
        default:
          return eq(column, value)
      }
    } catch (error) {
      // Return null if operator fails
      return null
    }
  }

  /**
   * Get the current query for advanced usage
   */
  getQuery(): PgSelect {
    return this.query
  }

  /**
   * Reset the query to start fresh
   */
  reset(): APIFeatures<T> {
    this.query = this.db.select().from(this.table)
    this.whereConditions = []
    return this
  }
}

/**
 * Helper function to create APIFeatures instance
 * @param db Drizzle database instance
 * @param table Drizzle table schema
 * @param queryString Query parameters
 * @returns APIFeatures instance
 */
export const createAPIFeatures = <T extends PgTable>(
  db: any,
  table: T,
  queryString: QueryParams
): APIFeatures<T> => {
  return new APIFeatures(db, table, queryString)
}

/**
 * Helper function for common query patterns
 */
export const queryHelpers = {
  /**
   * Build date range condition
   */
  dateRange: (column: PgColumn, fromDate?: string, toDate?: string): SQL | null => {
    try {
      if (!fromDate && !toDate) return null
      
      if (fromDate && toDate) {
        return between(column, new Date(fromDate), new Date(toDate))
      } else if (fromDate) {
        return gte(column, new Date(fromDate))
      } else if (toDate) {
        return lte(column, new Date(toDate))
      }
      
      return null
    } catch (error) {
      return null
    }
  },

  /**
   * Build search condition across multiple fields
   */
  multiFieldSearch: (columns: PgColumn[], searchTerm: string): SQL | null => {
    try {
      if (columns.length === 0) return null
      
      const searchConditions = columns.map(column => 
        ilike(column, `%${searchTerm}%`)
      )
      return safeOr(...searchConditions)
    } catch (error) {
      return null
    }
  },

  /**
   * Build pagination metadata
   */
  buildPaginationMeta: (total: number, page: number, limit: number) => ({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  }),
}

export default APIFeatures
