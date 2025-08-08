/**
 * Authentication service interface
 */
export interface IAuthenticationService {
  /**
   * Verify JWT token and return user information
   */
  verifyToken(token: string): Promise<any>;

  /**
   * Generate JWT tokens for user
   */
  generateTokens(
    user: any
  ): Promise<{ accessToken: string; refreshToken: string }>;

  /**
   * Refresh access token using refresh token
   */
  refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }>;

  /**
   * Revoke token
   */
  revokeToken(token: string): Promise<void>;
}
