-- Migration 019: "service" attendance status.
-- A student who came to class but was sent for some service. Counts as attended
-- (never pulls the student towards defaulter status). Kept in its own file:
-- a newly added enum value cannot be used in the same transaction.
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'service';
