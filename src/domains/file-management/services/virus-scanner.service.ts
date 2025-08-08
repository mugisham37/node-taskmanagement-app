export interface VirusScanResult {
  isClean: boolean;
  threats: string[];
  scanEngine: string;
  scanDate: Date;
  scanDuration: number; // in milliseconds
  metadata: Record<string, any>;
}

export interface VirusScannerService {
  // Core scanning operations
  scanBuffer(buffer: Buffer, filename: string): Promise<VirusScanResult>;
  scanFile(filePath: string): Promise<VirusScanResult>;
  scanUrl(url: string): Promise<VirusScanResult>;

  // Batch operations
  scanMultipleFiles(filePaths: string[]): Promise<VirusScanResult[]>;

  // Configuration and status
  isAvailable(): Promise<boolean>;
  getEngineInfo(): Promise<{
    name: string;
    version: string;
    lastUpdate: Date;
    signatureCount: number;
  }>;

  // Update operations
  updateSignatures(): Promise<void>;
  getUpdateStatus(): Promise<{
    lastUpdate: Date;
    nextUpdate: Date;
    isUpdating: boolean;
  }>;

  // Quarantine operations
  quarantineFile(filePath: string, reason: string): Promise<void>;
  releaseFromQuarantine(filePath: string): Promise<void>;
  listQuarantinedFiles(): Promise<
    Array<{
      filePath: string;
      quarantineDate: Date;
      reason: string;
    }>
  >;

  // Reporting
  getScanStatistics(
    fromDate: Date,
    toDate: Date
  ): Promise<{
    totalScans: number;
    cleanFiles: number;
    infectedFiles: number;
    errors: number;
    averageScanTime: number;
  }>;
}
