-- Migration 007: Fix remaining NO ACTION FK constraints so direct DB deletions work
-- subjects.created_by      → SET NULL
-- institution_settings.updated_by → SET NULL

ALTER TABLE subjects
  DROP CONSTRAINT IF EXISTS subjects_created_by_fkey;
ALTER TABLE subjects
  ADD CONSTRAINT subjects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE institution_settings
  DROP CONSTRAINT IF EXISTS institution_settings_updated_by_fkey;
ALTER TABLE institution_settings
  ADD CONSTRAINT institution_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
