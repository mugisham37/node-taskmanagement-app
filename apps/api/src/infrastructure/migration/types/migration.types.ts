/**
 * Core types for the legacy migration system
 */

export interface MigrationSession {
  sessionId: string;
  startTime: Date;
  totalFiles: number;
  processedFiles: number;
  migratedFunctionalities: number;
  enhancedComponents: number;
  deletedFiles: string[];
  errors: MigrationError[];
  status: 'in_progress' | 'completed' | 'failed';
  currentFile?: string;
  progress: number;
}

export interface MigrationError {
  file: string;
  functionality: string;
  error: string;
  resolution: string;
  resolved: boolean;
  timestamp: Date;
}

export interface ExtractedFunctionality {
  name: string;
  type:
    | 'class'
    | 'function'
    | 'interface'
    | 'type'
    | 'constant'
    | 'configuration';
  description: string;
  dependencies: string[];
  currentStatus: 'exists' | 'missing' | 'partial' | 'superior_exists';
  migrationAction: 'skip' | 'migrate' | 'enhance' | 'replace' | 'merge_logic';
  sourceLocation: string;
  targetLocation?: string;
}

export interface MigrationAction {
  action: 'create_file' | 'update_file' | 'merge_logic' | 'enhance_existing';
  targetPath: string;
  codeChanges: CodeChange[];
  integrationRequired: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface CodeChange {
  type: 'add' | 'modify' | 'delete';
  content: string;
  location: string;
  reason: string;
}

export interface IntegrationPoint {
  component: string;
  connectionType:
    | 'dependency_injection'
    | 'import'
    | 'event_handler'
    | 'api_endpoint';
  verificationMethod: string;
  required: boolean;
}

export interface FileMigrationProcess {
  sourceFile: string;
  targetLocation: string;
  functionalities: ExtractedFunctionality[];
  migrationActions: MigrationAction[];
  integrationPoints: IntegrationPoint[];
  verificationStatus: VerificationStatus;
  deletionConfirmed: boolean;
  backupCreated: boolean;
}

export interface VerificationStatus {
  integrationTested: boolean;
  functionalityValidated: boolean;
  performanceChecked: boolean;
  architectureCompliant: boolean;
  errors: string[];
  warnings: string[];
}

export interface BackupInfo {
  backupId: string;
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  checksum: string;
}

export type LogicClassification =
  | 'simple'
  | 'complex'
  | 'critical'
  | 'deprecated';
export type ComplexityLevel = 'low' | 'medium' | 'high' | 'very_high';
