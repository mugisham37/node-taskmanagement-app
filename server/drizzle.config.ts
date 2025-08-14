import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default {
  schema: './src/infrastructure/database/schema/*',
  out: './src/infrastructure/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement',
  },
  verbose: true,
  strict: true,
} satisfies Config;
