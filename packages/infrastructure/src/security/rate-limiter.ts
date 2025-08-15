export interface RateLimitRule {
  id: string;
  name: string;
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  totalHits: number;
}

export interface RateLimiter {
  /**
   * Check if request is allowed under rate limit
   */
  checkLimit(identifier: string, rule: RateLimitRule): Promise<RateLimitResult>;

  /**
   * Reset rate limit for identifier
   */
  resetLimit(identifier: string, ruleId: string): Promise<void>;

  /**
   * Get current rate limit status
   */
  getStatus(identifier: string, ruleId: string): Promise<RateLimitResult | null>;

  /**
   * Create a rate limit rule
   */
  createRule(rule: Omit<RateLimitRule, 'id'>): RateLimitRule;
}

interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

export class DefaultRateLimiter implements RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private rules = new Map<string, RateLimitRule>();

  async checkLimit(identifier: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const key = this.generateKey(identifier, rule);
    const now = new Date();
    
    let entry = this.limits.get(key);
    
    // Clean up expired entries
    if (entry && now > entry.resetTime) {
      this.limits.delete(key);
      entry = undefined;
    }

    if (!entry) {
      // First request in window
      entry = {
        count: 1,
        resetTime: new Date(now.getTime() + rule.windowMs),
        firstRequest: now,
      };
      this.limits.set(key, entry);

      return {
        allowed: true,
        remainingRequests: rule.maxRequests - 1,
        resetTime: entry.resetTime,
        totalHits: 1,
      };
    }

    // Increment counter
    entry.count++;

    const allowed = entry.count <= rule.maxRequests;
    const remainingRequests = Math.max(0, rule.maxRequests - entry.count);

    return {
      allowed,
      remainingRequests,
      resetTime: entry.resetTime,
      totalHits: entry.count,
    };
  }

  async resetLimit(identifier: string, ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) return;

    const key = this.generateKey(identifier, rule);
    this.limits.delete(key);
  }

  async getStatus(identifier: string, ruleId: string): Promise<RateLimitResult | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const key = this.generateKey(identifier, rule);
    const entry = this.limits.get(key);
    const now = new Date();

    if (!entry || now > entry.resetTime) {
      return {
        allowed: true,
        remainingRequests: rule.maxRequests,
        resetTime: new Date(now.getTime() + rule.windowMs),
        totalHits: 0,
      };
    }

    const allowed = entry.count < rule.maxRequests;
    const remainingRequests = Math.max(0, rule.maxRequests - entry.count);

    return {
      allowed,
      remainingRequests,
      resetTime: entry.resetTime,
      totalHits: entry.count,
    };
  }

  createRule(rule: Omit<RateLimitRule, 'id'>): RateLimitRule {
    const fullRule: RateLimitRule = {
      ...rule,
      id: this.generateRuleId(),
    };

    this.rules.set(fullRule.id, fullRule);
    return fullRule;
  }

  private generateKey(identifier: string, rule: RateLimitRule): string {
    const key = rule.keyGenerator ? rule.keyGenerator(identifier) : identifier;
    return `${rule.id}:${key}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get statistics about rate limiting
   */
  getStats(): {
    totalEntries: number;
    totalRules: number;
    activeEntries: number;
  } {
    const now = new Date();
    let activeEntries = 0;

    for (const entry of this.limits.values()) {
      if (now <= entry.resetTime) {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.limits.size,
      totalRules: this.rules.size,
      activeEntries,
    };
  }
}

/**
 * Create default rate limiter with cleanup interval
 */
export function createRateLimiter(cleanupIntervalMs: number = 60000): DefaultRateLimiter {
  const limiter = new DefaultRateLimiter();
  
  // Set up periodic cleanup
  setInterval(() => {
    limiter.cleanup();
  }, cleanupIntervalMs);

  return limiter;
}