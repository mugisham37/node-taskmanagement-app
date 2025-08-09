import { EventEmitter } from 'events';
import { WebSocketService } from './websocket-service';
import { RealtimeEventService } from './realtime-event-service';
import { LoggingService } from '../monitoring/logging-service';
import { CacheService } from '../caching/cache-service';

export interface CollaborativeDocument {
  id: string;
  type: 'task' | 'project' | 'comment';
  entityId: string;
  content: any;
  version: number;
  lastModified: Date;
  lastModifiedBy: string;
  collaborators: Set<string>;
  operations: DocumentOperation[];
}

export interface DocumentOperation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'replace' | 'format';
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  version: number;
}

export interface TypingIndicator {
  userId: string;
  userEmail: string;
  documentId: string;
  isTyping: boolean;
  lastActivity: Date;
}

export interface Comment {
  id: string;
  documentId: string;
  userId: string;
  userEmail: string;
  content: string;
  position?: number;
  parentId?: string;
  timestamp: Date;
  edited: boolean;
  editedAt?: Date;
}

export class CollaborationService extends EventEmitter {
  private documents = new Map<string, CollaborativeDocument>();
  private typingIndicators = new Map<string, Map<string, TypingIndicator>>();
  private comments = new Map<string, Comment[]>();
  private documentLocks = new Map<
    string,
    { userId: string; timestamp: Date }
  >();

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly realtimeEventService: RealtimeEventService,
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService
  ) {
    super();
    this.setupCleanupInterval();
  }

  // Document collaboration
  async createDocument(
    documentId: string,
    type: 'task' | 'project' | 'comment',
    entityId: string,
    initialContent: any,
    userId: string
  ): Promise<CollaborativeDocument> {
    const document: CollaborativeDocument = {
      id: documentId,
      type,
      entityId,
      content: initialContent,
      version: 1,
      lastModified: new Date(),
      lastModifiedBy: userId,
      collaborators: new Set([userId]),
      operations: [],
    };

    this.documents.set(documentId, document);
    await this.cacheDocument(document);

    this.logger.info('Collaborative document created', {
      documentId,
      type,
      entityId,
      userId,
    });

    return document;
  }

  async getDocument(documentId: string): Promise<CollaborativeDocument | null> {
    let document = this.documents.get(documentId);

    if (!document) {
      // Try to load from cache
      document = await this.loadDocumentFromCache(documentId);
      if (document) {
        this.documents.set(documentId, document);
      }
    }

    return document || null;
  }

  async applyOperation(
    documentId: string,
    operation: Omit<DocumentOperation, 'id' | 'timestamp' | 'version'>,
    userId: string
  ): Promise<{
    success: boolean;
    document?: CollaborativeDocument;
    conflict?: boolean;
  }> {
    const document = await this.getDocument(documentId);
    if (!document) {
      return { success: false };
    }

    // Check for conflicts
    const expectedVersion = operation.version;
    if (expectedVersion !== document.version) {
      this.logger.warn('Document operation conflict detected', {
        documentId,
        expectedVersion,
        currentVersion: document.version,
        userId,
      });
      return { success: false, conflict: true };
    }

    // Create full operation
    const fullOperation: DocumentOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      version: document.version + 1,
    };

    // Apply operation to document
    try {
      this.applyOperationToContent(document, fullOperation);
      document.version++;
      document.lastModified = new Date();
      document.lastModifiedBy = userId;
      document.collaborators.add(userId);
      document.operations.push(fullOperation);

      // Keep only last 100 operations
      if (document.operations.length > 100) {
        document.operations.splice(0, document.operations.length - 100);
      }

      await this.cacheDocument(document);

      // Broadcast operation to collaborators
      await this.broadcastOperation(documentId, fullOperation);

      this.logger.debug('Document operation applied', {
        documentId,
        operationType: fullOperation.type,
        version: document.version,
        userId,
      });

      return { success: true, document };
    } catch (error) {
      this.logger.error('Failed to apply document operation', error as Error, {
        documentId,
        operationType: operation.type,
        userId,
      });
      return { success: false };
    }
  }

  async addCollaborator(documentId: string, userId: string): Promise<boolean> {
    const document = await this.getDocument(documentId);
    if (!document) return false;

    document.collaborators.add(userId);
    await this.cacheDocument(document);

    // Subscribe user to document channel
    const userConnections = this.webSocketService.getUserConnections(userId);
    userConnections.forEach(connection => {
      this.webSocketService.subscribeToChannel(
        connection.id,
        `document:${documentId}`
      );
    });

    this.logger.info('Collaborator added to document', {
      documentId,
      userId,
      totalCollaborators: document.collaborators.size,
    });

    return true;
  }

  async removeCollaborator(
    documentId: string,
    userId: string
  ): Promise<boolean> {
    const document = await this.getDocument(documentId);
    if (!document) return false;

    document.collaborators.delete(userId);
    await this.cacheDocument(document);

    // Unsubscribe user from document channel
    const userConnections = this.webSocketService.getUserConnections(userId);
    userConnections.forEach(connection => {
      this.webSocketService.unsubscribeFromChannel(
        connection.id,
        `document:${documentId}`
      );
    });

    this.logger.info('Collaborator removed from document', {
      documentId,
      userId,
      totalCollaborators: document.collaborators.size,
    });

    return true;
  }

  // Typing indicators
  setTypingIndicator(
    documentId: string,
    userId: string,
    userEmail: string,
    isTyping: boolean
  ): void {
    if (!this.typingIndicators.has(documentId)) {
      this.typingIndicators.set(documentId, new Map());
    }

    const documentTyping = this.typingIndicators.get(documentId)!;

    if (isTyping) {
      documentTyping.set(userId, {
        userId,
        userEmail,
        documentId,
        isTyping: true,
        lastActivity: new Date(),
      });
    } else {
      documentTyping.delete(userId);
    }

    // Broadcast typing indicator
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: isTyping ? 'user_typing_start' : 'user_typing_stop',
      payload: {
        userId,
        userEmail,
        documentId,
      },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.debug('Typing indicator updated', {
      documentId,
      userId,
      isTyping,
    });
  }

  getTypingIndicators(documentId: string): TypingIndicator[] {
    const documentTyping = this.typingIndicators.get(documentId);
    return documentTyping ? Array.from(documentTyping.values()) : [];
  }

  // Comments
  async addComment(
    documentId: string,
    userId: string,
    userEmail: string,
    content: string,
    position?: number,
    parentId?: string
  ): Promise<Comment> {
    const comment: Comment = {
      id: this.generateCommentId(),
      documentId,
      userId,
      userEmail,
      content,
      position,
      parentId,
      timestamp: new Date(),
      edited: false,
    };

    if (!this.comments.has(documentId)) {
      this.comments.set(documentId, []);
    }

    this.comments.get(documentId)!.push(comment);
    await this.cacheComments(documentId);

    // Broadcast comment to collaborators
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'comment_added',
      payload: comment,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.info('Comment added to document', {
      documentId,
      commentId: comment.id,
      userId,
      hasParent: !!parentId,
    });

    return comment;
  }

  async updateComment(
    commentId: string,
    documentId: string,
    userId: string,
    newContent: string
  ): Promise<Comment | null> {
    const comments = this.comments.get(documentId) || [];
    const comment = comments.find(
      c => c.id === commentId && c.userId === userId
    );

    if (!comment) return null;

    comment.content = newContent;
    comment.edited = true;
    comment.editedAt = new Date();

    await this.cacheComments(documentId);

    // Broadcast comment update
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'comment_updated',
      payload: comment,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.info('Comment updated', {
      documentId,
      commentId,
      userId,
    });

    return comment;
  }

  async deleteComment(
    commentId: string,
    documentId: string,
    userId: string
  ): Promise<boolean> {
    const comments = this.comments.get(documentId) || [];
    const commentIndex = comments.findIndex(
      c => c.id === commentId && c.userId === userId
    );

    if (commentIndex === -1) return false;

    const deletedComment = comments.splice(commentIndex, 1)[0];
    await this.cacheComments(documentId);

    // Broadcast comment deletion
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'comment_deleted',
      payload: { commentId, documentId },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.info('Comment deleted', {
      documentId,
      commentId,
      userId,
    });

    return true;
  }

  getComments(documentId: string): Comment[] {
    return this.comments.get(documentId) || [];
  }

  // Document locking
  async acquireLock(documentId: string, userId: string): Promise<boolean> {
    const existingLock = this.documentLocks.get(documentId);

    if (existingLock && existingLock.userId !== userId) {
      // Check if lock is stale (older than 5 minutes)
      const lockAge = Date.now() - existingLock.timestamp.getTime();
      if (lockAge < 5 * 60 * 1000) {
        return false; // Lock is still active
      }
    }

    this.documentLocks.set(documentId, {
      userId,
      timestamp: new Date(),
    });

    // Broadcast lock acquisition
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'document_locked',
      payload: { documentId, userId },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.info('Document lock acquired', { documentId, userId });
    return true;
  }

  async releaseLock(documentId: string, userId: string): Promise<boolean> {
    const existingLock = this.documentLocks.get(documentId);

    if (!existingLock || existingLock.userId !== userId) {
      return false;
    }

    this.documentLocks.delete(documentId);

    // Broadcast lock release
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'document_unlocked',
      payload: { documentId, userId },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });

    this.logger.info('Document lock released', { documentId, userId });
    return true;
  }

  isDocumentLocked(documentId: string): { locked: boolean; userId?: string } {
    const lock = this.documentLocks.get(documentId);
    return lock ? { locked: true, userId: lock.userId } : { locked: false };
  }

  // Private methods
  private applyOperationToContent(
    document: CollaborativeDocument,
    operation: DocumentOperation
  ): void {
    // This is a simplified implementation - in a real system, you'd use operational transformation
    switch (operation.type) {
      case 'insert':
        if (typeof document.content === 'string' && operation.content) {
          document.content =
            document.content.slice(0, operation.position) +
            operation.content +
            document.content.slice(operation.position);
        }
        break;

      case 'delete':
        if (typeof document.content === 'string' && operation.length) {
          document.content =
            document.content.slice(0, operation.position) +
            document.content.slice(operation.position + operation.length);
        }
        break;

      case 'replace':
        if (
          typeof document.content === 'string' &&
          operation.content &&
          operation.length
        ) {
          document.content =
            document.content.slice(0, operation.position) +
            operation.content +
            document.content.slice(operation.position + operation.length);
        }
        break;

      default:
        // Handle other operation types or object-based content
        break;
    }
  }

  private async broadcastOperation(
    documentId: string,
    operation: DocumentOperation
  ): Promise<void> {
    this.webSocketService.broadcastToChannel(`document:${documentId}`, {
      type: 'document_operation',
      payload: operation,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId(),
    });
  }

  private async cacheDocument(document: CollaborativeDocument): Promise<void> {
    const key = `document:${document.id}`;
    await this.cacheService.set(key, JSON.stringify(document), 3600); // 1 hour TTL
  }

  private async loadDocumentFromCache(
    documentId: string
  ): Promise<CollaborativeDocument | null> {
    try {
      const key = `document:${documentId}`;
      const cached = await this.cacheService.get(key);

      if (cached) {
        const document = JSON.parse(cached) as CollaborativeDocument;
        document.collaborators = new Set(document.collaborators as any);
        return document;
      }
    } catch (error) {
      this.logger.error('Failed to load document from cache', error as Error, {
        documentId,
      });
    }

    return null;
  }

  private async cacheComments(documentId: string): Promise<void> {
    const comments = this.comments.get(documentId) || [];
    const key = `comments:${documentId}`;
    await this.cacheService.set(key, JSON.stringify(comments), 3600); // 1 hour TTL
  }

  private setupCleanupInterval(): void {
    // Clean up stale typing indicators every minute
    setInterval(() => {
      const now = new Date();
      const staleThreshold = 30 * 1000; // 30 seconds

      this.typingIndicators.forEach((documentTyping, documentId) => {
        documentTyping.forEach((indicator, userId) => {
          if (
            now.getTime() - indicator.lastActivity.getTime() >
            staleThreshold
          ) {
            documentTyping.delete(userId);

            // Broadcast typing stop
            this.webSocketService.broadcastToChannel(`document:${documentId}`, {
              type: 'user_typing_stop',
              payload: {
                userId,
                userEmail: indicator.userEmail,
                documentId,
              },
              timestamp: new Date().toISOString(),
              messageId: this.generateMessageId(),
            });
          }
        });

        if (documentTyping.size === 0) {
          this.typingIndicators.delete(documentId);
        }
      });
    }, 60 * 1000);
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
