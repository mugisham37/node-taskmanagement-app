import { logger } from '@/infrastructure/logging/logger';
import { EditOperation } from './collaborative-editor';

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  operations: EditOperation[];
  createdAt: number;
  createdBy: string;
  message?: string;
  parentVersion?: number;
}

export interface VersionBranch {
  id: string;
  name: string;
  documentId: string;
  baseVersion: number;
  headVersion: number;
  createdAt: number;
  createdBy: string;
}

export interface VersionDiff {
  documentId: string;
  fromVersion: number;
  toVersion: number;
  operations: EditOperation[];
  additions: number;
  deletions: number;
  changes: Array<{
    type: 'add' | 'remove' | 'modify';
    position: number;
    content: string;
    length?: number;
  }>;
}

export interface UndoRedoState {
  documentId: string;
  userId: string;
  undoStack: EditOperation[];
  redoStack: EditOperation[];
  maxStackSize: number;
}

export class VersionControl {
  private versions: Map<string, DocumentVersion[]> = new Map(); // documentId -> versions
  private branches: Map<string, VersionBranch[]> = new Map(); // documentId -> branches
  private undoRedoStates: Map<string, UndoRedoState> = new Map(); // userId:documentId -> state
  private maxVersionHistory: number = 100;

  constructor(maxVersionHistory: number = 100) {
    this.maxVersionHistory = maxVersionHistory;
    logger.info('Version control system initialized', { maxVersionHistory });
  }

  /**
   * Create initial version for document
   */
  createInitialVersion(
    documentId: string,
    content: string,
    userId: string,
    message?: string
  ): DocumentVersion {
    const version: DocumentVersion = {
      id: this.generateVersionId(),
      documentId,
      version: 1,
      content,
      operations: [],
      createdAt: Date.now(),
      createdBy: userId,
      message: message || 'Initial version',
    };

    const versions = this.versions.get(documentId) || [];
    versions.push(version);
    this.versions.set(documentId, versions);

    // Initialize undo/redo state for user
    this.initializeUndoRedoState(documentId, userId);

    logger.info('Initial version created', {
      documentId,
      versionId: version.id,
      userId,
    });

    return version;
  }

  /**
   * Create new version from operations
   */
  createVersion(
    documentId: string,
    operations: EditOperation[],
    content: string,
    userId: string,
    message?: string
  ): DocumentVersion | null {
    const versions = this.versions.get(documentId);
    if (!versions || versions.length === 0) {
      logger.warn('Cannot create version for non-existent document', {
        documentId,
      });
      return null;
    }

    const lastVersion = versions[versions.length - 1];
    const newVersion: DocumentVersion = {
      id: this.generateVersionId(),
      documentId,
      version: lastVersion.version + 1,
      content,
      operations,
      createdAt: Date.now(),
      createdBy: userId,
      message,
      parentVersion: lastVersion.version,
    };

    versions.push(newVersion);

    // Trim version history if needed
    if (versions.length > this.maxVersionHistory) {
      versions.splice(0, versions.length - this.maxVersionHistory);
    }

    this.versions.set(documentId, versions);

    logger.info('New version created', {
      documentId,
      versionId: newVersion.id,
      version: newVersion.version,
      operationCount: operations.length,
      userId,
    });

    return newVersion;
  }

  /**
   * Get document version
   */
  getVersion(documentId: string, version: number): DocumentVersion | null {
    const versions = this.versions.get(documentId);
    if (!versions) {
      return null;
    }

    return versions.find(v => v.version === version) || null;
  }

  /**
   * Get latest version
   */
  getLatestVersion(documentId: string): DocumentVersion | null {
    const versions = this.versions.get(documentId);
    if (!versions || versions.length === 0) {
      return null;
    }

    return versions[versions.length - 1];
  }

  /**
   * Get version history
   */
  getVersionHistory(
    documentId: string,
    limit: number = 20,
    offset: number = 0
  ): DocumentVersion[] {
    const versions = this.versions.get(documentId);
    if (!versions) {
      return [];
    }

    return versions
      .slice()
      .reverse()
      .slice(offset, offset + limit);
  }

  /**
   * Calculate diff between versions
   */
  calculateDiff(
    documentId: string,
    fromVersion: number,
    toVersion: number
  ): VersionDiff | null {
    const fromVer = this.getVersion(documentId, fromVersion);
    const toVer = this.getVersion(documentId, toVersion);

    if (!fromVer || !toVer) {
      return null;
    }

    // Get operations between versions
    const operations: EditOperation[] = [];
    const versions = this.versions.get(documentId) || [];

    for (const version of versions) {
      if (version.version > fromVersion && version.version <= toVersion) {
        operations.push(...version.operations);
      }
    }

    // Calculate changes
    const changes = this.calculateChanges(fromVer.content, toVer.content);
    const additions = changes
      .filter(c => c.type === 'add')
      .reduce((sum, c) => sum + c.content.length, 0);
    const deletions = changes
      .filter(c => c.type === 'remove')
      .reduce((sum, c) => sum + (c.length || 0), 0);

    return {
      documentId,
      fromVersion,
      toVersion,
      operations,
      additions,
      deletions,
      changes,
    };
  }

  /**
   * Revert to specific version
   */
  revertToVersion(
    documentId: string,
    targetVersion: number,
    userId: string,
    message?: string
  ): DocumentVersion | null {
    const targetVer = this.getVersion(documentId, targetVersion);
    if (!targetVer) {
      logger.warn('Cannot revert to non-existent version', {
        documentId,
        targetVersion,
      });
      return null;
    }

    // Create revert operation
    const revertOperation: EditOperation = {
      id: this.generateOperationId(),
      type: 'retain', // Special revert operation
      position: 0,
      content: targetVer.content,
      timestamp: Date.now(),
      userId,
      version: targetVer.version,
    };

    const newVersion = this.createVersion(
      documentId,
      [revertOperation],
      targetVer.content,
      userId,
      message || `Reverted to version ${targetVersion}`
    );

    logger.info('Document reverted to version', {
      documentId,
      targetVersion,
      newVersion: newVersion?.version,
      userId,
    });

    return newVersion;
  }

  /**
   * Create branch
   */
  createBranch(
    documentId: string,
    branchName: string,
    baseVersion: number,
    userId: string
  ): VersionBranch | null {
    const baseVer = this.getVersion(documentId, baseVersion);
    if (!baseVer) {
      logger.warn('Cannot create branch from non-existent version', {
        documentId,
        baseVersion,
      });
      return null;
    }

    const branch: VersionBranch = {
      id: this.generateBranchId(),
      name: branchName,
      documentId,
      baseVersion,
      headVersion: baseVersion,
      createdAt: Date.now(),
      createdBy: userId,
    };

    const branches = this.branches.get(documentId) || [];
    branches.push(branch);
    this.branches.set(documentId, branches);

    logger.info('Branch created', {
      documentId,
      branchName,
      branchId: branch.id,
      baseVersion,
      userId,
    });

    return branch;
  }

  /**
   * Get branches for document
   */
  getBranches(documentId: string): VersionBranch[] {
    return this.branches.get(documentId) || [];
  }

  /**
   * Add operation to undo stack
   */
  addToUndoStack(
    documentId: string,
    userId: string,
    operation: EditOperation
  ): void {
    const stateKey = `${userId}:${documentId}`;
    const state = this.undoRedoStates.get(stateKey);

    if (!state) {
      this.initializeUndoRedoState(documentId, userId);
      return this.addToUndoStack(documentId, userId, operation);
    }

    state.undoStack.push(operation);

    // Clear redo stack when new operation is added
    state.redoStack = [];

    // Limit stack size
    if (state.undoStack.length > state.maxStackSize) {
      state.undoStack.shift();
    }

    logger.debug('Operation added to undo stack', {
      documentId,
      userId,
      operationId: operation.id,
      stackSize: state.undoStack.length,
    });
  }

  /**
   * Undo last operation
   */
  undo(documentId: string, userId: string): EditOperation | null {
    const stateKey = `${userId}:${documentId}`;
    const state = this.undoRedoStates.get(stateKey);

    if (!state || state.undoStack.length === 0) {
      return null;
    }

    const operation = state.undoStack.pop()!;
    state.redoStack.push(operation);

    // Create inverse operation
    const undoOperation = this.createInverseOperation(operation);

    logger.debug('Operation undone', {
      documentId,
      userId,
      originalOperationId: operation.id,
      undoOperationId: undoOperation.id,
    });

    return undoOperation;
  }

  /**
   * Redo last undone operation
   */
  redo(documentId: string, userId: string): EditOperation | null {
    const stateKey = `${userId}:${documentId}`;
    const state = this.undoRedoStates.get(stateKey);

    if (!state || state.redoStack.length === 0) {
      return null;
    }

    const operation = state.redoStack.pop()!;
    state.undoStack.push(operation);

    logger.debug('Operation redone', {
      documentId,
      userId,
      operationId: operation.id,
    });

    return operation;
  }

  /**
   * Get undo/redo state
   */
  getUndoRedoState(
    documentId: string,
    userId: string
  ): {
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
  } {
    const stateKey = `${userId}:${documentId}`;
    const state = this.undoRedoStates.get(stateKey);

    if (!state) {
      return {
        canUndo: false,
        canRedo: false,
        undoCount: 0,
        redoCount: 0,
      };
    }

    return {
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
      undoCount: state.undoStack.length,
      redoCount: state.redoStack.length,
    };
  }

  /**
   * Initialize undo/redo state for user
   */
  private initializeUndoRedoState(documentId: string, userId: string): void {
    const stateKey = `${userId}:${documentId}`;

    if (!this.undoRedoStates.has(stateKey)) {
      this.undoRedoStates.set(stateKey, {
        documentId,
        userId,
        undoStack: [],
        redoStack: [],
        maxStackSize: 50,
      });
    }
  }

  /**
   * Create inverse operation for undo
   */
  private createInverseOperation(operation: EditOperation): EditOperation {
    const inverse: EditOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      userId: operation.userId,
      version: operation.version,
      position: operation.position,
      type: operation.type,
    };

    switch (operation.type) {
      case 'insert':
        inverse.type = 'delete';
        inverse.length = operation.content?.length || 0;
        break;

      case 'delete':
        inverse.type = 'insert';
        inverse.content = operation.content || '';
        break;

      case 'retain':
        // Retain operations are their own inverse
        break;
    }

    return inverse;
  }

  /**
   * Calculate changes between two content strings
   */
  private calculateChanges(
    fromContent: string,
    toContent: string
  ): Array<{
    type: 'add' | 'remove' | 'modify';
    position: number;
    content: string;
    length?: number;
  }> {
    const changes: Array<{
      type: 'add' | 'remove' | 'modify';
      position: number;
      content: string;
      length?: number;
    }> = [];

    // Simple diff algorithm (can be enhanced with more sophisticated algorithms)
    let i = 0;
    let j = 0;

    while (i < fromContent.length || j < toContent.length) {
      if (i >= fromContent.length) {
        // Addition at end
        changes.push({
          type: 'add',
          position: i,
          content: toContent.slice(j),
        });
        break;
      } else if (j >= toContent.length) {
        // Deletion at end
        changes.push({
          type: 'remove',
          position: i,
          content: fromContent.slice(i),
          length: fromContent.length - i,
        });
        break;
      } else if (fromContent[i] === toContent[j]) {
        // Characters match, continue
        i++;
        j++;
      } else {
        // Find next matching character
        let nextMatch = -1;
        for (let k = j + 1; k < toContent.length && k < j + 10; k++) {
          if (fromContent[i] === toContent[k]) {
            nextMatch = k;
            break;
          }
        }

        if (nextMatch !== -1) {
          // Addition
          changes.push({
            type: 'add',
            position: i,
            content: toContent.slice(j, nextMatch),
          });
          j = nextMatch;
        } else {
          // Modification or deletion
          changes.push({
            type: 'modify',
            position: i,
            content: toContent[j] || '',
            length: 1,
          });
          i++;
          j++;
        }
      }
    }

    return changes;
  }

  /**
   * Generate unique version ID
   */
  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique branch ID
   */
  private generateBranchId(): string {
    return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get version control metrics
   */
  getMetrics() {
    const totalVersions = Array.from(this.versions.values()).reduce(
      (sum, versions) => sum + versions.length,
      0
    );

    const totalBranches = Array.from(this.branches.values()).reduce(
      (sum, branches) => sum + branches.length,
      0
    );

    return {
      documentsWithVersions: this.versions.size,
      totalVersions,
      totalBranches,
      activeUndoRedoStates: this.undoRedoStates.size,
      maxVersionHistory: this.maxVersionHistory,
    };
  }

  /**
   * Clean up version control data for document
   */
  cleanup(documentId: string): void {
    this.versions.delete(documentId);
    this.branches.delete(documentId);

    // Clean up undo/redo states
    const keysToDelete: string[] = [];
    for (const [key, state] of this.undoRedoStates) {
      if (state.documentId === documentId) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.undoRedoStates.delete(key));

    logger.info('Version control data cleaned up', { documentId });
  }
}
