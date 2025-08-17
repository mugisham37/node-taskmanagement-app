import { adminConfig } from '@/config/app.config';
import { PaginatedResult, Permission, QueryParams, Role, User } from '@taskmanagement/types';

class UserService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = adminConfig.api.baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem(adminConfig.auth.tokenKey) 
      : null;
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async getUsers(params: QueryParams): Promise<PaginatedResult<User>> {
    const queryString = new URLSearchParams({
      page: params.page?.toString() || '1',
      pageSize: params.pageSize?.toString() || '25',
      ...(params.search && { search: params.search }),
      ...(params.sortBy && { sortBy: params.sortBy }),
      ...(params.sortOrder && { sortOrder: params.sortOrder }),
      ...(params.filters && { filters: JSON.stringify(params.filters) }),
    });

    const response = await fetch(`${this.baseUrl}/admin/users?${queryString}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch users');
    }

    return response.json();
  }

  async getUserById(userId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user');
    }

    return response.json();
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create user');
    }

    return response.json();
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update user');
    }

    return response.json();
  }

  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete user');
    }
  }

  async activateUser(userId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/activate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to activate user');
    }

    return response.json();
  }

  async deactivateUser(userId: string, reason?: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/deactivate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to deactivate user');
    }

    return response.json();
  }

  async suspendUser(userId: string, reason: string, duration?: number): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason, duration }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to suspend user');
    }

    return response.json();
  }

  async unsuspendUser(userId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/unsuspend`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to unsuspend user');
    }

    return response.json();
  }

  async resetUserPassword(userId: string, sendEmail: boolean = true): Promise<{ temporaryPassword?: string }> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ sendEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reset user password');
    }

    return response.json();
  }

  async assignRole(userId: string, roleId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/roles`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ roleId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to assign role');
    }

    return response.json();
  }

  async removeRole(userId: string, roleId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove role');
    }

    return response.json();
  }

  async bulkUpdateUsers(
    userIds: string[], 
    operation: string, 
    data?: any
  ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> {
    const response = await fetch(`${this.baseUrl}/admin/users/bulk`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ userIds, operation, data }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to perform bulk operation');
    }

    return response.json();
  }

  async exportUsers(filters?: Record<string, any>, format: 'csv' | 'xlsx' = 'csv'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/admin/users/export`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ filters, format }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to export users');
    }

    return response.blob();
  }

  async importUsers(file: File): Promise<{ successful: number; failed: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = typeof window !== 'undefined' 
      ? localStorage.getItem(adminConfig.auth.tokenKey) 
      : null;

    const response = await fetch(`${this.baseUrl}/admin/users/import`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import users');
    }

    return response.json();
  }

  // Role management
  async getRoles(): Promise<Role[]> {
    const response = await fetch(`${this.baseUrl}/admin/roles`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch roles');
    }

    return response.json();
  }

  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const response = await fetch(`${this.baseUrl}/admin/roles`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(roleData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create role');
    }

    return response.json();
  }

  async updateRole(roleId: string, roleData: Partial<Role>): Promise<Role> {
    const response = await fetch(`${this.baseUrl}/admin/roles/${roleId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(roleData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update role');
    }

    return response.json();
  }

  async deleteRole(roleId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/admin/roles/${roleId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete role');
    }
  }

  // Permission management
  async getPermissions(): Promise<Permission[]> {
    const response = await fetch(`${this.baseUrl}/admin/permissions`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch permissions');
    }

    return response.json();
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/activity?limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user activity');
    }

    return response.json();
  }

  async getUserSessions(userId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/sessions`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user sessions');
    }

    return response.json();
  }

  async terminateUserSession(userId: string, sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to terminate user session');
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    newThisMonth: number;
    growthRate: number;
  }> {
    const response = await fetch(`${this.baseUrl}/admin/users/stats`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user statistics');
    }

    return response.json();
  }
}

export const userService = new UserService();