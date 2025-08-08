# File Management and Attachment System

This document provides an overview of the comprehensive file management and attachment system implemented for the unified enterprise platform.

## Overview

The file management system provides secure, scalable, and collaborative file handling capabilities with enterprise-grade features including:

- Multi-backend storage support (Local, S3, Azure Blob)
- Comprehensive access control and permissions
- File versioning and collaboration features
- Attachment management for tasks, comments, and projects
- Real-time collaboration and conflict resolution
- Audit trails and security monitoring
- File approval workflows
- Advanced search and filtering capabilities

## Architecture

The system follows Domain-Driven Design (DDD) principles with clear separation of concerns:

```
src/domain/file-management/
├── entities/
│   ├── file.entity.ts           # Core file entity with business logic
│   └── attachment.entity.ts     # Attachment entity for linking files to entities
├── repositories/
│   └── file.repository.ts       # Repository interface for data access
├── services/
│   ├── file-storage.service.ts  # Storage service interface
│   └── virus-scanner.service.ts # Virus scanning service interface
└── value-objects/
    ├── file-metadata.vo.ts      # File metadata value object
    ├── file-access-control.vo.ts # Access control value object
    └── file-version.vo.ts       # File version value object
```

## Core Components

### 1. File Storage Infrastructure

#### Storage Backends

- **Enhanced Local Storage**: High-performance local file storage with compression and optimization
- **Amazon S3**: Cloud storage with advanced features and scalability
- **Azure Blob Storage**: Microsoft cloud storage integration
- **Storage Factory**: Centralized management of multiple storage backends

#### Features

- Configurable storage backends
- File validation and security scanning
- Compression and optimization
- Backup and disaster recovery
- Health monitoring and failover

### 2. File Management Service

The `FileManagementService` provides core file operations:

```typescript
// Upload a file
const result = await fileManagementService.uploadFile({
  buffer: fileBuffer,
  filename: 'document.pdf',
  workspaceId: 'workspace-123',
  userId: 'user-456',
  attachTo: {
    type: 'task',
    id: 'task-789',
  },
  generateThumbnail: true,
  runVirusScan: true,
});

// Download a file
const download = await fileManagementService.downloadFile({
  fileId: 'file-123',
  userId: 'user-456',
  version: 2,
});

// Search files
const searchResults = await fileManagementService.searchFiles({
  workspaceId: 'workspace-123',
  mimeType: 'image/',
  tags: ['important'],
  fullTextSearch: 'quarterly report',
});
```

### 3. Attachment Management

The `AttachmentService` handles file attachments to entities:

```typescript
// Create attachment
const attachment = await attachmentService.createAttachment({
  fileId: 'file-123',
  workspaceId: 'workspace-123',
  attachedTo: 'task',
  attachedToId: 'task-456',
  attachedBy: 'user-789',
  description: 'Project requirements document',
});

// Get attachments for an entity
const attachments = await attachmentService.getAttachmentsByEntity(
  'task',
  'task-456',
  'user-789'
);

// Share attachment
await attachmentService.shareAttachment({
  attachmentId: 'attachment-123',
  userId: 'user-456',
  shareWith: [
    {
      userId: 'user-789',
      permissions: ['read', 'comment'],
    },
  ],
});
```

### 4. File Collaboration

The `FileCollaborationService` enables collaborative features:

```typescript
// Add comment to file
const comment = await collaborationService.addFileComment(
  'file-123',
  'user-456',
  'This section needs revision',
  { page: 1, x: 100, y: 200 }
);

// Create approval workflow
const workflow = await collaborationService.createApprovalWorkflow(
  'file-123',
  'user-456',
  {
    name: 'Document Review',
    steps: [
      {
        id: 'step-1',
        name: 'Legal Review',
        approvers: ['legal-user-1', 'legal-user-2'],
        requiredApprovals: 1,
        order: 0,
        isParallel: true,
      },
    ],
  }
);

// Create file branch
const branch = await collaborationService.createFileBranch(
  'file-123',
  'user-456',
  'feature-branch',
  'Working on new features'
);
```

### 5. File Audit and Security

The `FileAuditService` provides comprehensive audit trails:

```typescript
// Log file event
await auditService.logFileEvent(
  'file-123',
  'user-456',
  'file_downloaded',
  { version: 2, size: 1024000 },
  {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    workspaceId: 'workspace-123',
  }
);

// Generate audit report
const report = await auditService.generateAuditReport({
  workspaceId: 'workspace-123',
  dateRange: {
    from: new Date('2024-01-01'),
    to: new Date('2024-12-31'),
  },
  categories: ['security', 'access'],
});

// Get security alerts
const alerts = await auditService.getSecurityAlerts(
  'workspace-123',
  'open',
  'high'
);
```

## API Endpoints

### File Management Endpoints

```
POST   /api/v1/files/upload                    # Upload file
GET    /api/v1/files/:fileId/download          # Download file
POST   /api/v1/files/:fileId/versions          # Upload new version
DELETE /api/v1/files/:fileId                   # Delete file
POST   /api/v1/files/:fileId/restore           # Restore deleted file
GET    /api/v1/files/search                    # Search files
GET    /api/v1/files/by-attachment/:type/:id   # Get files by attachment
GET    /api/v1/workspaces/:id/storage-usage    # Get storage usage
```

### Attachment Management Endpoints

```
POST   /api/v1/attachments                     # Create attachment
PATCH  /api/v1/attachments/:id                 # Update attachment
DELETE /api/v1/attachments/:id                 # Delete attachment
POST   /api/v1/attachments/:id/restore         # Restore attachment
GET    /api/v1/attachments/by-entity/:type/:id # Get attachments by entity
GET    /api/v1/attachments/search              # Search attachments
POST   /api/v1/attachments/reorder/:type/:id   # Reorder attachments
POST   /api/v1/attachments/:id/share           # Share attachment
GET    /api/v1/attachments/:id/preview         # Generate preview
GET    /api/v1/attachments/:id/versions        # Get attachment versions
```

## Security Features

### Access Control

- Workspace-level isolation
- Project-level permissions
- User-specific access controls
- Role-based authorization
- Public/private file sharing

### Security Monitoring

- Comprehensive audit logging
- Real-time threat detection
- Suspicious activity alerts
- Bulk download monitoring
- Permission escalation detection

### Data Protection

- Virus scanning integration
- File validation and sanitization
- Encryption at rest and in transit
- Secure file deletion
- Data retention policies

## File Types and Processing

### Supported File Types

- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, Word, Excel, PowerPoint
- **Text**: Plain text, CSV, JSON, XML
- **Archives**: ZIP, RAR, 7Z
- **Media**: MP4, AVI, MP3, WAV

### Processing Features

- Automatic thumbnail generation
- Document preview creation
- Image optimization
- File compression
- Metadata extraction
- OCR text extraction (planned)

## Performance and Scalability

### Optimization Features

- Multi-layer caching
- Lazy loading
- Streaming downloads
- Batch operations
- Connection pooling
- CDN integration (planned)

### Scalability

- Horizontal scaling support
- Load balancing
- Database sharding (planned)
- Microservice architecture
- Event-driven processing

## Configuration

### Storage Configuration

```typescript
// Local storage
const localConfig = {
  type: 'local',
  local: {
    basePath: './uploads',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: ['image/*', 'application/pdf'],
  },
};

// S3 storage
const s3Config = {
  type: 's3',
  s3: {
    region: 'us-east-1',
    bucket: 'my-files-bucket',
    accessKeyId: 'ACCESS_KEY',
    secretAccessKey: 'SECRET_KEY',
  },
};

// Azure Blob storage
const azureConfig = {
  type: 'azure',
  azure: {
    connectionString: 'DefaultEndpointsProtocol=https;...',
    containerName: 'files',
  },
};
```

### Environment Variables

```bash
# Storage configuration
STORAGE_TYPE=local|s3|azure
STORAGE_BASE_PATH=./uploads
STORAGE_MAX_FILE_SIZE=104857600

# S3 configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-files-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Azure configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER=files

# Security
VIRUS_SCANNING_ENABLED=true
FILE_ENCRYPTION_ENABLED=true
AUDIT_LOGGING_ENABLED=true
```

## Monitoring and Observability

### Metrics

- File upload/download rates
- Storage usage by workspace
- Error rates and types
- Performance metrics
- Security event counts

### Logging

- Structured logging with correlation IDs
- Audit trail for all file operations
- Security event logging
- Performance monitoring
- Error tracking and alerting

### Health Checks

- Storage backend health
- Service availability
- Database connectivity
- External service status

## Future Enhancements

### Planned Features

- Advanced OCR and text extraction
- AI-powered file classification
- Advanced collaboration features
- Integration with external systems
- Mobile optimization
- Real-time collaborative editing
- Advanced analytics and reporting

### Performance Improvements

- CDN integration
- Advanced caching strategies
- Database optimization
- Microservice decomposition
- Event sourcing implementation

## Testing

The system includes comprehensive test coverage:

- Unit tests for all services and entities
- Integration tests for API endpoints
- End-to-end tests for complete workflows
- Performance tests for scalability
- Security tests for vulnerability assessment

## Deployment

The file management system is designed for containerized deployment:

- Docker containers for all services
- Kubernetes orchestration
- Horizontal pod autoscaling
- Service mesh integration
- CI/CD pipeline integration

## Support and Maintenance

### Monitoring

- Real-time dashboards
- Alerting and notifications
- Performance monitoring
- Capacity planning
- Incident response procedures

### Backup and Recovery

- Automated backups
- Point-in-time recovery
- Disaster recovery procedures
- Data migration tools
- Compliance reporting

This file management system provides a robust, secure, and scalable foundation for enterprise file handling needs while maintaining flexibility for future enhancements and integrations.
