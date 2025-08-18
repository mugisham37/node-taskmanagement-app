import { promises as fs } from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  ComplexityLevel,
  ExtractedFunctionality,
  LogicClassification,
} from '../types/migration.types';

export class FileAnalysisService {
  async analyzeFile(filePath: string): Promise<ExtractedFunctionality[]> {
    const functionalities: ExtractedFunctionality[] = [];

    try {
      const content = (await fs.readFile(filePath, 'utf-8')) as string;
      const extension = path.extname(filePath).toLowerCase();

      switch (extension) {
        case '.ts':
        case '.js':
          functionalities.push(...(await this.analyzeTypeScriptFile(filePath, content)));
          break;
        case '.json':
          functionalities.push(...(await this.analyzeJsonFile(filePath, content)));
          break;
        case '.yml':
        case '.yaml':
          functionalities.push(...(await this.analyzeYamlFile(filePath, content)));
          break;
        case '.md':
          functionalities.push(...(await this.analyzeMarkdownFile(filePath, content)));
          break;
        default:
          functionalities.push(...(await this.analyzeGenericFile(filePath, content)));
      }

      return functionalities;
    } catch (error: unknown) {
      console.warn(`Failed to analyze file ${filePath}:`, (error as Error).message);
      return [];
    }
  }

  async extractDependencies(filePath: string): Promise<string[]> {
    const dependencies: string[] = [];

    try {
      const content = (await fs.readFile(filePath, 'utf-8')) as string;
      const extension = path.extname(filePath).toLowerCase();

      if (extension === '.ts' || extension === '.js') {
        dependencies.push(...this.extractTypeScriptDependencies(content));
      } else if (extension === '.json') {
        dependencies.push(...this.extractJsonDependencies(content));
      }

      return [...new Set(dependencies)]; // Remove duplicates
    } catch (error: unknown) {
      console.warn(`Failed to extract dependencies from ${filePath}:`, (error as Error).message);
      return [];
    }
  }

  classifyLogic(functionality: ExtractedFunctionality): LogicClassification {
    const name = functionality.name.toLowerCase();
    const description = functionality.description.toLowerCase();

    // Critical functionality patterns
    if (name.includes('auth') || name.includes('security') || name.includes('password')) {
      return 'critical';
    }

    if (name.includes('payment') || name.includes('billing') || name.includes('transaction')) {
      return 'critical';
    }

    // Deprecated patterns
    if (
      description.includes('deprecated') ||
      description.includes('legacy') ||
      description.includes('old')
    ) {
      return 'deprecated';
    }

    // Complex patterns
    if (functionality.dependencies.length > 5) {
      return 'complex';
    }

    if (functionality.type === 'class' && description.includes('manager')) {
      return 'complex';
    }

    // Default to simple
    return 'simple';
  }

  estimateComplexity(functionality: ExtractedFunctionality): ComplexityLevel {
    let complexityScore = 0;

    // Base complexity by type
    switch (functionality.type) {
      case 'class':
        complexityScore += 3;
        break;
      case 'function':
        complexityScore += 2;
        break;
      case 'interface':
        complexityScore += 1;
        break;
      case 'type':
        complexityScore += 1;
        break;
      case 'constant':
        complexityScore += 0;
        break;
      case 'configuration':
        complexityScore += 1;
        break;
    }

    // Dependency complexity
    complexityScore += functionality.dependencies.length;

    // Name-based complexity indicators
    const name = functionality.name.toLowerCase();
    if (name.includes('manager') || name.includes('service') || name.includes('controller')) {
      complexityScore += 2;
    }

    if (name.includes('factory') || name.includes('builder') || name.includes('strategy')) {
      complexityScore += 3;
    }

    // Description-based complexity
    const description = functionality.description.toLowerCase();
    if (description.includes('complex') || description.includes('advanced')) {
      complexityScore += 2;
    }

    if (description.includes('integration') || description.includes('external')) {
      complexityScore += 2;
    }

    // Determine complexity level
    if (complexityScore <= 2) return 'low';
    if (complexityScore <= 5) return 'medium';
    if (complexityScore <= 8) return 'high';
    return 'very_high';
  }

  private async analyzeTypeScriptFile(
    filePath: string,
    content: string
  ): Promise<ExtractedFunctionality[]> {
    const functionalities: ExtractedFunctionality[] = [];

    try {
      // Create TypeScript source file
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      // Visit all nodes in the AST
      const visit = (node: ts.Node) => {
        switch (node.kind) {
          case ts.SyntaxKind.ClassDeclaration:
            functionalities.push(this.extractClassInfo(node as ts.ClassDeclaration, filePath));
            break;
          case ts.SyntaxKind.FunctionDeclaration:
            functionalities.push(
              this.extractFunctionInfo(node as ts.FunctionDeclaration, filePath)
            );
            break;
          case ts.SyntaxKind.InterfaceDeclaration:
            functionalities.push(
              this.extractInterfaceInfo(node as ts.InterfaceDeclaration, filePath)
            );
            break;
          case ts.SyntaxKind.TypeAliasDeclaration:
            functionalities.push(this.extractTypeInfo(node as ts.TypeAliasDeclaration, filePath));
            break;
          case ts.SyntaxKind.VariableStatement:
            functionalities.push(
              ...this.extractVariableInfo(node as ts.VariableStatement, filePath)
            );
            break;
          case ts.SyntaxKind.EnumDeclaration:
            functionalities.push(this.extractEnumInfo(node as ts.EnumDeclaration, filePath));
            break;
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (error: unknown) {
      console.warn(`Failed to parse TypeScript file ${filePath}:`, (error as Error).message);
      // Fallback to simple text analysis
      functionalities.push(...(await this.analyzeGenericFile(filePath, content)));
    }

    return functionalities;
  }

  private extractClassInfo(node: ts.ClassDeclaration, filePath: string): ExtractedFunctionality {
    const name = node.name?.text || 'UnnamedClass';

    // Use getDecorators() for newer TypeScript versions
    const decorators =
      ts.getDecorators?.(node)?.map((d: any) => d.getText()) ||
      (node as any).decorators?.map((d: any) => d.getText()) ||
      [];

    const isService = decorators.some(
      (d: string) => d.includes('Injectable') || d.includes('Service')
    );
    const isController = decorators.some((d: string) => d.includes('Controller'));

    return {
      name,
      type: 'class',
      description: `${isService ? 'Service' : isController ? 'Controller' : 'Class'}: ${name}`,
      dependencies: this.extractTypeScriptDependencies(node.getFullText()),
      currentStatus: 'missing',
      migrationAction: 'migrate',
      sourceLocation: filePath,
    };
  }

  private extractFunctionInfo(
    node: ts.FunctionDeclaration,
    filePath: string
  ): ExtractedFunctionality {
    const name = node.name?.text || 'UnnamedFunction';
    const isAsync =
      node.modifiers?.some((m: any) => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported =
      node.modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name,
      type: 'function',
      description: `${isAsync ? 'Async ' : ''}${isExported ? 'Exported ' : ''}Function: ${name}`,
      dependencies: this.extractTypeScriptDependencies(node.getFullText()),
      currentStatus: 'missing',
      migrationAction: 'migrate',
      sourceLocation: filePath,
    };
  }

  private extractInterfaceInfo(
    node: ts.InterfaceDeclaration,
    filePath: string
  ): ExtractedFunctionality {
    const name = node.name.text;
    const memberCount = node.members.length;

    return {
      name,
      type: 'interface',
      description: `Interface: ${name} with ${memberCount} members`,
      dependencies: this.extractTypeScriptDependencies(node.getFullText()),
      currentStatus: 'missing',
      migrationAction: 'migrate',
      sourceLocation: filePath,
    };
  }

  private extractTypeInfo(node: ts.TypeAliasDeclaration, filePath: string): ExtractedFunctionality {
    const name = node.name.text;

    return {
      name,
      type: 'type',
      description: `Type alias: ${name}`,
      dependencies: this.extractTypeScriptDependencies(node.getFullText()),
      currentStatus: 'missing',
      migrationAction: 'migrate',
      sourceLocation: filePath,
    };
  }

  private extractVariableInfo(
    node: ts.VariableStatement,
    filePath: string
  ): ExtractedFunctionality[] {
    const functionalities: ExtractedFunctionality[] = [];

    node.declarationList.declarations.forEach((declaration: any) => {
      if (ts.isIdentifier(declaration.name)) {
        const name = declaration.name.text;
        const isConst = node.declarationList.flags & ts.NodeFlags.Const;

        functionalities.push({
          name,
          type: 'constant',
          description: `${isConst ? 'Constant' : 'Variable'}: ${name}`,
          dependencies: this.extractTypeScriptDependencies(declaration.getFullText()),
          currentStatus: 'missing',
          migrationAction: 'migrate',
          sourceLocation: filePath,
        });
      }
    });

    return functionalities;
  }

  private extractEnumInfo(node: ts.EnumDeclaration, filePath: string): ExtractedFunctionality {
    const name = node.name.text;
    const memberCount = node.members.length;

    return {
      name,
      type: 'constant',
      description: `Enum: ${name} with ${memberCount} values`,
      dependencies: [],
      currentStatus: 'missing',
      migrationAction: 'migrate',
      sourceLocation: filePath,
    };
  }

  private extractTypeScriptDependencies(content: string): string[] {
    const dependencies: string[] = [];

    // Extract import statements
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      }
    }

    // Extract require statements
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      }
    }

    return dependencies;
  }

  private async analyzeJsonFile(
    filePath: string,
    content: string
  ): Promise<ExtractedFunctionality[]> {
    const functionalities: ExtractedFunctionality[] = [];

    try {
      const json = JSON.parse(content);
      const fileName = path.basename(filePath, '.json');

      if (fileName === 'package') {
        functionalities.push({
          name: 'PackageConfiguration',
          type: 'configuration',
          description: `Package.json configuration with ${Object.keys(json.dependencies || {}).length} dependencies`,
          dependencies: Object.keys(json.dependencies || {}),
          currentStatus: 'missing',
          migrationAction: 'merge_logic',
          sourceLocation: filePath,
        });
      } else {
        functionalities.push({
          name: `${fileName}Configuration`,
          type: 'configuration',
          description: `JSON configuration file: ${fileName}`,
          dependencies: [],
          currentStatus: 'missing',
          migrationAction: 'migrate',
          sourceLocation: filePath,
        });
      }
    } catch (error) {
      functionalities.push({
        name: `InvalidJson_${path.basename(filePath)}`,
        type: 'configuration',
        description: `Invalid JSON file: ${filePath}`,
        dependencies: [],
        currentStatus: 'missing',
        migrationAction: 'skip',
        sourceLocation: filePath,
      });
    }

    return functionalities;
  }

  private async analyzeYamlFile(
    filePath: string,
    _content: string
  ): Promise<ExtractedFunctionality[]> {
    const fileName = path.basename(filePath);

    return [
      {
        name: `${fileName}Configuration`,
        type: 'configuration',
        description: `YAML configuration file: ${fileName}`,
        dependencies: [],
        currentStatus: 'missing',
        migrationAction: 'migrate',
        sourceLocation: filePath,
      },
    ];
  }

  private async analyzeMarkdownFile(
    filePath: string,
    _content: string
  ): Promise<ExtractedFunctionality[]> {
    const fileName = path.basename(filePath);

    return [
      {
        name: `${fileName}Documentation`,
        type: 'configuration',
        description: `Markdown documentation: ${fileName}`,
        dependencies: [],
        currentStatus: 'missing',
        migrationAction: 'migrate',
        sourceLocation: filePath,
      },
    ];
  }

  private async analyzeGenericFile(
    filePath: string,
    _content: string
  ): Promise<ExtractedFunctionality[]> {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    return [
      {
        name: `${fileName}File`,
        type: 'configuration',
        description: `Generic file: ${fileName} (${extension})`,
        dependencies: [],
        currentStatus: 'missing',
        migrationAction: 'migrate',
        sourceLocation: filePath,
      },
    ];
  }

  private extractJsonDependencies(content: string): string[] {
    try {
      const json = JSON.parse(content);

      if (json.dependencies) {
        return Object.keys(json.dependencies);
      }

      if (json.devDependencies) {
        return Object.keys(json.devDependencies);
      }

      return [];
    } catch (error) {
      return [];
    }
  }
}
