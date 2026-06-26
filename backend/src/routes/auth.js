import { Router } from 'express';
import passport from '../config/passport.js';
import { issueJWT } from '../utils/jwt.js';
import { query } from '../config/db.js';
import { requireAuth, requireActive } from '../middleware/auth.js';
import { verifyPassword, hashPassword, makeResetToken, hashToken } from '../utils/password.js';
import { emailPasswordReset } from '../services/emailService.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// ── Regular user OAuth ─────────────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: true })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  }),
  (req, res) => {
    const user = req.user;
    if (!user) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);

    if (user.status === 'active' && user.role) {
      const token = issueJWT(user);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
    if (user.status === 'pending' && user.role) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/pending`);
    }
    if (user.status === 'suspended') {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/suspended`);
    }
    // No role yet — onboarding
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/onboarding?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}`
    );
  }
);

// ── Admin OAuth — dedicated route + callback ───────────────────────────────

router.get(
  '/google/admin',
  passport.authenticate('google-admin', { scope: ['profile', 'email'], session: true })
);

router.get(
  '/google/admin-callback',
  passport.authenticate('google-admin', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/not-admin`,
  }),
  (req, res) => {
    const user = req.user;
    if (!user) return res.redirect(`${process.env.FRONTEND_URL}/auth/not-admin`);
    const token = issueJWT(user);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// ── Onboarding — set role for brand-new user ───────────────────────────────
// Accepts: student | teacher | mentor | admin
// admin goes to pending when multi_admin_enabled=true (default)

router.post('/onboarding', async (req, res) => {
  const { email, role } = req.body;
  const allowedRoles = ['student', 'teacher', 'mentor', 'admin'];
  if (!email || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid email or role' });
  }

  try {
    // For admin role: check multi_admin_enabled
    if (role === 'admin') {
      const settings = await query('SELECT multi_admin_enabled FROM institution_settings LIMIT 1');
      const multiAdminEnabled = settings.rows[0]?.multi_admin_enabled ?? true;
      if (!multiAdminEnabled) {
        return res.status(403).json({ error: 'Admin self-registration is disabled' });
      }
      // Admin requests go into pending queue just like other roles
    }

    const result = await query(
      `UPDATE users SET role=$1 WHERE email=$2 AND status='pending' AND role IS NULL RETURNING *`,
      [role, email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or already assigned a role' });
    }
    return res.json({ message: 'Role set. Awaiting admin approval.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Role select — for users with two roles (teacher + mentor) ──────────────
// Requires a valid JWT. Issues a new token with the chosen role as active.

router.post('/select-role', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { role } = req.body;
  const allowed = ['teacher', 'mentor'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE id=$1', [decoded.id]);
    const user = result.rows[0];
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Account not active' });
    }
    if (role !== user.role && role !== user.secondary_role) {
      return res.status(403).json({ error: 'You do not have this role' });
    }
    // Build a token with the selected role active; secondary_role = the other one
    const other = role === user.role ? user.secondary_role : user.role;
    const newToken = issueJWT({ ...user, role, secondary_role: other });
    return res.json({ token: newToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Username + password login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const r = await query('SELECT * FROM users WHERE lower(username) = lower($1) LIMIT 1', [username]);
    const user = r.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (user.status === 'suspended') return res.status(403).json({ error: 'Your account has been suspended' });
    if (user.status !== 'active' || !user.role) {
      return res.status(403).json({ error: 'Your account is pending approval' });
    }
    const token = issueJWT(user);
    return res.json({ token });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Forgot / reset password (staff: teacher, BV Leader, admin) ──────────────
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const generic = { message: 'If an eligible account with that email exists, a reset link has been sent.' };
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const r = await query('SELECT id, name, email, role FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    const user = r.rows[0];
    const isStaff = user && ['teacher', 'mentor', 'admin'].includes(user.role);
    const realEmail = user && user.email.includes('@') && !user.email.toLowerCase().endsWith('@noemail.bvrv');
    if (isStaff && realEmail) {
      const { raw, hash } = makeResetToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, hash, expires.toISOString()]
      );
      const link = `${process.env.FRONTEND_URL}/auth/reset-password?token=${raw}`;
      await emailPasswordReset(user, link);
    }
    return res.json(generic);
  } catch (err) {
    console.error('[forgot-password]', err);
    return res.json(generic); // never reveal internal errors / account existence
  }
});

router.post('/reset-password', async (req, res) => {
  const { token } = req.body;
  const password = String(req.body.password || '');
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  try {
    const hash = hashToken(token);
    const r = await query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
      [hash]
    );
    const row = r.rows[0];
    if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), row.user_id]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    return res.json({ message: 'Password updated. You can now sign in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Switch active role (teacher ↔ mentor) ──────────────────────────────────
// Issues a fresh token with the role swapped so the user can use the other
// portal. Only teacher/mentor can switch.
router.post('/switch-role', requireAuth, requireActive, (req, res) => {
  const swap = { teacher: 'mentor', mentor: 'teacher' };
  const target = swap[req.user.role];
  if (!target) return res.status(403).json({ error: 'Only teachers and mentors can switch roles' });
  if (req.user.secondary_role !== target)
    return res.status(403).json({ error: 'You do not have a second role to switch to' });

  const token = issueJWT({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: target,
    secondary_role: req.user.role,
    status: req.user.status,
    avatar_url: req.user.avatar_url,
  });
  res.json({ token, role: target });
});

export default router;
