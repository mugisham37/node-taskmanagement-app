import { SQL, sql } from 'drizzle-orm';

/**
 * Type definitions for safe SQL fragment handling
 */
export type SafeSQL = SQL<unknown>;
export type OptionalSQL = SQL<unknown> | undefined;
export type NullableSQL = SQL<unknown> | null;

/**
 * Type guard functions for SQL fragments
 */
export function isSQLFragment(value: unknown): value is SQL<unknown> {
  return value !== undefined && value !== null && typeof value === 'object';
}

export function isOptionalSQL(value: OptionalSQL): value is SQL<unknown> {
  return value !== undefined;
}

/**
 * Default SQL fragments for common use cases
 */
export const SQLDefaults = {
  ALWAYS_TRUE: sql`1=1`,
  ALWAYS_FALSE: sql`1=0`,
  EMPTY: sql``,
} as const;

/**
 * Safe SQL operations that handle undefined values gracefully
 */
export function ensureSQL(fragment: OptionalSQL, defaultValue?: SQL<unknown>): SQL<unknown> {
  return fragment ?? defaultValue ?? SQLDefaults.ALWAYS_TRUE;
}

export function ensureSQLOrNull(fragment: OptionalSQL): NullableSQL {
  return fragment ?? null;
}

/**
 * Filter out undefined SQL fragments from an array
 */
export function filterValidSQL(fragments: OptionalSQL[]): SQL<unknown>[] {
  return fragments.filter((fragment): fragment is SQL<unknown> => fragment !== undefined);
}

/**
 * Safely combine SQL fragments with AND logic
 */
export function safeAnd(...fragments: OptionalSQL[]): SQL<unknown> | null {
  const validFragments = filterValidSQL(fragments);
  
  if (validFragments.length === 0) return null;
  if (validFragments.length === 1) return validFragments[0];
  
  // Import and here to avoid circular dependency
  const { and } = require('drizzle-orm');
  return and(...validFragments);
}

/**
 * Safely combine SQL fragments with OR logic
 */
export function safeOr(...fragments: OptionalSQL[]): SQL<unknown> | null {
  const validFragments = filterValidSQL(fragments);
  
  if (validFragments.length === 0) return null;
  if (validFragments.length === 1) return validFragments[0];
  
  // Import or here to avoid circular dependency
  const { or } = require('drizzle-orm');
  return or(...validFragments);
}

/**
 * Convert a potentially undefined SQL fragment to a safe SQL fragment
 * with a fallback for common query building scenarios
 */
export function toSafeSQL(fragment: OptionalSQL, fallback: 'true' | 'false' | 'empty' = 'empty'): SQL<unknown> {
  if (fragment !== undefined) return fragment;
  
  switch (fallback) {
    case 'true':
      return SQLDefaults.ALWAYS_TRUE;
    case 'false':
      return SQLDefaults.ALWAYS_FALSE;
    case 'empty':
    default:
      return SQLDefaults.EMPTY;
  }
}
