import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifySetup() {
  console.log('🧪 Verifying database setup...');

  try {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:moses@localhost:5432/Task-Management';
    console.log('🔗 Connecting to:', connectionString.replace(/:[^:@]*@/, ':***@'));

    const pool = new Pool({
      connectionString,
      max: 1,
    });

    // Test connection
    console.log('📡 Testing connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    console.log('✅ Connection successful!');

    // Check tables
    console.log('📋 Checking tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = result.rows.map(row => row.table_name);
    console.log('📊 Found tables:', tables.length);
    console.log('📝 Tables:', tables.join(', '));

    // Test users table
    if (tables.includes('users')) {
      const userCount = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users table: ${userCount.rows[0].count} records`);
    }

    client.release();
    await pool.end();

    console.log('🎉 Database setup verification completed successfully!');
    console.log('✅ All systems are working correctly!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

verifySetup();
