import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { isValidYmd, istDateString } from '../utils/istDate.js';

// ── Teacher / Mentor: request a date unlock ────────────────────────────────

export async function requestDateUnlock(req, res) {
  const { date, reason } = req.body;
  if (!date || !isValidYmd(date)) return res.status(400).json({ error: 'Invalid date' });
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'Please provide a reason' });

  // Only allow requesting unlock for past dates (current or future dates aren't locked)
  const today = istDateString();
  if (date >= today) return res.status(400).json({ error: 'Only past dates need unlocking' });

  // Check for duplicate pending request
  const dup = await query(
    `SELECT id FROM attendance_date_unlocks
     WHERE requester_id=$1 AND unlock_date=$2 AND status='pending'`,
    [req.user.id, date]
  );
  if (dup.rows.length) return res.status(409).json({ error: 'You already have a pending request for this date' });

  const r = await query(
    `INSERT INTO attendance_date_unlocks (id, requester_id, requester_role, unlock_date, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [uuidv4(), req.user.id, req.user.role, date, reason.trim()]
  );
  res.status(201).json(r.rows[0]);
}

export async function getMyDateUnlockRequests(req, res) {
  const r = await query(
    `SELECT * FROM attendance_date_unlocks
     WHERE requester_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(r.rows);
}

// ── Admin: list, approve, reject ───────────────────────────────────────────

export async function getDateUnlockRequests(req, res) {
  const status = req.query.status || 'pending';
  const r = await query(
    `SELECT du.*, u.name AS requester_name
     FROM attendance_date_unlocks du
     JOIN users u ON u.id = du.requester_id
     WHERE du.status = $1
     ORDER BY du.created_at DESC LIMIT 100`,
    [status]
  );
  res.json(r.rows);
}

export async function reviewDateUnlock(req, res) {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'reject'
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' });

  const status = action === 'approve' ? 'approved' : 'rejected';
  const r = await query(
    `UPDATE attendance_date_unlocks
     SET status=$1, reviewed_by=$2, reviewed_at=NOW()
     WHERE id=$3 AND status='pending'
     RETURNING *`,
    [status, req.user.id, id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Request not found or already reviewed' });
  res.json(r.rows[0]);
}

export async function getPendingUnlockCount(_req, res) {
  const r = await query(`SELECT COUNT(*)::int AS count FROM attendance_date_unlocks WHERE status='pending'`);
  res.json({ count: r.rows[0].count });
}

// ── Utility: check if a date is unlocked for a user ────────────────────────

export async function hasApprovedUnlock(userId, date) {
  const r = await query(
    `SELECT 1 FROM attendance_date_unlocks
     WHERE requester_id=$1 AND unlock_date=$2 AND status='approved' LIMIT 1`,
    [userId, date]
  );
  return r.rows.length > 0;
}
