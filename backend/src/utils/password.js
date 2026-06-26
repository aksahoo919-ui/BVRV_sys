import crypto from 'crypto';

// Default password for accounts whose password has never been set by an admin.
export const DEFAULT_PASSWORD = '1896';

// Hash a password as "salt:derivedKey" (hex), using scrypt (built-in, no deps).
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `${salt}:${dk}`;
}

// Verify a password. A null/empty stored hash means "still the default 1896".
export function verifyPassword(plain, stored) {
  if (!stored) return String(plain) === DEFAULT_PASSWORD;
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const dk = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(dk, 'hex'));
  } catch {
    return false;
  }
}

// Password-reset token: returns the raw token (emailed) and its sha256 hash (stored).
export function makeResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}
export function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// Default username from email/name rules.
export function defaultUsername(email, name) {
  const e = String(email || '').toLowerCase();
  if (e.endsWith('@gmail.com') || e.endsWith('@voicepune.com')) return email;
  return String(name || '').trim().replace(/\s+/g, '_');
}
