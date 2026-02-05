const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// Use individual DB env vars since you don't have DATABASE_URL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔄 Starting bootcamp model migration...');
    console.log(`📍 Connecting to database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
    
    // Read the SQL file
    const sql = fs.readFileSync(
      path.join(__dirname, 'bootcamp-migration.sql'), 
      'utf8'
    );
    
    // Execute the migration
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Verifying tables...');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'training%'
      ORDER BY table_name
    `);
    
    console.log('Available training tables:', result.rows.map(r => r.table_name));
    
    await pool.end(); // Close the connection
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end(); // Close the connection even on error
    process.exit(1);
  }
}

runMigration();