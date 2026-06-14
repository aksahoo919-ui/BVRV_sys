-- Allow a user to hold two roles (e.g. teacher + mentor).
-- secondary_role stores the alternate role; primary role stays in the `role` column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_role user_role;
