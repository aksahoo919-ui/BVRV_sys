-- Migration 005: Replace semester references with academic_year in marks/results
-- Add academic_year_id to subjects

-- subjects: add academic_year_id
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;

-- marks: add academic_year_id, backfill from semester, make semester_id nullable
ALTER TABLE marks ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE;

UPDATE marks m
SET academic_year_id = s.academic_year_id
FROM semesters s
WHERE m.semester_id = s.id AND m.academic_year_id IS NULL;

ALTER TABLE marks ALTER COLUMN semester_id DROP NOT NULL;

-- Drop old unique constraint on marks if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marks_student_id_subject_id_semester_id_assessment_type_key'
  ) THEN
    ALTER TABLE marks DROP CONSTRAINT marks_student_id_subject_id_semester_id_assessment_type_key;
  END IF;
END $$;

-- Add new unique constraint on marks only if it doesn't exist yet
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marks_unique_academic'
  ) THEN
    ALTER TABLE marks ADD CONSTRAINT marks_unique_academic
      UNIQUE (student_id, subject_id, academic_year_id, assessment_type);
  END IF;
END $$;

-- results: add academic_year_id, backfill, make semester_id nullable
ALTER TABLE results ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE;

UPDATE results r
SET academic_year_id = s.academic_year_id
FROM semesters s
WHERE r.semester_id = s.id AND r.academic_year_id IS NULL;

ALTER TABLE results ALTER COLUMN semester_id DROP NOT NULL;

-- Drop old unique constraint on results if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'results_student_id_semester_id_key'
  ) THEN
    ALTER TABLE results DROP CONSTRAINT results_student_id_semester_id_key;
  END IF;
END $$;

-- Add new unique constraint on results only if it doesn't exist yet
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'results_unique_academic'
  ) THEN
    ALTER TABLE results ADD CONSTRAINT results_unique_academic
      UNIQUE (student_id, academic_year_id);
  END IF;
END $$;
