#!/usr/bin/env node

/**
 * API Route Generator
 * Generates tRPC routes with TypeScript, validation, and tests
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Route templates
const templates = {
  router: (name, options) => {
    const pascalName = toPascalCase(name);
    const camelName = toCamelCase(name);
    
    return `import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { ${pascalName}Service } from '@taskmanagement/domain';
import { 
  Create${pascalName}Schema,
  Update${pascalName}Schema,
  ${pascalName}QuerySchema,
  ${pascalName}ParamsSchema
} from '@taskmanagement/validation';

export const ${camelName}Router = router({
  // Get all ${name}s with optional filtering
  getAll: ${options.requireAuth ? 'protectedProcedure' : 'publicProcedure'}
    .input(${pascalName}QuerySchema.optional())
    .query(async ({ input, ctx }) => {
      const ${camelName}Service = new ${pascalName}Service(
        ctx.repositories.${camelName},
        ctx.eventBus
      );
      
      return await ${camelName}Service.findAll(input);
    }),

  // Get ${name} by ID
  getById: ${options.requireAuth ? 'protectedProcedure' : 'publicProcedure'}
    .input(${pascalName}ParamsSchema)
    .query(async ({ input, ctx }) => {
      const ${camelName}Service = new ${pascalName}Service(
        ctx.repositories.${camelName},
        ctx.eventBus
      );
      
      const ${camelName} = await ${camelName}Service.findById(input.id);
      
      if (!${camelName}) {
        throw new Error('${pascalName} not found');
      }
      
      return ${camelName};
    }),

  // Create new ${name}
  create: protectedProcedure
    .input(Create${pascalName}Schema)
    .mutation(async ({ input, ctx }) => {
      const ${camelName}Service = new ${pascalName}Service(
        ctx.repositories.${camelName},
        ctx.eventBus
      );
      
      return await ${camelName}Service.create({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Update ${name}
  update: protectedProcedure
    .input(Update${pascalName}Schema)
    .mutation(async ({ input, ctx }) => {
      const ${camelName}Service = new ${pascalName}Service(
        ctx.repositories.${camelName},
        ctx.eventBus
      );
      
      return await ${camelName}Service.update(input.id, {
        ...input,
        updatedBy: ctx.user.id,
      });
    }),

  // Delete ${name}
  delete: protectedProcedure
    .input(${pascalName}ParamsSchema)
    .mutation(async ({ input, ctx }) => {
      const ${camelName}Service = new ${pascalName}Service(
        ctx.repositories.${camelName},
        ctx.eventBus
      );
      
      await ${camelName}Service.delete(input.id);
      
      return { success: true };
    }),

${options.withSubscription ? `
  // Subscribe to ${name} changes
  subscribe: protectedProcedure
    .input(z.object({ ${camelName}Id: z.string().uuid().optional() }))
    .subscription(async ({ input, ctx }) => {
      return ctx.eventBus.subscribe('${camelName}.*', (event) => {
        if (!input.${camelName}Id || event.aggregateId === input.${camelName}Id) {
          return event;
        }
      });
    }),` : ''}
});`;
  },

  validation: (name, options) => {
    const pascalName = toPascalCase(name);
    
    return `import { z } from 'zod';

// Base ${name} schema
export const ${pascalName}Schema = z.object({
  id: z.string().uuid(),
  ${options.fields.map(field => `${field.name}: ${getZodType(field.type, field.optional)},`).join('\n  ')}
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().optional(),
});

// Create ${name} schema (without generated fields)
export const Create${pascalName}Schema = ${pascalName}Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
});

// Update ${name} schema (partial with ID)
export const Update${pascalName}Schema = Create${pascalName}Schema
  .partial()
  .extend({
    id: z.string().uuid(),
  });

// Query schema for filtering
export const ${pascalName}QuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.enum([${options.fields.map(f => `'${f.name}'`).join(', ')}]).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  ${options.fields
    .filter(f => f.filterable)
    .map(f => `${f.name}: ${getZodType(f.type, true)},`)
    .join('\n  ')}
});

// Params schema for ID-based operations
export const ${pascalName}ParamsSchema = z.object({
  id: z.string().uuid(),
});

// Export types
export type ${pascalName} = z.infer<typeof ${pascalName}Schema>;
export type Create${pascalName} = z.infer<typeof Create${pascalName}Schema>;
export type Update${pascalName} = z.infer<typeof Update${pascalName}Schema>;
export type ${pascalName}Query = z.infer<typeof ${pascalName}QuerySchema>;
export type ${pascalName}Params = z.infer<typeof ${pascalName}ParamsSchema>;`;
  },

  service: (name, options) => {
    const pascalName = toPascalCase(name);
    const camelName = toCamelCase(name);
    
    return `import { 
  ${pascalName}, 
  Create${pascalName}, 
  Update${pascalName}, 
  ${pascalName}Query 
} from '@taskmanagement/types';
import { I${pascalName}Repository } from '@taskmanagement/domain';
import { IEventBus } from '@taskmanagement/events';
import { 
  ${pascalName}CreatedEvent, 
  ${pascalName}UpdatedEvent, 
  ${pascalName}DeletedEvent 
} from '../events';

export class ${pascalName}Service {
  constructor(
    private readonly ${camelName}Repository: I${pascalName}Repository,
    private readonly eventBus: IEventBus
  ) {}

  async findAll(query?: ${pascalName}Query): Promise<{
    data: ${pascalName}[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { data, total } = await this.${camelName}Repository.findMany(query);
    
    return {
      data,
      total,
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
  }

  async findById(id: string): Promise<${pascalName} | null> {
    return await this.${camelName}Repository.findById(id);
  }

  async create(data: Create${pascalName}): Promise<${pascalName}> {
    const ${camelName} = await this.${camelName}Repository.create(data);
    
    // Publish domain event
    await this.eventBus.publish(
      new ${pascalName}CreatedEvent(${camelName}.id, ${camelName})
    );
    
    return ${camelName};
  }

  async update(id: string, data: Partial<Update${pascalName}>): Promise<${pascalName}> {
    const existing${pascalName} = await this.${camelName}Repository.findById(id);
    
    if (!existing${pascalName}) {
      throw new Error('${pascalName} not found');
    }
    
    const updated${pascalName} = await this.${camelName}Repository.update(id, data);
    
    // Publish domain event
    await this.eventBus.publish(
      new ${pascalName}UpdatedEvent(id, updated${pascalName}, existing${pascalName})
    );
    
    return updated${pascalName};
  }

  async delete(id: string): Promise<void> {
    const existing${pascalName} = await this.${camelName}Repository.findById(id);
    
    if (!existing${pascalName}) {
      throw new Error('${pascalName} not found');
    }
    
    await this.${camelName}Repository.delete(id);
    
    // Publish domain event
    await this.eventBus.publish(
      new ${pascalName}DeletedEvent(id, existing${pascalName})
    );
  }
}`;
  },

  test: (name, options) => {
    const pascalName = toPascalCase(name);
    const camelName = toCamelCase(name);
    
    return `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTRPCMsw } from 'msw-trpc';
import { setupServer } from 'msw/node';
import { ${camelName}Router } from './${camelName}';
import { createMockContext } from '../__tests__/helpers';

// Mock service
const mock${pascalName}Service = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Setup MSW server
const trpcMsw = createTRPCMsw<typeof ${camelName}Router>();
const server = setupServer();

describe('${pascalName} Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all ${name}s', async () => {
      const mockData = [
        { id: '1', ${options.fields[0]?.name || 'name'}: 'Test ${pascalName} 1' },
        { id: '2', ${options.fields[0]?.name || 'name'}: 'Test ${pascalName} 2' },
      ];
      
      mock${pascalName}Service.findAll.mockResolvedValue({
        data: mockData,
        total: 2,
        page: 1,
        limit: 10,
      });

      const ctx = createMockContext();
      const caller = ${camelName}Router.createCaller(ctx);
      
      const result = await caller.getAll();
      
      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(2);
    });

    it('should handle query parameters', async () => {
      const query = { page: 2, limit: 5, search: 'test' };
      
      mock${pascalName}Service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      const ctx = createMockContext();
      const caller = ${camelName}Router.createCaller(ctx);
      
      await caller.getAll(query);
      
      expect(mock${pascalName}Service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('getById', () => {
    it('should return ${name} by ID', async () => {
      const mockData = { id: '1', ${options.fields[0]?.name || 'name'}: 'Test ${pascalName}' };
      
      mock${pascalName}Service.findById.mockResolvedValue(mockData);

      const ctx = createMockContext();
      const caller = ${camelName}Router.createCaller(ctx);
      
      const result = await caller.getById({ id: '1' });
      
      expect(result).toEqual(mockData);
    });

    it('should throw error when ${name} not found', async () => {
      mock${pascalName}Service.findById.mockResolvedValue(null);

      const ctx = createMockContext();
      const caller = ${camelName}Router.createCaller(ctx);
      
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toThrow('${pascalName} not found');
    });
  });

  describe('create', () => {
    it('should create new ${name}', async () => {
      const createData = { ${options.fields[0]?.name || 'name'}: 'New ${pascalName}' };
      const mockResult = { id: '1', ...createData };
      
      mock${pascalName}Service.create.mockResolvedValue(mockResult);

      const ctx = createMockContext({ user: { id: 'user1' } });
      const caller = ${camelName}Router.createCaller(ctx);
      
      const result = await caller.create(createData);
      
      expect(result).toEqual(mockResult);
      expect(mock${pascalName}Service.create).toHaveBeenCalledWith({
        ...createData,
        createdBy: 'user1',
      });
    });
  });

  describe('update', () => {
    it('should update existing ${name}', async () => {
      const updateData = { id: '1', ${options.fields[0]?.name || 'name'}: 'Updated ${pascalName}' };
      const mockResult = { ...updateData };
      
      mock${pascalName}Service.update.mockResolvedValue(mockResult);

      const ctx = createMockContext({ user: { id: 'user1' } });
      const caller = ${camelName}Router.createCaller(ctx);
      
      const result = await caller.update(updateData);
      
      expect(result).toEqual(mockResult);
    });
  });

  describe('delete', () => {
    it('should delete ${name}', async () => {
      mock${pascalName}Service.delete.mockResolvedValue(undefined);

      const ctx = createMockContext({ user: { id: 'user1' } });
      const caller = ${camelName}Router.createCaller(ctx);
      
      const result = await caller.delete({ id: '1' });
      
      expect(result).toEqual({ success: true });
      expect(mock${pascalName}Service.delete).toHaveBeenCalledWith('1');
    });
  });
});`;
  },
};

// Utility functions
const toPascalCase = (str) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
    .replace(/^./, (char) => char.toUpperCase());
};

const toCamelCase = (str) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
    .replace(/^./, (char) => char.toLowerCase());
};

const getZodType = (type, optional = false) => {
  const baseTypes = {
    string: 'z.string()',
    number: 'z.number()',
    boolean: 'z.boolean()',
    date: 'z.date()',
    uuid: 'z.string().uuid()',
    email: 'z.string().email()',
    url: 'z.string().url()',
    json: 'z.record(z.any())',
  };
  
  let zodType = baseTypes[type] || 'z.string()';
  
  if (optional) {
    zodType += '.optional()';
  }
  
  return zodType;
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log.info(`Created directory: ${dirPath}`);
  }
};

const writeFile = (filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf8');
  log.success(`Created: ${filePath}`);
};

// Main generation function
const generateApiRoute = (options) => {
  const {
    name,
    path: targetPath = 'apps/api/src/presentation/routes',
    withValidation = true,
    withService = true,
    withTest = true,
    requireAuth = true,
    withSubscription = false,
    fields = [
      { name: 'name', type: 'string', optional: false, filterable: true },
      { name: 'description', type: 'string', optional: true, filterable: false },
    ],
  } = options;

  const camelName = toCamelCase(name);
  const pascalName = toPascalCase(name);

  // Create route directory
  const routeDir = path.join(process.cwd(), targetPath);
  ensureDirectoryExists(routeDir);

  // Generate router file
  const routerContent = templates.router(name, { requireAuth, withSubscription });
  writeFile(path.join(routeDir, `${camelName}.ts`), routerContent);

  // Generate validation schemas
  if (withValidation) {
    const validationDir = path.join(process.cwd(), 'packages/validation/src/schemas');
    ensureDirectoryExists(validationDir);
    
    const validationContent = templates.validation(name, { fields });
    writeFile(path.join(validationDir, `${camelName}.ts`), validationContent);
  }

  // Generate service
  if (withService) {
    const serviceDir = path.join(process.cwd(), 'packages/domain/src/services');
    ensureDirectoryExists(serviceDir);
    
    const serviceContent = templates.service(name, { fields });
    writeFile(path.join(serviceDir, `${pascalName}Service.ts`), serviceContent);
  }

  // Generate tests
  if (withTest) {
    const testDir = path.join(routeDir, '__tests__');
    ensureDirectoryExists(testDir);
    
    const testContent = templates.test(name, { fields });
    writeFile(path.join(testDir, `${camelName}.test.ts`), testContent);
  }

  log.success(`API route ${name} generated successfully!`);
  
  // Update router index
  updateRouterIndex(targetPath, camelName);
};

const updateRouterIndex = (targetPath, routeName) => {
  const indexPath = path.join(process.cwd(), targetPath, 'index.ts');
  
  if (fs.existsSync(indexPath)) {
    const currentContent = fs.readFileSync(indexPath, 'utf8');
    const importLine = `import { ${routeName}Router } from './${routeName}';`;
    const exportLine = `  ${routeName}: ${routeName}Router,`;
    
    if (!currentContent.includes(importLine)) {
      // Add import
      const lines = currentContent.split('\n');
      const lastImportIndex = lines.findLastIndex(line => line.startsWith('import'));
      lines.splice(lastImportIndex + 1, 0, importLine);
      
      // Add to router object
      const routerStartIndex = lines.findIndex(line => line.includes('router({'));
      if (routerStartIndex !== -1) {
        lines.splice(routerStartIndex + 1, 0, exportLine);
      }
      
      const newContent = lines.join('\n');
      fs.writeFileSync(indexPath, newContent, 'utf8');
      log.success(`Updated router index: ${indexPath}`);
    }
  }
};

// CLI interface
const showHelp = () => {
  console.log(`
${colors.cyan}API Route Generator${colors.reset}

Usage: node api-route.js <route-name> [options]

Options:
  --path <path>         Target directory (default: apps/api/src/presentation/routes)
  --no-validation      Skip validation schema generation
  --no-service         Skip service generation
  --no-test            Skip test file generation
  --no-auth            Make routes public (no authentication required)
  --with-subscription  Add WebSocket subscription endpoint
  --fields <fields>    Custom fields (JSON format)
  -h, --help           Show this help message

Field Format:
  --fields '[{"name":"title","type":"string","optional":false,"filterable":true}]'

Available Types:
  string, number, boolean, date, uuid, email, url, json

Examples:
  node api-route.js task
  node api-route.js user --no-auth
  node api-route.js notification --with-subscription
  node api-route.js project --fields '[{"name":"title","type":"string"},{"name":"budget","type":"number","optional":true}]'
`);
};

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const options = {
    name: args[0],
    withValidation: true,
    withService: true,
    withTest: true,
    requireAuth: true,
    withSubscription: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--path':
        options.path = args[++i];
        break;
      case '--no-validation':
        options.withValidation = false;
        break;
      case '--no-service':
        options.withService = false;
        break;
      case '--no-test':
        options.withTest = false;
        break;
      case '--no-auth':
        options.requireAuth = false;
        break;
      case '--with-subscription':
        options.withSubscription = true;
        break;
      case '--fields':
        try {
          options.fields = JSON.parse(args[++i]);
        } catch (error) {
          log.error('Invalid fields JSON format');
          process.exit(1);
        }
        break;
      default:
        log.warning(`Unknown option: ${arg}`);
        break;
    }
  }

  return options;
};

// Main execution
const main = () => {
  try {
    const options = parseArgs();
    
    if (!options.name) {
      log.error('Route name is required');
      showHelp();
      process.exit(1);
    }

    log.info(`Generating API route: ${options.name}`);
    generateApiRoute(options);
    
    log.info('');
    log.info('Next steps:');
    log.info('1. Update your main router to include the new route');
    log.info('2. Run tests: npm test');
    log.info('3. Start the API server: npm run dev');
    
  } catch (error) {
    log.error(`Failed to generate API route: ${error.message}`);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateApiRoute,
  templates,
  toPascalCase,
  toCamelCase,
};