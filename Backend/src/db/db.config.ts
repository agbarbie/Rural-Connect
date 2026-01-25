// src/db/db.config.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Safely get and cast password
const dbPassword = process.env.DB_PASSWORD 
  ? String(process.env.DB_PASSWORD)
  : process.env.DATABASE_URL 
  ? undefined // Let DATABASE_URL handle it
  : '1620';

console.log('Database Configuration:', {
  host: process.env.DB_HOST || 'from DATABASE_URL',
  database: process.env.DB_NAME || 'from DATABASE_URL',
  user: process.env.DB_USER || 'from DATABASE_URL',
  usingDatabaseUrl: !!process.env.DATABASE_URL,
  passwordDefined: !!dbPassword,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'postgres'}:${dbPassword}@${process.env.DB_HOST || 'localhost'}:${parseInt(process.env.DB_PORT || '5432')}/${process.env.DB_NAME || 'digital_skilling_app'}`,

  // CRITICAL FOR RENDER
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,

  // KEEP CONNECTION ALIVE — THIS FIXES THE 500 ERROR
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Event listeners
pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
  // Don't exit in production — let it recover
});

// Test connection on startup
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() AS server_time');
    console.log('Database connected successfully at:', res.rows[0].server_time);
    client.release();
  } catch (err: any) {
    console.error('Initial database connection failed:', err.message);
  }
})();

export default pool;