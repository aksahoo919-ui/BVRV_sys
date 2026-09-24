-- Migration 020: calendar day (IST) for teacher sessions.
-- Multiple sessions a teacher opens for the same class on the same day are merged
-- into one attendance day, and the weekly edit lock is evaluated on this date.
-- opened_at stays the real time the attendance was recorded.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_date DATE;
UPDATE sessions SET session_date = (opened_at AT TIME ZONE 'Asia/Kolkata')::date
 WHERE session_date IS NULL;
ALTER TABLE sessions ALTER COLUMN session_date SET DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
ALTER TABLE sessions ALTER COLUMN session_date SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_subject_date ON sessions(subject_id, session_date);

-- BV Leader sessions: default the day to today in IST (CURRENT_DATE is UTC on the DB).
ALTER TABLE mentor_sessions ALTER COLUMN session_date SET DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
CREATE INDEX IF NOT EXISTS idx_msess_mentor_date ON mentor_sessions(mentor_id, session_date);
