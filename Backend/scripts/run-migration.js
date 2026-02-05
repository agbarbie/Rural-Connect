const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use Render's DATABASE_URL or individual DB env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔄 Starting bootcamp model migration...');
    
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
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();