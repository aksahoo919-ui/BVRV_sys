-- Migration 022: gender on users (filled from the BV-wise registration sheets; shown on All Users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('Male', 'Female'));
