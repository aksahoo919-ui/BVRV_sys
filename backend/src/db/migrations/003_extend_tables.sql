-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003 — Extend existing tables + course_enrollments
-- Run AFTER 002_extensions.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Rename attendance_threshold → min_attendance_threshold (idempotent) ─
DO $$ BEGIN
  -- Only rename if old column exists AND new column does NOT yet exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'institution_settings' AND column_name = 'attendance_threshold'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'institution_settings' AND column_name = 'min_attendance_threshold'
  ) THEN
    ALTER TABLE institution_settings RENAME COLUMN attendance_threshold TO min_attendance_threshold;
  END IF;
END $$;

-- Ensure the column exists under the new name (handles first-run and re-run)
ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS min_attendance_threshold INTEGER NOT NULL DEFAULT 75;

-- ── 2. New columns on institution_settings ────────────────────────────────
ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS gpa_scale NUMERIC NOT NULL DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS grade_boundaries JSONB NOT NULL DEFAULT '{"S":90,"A":80,"B":70,"C":60,"D":50,"F":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mentor_alert_gpa_threshold NUMERIC NOT NULL DEFAULT 5.0;

-- ── 3. New columns on users ───────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roll_number TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- ── 4. New columns on subjects ────────────────────────────────────────────
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS semester_number INT,
  ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 3;

-- ── 5. course_enrollments (course-level, distinct from class_enrollments) ─
CREATE TABLE IF NOT EXISTS course_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course  ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_year    ON course_enrollments(academic_year_id);
