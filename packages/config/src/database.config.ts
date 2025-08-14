import { z } from 'zod';

// Database configuration schema
const databaseConfigSchema = z.object({
  url: z.string().url('Invalid database URL'),
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  ssl: z.boolean().default(false),
  maxConnections: z.number().int().min(1).default(20),
  idleTimeout: z.number().int().min(1000).default(20000), // 20 seconds
  connectTimeout: z.number().int().min(1000).default(10000), // 10 seconds
  schema: z.string().default('public'),
  logging: z.boolean().default(false),
  migrations: z.object({
    directory: z.string().default('./migrations'),
    tableName: z.string().default('migrations'),
  }).default({}),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

// Default database configuration
const defaultConfig: Partial<DatabaseConfig> = {
  host: 'localhost',
  port: 5432,
  ssl: false,
  maxConnections: 20,
  idleTimeout: 20000,
  connectTimeout: 10000,
  schema: 'public',
  logging: process.env.NODE_ENV === 'development',
  migrations: {
    directory: './migrations',
    tableName: 'migrations',
  },
};

// Create database configuration from environment variables
export const createDatabaseConfig = (): DatabaseConfig => {
  const config = {
    ...defaultConfig,
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || defaultConfig.host,
    port: parseInt(process.env.DB_PORT || String(defaultConfig.port)),
    database: process.env.DB_NAME || process.env.DB_DATABASE || '',
    username: process.env.DB_USER || process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || String(defaultConfig.maxConnections)),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || String(defaultConfig.idleTimeout)),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || String(defaultConfig.connectTimeout)),
    schema: process.env.DB_SCHEMA || defaultConfig.schema,
    logging: process.env.DB_LOGGING === 'true' || defaultConfig.logging,
  };

  return databaseConfigSchema.parse(config);
};

// Export the configuration
export const databaseConfig = createDatabaseConfig();

// Connection string builder
export const buildConnectionString = (config: DatabaseConfig): string => {
  if (config.url) {
    return config.url;
  }

  const { host, port, database, username, password, ssl } = config;
  let connectionString = `postgresql://${username}:${password}@${host}:${port}/${database}`;
  
  if (ssl) {
    connectionString += '?ssl=true';
  }
  
  return connectionString;
};

// Validate database configuration
export const validateDatabaseConfig = (config: unknown): DatabaseConfig => {
  return databaseConfigSchema.parse(config);
};