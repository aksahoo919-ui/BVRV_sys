-- Migration 010: per-class mentors + mentor weekly sessions/attendance + manual marking
--
-- Mentor assignment is now per (class, student): a class can have many mentors,
-- and each mentor can have many students within that class. One mentor per
-- student per class (UNIQUE subject_id, student_id).

CREATE TABLE IF NOT EXISTS class_mentor_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  mentor_id   UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_cma_mentor  ON class_mentor_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_cma_subject ON class_mentor_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_cma_student ON class_mentor_assignments(student_id);

-- Mentor weekly sessions — distinct from academic (teacher) sessions, so they
-- never dilute the subject attendance %. They have their own defaulter logic.
CREATE TABLE IF NOT EXISTS mentor_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  mentor_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  title        TEXT,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msess_mentor  ON mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_msess_subject ON mentor_sessions(subject_id);

-- Mentor attendance — manually marked present/absent.
CREATE TABLE IF NOT EXISTS mentor_attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'present',  -- 'present' | 'absent'
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_matt_session ON mentor_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_matt_student ON mentor_attendance(student_id);

-- Flag teacher sessions created via manual (roster) marking instead of PIN.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS manual BOOLEAN NOT NULL DEFAULT FALSE;
