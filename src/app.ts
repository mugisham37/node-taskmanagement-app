import express, { type Request } from 'express';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rate-limiter.middleware';
import {
  configureSecurityMiddleware,
  validateContentType,
} from './middleware/security.middleware';
import { performanceMonitor } from '../shared/utils/performance-monitor';
import { requestLogger, stream } from '../shared/config/logger';
import { apiVersionMiddleware } from './middleware/api-version.middleware';
import {
  i18nMiddleware,
  languageMiddleware,
  translationMiddleware,
} from './middleware/i18n.middleware';
import routes from './routes';
import config from '../shared/config/environment';
import { setupSwagger } from '../shared/config/swagger';

// Create Express app
const app = express();

// Configure security middleware
configureSecurityMiddleware(app);

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(
    morgan('combined', {
      stream,
      skip: (req: Request) =>
        req.url === '/health' || req.url.startsWith('/health/'),
    })
  );
}

// Request context logger
app.use(requestLogger);

// Performance monitoring
app.use(performanceMonitor);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Validate content type
app.use(
  validateContentType([
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ])
);

// Cookie parser
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Rate limiting
app.use(rateLimiter);

// Internationalization middleware
app.use(i18nMiddleware);
app.use(languageMiddleware);
app.use(translationMiddleware);

// API version middleware
app.use(apiVersionMiddleware);

// API routes
app.use(routes);

// Swagger documentation
setupSwagger(app);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
