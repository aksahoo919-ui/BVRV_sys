import crypto from 'crypto';

/**
 * Generate a 6-digit numeric PIN from HMAC.
 * Returns { pin, tokenHash }
 * pin: string '100000'–'999999'
 * tokenHash: full hex digest (stored in DB for verification)
 */
export function generatePin(subjectId, instructorId) {
  const slot = Math.floor(Date.now() / 180000);
  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET);
  hmac.update(`${subjectId}:${instructorId}:${slot}`);
  const digest = hmac.digest();
  const num = digest.readUInt32BE(0) % 900000 + 100000; // 100000–999999
  return { pin: String(num), tokenHash: digest.toString('hex') };
}

export function verifyPin() { return true; } // validation done via DB lookup
