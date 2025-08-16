/**
 * Database mapping utilities
 */

import { Project, ProjectMember } from '../../../domain/entities/project';
import { ProjectId, UserId, WorkspaceId, ProjectStatusVO, ProjectRoleVO } from '../../../domain/value-objects';
import { ProjectStatus, ProjectRole } from '../../../shared/enums/common.enums';
import { ProjectRow, ProjectMemberRow, DbProjectStatus, DbProjectRole, ProjectMemberWithUserRow } from '../types';

/**
 * Map database project status to domain enum
 */
export function mapDbStatusToDomain(dbStatus: DbProjectStatus): ProjectStatus {
  return ProjectStatus[dbStatus];
}

/**
 * Map domain project status to database enum
 */
export function mapDomainStatusToDb(domainStatus: ProjectStatus): DbProjectStatus {
  return domainStatus as DbProjectStatus;
}

/**
 * Map database project role to domain enum
 */
export function mapDbRoleToDomain(dbRole: DbProjectRole): ProjectRole {
  return ProjectRole[dbRole];
}

/**
 * Map domain project role to database enum  
 */
export function mapDomainRoleToDb(domainRole: ProjectRole): DbProjectRole {
  return domainRole as DbProjectRole;
}

/**
 * Map database row to Project entity
 */
export function mapRowToProject(row: ProjectRow, members: ProjectMember[] = []): Project {
  return Project.restore(
    ProjectId.create(row.id),
    row.name,
    row.description || '',
    WorkspaceId.create(row.workspaceId),
    UserId.create(row.managerId),
    ProjectStatusVO.create(mapDbStatusToDomain(row.status)),
    row.startDate,
    row.endDate,
    members,
    row.createdAt,
    row.updatedAt
  );
}

/**
 * Map Project entity to database insert data
 */
export function mapProjectToInsert(project: Project): Omit<ProjectRow, 'createdAt' | 'updatedAt'> {
  return {
    id: project.id.value,
    name: project.name,
    description: project.description,
    workspaceId: project.workspaceId.value,
    managerId: project.managerId.value,
    status: mapDomainStatusToDb(project.status.value),
    startDate: project.startDate,
    endDate: project.endDate,
  };
}

/**
 * Map database row with user info to ProjectMember
 */
export function mapRowToProjectMember(row: ProjectMemberWithUserRow): ProjectMember {
  return {
    id: UserId.create(row.project_members.id),
    userId: UserId.create(row.project_members.userId),
    role: ProjectRoleVO.create(mapDbRoleToDomain(row.project_members.role)),
    joinedAt: row.project_members.joinedAt,
  };
}

/**
 * Map ProjectMember to database insert data
 */
export function mapProjectMemberToInsert(
  projectId: string,
  member: ProjectMember
): Omit<ProjectMemberRow, 'joinedAt'> {
  return {
    id: crypto.randomUUID(),
    projectId,
    userId: member.userId.value,
    role: mapDomainRoleToDb(member.role.value),
  };
}
