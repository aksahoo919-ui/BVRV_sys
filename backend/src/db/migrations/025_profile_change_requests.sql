-- Migration 025: students ask for a BV Leader or course (class) change from their
-- profile; an admin approves (the change is applied then) or rejects it.
CREATE TABLE IF NOT EXISTS profile_change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('bv_leader', 'course')),
  mentor_id       UUID REFERENCES users(id) ON DELETE CASCADE,       -- bv_leader: requested leader
  from_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,   -- course: class to leave (NULL = add)
  to_subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,    -- course: class to join
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON profile_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcr_student ON profile_change_requests (student_id);
-- one open request of each kind per student
CREATE UNIQUE INDEX IF NOT EXISTS uq_pcr_pending ON profile_change_requests (student_id, kind) WHERE status = 'pending';
