# Multi-stage Dockerfile for Web application
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy package.json files for all packages
COPY packages/*/package.json ./packages/*/
COPY apps/web/package.json ./apps/web/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build dependencies (includes devDependencies)
FROM base AS build-deps
RUN npm ci

# Build stage
FROM build-deps AS build
COPY . .

# Build the web application
RUN npm run build:web

# Production stage
FROM node:18-alpine AS runtime

# Install security updates and nginx
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    nginx \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies (only needed for Next.js server)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=nodejs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nodejs:nodejs /app/apps/web/package.json ./apps/web/
COPY --from=build --chown=nodejs:nodejs /app/apps/web/next.config.js ./apps/web/

# Copy shared packages
COPY --from=build --chown=nodejs:nodejs /app/packages ./packages

# Copy necessary configuration files
COPY --from=build --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=build --chown=nodejs:nodejs /app/turbo.json ./

# Copy nginx configuration
COPY infrastructure/docker/nginx/web.conf /etc/nginx/http.d/default.conf

# Create directories for logs and temp files
RUN mkdir -p /app/logs /app/tmp /var/log/nginx && \
    chown -R nodejs:nodejs /app && \
    chown -R nodejs:nodejs /var/log/nginx

# Create startup script
COPY --chown=nodejs:nodejs infrastructure/docker/scripts/web-start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["/app/start.sh"]

# Labels for metadata
LABEL maintainer="TaskManagement Team <team@taskmanagement.com>"
LABEL version="1.0.0"
LABEL description="TaskManagement Web Application"
LABEL org.opencontainers.image.source="https://github.com/taskmanagement/app"
LABEL org.opencontainers.image.documentation="https://docs.taskmanagement.com"
LABEL org.opencontainers.image.licenses="MIT"