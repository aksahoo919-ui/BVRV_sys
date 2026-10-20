-- Migration 027: initiated (spiritual) name on users; shown next to the devotee name in class lists, BV Leader portal and All Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS initiated_name TEXT;
