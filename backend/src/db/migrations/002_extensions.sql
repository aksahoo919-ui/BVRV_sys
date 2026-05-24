-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002 — Role extensions + all new tables
-- Run AFTER 001_init.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Role enum: rename instructor → teacher, add mentor ─────────────────
DO $$ BEGIN
  -- Rename only if 'instructor' still exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'instructor'
  ) THEN
    ALTER TYPE user_role RENAME VALUE 'instructor' TO 'teacher';
  END IF;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mentor';
END $$;

-- Update any remaining rows that still carry the old label
-- (in case the enum rename didn't cascade automatically on older PG)
UPDATE users SET role = 'teacher' WHERE role::text = 'instructor';

-- ── 2. institution_settings additions ────────────────────────────────────
ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS multi_admin_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. New enums ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE contact_medium AS ENUM ('call', 'email', 'meeting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment_type AS ENUM ('internal', 'assignment', 'midterm', 'final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_audience AS ENUM (
    'everyone', 'all_students', 'all_teachers', 'all_mentors',
    'class_students', 'assigned_students'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. departments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. courses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  duration_years  INT NOT NULL DEFAULT 4,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. academic_years ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. semesters ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  number           INT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  is_current       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── 8. timetable_slots ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room        TEXT
);

-- ── 9. mentor_assignments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentor_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id) -- one mentor per student
);

-- ── 10. counseling_notes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counseling_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note         TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 11. parent_contact_records ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_contact_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_date DATE NOT NULL,
  medium       contact_medium NOT NULL,
  summary      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 12. meeting_schedules ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  agenda       TEXT NOT NULL,
  status       meeting_status NOT NULL DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 13. marks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester_id      UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  assessment_type  assessment_type NOT NULL,
  max_marks        INT NOT NULL,
  scored_marks     NUMERIC NOT NULL,
  uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id, semester_id, assessment_type)
);

-- ── 14. results ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester_id  UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  gpa          NUMERIC NOT NULL DEFAULT 0,
  cgpa         NUMERIC NOT NULL DEFAULT 0,
  rank         INT,
  published    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  UNIQUE (student_id, semester_id)
);

-- ── 15. leave_requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_date    DATE NOT NULL,
  to_date      DATE NOT NULL,
  reason       TEXT NOT NULL,
  status       leave_status NOT NULL DEFAULT 'pending',
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 16. attendance_corrections ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_status  attendance_status NOT NULL,
  requested_status attendance_status NOT NULL,
  reason           TEXT NOT NULL,
  status           correction_status NOT NULL DEFAULT 'pending',
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

-- ── 17. notifications (new — distinct from messages) ─────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   notification_audience NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 18. notification_reads ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, user_id)
);

-- ── 19. audit_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 20. backups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  filename    TEXT NOT NULL,
  size_bytes  BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentor   ON mentor_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_student  ON mentor_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_counseling_notes_student    ON counseling_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_student     ON parent_contact_records(student_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_mentor    ON meeting_schedules(mentor_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedules_student   ON meeting_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_student               ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_semester              ON marks(semester_id);
CREATE INDEX IF NOT EXISTS idx_results_student             ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student      ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_corrections_session         ON attendance_corrections(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience      ON notifications(audience);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor            ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created          ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher           ON timetable_slots(teacher_id);
