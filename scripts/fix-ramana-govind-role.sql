-- Fix: Ramana Govind Pr cannot switch from BV Leader to Teacher
-- The user's secondary_role needs to be set to 'teacher'
-- Run on the VPS: psql $DATABASE_URL -f fix-ramana-govind-role.sql

-- First, find the user
SELECT id, name, email, role, secondary_role FROM users
WHERE name ILIKE '%Ramana Govind%' OR name ILIKE '%ramana%govind%';

-- If found, set secondary_role = 'teacher' (only if current role is 'mentor')
UPDATE users
SET secondary_role = 'teacher'
WHERE name ILIKE '%Ramana Govind%'
  AND role = 'mentor'
  AND (secondary_role IS NULL OR secondary_role != 'teacher')
RETURNING id, name, role, secondary_role;
