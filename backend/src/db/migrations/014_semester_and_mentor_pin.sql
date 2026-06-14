-- Migration 014:
--  (1) Add a simple semester number (1 or 2) to marks.
--  (2) Give mentor_sessions a PIN so mentors can run code-based attendance.

-- ── (1) marks.semester_no ─────────────────────────────────────────────────
ALTER TABLE marks ADD COLUMN IF NOT EXISTS semester_no INT;
UPDATE marks SET semester_no = 1 WHERE semester_no IS NULL;

-- Re-key the uniqueness to include the semester so the same assessment can
-- exist in both semesters.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marks_unique_academic') THEN
    ALTER TABLE marks DROP CONSTRAINT marks_unique_academic;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marks_unique_academic_sem') THEN
    ALTER TABLE marks ADD CONSTRAINT marks_unique_academic_sem
      UNIQUE (student_id, subject_id, academic_year_id, semester_no, assessment_type);
  END IF;
END $$;

-- ── (2) mentor_sessions PIN columns ───────────────────────────────────────
ALTER TABLE mentor_sessions ADD COLUMN IF NOT EXISTS pin_display TEXT;
ALTER TABLE mentor_sessions ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ;
ALTER TABLE mentor_sessions ADD COLUMN IF NOT EXISTS closed      BOOLEAN NOT NULL DEFAULT FALSE;
