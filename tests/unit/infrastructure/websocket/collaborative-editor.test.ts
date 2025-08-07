import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollaborativeEditor } from '@/infrastructure/websocket/collaborative-editor';
import { WebSocketConnectionManager } from '@/infrastructure/websocket/websocket-connection-manager';
import { EventBroadcaster } from '@/infrastructure/websocket/event-broadcaster';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock connection manager
const createMockConnectionManager = () => ({
  getConnectionsByWorkspace: vi.fn().mockReturnValue([]),
  getConnectionsByProject: vi.fn().mockReturnValue([]),
  getConnectionsByUser: vi.fn().mockReturnValue([]),
  getAllConnections: vi.fn().mockReturnValue([]),
});

// Mock event broadcaster
const createMockEventBroadcaster = () => ({
  broadcast: vi.fn().mockResolvedValue({
    eventId: 'test-event-id',
    delivered: 0,
    failed: 0,
    filtered: 0,
    duration: 10,
  }),
});

describe('CollaborativeEditor', () => {
  let collaborativeEditor: CollaborativeEditor;
  let mockConnectionManager: any;
  let mockEventBroadcaster: any;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    mockEventBroadcaster = createMockEventBroadcaster();
    collaborativeEditor = new CollaborativeEditor(
      mockConnectionManager,
      mockEventBroadcaster
    );
  });

  describe('document initialization', () => {
    it('should initialize document successfully', async () => {
      const documentId = 'doc-1';
      const initialContent = 'Hello World';
      const userId = 'user-1';

      const document = await collaborativeEditor.initializeDocument(
        documentId,
        initialContent,
        userId
      );

      expect(document).toBeDefined();
      expect(document.id).toBe(documentId);
      expect(document.content).toBe(initialContent);
      expect(document.version).toBe(1);
      expect(document.activeEditors.has(userId)).toBe(true);
    });
  });

  describe('document joining and leaving', () => {
    beforeEach(async () => {
      await collaborativeEditor.initializeDocument(
        'doc-1',
        'Hello World',
        'user-1'
      );
    });

    it('should allow user to join document', async () => {
      const document = await collaborativeEditor.joinDocument(
        'doc-1',
        'user-2'
      );

      expect(document).toBeDefined();
      expect(document!.activeEditors.has('user-2')).toBe(true);
      expect(mockEventBroadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'editor.user_joined',
          data: expect.objectContaining({
            documentId: 'doc-1',
            userId: 'user-2',
          }),
        })
      );
    });

    it('should handle joining non-existent document', async () => {
      const document = await collaborativeEditor.joinDocument(
        'non-existent',
        'user-2'
      );

      expect(document).toBeNull();
    });

    it('should allow user to leave document', async () => {
      await collaborativeEditor.joinDocument('doc-1', 'user-2');
      await collaborativeEditor.leaveDocument('doc-1', 'user-2');

      const document = collaborativeEditor.getDocument('doc-1');
      expect(document!.activeEditors.has('user-2')).toBe(false);
      expect(mockEventBroadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'editor.user_left',
        })
      );
    });
  });

  describe('edit operations', () => {
    beforeEach(async () => {
      await collaborativeEditor.initializeDocument(
        'doc-1',
        'Hello World',
        'user-1'
      );
    });

    it('should apply insert operation', async () => {
      const operation = {
        type: 'insert' as const,
        position: 5,
        content: ' Beautiful',
        userId: 'user-1',
        version: 1,
      };

      const result = await collaborativeEditor.applyOperation(
        'doc-1',
        operation
      );

      expect(result.success).toBe(true);

      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const document = collaborativeEditor.getDocument('doc-1');
      expect(document).toBeDefined();
    });

    it('should apply delete operation', async () => {
      const operation = {
        type: 'delete' as const,
        position: 0,
        length: 5,
        userId: 'user-1',
        version: 1,
      };

      const result = await collaborativeEditor.applyOperation(
        'doc-1',
        operation
      );

      expect(result.success).toBe(true);
    });

    it('should handle operation on non-existent document', async () => {
      const operation = {
        type: 'insert' as const,
        position: 0,
        content: 'test',
        userId: 'user-1',
        version: 1,
      };

      const result = await collaborativeEditor.applyOperation(
        'non-existent',
        operation
      );

      expect(result.success).toBe(false);
    });
  });

  describe('cursor management', () => {
    beforeEach(async () => {
      await collaborativeEditor.initializeDocument(
        'doc-1',
        'Hello World',
        'user-1'
      );
      await collaborativeEditor.joinDocument('doc-1', 'user-2');
    });

    it('should update cursor position', async () => {
      await collaborativeEditor.updateCursor('doc-1', 'user-1', 5);

      const cursors = collaborativeEditor.getDocumentCursors('doc-1');
      const userCursor = cursors.find(c => c.userId === 'user-1');

      expect(userCursor).toBeDefined();
      expect(userCursor!.position).toBe(5);
      expect(mockEventBroadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'cursor.updated',
        })
      );
    });

    it('should update cursor with selection', async () => {
      await collaborativeEditor.updateCursor('doc-1', 'user-1', 5, {
        start: 5,
        end: 10,
      });

      const cursors = collaborativeEditor.getDocumentCursors('doc-1');
      const userCursor = cursors.find(c => c.userId === 'user-1');

      expect(userCursor).toBeDefined();
      expect(userCursor!.selection).toEqual({ start: 5, end: 10 });
    });

    it('should return empty array for non-existent document cursors', () => {
      const cursors = collaborativeEditor.getDocumentCursors('non-existent');
      expect(cursors).toEqual([]);
    });
  });

  describe('document retrieval', () => {
    it('should return document state', async () => {
      await collaborativeEditor.initializeDocument(
        'doc-1',
        'Hello World',
        'user-1'
      );

      const document = collaborativeEditor.getDocument('doc-1');

      expect(document).toBeDefined();
      expect(document!.id).toBe('doc-1');
      expect(document!.content).toBe('Hello World');
    });

    it('should return null for non-existent document', () => {
      const document = collaborativeEditor.getDocument('non-existent');
      expect(document).toBeNull();
    });
  });

  describe('metrics', () => {
    it('should return collaborative editing metrics', async () => {
      await collaborativeEditor.initializeDocument(
        'doc-1',
        'Hello World',
        'user-1'
      );
      await collaborativeEditor.joinDocument('doc-1', 'user-2');

      const metrics = collaborativeEditor.getMetrics();

      expect(metrics).toHaveProperty('activeDocuments');
      expect(metrics).toHaveProperty('totalOperations');
      expect(metrics).toHaveProperty('activeEditors');
      expect(metrics).toHaveProperty('queuedOperations');
      expect(metrics.activeDocuments).toBe(1);
      expect(metrics.activeEditors).toBe(2);
    });
  });
});
