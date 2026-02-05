-- Drop old video-based tables (if they exist)
DROP TABLE IF EXISTS training_video_progress CASCADE;
DROP TABLE IF EXISTS training_videos CASCADE;

-- Drop old video-based tables (if they exist)
DROP TABLE IF EXISTS training_video_progress CASCADE;
DROP TABLE IF EXISTS training_videos CASCADE;

-- Add missing columns to trainings table
ALTER TABLE trainings 
ADD COLUMN IF NOT EXISTS eligibility_requirements TEXT,
ADD COLUMN IF NOT EXISTS application_url TEXT,
ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

-- Create training_sessions table
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

-- Create training_applications table
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

-- Create session_attendance table
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

-- Create certificate_verifications table
CREATE TABLE IF NOT EXISTS certificate_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
    verification_code VARCHAR(100) NOT NULL UNIQUE,
    certificate_url TEXT NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_cert_code ON certificate_verifications(verification_code);

-- Update training_enrollments to add new fields
ALTER TABLE training_enrollments 
ADD COLUMN IF NOT EXISTS attendance_rate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS participation_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_marked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certificate_issued BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certificate_url TEXT,
ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMP;

-- Create triggers for updated_at
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