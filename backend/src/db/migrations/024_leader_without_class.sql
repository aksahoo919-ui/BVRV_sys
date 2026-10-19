-- Migration 024: a BV Leader link without a class.
--
-- Add BV Member no longer needs a class. Such a link is a class_mentor_assignments
-- row with subject_id NULL (at most one per student). When the student later
-- gets a class, the link moves onto that class.

ALTER TABLE class_mentor_assignments ALTER COLUMN subject_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cma_no_class ON class_mentor_assignments(student_id) WHERE subject_id IS NULL;
