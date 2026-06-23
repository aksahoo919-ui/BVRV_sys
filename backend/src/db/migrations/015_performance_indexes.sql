-- Migration 015: performance indexes on hot filter/join columns.
-- All idempotent; safe to re-run.

CREATE INDEX IF NOT EXISTS idx_class_enrollments_student    ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_instructor ON class_enrollments(instructor_id);

CREATE INDEX IF NOT EXISTS idx_marks_subject       ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_academic_year ON marks(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_results_academic_year ON results(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_results_course        ON results(course_id);

CREATE INDEX IF NOT EXISTS idx_subjects_course        ON subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_subjects_academic_year ON subjects(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_attendance_student ON mentor_attendance(student_id);
