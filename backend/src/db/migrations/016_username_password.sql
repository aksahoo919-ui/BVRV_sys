-- Migration 016: username + password login alongside Google OAuth.
-- Default username: the email if it's a real @gmail.com / @voicepune.com address,
-- otherwise the name with spaces replaced by underscores.
-- Default password is '1896' — represented by a NULL password_hash (handled in app).

ALTER TABLE users ADD COLUMN IF NOT EXISTS username      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users SET username = CASE
    WHEN lower(email) LIKE '%@gmail.com' OR lower(email) LIKE '%@voicepune.com' THEN email
    ELSE regexp_replace(trim(name), '\s+', '_', 'g')
  END
WHERE username IS NULL OR username = '';

-- Fast case-insensitive lookups for login (non-unique to tolerate duplicate names)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
