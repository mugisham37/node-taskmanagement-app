/**
 * Database types and interfaces
 */

import { projects, projectMembers } from '../schema';

// Extract types from schema
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;
export type ProjectMemberInsert = typeof projectMembers.$inferInsert;

// Database enum values
export type DbProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type DbProjectRole = 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';

// Join result types
export interface ProjectWithMemberRow {
  projects: ProjectRow;
  project_members: ProjectMemberRow;
}

export interface ProjectMemberWithUserRow {
  project_members: ProjectMemberRow;
  users: {
    id: string;
    email: string;
    name: string;
  };
}
