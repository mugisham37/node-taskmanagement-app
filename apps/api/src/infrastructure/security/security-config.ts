/**
 * Security Configuration
 */

export interface SecurityConfig {
  cors: {
    origin: string[];
    credentials: boolean;
    optionsSuccessStatus: number;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
  };
  rateLimit: {
    max: number;
    timeWindow: number;
    errorResponseBuilder?: (request: any, reply: any) => any;
  };
  authentication: {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  },
  helmet: {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
  },
  authentication: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
  },
};

export function getSecurityConfig(): SecurityConfig {
  return {
    ...defaultSecurityConfig,
    cors: {
      ...defaultSecurityConfig.cors,
      origin: process.env.CORS_ORIGIN?.split(',') || defaultSecurityConfig.cors.origin,
    },
    authentication: {
      ...defaultSecurityConfig.authentication,
      jwtSecret: process.env.JWT_SECRET || defaultSecurityConfig.authentication.jwtSecret,
    },
  };
}
