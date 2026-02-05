const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting bootcamp model migration...');
    console.log(`📍 Connecting to database: ${process.env.DB_NAME || 'production'} on ${process.env.DB_HOST || 'render'}`);
    
    await client.query('BEGIN');

    // STEP 1: Check if trainings table exists
    const trainingExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'trainings'
      );
    `);

    if (trainingExists.rows[0].exists) {
      console.log('✓ Trainings table exists');
      
      // Check if it has a primary key
      const hasPK = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'trainings' AND constraint_type = 'PRIMARY KEY';
      `);

      if (hasPK.rows.length === 0) {
        console.log('⚠️  Trainings table missing primary key - adding it...');
        
        // Check if id column exists
        const hasId = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'trainings' AND column_name = 'id';
        `);

        if (hasId.rows.length === 0) {
          // Add id column
          await client.query(`
            ALTER TABLE trainings 
            ADD COLUMN id UUID DEFAULT gen_random_uuid();
          `);
          console.log('  ✓ Added id column');
        }

        // Add primary key constraint
        await client.query(`
          ALTER TABLE trainings 
          ADD CONSTRAINT trainings_pkey PRIMARY KEY (id);
        `);
        console.log('  ✓ Added primary key constraint');
      } else {
        console.log('✓ Trainings table has primary key');
      }
    } else {
      // Create trainings table from scratch
      console.log('⚠️  Trainings table does not exist - creating it...');
      await client.query(`
        CREATE TABLE trainings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category_id UUID,
          employer_id UUID NOT NULL,
          requirements TEXT,
          duration_weeks INTEGER,
          level VARCHAR(50),
          max_participants INTEGER,
          application_deadline TIMESTAMP,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          status VARCHAR(20) DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('  ✓ Created trainings table');
    }

    // STEP 2: Ensure users table exists and has primary key
    const usersExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (usersExists.rows[0].exists) {
      console.log('✓ Users table exists');
      
      // Check if it has a primary key
      const usersPK = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY';
      `);

      if (usersPK.rows.length === 0) {
        console.log('⚠️  Users table missing primary key - adding it...');
        
        // Check if id column exists
        const hasId = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'id';
        `);

        if (hasId.rows.length === 0) {
          // Add id column
          await client.query(`
            ALTER TABLE users 
            ADD COLUMN id UUID DEFAULT gen_random_uuid();
          `);
          console.log('  ✓ Added id column');
        }

        // Add primary key constraint
        await client.query(`
          ALTER TABLE users 
          ADD CONSTRAINT users_pkey PRIMARY KEY (id);
        `);
        console.log('  ✓ Added primary key constraint');
      } else {
        console.log('✓ Users table has primary key');
      }
    } else {
      console.log('⚠️  Users table does not exist - creating it...');
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          role VARCHAR(20) DEFAULT 'jobseeker',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('  ✓ Created users table');
    }

    // STEP 3: Ensure training_enrollments exists and has primary key
    const enrollExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'training_enrollments'
      );
    `);

    if (enrollExists.rows[0].exists) {
      console.log('✓ Training_enrollments table exists');
      
      // Check if it has a primary key
      const enrollPK = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'training_enrollments' AND constraint_type = 'PRIMARY KEY';
      `);

      if (enrollPK.rows.length === 0) {
        console.log('⚠️  Training_enrollments table missing primary key - adding it...');
        
        // Check if id column exists
        const hasId = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'training_enrollments' AND column_name = 'id';
        `);

        if (hasId.rows.length === 0) {
          // Add id column
          await client.query(`
            ALTER TABLE training_enrollments 
            ADD COLUMN id UUID DEFAULT gen_random_uuid();
          `);
          console.log('  ✓ Added id column');
        }

        // Add primary key constraint
        await client.query(`
          ALTER TABLE training_enrollments 
          ADD CONSTRAINT training_enrollments_pkey PRIMARY KEY (id);
        `);
        console.log('  ✓ Added primary key constraint');
      } else {
        console.log('✓ Training_enrollments table has primary key');
      }
    } else {
      console.log('⚠️  Training_enrollments table does not exist - creating it...');
      await client.query(`
        CREATE TABLE training_enrollments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          progress INTEGER DEFAULT 0,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(training_id, user_id)
        );
      `);
      console.log('  ✓ Created training_enrollments table');
    }

    // Add this after STEP 3 (around line 130, after the training_enrollments check)

// STEP 3.5: Add missing columns to trainings table
console.log('🔧 Checking trainings table for missing columns...');

const trainingColumnsToAdd = [
  { name: 'eligibility_requirements', type: 'TEXT' },
  { name: 'application_url', type: 'TEXT' },
  { name: 'application_deadline', type: 'TIMESTAMP' },
  { name: 'start_date', type: 'TIMESTAMP' },
  { name: 'end_date', type: 'TIMESTAMP' }
];

for (const col of trainingColumnsToAdd) {
  const exists = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'trainings' AND column_name = $1;
  `, [col.name]);

  if (exists.rows.length === 0) {
    await client.query(`ALTER TABLE trainings ADD COLUMN ${col.name} ${col.type};`);
    console.log(`  ✓ Added column to trainings: ${col.name}`);
  } else {
    console.log(`  ✓ Column already exists: ${col.name}`);
  }
}

    // STEP 4: Drop old video tables
    console.log('🗑️  Dropping old video-based tables...');
    await client.query('DROP TABLE IF EXISTS training_video_progress CASCADE;');
    await client.query('DROP TABLE IF EXISTS training_videos CASCADE;');

    // STEP 5: Create training_sessions
    console.log('📅 Creating training_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        duration_minutes INTEGER NOT NULL,
        meeting_url TEXT,
        meeting_password VARCHAR(100),
        order_index INTEGER NOT NULL DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        attendance_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_training ON training_sessions(training_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON training_sessions(scheduled_at);
    `);

    // STEP 6: Create training_applications
    console.log('📝 Creating training_applications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        motivation TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'rejected')),
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        employer_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(training_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_applications_training ON training_applications(training_id);
      CREATE INDEX IF NOT EXISTS idx_applications_user ON training_applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_applications_status ON training_applications(status);
    `);

    // STEP 7: Create session_attendance
    console.log('✅ Creating session_attendance table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        enrollment_id UUID NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attended BOOLEAN DEFAULT FALSE,
        attendance_marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(session_id, enrollment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_session ON session_attendance(session_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_enrollment ON session_attendance(enrollment_id);
    `);

    // STEP 8: Create certificate_verifications
    console.log('🎓 Creating certificate_verifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS certificate_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        enrollment_id UUID NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
        verification_code VARCHAR(100) NOT NULL UNIQUE,
        certificate_url TEXT NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(enrollment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_cert_code ON certificate_verifications(verification_code);
    `);

    // STEP 9: Add new columns to training_enrollments
    console.log('🔧 Updating training_enrollments table...');
    
    const columnsToAdd = [
      { name: 'attendance_rate', type: 'INTEGER DEFAULT 0' },
      { name: 'participation_score', type: 'INTEGER DEFAULT 0' },
      { name: 'tasks_completed', type: 'INTEGER DEFAULT 0' },
      { name: 'tasks_total', type: 'INTEGER DEFAULT 0' },
      { name: 'completion_marked', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'certificate_issued', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'certificate_url', type: 'TEXT' },
      { name: 'certificate_issued_at', type: 'TIMESTAMP' }
    ];

    for (const col of columnsToAdd) {
      const exists = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'training_enrollments' AND column_name = $1;
      `, [col.name]);

      if (exists.rows.length === 0) {
        await client.query(`ALTER TABLE training_enrollments ADD COLUMN ${col.name} ${col.type};`);
        console.log(`  ✓ Added column: ${col.name}`);
      }
    }

    // STEP 10: Create triggers
    console.log('⚙️  Creating update triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_training_sessions_updated_at ON training_sessions;
      CREATE TRIGGER update_training_sessions_updated_at 
        BEFORE UPDATE ON training_sessions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_training_applications_updated_at ON training_applications;
      CREATE TRIGGER update_training_applications_updated_at 
        BEFORE UPDATE ON training_applications 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_training_enrollments_updated_at ON training_enrollments;
      CREATE TRIGGER update_training_enrollments_updated_at 
        BEFORE UPDATE ON training_enrollments 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Verifying tables...');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'training%'
        OR table_name = 'session_attendance'
        OR table_name = 'certificate_verifications'
      ORDER BY table_name
    `);
    
    console.log('✓ Available tables:', result.rows.map(r => r.table_name).join(', '));
    
    client.release();
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

runMigration();