import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionControl } from '@/infrastructure/websocket/version-control';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VersionControl', () => {
  let versionControl: VersionControl;

  beforeEach(() => {
    versionControl = new VersionControl(50); // Max 50 versions for testing
  });

  describe('version creation', () => {
    it('should create initial version', () => {
      const version = versionControl.createInitialVersion(
        'doc-1',
        'Hello World',
        'user-1',
        'Initial commit'
      );

      expect(version).toBeDefined();
      expect(version.documentId).toBe('doc-1');
      expect(version.content).toBe('Hello World');
      expect(version.version).toBe(1);
      expect(version.createdBy).toBe('user-1');
      expect(version.message).toBe('Initial commit');
    });

    it('should create subsequent versions', () => {
      // Create initial version
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');

      // Create second version
      const operations = [
        {
          id: 'op-1',
          type: 'insert' as const,
          position: 5,
          content: ' Beautiful',
          timestamp: Date.now(),
          userId: 'user-1',
          version: 2,
        },
      ];

      const version = versionControl.createVersion(
        'doc-1',
        operations,
        'Hello Beautiful World',
        'user-1',
        'Added beautiful'
      );

      expect(version).toBeDefined();
      expect(version!.version).toBe(2);
      expect(version!.content).toBe('Hello Beautiful World');
      expect(version!.operations).toHaveLength(1);
      expect(version!.parentVersion).toBe(1);
    });

    it('should handle creating version for non-existent document', () => {
      const version = versionControl.createVersion(
        'non-existent',
        [],
        'content',
        'user-1'
      );

      expect(version).toBeNull();
    });
  });

  describe('version retrieval', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Beautiful World',
        'user-1'
      );
    });

    it('should get specific version', () => {
      const version = versionControl.getVersion('doc-1', 1);

      expect(version).toBeDefined();
      expect(version!.version).toBe(1);
      expect(version!.content).toBe('Hello World');
    });

    it('should get latest version', () => {
      const version = versionControl.getLatestVersion('doc-1');

      expect(version).toBeDefined();
      expect(version!.version).toBe(2);
      expect(version!.content).toBe('Hello Beautiful World');
    });

    it('should get version history', () => {
      const history = versionControl.getVersionHistory('doc-1', 10);

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(2); // Latest first
      expect(history[1].version).toBe(1);
    });

    it('should return null for non-existent version', () => {
      const version = versionControl.getVersion('doc-1', 999);
      expect(version).toBeNull();
    });
  });

  describe('diff calculation', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Beautiful World',
        'user-1'
      );
    });

    it('should calculate diff between versions', () => {
      const diff = versionControl.calculateDiff('doc-1', 1, 2);

      expect(diff).toBeDefined();
      expect(diff!.fromVersion).toBe(1);
      expect(diff!.toVersion).toBe(2);
      expect(diff!.changes).toBeDefined();
      expect(diff!.additions).toBeGreaterThan(0);
    });

    it('should return null for invalid versions', () => {
      const diff = versionControl.calculateDiff('doc-1', 1, 999);
      expect(diff).toBeNull();
    });
  });

  describe('version revert', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Beautiful World',
        'user-1'
      );
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Amazing Beautiful World',
        'user-1'
      );
    });

    it('should revert to previous version', () => {
      const revertedVersion = versionControl.revertToVersion(
        'doc-1',
        1,
        'user-1',
        'Reverted changes'
      );

      expect(revertedVersion).toBeDefined();
      expect(revertedVersion!.content).toBe('Hello World');
      expect(revertedVersion!.message).toBe('Reverted changes');
      expect(revertedVersion!.version).toBe(4); // New version created
    });

    it('should handle reverting to non-existent version', () => {
      const revertedVersion = versionControl.revertToVersion(
        'doc-1',
        999,
        'user-1'
      );
      expect(revertedVersion).toBeNull();
    });
  });

  describe('branching', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Beautiful World',
        'user-1'
      );
    });

    it('should create branch', () => {
      const branch = versionControl.createBranch(
        'doc-1',
        'feature-branch',
        2,
        'user-1'
      );

      expect(branch).toBeDefined();
      expect(branch!.name).toBe('feature-branch');
      expect(branch!.baseVersion).toBe(2);
      expect(branch!.headVersion).toBe(2);
      expect(branch!.createdBy).toBe('user-1');
    });

    it('should get branches for document', () => {
      versionControl.createBranch('doc-1', 'feature-1', 1, 'user-1');
      versionControl.createBranch('doc-1', 'feature-2', 2, 'user-2');

      const branches = versionControl.getBranches('doc-1');

      expect(branches).toHaveLength(2);
      expect(branches.map(b => b.name)).toContain('feature-1');
      expect(branches.map(b => b.name)).toContain('feature-2');
    });

    it('should handle creating branch from non-existent version', () => {
      const branch = versionControl.createBranch(
        'doc-1',
        'invalid-branch',
        999,
        'user-1'
      );
      expect(branch).toBeNull();
    });
  });

  describe('undo/redo functionality', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
    });

    it('should add operation to undo stack', () => {
      const operation = {
        id: 'op-1',
        type: 'insert' as const,
        position: 5,
        content: ' Beautiful',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      versionControl.addToUndoStack('doc-1', 'user-1', operation);

      const state = versionControl.getUndoRedoState('doc-1', 'user-1');
      expect(state.canUndo).toBe(true);
      expect(state.undoCount).toBe(1);
    });

    it('should undo operation', () => {
      const operation = {
        id: 'op-1',
        type: 'insert' as const,
        position: 5,
        content: ' Beautiful',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      versionControl.addToUndoStack('doc-1', 'user-1', operation);
      const undoOperation = versionControl.undo('doc-1', 'user-1');

      expect(undoOperation).toBeDefined();
      expect(undoOperation!.type).toBe('delete'); // Inverse of insert
      expect(undoOperation!.position).toBe(5);
      expect(undoOperation!.length).toBe(' Beautiful'.length);

      const state = versionControl.getUndoRedoState('doc-1', 'user-1');
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(true);
    });

    it('should redo operation', () => {
      const operation = {
        id: 'op-1',
        type: 'insert' as const,
        position: 5,
        content: ' Beautiful',
        timestamp: Date.now(),
        userId: 'user-1',
        version: 1,
      };

      versionControl.addToUndoStack('doc-1', 'user-1', operation);
      versionControl.undo('doc-1', 'user-1');
      const redoOperation = versionControl.redo('doc-1', 'user-1');

      expect(redoOperation).toBeDefined();
      expect(redoOperation!.type).toBe('insert');
      expect(redoOperation!.content).toBe(' Beautiful');

      const state = versionControl.getUndoRedoState('doc-1', 'user-1');
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(false);
    });

    it('should return null when nothing to undo', () => {
      const undoOperation = versionControl.undo('doc-1', 'user-1');
      expect(undoOperation).toBeNull();
    });

    it('should return null when nothing to redo', () => {
      const redoOperation = versionControl.redo('doc-1', 'user-1');
      expect(redoOperation).toBeNull();
    });
  });

  describe('metrics and cleanup', () => {
    beforeEach(() => {
      versionControl.createInitialVersion('doc-1', 'Hello World', 'user-1');
      versionControl.createVersion(
        'doc-1',
        [],
        'Hello Beautiful World',
        'user-1'
      );
      versionControl.createBranch('doc-1', 'feature-branch', 1, 'user-1');
    });

    it('should return version control metrics', () => {
      const metrics = versionControl.getMetrics();

      expect(metrics).toHaveProperty('documentsWithVersions');
      expect(metrics).toHaveProperty('totalVersions');
      expect(metrics).toHaveProperty('totalBranches');
      expect(metrics).toHaveProperty('activeUndoRedoStates');
      expect(metrics).toHaveProperty('maxVersionHistory');

      expect(metrics.documentsWithVersions).toBe(1);
      expect(metrics.totalVersions).toBe(2);
      expect(metrics.totalBranches).toBe(1);
    });

    it('should cleanup document data', () => {
      versionControl.cleanup('doc-1');

      const version = versionControl.getLatestVersion('doc-1');
      const branches = versionControl.getBranches('doc-1');
      const state = versionControl.getUndoRedoState('doc-1', 'user-1');

      expect(version).toBeNull();
      expect(branches).toHaveLength(0);
      expect(state.canUndo).toBe(false);
    });
  });
});
