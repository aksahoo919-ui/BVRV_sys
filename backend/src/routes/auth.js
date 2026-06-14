import { Router } from 'express';
import passport from '../config/passport.js';
import { issueJWT } from '../utils/jwt.js';
import { query } from '../config/db.js';
import { requireAuth, requireActive } from '../middleware/auth.js';
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

// ── Switch active role (teacher ↔ mentor) ──────────────────────────────────
// Issues a fresh token with the role swapped so the user can use the other
// portal. Only teacher/mentor can switch.
router.post('/switch-role', requireAuth, requireActive, (req, res) => {
  const swap = { teacher: 'mentor', mentor: 'teacher' };
  const target = swap[req.user.role];
  if (!target) return res.status(403).json({ error: 'Only teachers and mentors can switch roles' });

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
