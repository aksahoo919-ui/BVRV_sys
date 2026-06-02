-- Migration 008: assessment_type enum → text, add assessed_on date
-- Enables open-ended assessment labels like "OBE-1", "CBE-2", "Sloka-3"
-- and an optional date of assessment.

-- 1. Convert assessment_type column from enum to TEXT (idempotent — TEXT cast is a no-op if already text)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marks'
      AND column_name='assessment_type' AND udt_name='assessment_type'
  ) THEN
    ALTER TABLE marks ALTER COLUMN assessment_type TYPE TEXT USING assessment_type::text;
  END IF;
END $$;

-- 2. Add optional assessed_on date
ALTER TABLE marks ADD COLUMN IF NOT EXISTS assessed_on DATE;

-- 3. Drop the now-unused enum type (only if nothing else references it)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='assessment_type')
     AND NOT EXISTS (
       SELECT 1 FROM pg_attribute a
       JOIN pg_type t ON t.oid = a.atttypid
       WHERE t.typname='assessment_type' AND a.attnum > 0 AND NOT a.attisdropped
     )
  THEN
    DROP TYPE assessment_type;
  END IF;
END $$;
