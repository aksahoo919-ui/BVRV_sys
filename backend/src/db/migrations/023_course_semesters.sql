-- Migration 023: semester-wise classes.
--
-- A semester now belongs to a course (its own months per course) and every
-- class (subject) belongs to one semester. A new semester gets its own copy of
-- the classes, so enrolment, attendance, BV leader links and teachers of past
-- semesters stay as they were (the student timeline reads them).
--
-- Existing classes become Sem 1 of their course (current).

ALTER TABLE semesters ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE semesters ALTER COLUMN academic_year_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_semesters_course_number ON semesters(course_id, number) WHERE course_id IS NOT NULL;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id);

-- The same class code repeats once per semester.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_code_semester
  ON subjects(code, COALESCE(semester_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Sem 1 for every course that has classes. Months: from the first class day
-- (or the academic year start) to six months later, or the last class day if later.
INSERT INTO semesters (id, academic_year_id, course_id, number, label, start_date, end_date, is_current)
SELECT gen_random_uuid(), x.ay_id, x.course_id, 1, 'Sem 1', x.start_d,
       GREATEST((x.start_d + INTERVAL '6 months' - INTERVAL '1 day')::date, COALESCE(x.last_day, x.start_d)),
       TRUE
FROM (
  SELECT s.course_id,
         (ARRAY_AGG(s.academic_year_id) FILTER (WHERE s.academic_year_id IS NOT NULL))[1] AS ay_id,
         DATE_TRUNC('month', COALESCE(MIN(sess.session_date), MIN(ay.start_date), DATE '2026-01-01'))::date AS start_d,
         MAX(sess.session_date) AS last_day
  FROM subjects s
  LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
  LEFT JOIN sessions sess ON sess.subject_id = s.id
  WHERE s.course_id IS NOT NULL
  GROUP BY s.course_id
) x
WHERE NOT EXISTS (SELECT 1 FROM semesters e WHERE e.course_id = x.course_id);

UPDATE subjects s SET semester_id = sem.id
FROM semesters sem
WHERE sem.course_id = s.course_id AND sem.number = 1 AND s.semester_id IS NULL;
