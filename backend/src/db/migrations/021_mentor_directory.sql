-- Migration 021: mentor directory (admin > Mentors > BVRV Mentors / BV Mentors)
--
-- One row per mentor listing. kind = 'bvrv' (class mentor, has a class/subject)
-- or 'bv' (BV mentor, has a language). The mentor and the coordinator are
-- normally portal users; name/phone/email columns hold admin-typed values that
-- are shown instead of the account's values (or used when no account is linked).

CREATE TABLE IF NOT EXISTS mentor_directory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                TEXT NOT NULL CHECK (kind IN ('bvrv', 'bv')),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT,
  phone               TEXT,
  email               TEXT,
  subject_id          UUID REFERENCES subjects(id) ON DELETE SET NULL,   -- bvrv: class (e.g. GF1-E)
  language            TEXT CHECK (language IS NULL OR language IN ('English', 'Hindi', 'Telugu')),  -- bv
  coordinator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  coordinator_name    TEXT,
  coordinator_phone   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mdir_kind ON mentor_directory(kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mdir_bvrv ON mentor_directory(user_id, subject_id) WHERE kind = 'bvrv' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mdir_bv   ON mentor_directory(user_id, language)   WHERE kind = 'bv'   AND user_id IS NOT NULL;

-- Pre-fill (only on an empty directory)
-- BVRV mentors: the instructors already assigned to each class.
INSERT INTO mentor_directory (kind, user_id, subject_id)
SELECT DISTINCT 'bvrv', ce.instructor_id, ce.subject_id
FROM class_enrollments ce
JOIN subjects s ON s.id = ce.subject_id
WHERE ce.instructor_id IS NOT NULL AND s.code <> 'TEST'
  AND NOT EXISTS (SELECT 1 FROM mentor_directory WHERE kind = 'bvrv');

-- BV mentors: every BV Leader, with the language most of their members study in.
INSERT INTO mentor_directory (kind, user_id, language)
SELECT 'bv', u.id,
  (SELECT CASE RIGHT(s.code, 1) WHEN 'E' THEN 'English' WHEN 'H' THEN 'Hindi' WHEN 'T' THEN 'Telugu' END
     FROM class_mentor_assignments c JOIN subjects s ON s.id = c.subject_id
    WHERE c.mentor_id = u.id AND s.code ~ '-[EHT]$'   -- language classes only (TEST would read as Telugu)
    GROUP BY RIGHT(s.code, 1) ORDER BY COUNT(*) DESC, RIGHT(s.code, 1) LIMIT 1)
FROM users u
WHERE (u.role = 'mentor' OR u.secondary_role = 'mentor') AND u.status::text <> 'rejected'
  AND NOT EXISTS (SELECT 1 FROM mentor_directory WHERE kind = 'bv');
