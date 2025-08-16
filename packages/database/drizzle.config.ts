import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config();

export default {
  schema: './src/schema/*',
  out: './src/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement',
  },
  verbose: true,
  strict: true,
} satisfies Config;
