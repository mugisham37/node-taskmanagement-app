/**
 * Rate limiting service interface
 */
export interface IRateLimitService {
  /**
   * Check if client has exceeded rate limit
   */
  checkLimit(
    clientId: string,
    max: number,
    timeWindow: string
  ): Promise<boolean>;

  /**
   * Get current rate limit status for client
   */
  getStatus(clientId: string): Promise<{
    remaining: number;
    resetTime: Date;
    total: number;
  }>;

  /**
   * Reset rate limit for client
   */
  reset(clientId: string): Promise<void>;
}
