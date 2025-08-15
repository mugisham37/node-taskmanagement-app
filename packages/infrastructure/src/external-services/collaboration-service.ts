
export enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  REPLACE = 'replace',
  MODIFY = 'modify'
}

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
  documentId: string;
  userId: string;
  userEmail: string;
  type: OperationType;
  position: number;
  content: string;
  length?: number;
  timestamp: Date;
  version: number;
}

export interface CollaborationService {
  /**
   * Create a new collaborative document
   */
  createDocument(
    documentId: string,
    type: 'task' | 'project' | 'comment',
    entityId: string,
    initialContent: any,
    userId: string
  ): Promise<CollaborativeDocument>;

  /**
   * Get a collaborative document
   */
  getDocument(documentId: string): Promise<CollaborativeDocument | undefined>;

  /**
   * Apply an operation to a document
   */
  applyOperation(
    documentId: string,
    operation: Omit<DocumentOperation, 'id' | 'timestamp'>,
    userId: string
  ): Promise<{
    success: boolean;
    document?: CollaborativeDocument;
    conflict?: boolean;
  }>;

  /**
   * Add a collaborator to a document
   */
  addCollaborator(documentId: string, userId: string): Promise<boolean>;

  /**
   * Remove a collaborator from a document
   */
  removeCollaborator(documentId: string, userId: string): Promise<boolean>;

  /**
   * Set typing indicator for a user
   */
  setTypingIndicator(
    documentId: string,
    userId: string,
    userEmail: string,
    isTyping: boolean
  ): void;
}