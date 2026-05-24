import { Router } from 'express';
import passport from '../config/passport.js';
import { issueJWT } from '../utils/jwt.js';
import { query } from '../config/db.js';
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

export default router;
