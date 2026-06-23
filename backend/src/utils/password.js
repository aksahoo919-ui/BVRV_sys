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

// Default username from email/name rules.
export function defaultUsername(email, name) {
  const e = String(email || '').toLowerCase();
  if (e.endsWith('@gmail.com') || e.endsWith('@voicepune.com')) return email;
  return String(name || '').trim().replace(/\s+/g, '_');
}
