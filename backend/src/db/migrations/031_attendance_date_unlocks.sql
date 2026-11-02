-- Attendance date unlock requests: coordinators (teachers / BV leaders) can
-- request to unlock a specific past date for attendance marking. Admin
-- approves or rejects. While approved, isDateLocked() exempts that date for
-- that user's classes/groups.

CREATE TABLE IF NOT EXISTS attendance_date_unlocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES users(id),
  requester_role TEXT NOT NULL CHECK (requester_role IN ('teacher', 'mentor')),
  unlock_date   DATE NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_date_unlocks_requester ON attendance_date_unlocks(requester_id);
CREATE INDEX IF NOT EXISTS idx_date_unlocks_status ON attendance_date_unlocks(status);
