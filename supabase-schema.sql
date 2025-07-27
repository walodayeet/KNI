-- Create a dedicated schema for the KNI web app
CREATE SCHEMA IF NOT EXISTS kni;

-- Create custom types/enums within the 'kni' schema
DO $$ BEGIN
    CREATE TYPE kni.user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'GUEST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE kni.test_type AS ENUM ('MOCK_TEST', 'PRACTICE_TEST', 'DIAGNOSTIC_TEST', 'FINAL_TEST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE kni.question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'ESSAY', 'FILL_BLANK');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE kni.difficulty_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE kni.subject_area AS ENUM ('MATHEMATICS', 'LOGIC', 'LANGUAGE', 'SCIENCE', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create tables within the 'kni' schema

-- Users table
CREATE TABLE IF NOT EXISTS kni.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT,
  "role" kni.user_role DEFAULT 'STUDENT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS kni.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES kni.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test templates table
CREATE TABLE IF NOT EXISTS kni.test_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  description TEXT,
  test_type kni.test_type NOT NULL,
  subject_areas kni.subject_area[] NOT NULL,
  difficulty_level kni.difficulty_level NOT NULL,
  total_questions INTEGER NOT NULL,
  time_limit INTEGER, -- in minutes
  passing_score INTEGER DEFAULT 70,
  question_distribution JSONB,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES kni.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test results table
CREATE TABLE IF NOT EXISTS kni.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  test_template_id UUID REFERENCES kni.test_templates(id) ON DELETE SET NULL,
  test_type kni.test_type NOT NULL,
  test_title VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  time_taken INTEGER, -- in minutes
  answers JSONB,
  detailed_results JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test questions table
CREATE TABLE IF NOT EXISTS kni.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  question_type kni.question_type NOT NULL,
  subject_area kni.subject_area NOT NULL,
  difficulty_level kni.difficulty_level NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  time_limit INTEGER, -- in seconds
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for tests and questions
CREATE TABLE IF NOT EXISTS kni.test_template_questions (
    test_template_id UUID NOT NULL REFERENCES kni.test_templates(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES kni.test_questions(id) ON DELETE CASCADE,
    PRIMARY KEY (test_template_id, question_id)
);

-- User progress tracking
CREATE TABLE IF NOT EXISTS kni.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  subject_area kni.subject_area NOT NULL,
  total_questions_attempted INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  time_spent INTEGER DEFAULT 0, -- in minutes
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject_area)
);

-- Study materials table
CREATE TABLE IF NOT EXISTS kni.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject_area kni.subject_area NOT NULL,
  difficulty_level kni.difficulty_level NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content_url TEXT,
  content_data JSONB,
  duration_minutes INTEGER,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES kni.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study sessions table
CREATE TABLE IF NOT EXISTS kni.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES kni.study_materials(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  progress_percentage INTEGER DEFAULT 0,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test analytics table
CREATE TABLE IF NOT EXISTS kni.test_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES kni.test_results(id) ON DELETE CASCADE,
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  subject_breakdown JSONB,
  difficulty_breakdown JSONB,
  time_per_question JSONB,
  question_sequence JSONB,
  skipped_questions INTEGER[] DEFAULT '{}',
  changed_answers INTEGER[] DEFAULT '{}',
  confidence_levels JSONB,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],
  improvement_areas TEXT[],
  next_study_focus kni.subject_area,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning analytics table
CREATE TABLE IF NOT EXISTS kni.learning_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  study_session_id UUID REFERENCES kni.study_sessions(id) ON DELETE CASCADE,
  engagement_score INTEGER DEFAULT 0,
  focus_time INTEGER DEFAULT 0,
  break_time INTEGER DEFAULT 0,
  materials_accessed INTEGER DEFAULT 0,
  questions_attempted INTEGER DEFAULT 0,
  help_requests INTEGER DEFAULT 0,
  learning_velocity DECIMAL(5,2) DEFAULT 0,
  retention_rate DECIMAL(5,2) DEFAULT 0,
  difficulty_preference kni.difficulty_level,
  preferred_study_time INTEGER,
  learning_style_indicators JSONB,
  performance_trends JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements table
CREATE TABLE IF NOT EXISTS kni.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_type VARCHAR(100) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    description TEXT,
    points_earned INTEGER DEFAULT 0,
    badge_icon VARCHAR(255)
);

-- User achievements table
CREATE TABLE IF NOT EXISTS kni.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES kni.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Function to validate days_of_week array
CREATE OR REPLACE FUNCTION kni.is_valid_days_of_week(days integer[])
RETURNS boolean AS $$
DECLARE
    day_value int;
BEGIN
    IF days IS NULL OR array_length(days, 1) IS NULL THEN RETURN true; END IF;
    FOREACH day_value IN ARRAY days LOOP
        IF day_value < 0 OR day_value > 6 THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Study reminders table
CREATE TABLE IF NOT EXISTS kni.study_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  scheduled_time TIME NOT NULL,
  days_of_week INTEGER[] DEFAULT '{}' CHECK (kni.is_valid_days_of_week(days_of_week)),
  is_active BOOLEAN DEFAULT true,
  last_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question feedback table
CREATE TABLE IF NOT EXISTS kni.question_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES kni.test_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES kni.users(id) ON DELETE CASCADE,
  feedback_type VARCHAR(50) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  "comment" TEXT,
  is_helpful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policies on the 'kni' schema tables
ALTER TABLE kni.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON kni.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON kni.users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE kni.test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own test results" ON kni.test_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own test results" ON kni.test_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers can view all test results" ON kni.test_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM kni.users WHERE id = auth.uid() AND "role" IN ('TEACHER', 'ADMIN'))
);

-- Add other RLS policies for the rest of your tables in the same manner...
-- Example for study materials:
ALTER TABLE kni.study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active study materials" ON kni.study_materials FOR SELECT USING (is_active = true);
CREATE POLICY "Teachers can manage study materials" ON kni.study_materials FOR ALL USING (
  EXISTS (SELECT 1 FROM kni.users WHERE id = auth.uid() AND "role" IN ('TEACHER', 'ADMIN'))
);

-- ✨ Pro Tip: To make querying easier in your app, you can tell PostgreSQL to always look in your 'kni' schema first.
-- You can set this in your database connection settings or run it per session:
-- SET search_path TO kni, public;
-- This means if you write `SELECT * FROM users;`, PostgreSQL will first look for `kni.users` before looking for `public.users`.