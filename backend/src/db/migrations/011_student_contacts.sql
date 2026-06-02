-- Migration 011: student contact directory (guardian/parent contacts)
-- Used by the mentor "Contacts" tab on a student's detail page.

CREATE TABLE IF NOT EXISTS student_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  relationship TEXT,
  phone        TEXT,
  email        TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_contacts_student ON student_contacts(student_id);
