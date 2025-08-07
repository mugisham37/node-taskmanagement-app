import winston from 'winston';
import { config } from '@/infrastructure/config/environment';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  config.logging.format === 'json'
    ? winston.format.json()
    : winston.format.simple()
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'unified-enterprise-platform',
    environment: config.app.environment,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (config.app.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

// Create child loggers for different domains
export const createDomainLogger = (domain: string): winston.Logger => {
  return logger.child({ domain });
};

export const authLogger = createDomainLogger('authentication');
export const taskLogger = createDomainLogger('task-management');
export const calendarLogger = createDomainLogger('calendar');
export const collaborationLogger = createDomainLogger('collaboration');
export const notificationLogger = createDomainLogger('notification');
export const analyticsLogger = createDomainLogger('analytics');
export const auditLogger = createDomainLogger('audit');
export const fileLogger = createDomainLogger('file-management');
export const integrationLogger = createDomainLogger('integration');