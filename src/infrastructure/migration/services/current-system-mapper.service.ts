import {
  ExtractedFunctionality,
  IntegrationPoint,
} from '../types/migration.types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemStructure {
  directories: DirectoryInfo[];
  files: FileInfo[];
  totalFiles: number;
  totalDirectories: number;
}

export interface DirectoryInfo {
  path: string;
  name: string;
  layer:
    | 'domain'
    | 'application'
    | 'infrastructure'
    | 'presentation'
    | 'shared'
    | 'other';
  fileCount: number;
  subdirectories: string[];
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  layer: string;
  type:
    | 'service'
    | 'controller'
    | 'entity'
    | 'repository'
    | 'dto'
    | 'interface'
    | 'config'
    | 'other';
}

export interface ExistingFunctionality {
  name: string;
  type: string;
  location: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  capabilities: string[];
  lastModified: Date;
}

export interface QualityComparison {
  existing: ExistingFunctionality;
  new: ExtractedFunctionality;
  recommendation:
    | 'keep_existing'
    | 'replace_with_new'
    | 'merge_both'
    | 'enhance_existing';
  reasons: string[];
}

export class CurrentSystemMapperService {
  private systemStructure: SystemStructure | null = null;
  private functionalityCache: Map<string, ExistingFunctionality[]> = new Map();

  async mapCurrentStructure(): Promise<SystemStructure> {
    if (this.systemStructure) {
      return this.systemStructure;
    }

    const srcPath = path.join(process.cwd(), 'src');
    const directories: DirectoryInfo[] = [];
    const files: FileInfo[] = [];

    try {
      await this.scanDirectory(srcPath, directories, files);

      this.systemStructure = {
        directories,
        files,
        totalFiles: files.length,
        totalDirectories: directories.length,
      };

      return this.systemStructure;
    } catch (error) {
      console.warn('Failed to map current structure:', error.message);
      return {
        directories: [],
        files: [],
        totalFiles: 0,
        totalDirectories: 0,
      };
    }
  }

  async findEquivalentFunctionality(
    functionality: ExtractedFunctionality
  ): Promise<ExistingFunctionality | null> {
    const structure = await this.mapCurrentStructure();

    // Check cache first
    const cacheKey = `${functionality.name}_${functionality.type}`;
    const cached = this.functionalityCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached[0];
    }

    // Search for equivalent functionality
    const candidates: ExistingFunctionality[] = [];

    // Search by name similarity
    for (const file of structure.files) {
      if (this.isNameSimilar(functionality.name, file.name)) {
        const existing = await this.analyzeExistingFile(file);
        if (existing && this.isTypeSimilar(functionality.type, existing.type)) {
          candidates.push(existing);
        }
      }
    }

    // Search by functionality type and location
    const expectedLayer = this.determineExpectedLayer(functionality);
    const layerFiles = structure.files.filter(f => f.layer === expectedLayer);

    for (const file of layerFiles) {
      const existing = await this.analyzeExistingFile(file);
      if (existing && this.isFunctionalitySimilar(functionality, existing)) {
        candidates.push(existing);
      }
    }

    // Return best match
    if (candidates.length > 0) {
      const best = this.selectBestMatch(functionality, candidates);
      this.functionalityCache.set(cacheKey, [best]);
      return best;
    }

    return null;
  }

  async identifyIntegrationPoints(
    functionality: ExtractedFunctionality
  ): Promise<IntegrationPoint[]> {
    const integrationPoints: IntegrationPoint[] = [];
    const structure = await this.mapCurrentStructure();

    // Determine integration points based on functionality type and dependencies
    switch (functionality.type) {
      case 'class':
        integrationPoints.push(
          ...(await this.identifyClassIntegrations(functionality, structure))
        );
        break;
      case 'function':
        integrationPoints.push(
          ...(await this.identifyFunctionIntegrations(functionality, structure))
        );
        break;
      case 'interface':
        integrationPoints.push(
          ...(await this.identifyInterfaceIntegrations(
            functionality,
            structure
          ))
        );
        break;
      case 'configuration':
        integrationPoints.push(
          ...(await this.identifyConfigIntegrations(functionality, structure))
        );
        break;
    }

    // Add dependency-based integration points
    for (const dependency of functionality.dependencies) {
      const depIntegration = await this.findDependencyIntegration(
        dependency,
        structure
      );
      if (depIntegration) {
        integrationPoints.push(depIntegration);
      }
    }

    return integrationPoints;
  }

  assessImplementationQuality(
    existing: ExistingFunctionality,
    newFunc: ExtractedFunctionality
  ): QualityComparison {
    const reasons: string[] = [];
    let recommendation: QualityComparison['recommendation'] = 'keep_existing';

    // Compare based on quality metrics
    if (existing.quality === 'poor' || existing.quality === 'fair') {
      recommendation = 'replace_with_new';
      reasons.push(`Existing implementation quality is ${existing.quality}`);
    }

    // Compare capabilities
    const newCapabilities = this.estimateCapabilities(newFunc);
    const missingCapabilities = newCapabilities.filter(
      cap => !existing.capabilities.includes(cap)
    );

    if (missingCapabilities.length > 0) {
      if (existing.quality === 'excellent') {
        recommendation = 'enhance_existing';
        reasons.push(
          `Add missing capabilities: ${missingCapabilities.join(', ')}`
        );
      } else {
        recommendation = 'merge_both';
        reasons.push(`Merge to combine capabilities`);
      }
    }

    // Consider age and maintenance
    const daysSinceModified =
      (Date.now() - existing.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 180) {
      // 6 months
      reasons.push('Existing implementation is old and may need updates');
      if (recommendation === 'keep_existing') {
        recommendation = 'enhance_existing';
      }
    }

    // Consider architecture compliance
    const expectedLayer = this.determineExpectedLayer(newFunc);
    const currentLayer = this.extractLayerFromPath(existing.location);

    if (expectedLayer !== currentLayer) {
      recommendation = 'replace_with_new';
      reasons.push(
        `Move from ${currentLayer} to ${expectedLayer} layer for better architecture`
      );
    }

    return {
      existing,
      new: newFunc,
      recommendation,
      reasons,
    };
  }

  private async scanDirectory(
    dirPath: string,
    directories: DirectoryInfo[],
    files: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const relativePath = path.relative(
        path.join(process.cwd(), 'src'),
        dirPath
      );

      if (relativePath) {
        // Don't include root src directory
        const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
        const fileCount = entries.filter(e => e.isFile()).length;

        directories.push({
          path: relativePath,
          name: path.basename(dirPath),
          layer: this.determineLayer(relativePath),
          fileCount,
          subdirectories: subdirs,
        });
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, directories, files);
        } else {
          const stats = await fs.stat(fullPath);
          const relativeFilePath = path.relative(
            path.join(process.cwd(), 'src'),
            fullPath
          );

          files.push({
            path: relativeFilePath,
            name: entry.name,
            extension: path.extname(entry.name),
            size: stats.size,
            layer: this.determineLayer(path.dirname(relativeFilePath)),
            type: this.determineFileType(entry.name),
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error.message);
    }
  }

  private determineLayer(filePath: string): DirectoryInfo['layer'] {
    const pathLower = filePath.toLowerCase();

    if (pathLower.includes('domain')) return 'domain';
    if (pathLower.includes('application')) return 'application';
    if (pathLower.includes('infrastructure')) return 'infrastructure';
    if (pathLower.includes('presentation')) return 'presentation';
    if (pathLower.includes('shared')) return 'shared';

    return 'other';
  }

  private determineFileType(fileName: string): FileInfo['type'] {
    const nameLower = fileName.toLowerCase();

    if (nameLower.includes('service')) return 'service';
    if (nameLower.includes('controller')) return 'controller';
    if (nameLower.includes('entity')) return 'entity';
    if (nameLower.includes('repository')) return 'repository';
    if (nameLower.includes('dto')) return 'dto';
    if (nameLower.includes('interface') || nameLower.endsWith('.interface.ts'))
      return 'interface';
    if (nameLower.includes('config')) return 'config';

    return 'other';
  }

  private isNameSimilar(name1: string, name2: string): boolean {
    const normalize = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match
    if (n1 === n2) return true;

    // Contains match
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    const similarity = 1 - distance / maxLength;

    return similarity > 0.7; // 70% similarity threshold
  }

  private isTypeSimilar(type1: string, type2: string): boolean {
    const typeMap: Record<string, string[]> = {
      class: ['service', 'controller', 'entity'],
      function: ['function', 'method'],
      interface: ['interface', 'type'],
      configuration: ['config', 'configuration'],
    };

    const mapped1 = typeMap[type1] || [type1];
    const mapped2 = typeMap[type2] || [type2];

    return mapped1.some(t1 => mapped2.includes(t1));
  }

  private isFunctionalitySimilar(
    func: ExtractedFunctionality,
    existing: ExistingFunctionality
  ): boolean {
    // Check if they serve similar purposes based on name patterns
    const funcPurpose = this.extractPurpose(func.name);
    const existingPurpose = this.extractPurpose(existing.name);

    return funcPurpose === existingPurpose;
  }

  private extractPurpose(name: string): string {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('auth')) return 'authentication';
    if (nameLower.includes('user')) return 'user_management';
    if (nameLower.includes('task')) return 'task_management';
    if (nameLower.includes('notification')) return 'notification';
    if (nameLower.includes('email')) return 'email';
    if (nameLower.includes('database') || nameLower.includes('db'))
      return 'database';
    if (nameLower.includes('api')) return 'api';
    if (nameLower.includes('config')) return 'configuration';

    return 'general';
  }

  private determineExpectedLayer(
    functionality: ExtractedFunctionality
  ): string {
    const name = functionality.name.toLowerCase();
    const description = functionality.description.toLowerCase();

    if (name.includes('entity') || description.includes('domain'))
      return 'domain';
    if (name.includes('service') && !name.includes('controller'))
      return 'application';
    if (name.includes('repository') || name.includes('database'))
      return 'infrastructure';
    if (name.includes('controller') || name.includes('dto'))
      return 'presentation';
    if (name.includes('util') || name.includes('helper')) return 'shared';

    return 'other';
  }

  private extractLayerFromPath(filePath: string): string {
    return this.determineLayer(filePath);
  }

  private async analyzeExistingFile(
    file: FileInfo
  ): Promise<ExistingFunctionality | null> {
    try {
      const fullPath = path.join(process.cwd(), 'src', file.path);
      const stats = await fs.stat(fullPath);

      // Simple analysis - could be enhanced with actual code parsing
      const quality = this.assessFileQuality(file);
      const capabilities = this.estimateFileCapabilities(file);

      return {
        name: path.basename(file.name, file.extension),
        type: file.type,
        location: file.path,
        quality,
        capabilities,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return null;
    }
  }

  private assessFileQuality(file: FileInfo): ExistingFunctionality['quality'] {
    // Simple heuristics - could be enhanced with actual code analysis
    if (file.size < 100) return 'poor'; // Too small
    if (file.size > 10000) return 'fair'; // Too large
    if (file.name.includes('test') || file.name.includes('spec')) return 'good'; // Has tests

    return 'good'; // Default
  }

  private estimateFileCapabilities(file: FileInfo): string[] {
    const capabilities: string[] = [];
    const name = file.name.toLowerCase();

    if (name.includes('crud'))
      capabilities.push('create', 'read', 'update', 'delete');
    if (name.includes('auth'))
      capabilities.push('authentication', 'authorization');
    if (name.includes('validation')) capabilities.push('validation');
    if (name.includes('cache')) capabilities.push('caching');
    if (name.includes('email')) capabilities.push('email_sending');
    if (name.includes('notification')) capabilities.push('notifications');

    return capabilities;
  }

  private estimateCapabilities(
    functionality: ExtractedFunctionality
  ): string[] {
    const capabilities: string[] = [];
    const name = functionality.name.toLowerCase();
    const description = functionality.description.toLowerCase();

    if (name.includes('create') || description.includes('create'))
      capabilities.push('create');
    if (
      name.includes('read') ||
      name.includes('get') ||
      description.includes('read')
    )
      capabilities.push('read');
    if (name.includes('update') || description.includes('update'))
      capabilities.push('update');
    if (name.includes('delete') || description.includes('delete'))
      capabilities.push('delete');
    if (name.includes('auth') || description.includes('auth'))
      capabilities.push('authentication');
    if (name.includes('valid') || description.includes('valid'))
      capabilities.push('validation');

    return capabilities;
  }

  private selectBestMatch(
    functionality: ExtractedFunctionality,
    candidates: ExistingFunctionality[]
  ): ExistingFunctionality {
    // Score each candidate
    const scored = candidates.map(candidate => ({
      candidate,
      score: this.calculateMatchScore(functionality, candidate),
    }));

    // Return highest scoring candidate
    scored.sort((a, b) => b.score - a.score);
    return scored[0].candidate;
  }

  private calculateMatchScore(
    functionality: ExtractedFunctionality,
    existing: ExistingFunctionality
  ): number {
    let score = 0;

    // Name similarity
    if (this.isNameSimilar(functionality.name, existing.name)) score += 10;

    // Type similarity
    if (this.isTypeSimilar(functionality.type, existing.type)) score += 5;

    // Quality bonus
    switch (existing.quality) {
      case 'excellent':
        score += 4;
        break;
      case 'good':
        score += 3;
        break;
      case 'fair':
        score += 1;
        break;
      case 'poor':
        score -= 2;
        break;
    }

    // Capability overlap
    const newCapabilities = this.estimateCapabilities(functionality);
    const overlap = existing.capabilities.filter(cap =>
      newCapabilities.includes(cap)
    );
    score += overlap.length * 2;

    return score;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Integration point identification methods
  private async identifyClassIntegrations(
    functionality: ExtractedFunctionality,
    structure: SystemStructure
  ): Promise<IntegrationPoint[]> {
    const points: IntegrationPoint[] = [];

    // Service classes need DI registration
    if (functionality.name.includes('Service')) {
      points.push({
        component: 'DependencyInjection',
        connectionType: 'dependency_injection',
        verificationMethod: 'checkServiceRegistration',
        required: true,
      });
    }

    // Controller classes need route registration
    if (functionality.name.includes('Controller')) {
      points.push({
        component: 'RouteRegistration',
        connectionType: 'api_endpoint',
        verificationMethod: 'checkRouteRegistration',
        required: true,
      });
    }

    return points;
  }

  private async identifyFunctionIntegrations(
    functionality: ExtractedFunctionality,
    structure: SystemStructure
  ): Promise<IntegrationPoint[]> {
    const points: IntegrationPoint[] = [];

    // Utility functions need to be exported
    points.push({
      component: 'ModuleExports',
      connectionType: 'import',
      verificationMethod: 'checkExportAvailability',
      required: true,
    });

    return points;
  }

  private async identifyInterfaceIntegrations(
    functionality: ExtractedFunctionality,
    structure: SystemStructure
  ): Promise<IntegrationPoint[]> {
    const points: IntegrationPoint[] = [];

    // Interfaces need to be available for import
    points.push({
      component: 'TypeDefinitions',
      connectionType: 'import',
      verificationMethod: 'checkTypeAvailability',
      required: true,
    });

    return points;
  }

  private async identifyConfigIntegrations(
    functionality: ExtractedFunctionality,
    structure: SystemStructure
  ): Promise<IntegrationPoint[]> {
    const points: IntegrationPoint[] = [];

    // Configuration needs to be loaded
    points.push({
      component: 'ConfigurationLoader',
      connectionType: 'import',
      verificationMethod: 'checkConfigurationLoading',
      required: true,
    });

    return points;
  }

  private async findDependencyIntegration(
    dependency: string,
    structure: SystemStructure
  ): Promise<IntegrationPoint | null> {
    // Check if dependency exists in current system
    const dependencyFile = structure.files.find(
      f => f.name.includes(dependency) || f.path.includes(dependency)
    );

    if (dependencyFile) {
      return {
        component: dependency,
        connectionType: 'import',
        verificationMethod: 'checkDependencyAvailability',
        required: true,
      };
    }

    return null;
  }
}
