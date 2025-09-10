import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'digital_skilling_app',
  password: process.env.DB_PASSWORD || '1620',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export default pool;