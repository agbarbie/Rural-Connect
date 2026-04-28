const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
);

async function cleanupAndMigrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting comprehensive cleanup and migration...');
    await client.query('BEGIN');

    // ============================================
    // STEP 1: DISABLE PROBLEMATIC TRIGGERS FIRST
    // ============================================
    console.log('\n🔧 Step 1: Disabling problematic triggers...');
    
    // Drop triggers that reference non-existent columns
    const triggers = [
      'update_training_enrolled_count',
      'update_training_application_count',
      'update_training_participants'
    ];
    
    for (const trigger of triggers) {
      try {
        await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON training_enrollments CASCADE`);
        await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON training_applications CASCADE`);
        await client.query(`DROP FUNCTION IF EXISTS ${trigger}() CASCADE`);
        console.log(`  ✓ Removed trigger: ${trigger}`);
      } catch (err) {
        console.log(`  ⚠️  Could not remove trigger ${trigger}:`, err.message);
      }
    }

    // ============================================
    // STEP 2: ARCHIVE OLD TRAINING DATA
    // ============================================
    console.log('\n📦 Step 2: Archiving old training data...');
    
    // Create archive table for old trainings
    await client.query(`
      CREATE TABLE IF NOT EXISTS trainings_archive_old (
        id UUID,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        old_data JSONB
      );
    `);

    // Archive old trainings that don't have sessions
    const oldTrainings = await client.query(`
      SELECT t.* 
      FROM trainings t
      LEFT JOIN training_sessions ts ON t.id = ts.training_id
      WHERE ts.id IS NULL 
        AND t.created_at < NOW() - INTERVAL '1 day'
    `);

    if (oldTrainings.rows.length > 0) {
      console.log(`  Found ${oldTrainings.rows.length} old trainings to archive`);
      
      for (const training of oldTrainings.rows) {
        await client.query(`
          INSERT INTO trainings_archive_old (id, old_data)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [training.id, JSON.stringify(training)]);
      }

      // Delete old training applications (one by one to avoid trigger issues)
      for (const training of oldTrainings.rows) {
        await client.query(`
          DELETE FROM training_applications 
          WHERE training_id = $1
        `, [training.id]);
      }

      // Delete old enrollments (one by one to avoid trigger issues)
      for (const training of oldTrainings.rows) {
        await client.query(`
          DELETE FROM training_enrollments 
          WHERE training_id = $1
        `, [training.id]);
      }

      // Delete old trainings (one by one to avoid trigger issues)
      for (const training of oldTrainings.rows) {
        await client.query(`
          DELETE FROM trainings 
          WHERE id = $1
        `, [training.id]);
      }

      console.log(`  ✓ Archived and removed ${oldTrainings.rows.length} old trainings`);
    } else {
      console.log('  ✓ No old trainings to archive');
    }

    // ============================================
    // STEP 3: CLEAN OLD NOTIFICATIONS
    // ============================================
    console.log('\n🔔 Step 3: Cleaning old notifications...');
    
    // Delete notifications for archived trainings
    const deletedNotifs = await client.query(`
      DELETE FROM notifications 
      WHERE metadata::jsonb->>'training_id' IN (
        SELECT id::text FROM trainings_archive_old
      )
      RETURNING id
    `);

    console.log(`  ✓ Removed ${deletedNotifs.rowCount} old notifications`);

    // ============================================
    // STEP 4: ENSURE PROPER EMPLOYER-TRAINING RELATIONSHIP
    // ============================================
    console.log('\n👔 Step 4: Ensuring proper employer-training relationships...');
    
    // Check if trainings table has provider_id column
    const hasProviderId = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trainings' AND column_name = 'provider_id'
    `);

    if (hasProviderId.rows.length === 0) {
      console.log('  Adding provider_id column...');
      await client.query(`
        ALTER TABLE trainings 
        ADD COLUMN provider_id UUID REFERENCES employers(id) ON DELETE CASCADE
      `);
      console.log('  ✓ Added provider_id column');
    } else {
      console.log('  ✓ provider_id column exists');
    }

    // Check if employer_id column exists
    const hasEmployerId = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trainings' AND column_name = 'employer_id'
    `);

    // Migrate employer_id to provider_id if employer_id exists
    if (hasEmployerId.rows.length > 0) {
      const needsMigration = await client.query(`
        SELECT COUNT(*) as count
        FROM trainings
        WHERE provider_id IS NULL AND employer_id IS NOT NULL
      `);

      if (parseInt(needsMigration.rows[0].count) > 0) {
        console.log(`  Migrating ${needsMigration.rows[0].count} training provider relationships...`);
        
        await client.query(`
          UPDATE trainings t
          SET provider_id = e.id
          FROM employers e
          WHERE t.employer_id = e.user_id
            AND t.provider_id IS NULL
        `);
        
        console.log('  ✓ Migrated provider relationships from employer_id');
      } else {
        console.log('  ✓ No provider relationships to migrate');
      }
    } else {
      console.log('  ✓ No employer_id column (using provider_id directly)');
      
      // If no employer_id, check if we need to set provider_id from other sources
      const nullProviders = await client.query(`
        SELECT COUNT(*) as count
        FROM trainings
        WHERE provider_id IS NULL
      `);
      
      if (parseInt(nullProviders.rows[0].count) > 0) {
        console.log(`  ⚠️  Found ${nullProviders.rows[0].count} trainings with NULL provider_id`);
        console.log('  These trainings will need manual assignment or will be filtered out');
      }
    }

    // ============================================
    // STEP 5: ADD MISSING INDEXES
    // ============================================
    console.log('\n📊 Step 5: Adding performance indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trainings_provider ON trainings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_trainings_status ON trainings(status);
      CREATE INDEX IF NOT EXISTS idx_applications_training_user ON training_applications(training_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN (metadata);
    `);
    
    console.log('  ✓ Indexes created');

    // ============================================
    // STEP 6: ENSURE ALL REQUIRED COLUMNS EXIST
    // ============================================
    console.log('\n🔧 Step 6: Ensuring all required columns exist...');
    
    const requiredColumns = [
      { table: 'trainings', columns: [
        { name: 'provider_id', type: 'UUID REFERENCES employers(id) ON DELETE CASCADE' },
        { name: 'provider_name', type: 'VARCHAR(255)' },
        { name: 'application_deadline', type: 'TIMESTAMP' },
        { name: 'start_date', type: 'TIMESTAMP' },
        { name: 'end_date', type: 'TIMESTAMP' },
        { name: 'max_participants', type: 'INTEGER' },
        { name: 'current_participants', type: 'INTEGER DEFAULT 0' },
        { name: 'has_certificate', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'cost_type', type: 'VARCHAR(20) DEFAULT \'Free\'' },
        { name: 'price', type: 'DECIMAL(10,2) DEFAULT 0' },
        { name: 'mode', type: 'VARCHAR(20) DEFAULT \'Online\'' },
        { name: 'rating', type: 'DECIMAL(3,2) DEFAULT 0' },
        { name: 'total_students', type: 'INTEGER DEFAULT 0' },
        { name: 'thumbnail_url', type: 'TEXT' },
        { name: 'location', type: 'VARCHAR(255)' }
      ]},
      { table: 'training_enrollments', columns: [
        { name: 'application_id', type: 'UUID REFERENCES training_applications(id) ON DELETE SET NULL' },
        { name: 'attendance_rate', type: 'INTEGER DEFAULT 0' },
        { name: 'participation_score', type: 'INTEGER DEFAULT 0' },
        { name: 'completion_marked', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'certificate_issued', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'certificate_url', type: 'TEXT' },
        { name: 'certificate_issued_at', type: 'TIMESTAMP' }
      ]},
      { table: 'users', columns: [
        { name: 'first_name', type: 'VARCHAR(100)' },
        { name: 'last_name', type: 'VARCHAR(100)' },
        { name: 'phone_number', type: 'VARCHAR(20)' },
        { name: 'profile_image', type: 'TEXT' }
      ]}
    ];

    for (const tableConfig of requiredColumns) {
      for (const col of tableConfig.columns) {
        const exists = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [tableConfig.table, col.name]);

        if (exists.rows.length === 0) {
          try {
            await client.query(`ALTER TABLE ${tableConfig.table} ADD COLUMN ${col.name} ${col.type}`);
            console.log(`  ✓ Added ${tableConfig.table}.${col.name}`);
          } catch (err) {
            console.log(`  ⚠️  Could not add ${tableConfig.table}.${col.name}: ${err.message}`);
          }
        }
      }
    }

    // ============================================
    // STEP 7: UPDATE PROVIDER NAMES
    // ============================================
    console.log('\n📝 Step 7: Updating provider names...');
    
    await client.query(`
      UPDATE trainings t
      SET provider_name = COALESCE(
        (SELECT c.name FROM companies c JOIN employers e ON c.id = e.company_id WHERE e.id = t.provider_id),
        (SELECT u.first_name || ' ' || u.last_name FROM users u JOIN employers e ON u.id = e.user_id WHERE e.id = t.provider_id),
        'Training Provider'
      )
      WHERE provider_name IS NULL OR provider_name = ''
    `);
    
    console.log('  ✓ Provider names updated');

    await client.query('COMMIT');
    
    console.log('\n✅ Cleanup and migration completed successfully!');
    
    // Print summary
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM trainings) as total_trainings,
        (SELECT COUNT(*) FROM trainings WHERE status = 'published') as published_trainings,
        (SELECT COUNT(*) FROM training_sessions) as total_sessions,
        (SELECT COUNT(*) FROM training_applications) as total_applications,
        (SELECT COUNT(*) FROM training_enrollments) as total_enrollments,
        (SELECT COUNT(*) FROM trainings_archive_old) as archived_trainings
    `);
    
    console.log('\n📊 Database Summary:');
    console.log(`  Total Trainings: ${summary.rows[0].total_trainings}`);
    console.log(`  Published: ${summary.rows[0].published_trainings}`);
    console.log(`  Sessions: ${summary.rows[0].total_sessions}`);
    console.log(`  Applications: ${summary.rows[0].total_applications}`);
    console.log(`  Enrollments: ${summary.rows[0].total_enrollments}`);
    console.log(`  Archived Old Trainings: ${summary.rows[0].archived_trainings}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupAndMigrate()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });