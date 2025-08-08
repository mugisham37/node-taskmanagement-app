import { logger } from '@/infrastructure/logging/logger';
import { WebSocketConnectionManager } from './websocket-connection-manager';
import { EventBroadcaster } from './event-broadcaster';

export interface EditOperation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  userId: string;
  version: number;
}

export interface DocumentState {
  id: string;
  content: string;
  version: number;
  lastModified: number;
  activeEditors: Set<string>;
  operationHistory: EditOperation[];
}

export interface CursorPosition {
  userId: string;
  position: number;
  selection?: {
    start: number;
    end: number;
  };
  timestamp: number;
}

export interface ConflictResolution {
  originalOperation: EditOperation;
  transformedOperation: EditOperation;
  conflictType: 'concurrent_edit' | 'version_mismatch' | 'position_conflict';
  resolution: 'transform' | 'reject' | 'merge';
}

export class CollaborativeEditor {
  private documents: Map<string, DocumentState> = new Map();
  private cursors: Map<string, Map<string, CursorPosition>> = new Map(); // documentId -> userId -> cursor
  private connectionManager: WebSocketConnectionManager;
  private eventBroadcaster: EventBroadcaster;
  private operationQueue: Map<string, EditOperation[]> = new Map(); // documentId -> operations
  private isProcessingOperations: Map<string, boolean> = new Map();

  constructor(
    connectionManager: WebSocketConnectionManager,
    eventBroadcaster: EventBroadcaster
  ) {
    this.connectionManager = connectionManager;
    this.eventBroadcaster = eventBroadcaster;

    logger.info('Collaborative editor initialized');
  }

  /**
   * Initialize document for collaborative editing
   */
  async initializeDocument(
    documentId: string,
    initialContent: string,
    userId: string
  ): Promise<DocumentState> {
    const document: DocumentState = {
      id: documentId,
      content: initialContent,
      version: 1,
      lastModified: Date.now(),
      activeEditors: new Set([userId]),
      operationHistory: [],
    };

    this.documents.set(documentId, document);
    this.cursors.set(documentId, new Map());
    this.operationQueue.set(documentId, []);
    this.isProcessingOperations.set(documentId, false);

    logger.info('Document initialized for collaborative editing', {
      documentId,
      userId,
      contentLength: initialContent.length,
    });

    return document;
  }

  /**
   * Join document editing session
   */
  async joinDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentState | null> {
    const document = this.documents.get(documentId);
    if (!document) {
      logger.warn('Attempted to join non-existent document', {
        documentId,
        userId,
      });
      return null;
    }

    document.activeEditors.add(userId);

    // Initialize cursor for user
    const documentCursors = this.cursors.get(documentId);
    if (documentCursors) {
      documentCursors.set(userId, {
        userId,
        position: 0,
        timestamp: Date.now(),
      });
    }

    // Broadcast user joined
    await this.eventBroadcaster.broadcast({
      type: 'collaboration',
      event: 'editor.user_joined',
      data: {
        documentId,
        userId,
        activeEditors: Array.from(document.activeEditors),
      },
      source: {
        userId,
      },
      target: {
        type: 'global', // Broadcast to all users with access to document
        id: 'all',
        excludeUsers: [userId],
      },
      priority: 'normal',
      persistent: false,
    });

    logger.info('User joined document editing session', {
      documentId,
      userId,
      activeEditors: document.activeEditors.size,
    });

    return document;
  }

  /**
   * Leave document editing session
   */
  async leaveDocument(documentId: string, userId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      return;
    }

    document.activeEditors.delete(userId);

    // Remove cursor
    const documentCursors = this.cursors.get(documentId);
    if (documentCursors) {
      documentCursors.delete(userId);
    }

    // Broadcast user left
    await this.eventBroadcaster.broadcast({
      type: 'collaboration',
      event: 'editor.user_left',
      data: {
        documentId,
        userId,
        activeEditors: Array.from(document.activeEditors),
      },
      source: {
        userId,
      },
      target: {
        type: 'global',
        id: 'all',
        excludeUsers: [userId],
      },
      priority: 'normal',
      persistent: false,
    });

    // Clean up document if no active editors
    if (document.activeEditors.size === 0) {
      this.cleanupDocument(documentId);
    }

    logger.info('User left document editing session', {
      documentId,
      userId,
      activeEditors: document.activeEditors.size,
    });
  }

  /**
   * Apply edit operation to document
   */
  async applyOperation(
    documentId: string,
    operation: Omit<EditOperation, 'id' | 'timestamp'>
  ): Promise<{
    success: boolean;
    transformedOperation?: EditOperation;
    conflict?: ConflictResolution;
  }> {
    const document = this.documents.get(documentId);
    if (!document) {
      return { success: false };
    }

    const fullOperation: EditOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
    };

    // Add to operation queue
    const queue = this.operationQueue.get(documentId) || [];
    queue.push(fullOperation);
    this.operationQueue.set(documentId, queue);

    // Process operations if not already processing
    if (!this.isProcessingOperations.get(documentId)) {
      return await this.processOperationQueue(documentId);
    }

    return { success: true };
  }

  /**
   * Update cursor position
   */
  async updateCursor(
    documentId: string,
    userId: string,
    position: number,
    selection?: { start: number; end: number }
  ): Promise<void> {
    const documentCursors = this.cursors.get(documentId);
    if (!documentCursors) {
      return;
    }

    const cursor: CursorPosition = {
      userId,
      position,
      selection,
      timestamp: Date.now(),
    };

    documentCursors.set(userId, cursor);

    // Broadcast cursor update
    await this.eventBroadcaster.broadcast({
      type: 'collaboration',
      event: 'cursor.updated',
      data: {
        documentId,
        cursor,
      },
      source: {
        userId,
      },
      target: {
        type: 'global',
        id: 'all',
        excludeUsers: [userId],
      },
      priority: 'low',
      persistent: false,
    });

    logger.debug('Cursor position updated', {
      documentId,
      userId,
      position,
      selection,
    });
  }

  /**
   * Get document cursors
   */
  getDocumentCursors(documentId: string): CursorPosition[] {
    const documentCursors = this.cursors.get(documentId);
    if (!documentCursors) {
      return [];
    }

    return Array.from(documentCursors.values());
  }

  /**
   * Get document state
   */
  getDocument(documentId: string): DocumentState | null {
    return this.documents.get(documentId) || null;
  }

  /**
   * Process operation queue for a document
   */
  private async processOperationQueue(
    documentId: string
  ): Promise<{
    success: boolean;
    transformedOperation?: EditOperation;
    conflict?: ConflictResolution;
  }> {
    const document = this.documents.get(documentId);
    const queue = this.operationQueue.get(documentId);

    if (!document || !queue || queue.length === 0) {
      return { success: false };
    }

    this.isProcessingOperations.set(documentId, true);

    try {
      const operation = queue.shift()!;

      // Check for version conflicts
      if (operation.version !== document.version) {
        const conflict = await this.resolveVersionConflict(document, operation);
        if (conflict.resolution === 'reject') {
          logger.warn('Operation rejected due to version conflict', {
            documentId,
            operationVersion: operation.version,
            documentVersion: document.version,
          });
          return { success: false, conflict };
        }
        operation.version = document.version;
      }

      // Transform operation against concurrent operations
      const transformedOperation = await this.transformOperation(
        document,
        operation
      );

      // Apply operation to document
      const success = this.applyOperationToDocument(
        document,
        transformedOperation
      );

      if (success) {
        // Update document version and history
        document.version++;
        document.lastModified = Date.now();
        document.operationHistory.push(transformedOperation);

        // Broadcast operation to other editors
        await this.broadcastOperation(documentId, transformedOperation);

        logger.debug('Operation applied successfully', {
          documentId,
          operationId: transformedOperation.id,
          newVersion: document.version,
        });

        return { success: true, transformedOperation };
      }

      return { success: false };
    } catch (error) {
      logger.error('Error processing operation queue', {
        error: error instanceof Error ? error.message : String(error),
        documentId,
      });
      return { success: false };
    } finally {
      this.isProcessingOperations.set(documentId, false);

      // Continue processing if more operations in queue
      const remainingQueue = this.operationQueue.get(documentId);
      if (remainingQueue && remainingQueue.length > 0) {
        setImmediate(() => this.processOperationQueue(documentId));
      }
    }
  }

  /**
   * Transform operation using Operational Transformation
   */
  private async transformOperation(
    document: DocumentState,
    operation: EditOperation
  ): Promise<EditOperation> {
    // Get concurrent operations (operations with same or higher version)
    const concurrentOps = document.operationHistory.filter(
      op =>
        op.timestamp >= operation.timestamp && op.userId !== operation.userId
    );

    let transformedOp = { ...operation };

    // Apply operational transformation for each concurrent operation
    for (const concurrentOp of concurrentOps) {
      transformedOp = this.transformAgainstOperation(
        transformedOp,
        concurrentOp
      );
    }

    return transformedOp;
  }

  /**
   * Transform one operation against another using OT rules
   */
  private transformAgainstOperation(
    op1: EditOperation,
    op2: EditOperation
  ): EditOperation {
    const transformed = { ...op1 };

    // Insert vs Insert
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op2.position <= op1.position) {
        transformed.position += op2.content?.length || 0;
      }
    }
    // Insert vs Delete
    else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op2.position < op1.position) {
        transformed.position -= Math.min(
          op2.length || 0,
          op1.position - op2.position
        );
      }
    }
    // Delete vs Insert
    else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op2.position <= op1.position) {
        transformed.position += op2.content?.length || 0;
      }
    }
    // Delete vs Delete
    else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op2.position < op1.position) {
        const deletedBeforeOp1 = Math.min(
          op2.length || 0,
          op1.position - op2.position
        );
        transformed.position -= deletedBeforeOp1;
      } else if (op2.position < op1.position + (op1.length || 0)) {
        // Overlapping deletes - adjust length
        const overlap = Math.min(
          op1.position + (op1.length || 0) - op2.position,
          op2.length || 0
        );
        transformed.length = (transformed.length || 0) - overlap;
      }
    }

    return transformed;
  }

  /**
   * Apply operation to document content
   */
  private applyOperationToDocument(
    document: DocumentState,
    operation: EditOperation
  ): boolean {
    try {
      let content = document.content;

      switch (operation.type) {
        case 'insert':
          if (
            operation.content &&
            operation.position >= 0 &&
            operation.position <= content.length
          ) {
            content =
              content.slice(0, operation.position) +
              operation.content +
              content.slice(operation.position);
            document.content = content;
            return true;
          }
          break;

        case 'delete':
          if (
            operation.position >= 0 &&
            operation.length &&
            operation.position + operation.length <= content.length
          ) {
            content =
              content.slice(0, operation.position) +
              content.slice(operation.position + operation.length);
            document.content = content;
            return true;
          }
          break;

        case 'retain':
          // Retain operations don't change content, just move cursor
          return true;
      }

      return false;
    } catch (error) {
      logger.error('Error applying operation to document', {
        error: error instanceof Error ? error.message : String(error),
        documentId: document.id,
        operation,
      });
      return false;
    }
  }

  /**
   * Resolve version conflict
   */
  private async resolveVersionConflict(
    document: DocumentState,
    operation: EditOperation
  ): Promise<ConflictResolution> {
    const versionDiff = document.version - operation.version;

    if (versionDiff > 10) {
      // Too many versions behind, reject operation
      return {
        originalOperation: operation,
        transformedOperation: operation,
        conflictType: 'version_mismatch',
        resolution: 'reject',
      };
    }

    // Transform operation against missed operations
    const missedOperations = document.operationHistory.slice(-versionDiff);
    let transformedOp = { ...operation };

    for (const missedOp of missedOperations) {
      transformedOp = this.transformAgainstOperation(transformedOp, missedOp);
    }

    return {
      originalOperation: operation,
      transformedOperation: transformedOp,
      conflictType: 'version_mismatch',
      resolution: 'transform',
    };
  }

  /**
   * Broadcast operation to other editors
   */
  private async broadcastOperation(
    documentId: string,
    operation: EditOperation
  ): Promise<void> {
    await this.eventBroadcaster.broadcast({
      type: 'collaboration',
      event: 'operation.applied',
      data: {
        documentId,
        operation,
      },
      source: {
        userId: operation.userId,
      },
      target: {
        type: 'global',
        id: 'all',
        excludeUsers: [operation.userId],
      },
      priority: 'high',
      persistent: false,
    });
  }

  /**
   * Clean up document resources
   */
  private cleanupDocument(documentId: string): void {
    this.documents.delete(documentId);
    this.cursors.delete(documentId);
    this.operationQueue.delete(documentId);
    this.isProcessingOperations.delete(documentId);

    logger.info('Document cleaned up', { documentId });
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get collaborative editing metrics
   */
  getMetrics() {
    return {
      activeDocuments: this.documents.size,
      totalOperations: Array.from(this.documents.values()).reduce(
        (sum, doc) => sum + doc.operationHistory.length,
        0
      ),
      activeEditors: Array.from(this.documents.values()).reduce(
        (sum, doc) => sum + doc.activeEditors.size,
        0
      ),
      queuedOperations: Array.from(this.operationQueue.values()).reduce(
        (sum, queue) => sum + queue.length,
        0
      ),
    };
  }
}
