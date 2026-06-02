-- Migration 009: scope results by course in addition to academic year
-- A student's result is now per (academic_year, course), so different
-- courses/years are never merged into one row.

ALTER TABLE results ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- Drop the year-only unique constraint if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_unique_academic') THEN
    ALTER TABLE results DROP CONSTRAINT results_unique_academic;
  END IF;
END $$;

-- Add the (student, academic_year, course) unique constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_unique_year_course') THEN
    ALTER TABLE results ADD CONSTRAINT results_unique_year_course
      UNIQUE (student_id, academic_year_id, course_id);
  END IF;
END $$;
