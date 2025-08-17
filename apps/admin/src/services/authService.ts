import { adminConfig } from '@/config/app.config';
import { AuthResult, LoginCredentials, User } from '@taskmanagement/types';

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = adminConfig.api.baseUrl;
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  }

  async verifyMFA(token: string, mfaCode: string): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/auth/admin/verify-mfa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, mfaCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'MFA verification failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Token refresh failed');
    }

    return response.json();
  }

  async logout(): Promise<void> {
    const token = this.getStoredToken();
    
    if (token) {
      try {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Logout on server failed, but we'll still clear local storage
        console.error('Server logout failed:', error);
      }
    }

    // Clear local storage
    this.clearStoredTokens();
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get current user');
    }

    return response.json();
  }

  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send password reset email');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reset password');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to change password');
    }
  }

  async setupMFA(): Promise<{ qrCode: string; secret: string; backupCodes: string[] }> {
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/auth/mfa/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to setup MFA');
    }

    return response.json();
  }

  async enableMFA(token: string): Promise<{ backupCodes: string[] }> {
    const authToken = this.getStoredToken();
    
    if (!authToken) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/auth/mfa/enable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to enable MFA');
    }

    return response.json();
  }

  async disableMFA(password: string): Promise<void> {
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/auth/mfa/disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disable MFA');
    }
  }

  // Token management
  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(adminConfig.auth.tokenKey);
  }

  private getStoredRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(adminConfig.auth.refreshTokenKey);
  }

  private clearStoredTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(adminConfig.auth.tokenKey);
    localStorage.removeItem(adminConfig.auth.refreshTokenKey);
  }

  // Utility methods
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('*');
  }

  hasRole(userRoles: string[], requiredRole: string): boolean {
    return userRoles.includes(requiredRole);
  }

  hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
    return requiredRoles.some(role => userRoles.includes(role));
  }

  isAdmin(userRoles: string[]): boolean {
    return this.hasAnyRole(userRoles, adminConfig.auth.adminRoles);
  }
}

export const authService = new AuthService();