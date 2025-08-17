# Multi-stage Dockerfile for API application
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
COPY apps/api/package.json ./apps/api/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build:api

# Production stage
FROM node:18-alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/packages ./packages

# Copy necessary configuration files
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=build --chown=nodejs:nodejs /app/turbo.json ./

# Create directories for logs and temp files
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/index.js"]

# Labels for metadata
LABEL maintainer="TaskManagement Team <team@taskmanagement.com>"
LABEL version="1.0.0"
LABEL description="TaskManagement API Server"
LABEL org.opencontainers.image.source="https://github.com/taskmanagement/app"
LABEL org.opencontainers.image.documentation="https://docs.taskmanagement.com"
LABEL org.opencontainers.image.licenses="MIT"