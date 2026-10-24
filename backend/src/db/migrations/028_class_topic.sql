-- Migration 028: the subject a class studies in its semester (e.g. "ISO", "BG 1 to 6"); shown to teachers with year and semester
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS topic TEXT;
