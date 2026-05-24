-- Migration 006: Fix foreign key constraints on users so admin can delete users
-- sessions.instructor_id    → SET NULL  (keep session history, null out the teacher)
-- attendance_logs.student_id → CASCADE  (delete logs when student is removed)
-- messages.sender_id         → SET NULL  (keep messages, null out the sender)

-- ── sessions.instructor_id ───────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_instructor_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE sessions ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL;

-- ── attendance_logs.student_id ───────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE attendance_logs
  ADD CONSTRAINT attendance_logs_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── messages.sender_id ───────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
