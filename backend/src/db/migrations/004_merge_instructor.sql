-- Migration 004: Merge 'instructor' role into 'teacher'
-- Idempotent: skips safely if 'instructor' is not a valid enum value

DO $$ BEGIN
  -- Only run the UPDATE if 'instructor' exists as an enum label
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'instructor'
  ) THEN
    UPDATE users SET role = 'teacher' WHERE role = 'instructor';
  END IF;
END $$;
