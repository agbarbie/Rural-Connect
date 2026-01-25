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
  // Prefer full DATABASE_URL (recommended for Render)
  connectionString: process.env.DATABASE_URL,
  
  // If not using DATABASE_URL, fall back to individual vars
  ...(process.env.DATABASE_URL ? {} : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'digital_skilling_app',
    password: dbPassword,
    port: parseInt(process.env.DB_PORT || '5432'),
  }),

  // CRITICAL for Render PostgreSQL
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // Render uses self-signed certs
    : false,

  // Keep connections alive (fixes timeout 500 errors!)
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,

  // Pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Slightly longer for cold starts
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