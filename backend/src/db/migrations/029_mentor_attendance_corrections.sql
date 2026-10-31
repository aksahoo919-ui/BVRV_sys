-- Migration 029: attendance correction requests for the BV Leader (mentor) side.
-- Mirrors attendance_corrections, but against mentor_sessions/mentor_attendance,
-- which are a separate table family from the teacher's sessions/attendance_logs.
-- Feedback from Lakshminadh Prabhu (Tech, Abids), 27 Oct 2026: BV Leaders had no
-- way to request an attendance correction at all.
CREATE TABLE IF NOT EXISTS mentor_attendance_corrections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_status  TEXT NOT NULL,
  requested_status TEXT NOT NULL,
  reason           TEXT NOT NULL,
  status           correction_status NOT NULL DEFAULT 'pending',
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_mac_requested_by ON mentor_attendance_corrections(requested_by);
CREATE INDEX IF NOT EXISTS idx_mac_status       ON mentor_attendance_corrections(status);
