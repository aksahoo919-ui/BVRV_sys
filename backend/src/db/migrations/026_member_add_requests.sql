-- Migration 026: a BV Leader asks (from the BV Leader portal) to add a devotee as their member.
-- Nothing is added until an admin approves; the course is optional.
CREATE TABLE IF NOT EXISTS member_add_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,                 -- the BV Leader asking
  student_id   UUID REFERENCES users(id) ON DELETE SET NULL,                          -- set when the devotee already has a portal account
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  gender       TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female')),
  subject_id   UUID REFERENCES subjects(id) ON DELETE SET NULL,                       -- optional course (class)
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note   TEXT,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mar_status ON member_add_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mar_mentor ON member_add_requests (mentor_id);
