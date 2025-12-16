// src/db/db.config.ts
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ✅ CRITICAL FIX: Ensure password is always a string
const dbPassword = process.env.DB_PASSWORD 
  ? String(process.env.DB_PASSWORD) // Convert to string explicitly
  : '1620';

console.log('🔧 Database Configuration:', {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'digital_skilling_app',
  user: process.env.DB_USER || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  passwordType: typeof dbPassword, // Should log "string"
});

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'digital_skilling_app',
  password: dbPassword, // ✅ Now guaranteed to be a string
  port: parseInt(process.env.DB_PORT || '5432'),
  // Additional configuration for better error handling
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error if connection takes longer than 2 seconds
});

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection test failed:', err.message);
  } else {
    console.log('✅ Database connection test successful:', res.rows[0].now);
  }
});

// Query function for convenience
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client: PoolClient = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

export default pool;