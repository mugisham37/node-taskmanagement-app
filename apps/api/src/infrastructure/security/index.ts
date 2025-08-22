/**
 * Security Infrastructure
 */

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string[];
}

export const defaultSecurityConfig: SecurityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  jwtExpiresIn: '1h',
  corsOrigin: ['http://localhost:3000'],
};

export class SecurityUtils {
  static sanitizeInput(input: string): string {
    return input.replace(/[<>]/g, '').trim();
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
