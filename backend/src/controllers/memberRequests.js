import { query, pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../middleware/audit.js';
import { applyBVMember } from './adminSemesters.js';

// ── "Add new member" asked by a BV Leader (Prabhuji, 19 Oct call) ──────────
// The BV Leader enters a devotee (course optional). Nothing is added until an
// admin approves. The devotee is first looked up in the portal (phone / email);
// when found, approving puts that existing account under the BV Leader instead of
// creating a duplicate.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = v => (v == null ? null : String(v).trim() || null);
const digits10 = p => String(p || '').replace(/\D/g, '').slice(-10);
const isRealEmail = e => !!e && /^\S+@\S+\.\S+$/.test(e) && !/@noemail\.bvrv$/i.test(e);

// An existing student account with this phone (last 10 digits) or email.
async function findExisting({ phone, email }) {
  const p10 = digits10(phone);
  const em = isRealEmail(email) ? email.toLowerCase() : null;
  if (p10.length !== 10 && !em) return null;
  const r = await query(`
    SELECT u.id, u.name, u.phone, u.email,
      (SELECT STRING_AGG(DISTINCT m.name, ' / ') FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id WHERE cma.student_id = u.id) AS leaders,
      (SELECT STRING_AGG(DISTINCT COALESCE(c.name || ' (' || s.code || ')', s.code), ', ')
         FROM class_enrollments ce JOIN subjects s ON s.id = ce.subject_id LEFT JOIN semesters sem ON sem.id = s.semester_id LEFT JOIN courses c ON c.id = s.course_id
         WHERE ce.student_id = u.id AND (sem.id IS NULL OR sem.is_current)) AS courses
    FROM users u
    WHERE u.role = 'student' AND u.status = 'active'
      AND (($1::text <> '' AND right(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 10) = $1) OR ($2::text IS NOT NULL AND lower(u.email) = $2))
    ORDER BY (lower(u.email) = $2) DESC NULLS LAST, u.name`, [p10.length === 10 ? p10 : '', em]);
  return r.rows;
}

const SELECT = `
  SELECT r.id, r.mentor_id, mu.name AS mentor_name, r.student_id, r.name, r.phone, r.email, r.gender, r.subject_id,
    s.code AS course_code, c.name AS course_name, r.note, r.status, r.admin_note, r.created_at, r.reviewed_at, rv.name AS reviewed_by_name,
    eu.name AS existing_name, eu.phone AS existing_phone,
    (SELECT STRING_AGG(DISTINCT m.name, ' / ') FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id WHERE cma.student_id = r.student_id) AS existing_leaders
  FROM member_add_requests r
  JOIN users mu ON mu.id = r.mentor_id
  LEFT JOIN users eu ON eu.id = r.student_id
  LEFT JOIN users rv ON rv.id = r.reviewed_by
  LEFT JOIN subjects s ON s.id = r.subject_id
  LEFT JOIN courses c ON c.id = s.course_id`;

// ── BV Leader side ────────────────────────────────────────────────────────

// GET /mentor/member-requests — my requests + the current classes I can pick (optional)
async function myMemberRequests(req, res) {
  const [requests, classes] = await Promise.all([
    query(`${SELECT} WHERE r.mentor_id = $1 ORDER BY r.created_at DESC LIMIT 200`, [req.user.id]),
    query(`SELECT s.id AS subject_id, s.code, c.name AS course_name, s.name AS class_name
           FROM subjects s LEFT JOIN courses c ON c.id = s.course_id LEFT JOIN semesters sem ON sem.id = s.semester_id
           WHERE (sem.id IS NULL OR sem.is_current) AND s.code <> 'TEST' ORDER BY c.name, s.code`),
  ]);
  res.json({ requests: requests.rows, classes: classes.rows });
}

// POST /mentor/member-requests  { name, phone?, email?, gender?, subject_id?, note? }
async function createMemberRequest(req, res) {
  const name = clean(req.body.name)?.replace(/\s+/g, ' ');
  const phone = clean(req.body.phone), email = clean(req.body.email), note = clean(req.body.note)?.slice(0, 500) || null;
  const gender = ['Male', 'Female'].includes(req.body.gender) ? req.body.gender : null;
  const subject_id = clean(req.body.subject_id);
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (email && email.toUpperCase() !== 'NA' && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (phone && digits10(phone).length !== 10) return res.status(400).json({ error: 'Mobile number must have 10 digits' });
  if (subject_id) {
    if (!UUID_RE.test(subject_id)) return res.status(400).json({ error: 'Invalid course' });
    const ok = await query(`SELECT 1 FROM subjects s LEFT JOIN semesters sem ON sem.id = s.semester_id WHERE s.id = $1 AND (sem.id IS NULL OR sem.is_current)`, [subject_id]);
    if (!ok.rows.length) return res.status(400).json({ error: 'Pick a course of the current semester' });
  }

  // validation: is this devotee already in the portal?
  const found = await findExisting({ phone, email });
  const existing = found && found.length === 1 ? found[0] : (found && found.length > 1 ? found.find(f => isRealEmail(email) && f.email?.toLowerCase() === email.toLowerCase()) || null : null);
  if (found && found.length > 1 && !existing)
    return res.status(409).json({ error: `Several portal accounts match this number (${found.map(f => f.name).join(', ')}). Ask the admin to add them.` });
  if (existing) {
    const mine = await query('SELECT 1 FROM class_mentor_assignments WHERE mentor_id = $1 AND student_id = $2 LIMIT 1', [req.user.id, existing.id]);
    if (mine.rows.length) return res.status(409).json({ error: `${existing.name} is already your member` });
  }
  const dupPending = await query(
    `SELECT 1 FROM member_add_requests WHERE mentor_id = $1 AND status = 'pending'
       AND (($2::uuid IS NOT NULL AND student_id = $2) OR lower(name) = lower($3))`, [req.user.id, existing?.id || null, name]);
  if (dupPending.rows.length) return res.status(409).json({ error: 'You already have a pending request for this devotee' });

  const r = await query(
    `INSERT INTO member_add_requests (mentor_id, student_id, name, phone, email, gender, subject_id, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.user.id, existing?.id || null, name, phone, email && email.toUpperCase() !== 'NA' ? email : null, gender, subject_id, note]);
  await logAudit(req.user.id, 'request_add_member', 'member_add_request', r.rows[0].id, { name, existing_student_id: existing?.id || null, subject_id });
  res.status(201).json({
    id: r.rows[0].id,
    existing: existing ? { name: existing.name, leaders: existing.leaders, courses: existing.courses } : null,
  });
}

// POST /mentor/member-requests/:id/cancel
async function cancelMemberRequest(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await query(`UPDATE member_add_requests SET status = 'cancelled', reviewed_at = NOW() WHERE id = $1 AND mentor_id = $2 AND status = 'pending' RETURNING id`, [req.params.id, req.user.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No pending request to cancel' });
  res.json({ message: 'Request cancelled' });
}

// ── Admin side ────────────────────────────────────────────────────────────

// GET /admin/member-requests?status=pending|approved|rejected|cancelled|all
async function listMemberRequests(req, res) {
  const status = req.query.status || 'pending';
  const all = status === 'all';
  if (!all && !['pending', 'approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(`${SELECT} ${all ? '' : 'WHERE r.status = $1'} ORDER BY r.created_at DESC LIMIT 500`, all ? [] : [status]);
  const counts = (await query(`SELECT status, COUNT(*)::int AS n FROM member_add_requests GROUP BY status`)).rows;
  res.json({ requests: r.rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) });
}

// PATCH /admin/member-requests/:id  { status: 'approved' | 'rejected', admin_note? }
// Approve: uses the existing account when there is one (re-checked now), else creates the student, then puts them under the BV Leader.
async function reviewMemberRequest(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const adminNote = clean(req.body.admin_note)?.slice(0, 500) || null;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const client = await pool.connect();
  let row, result = {};
  try {
    await client.query('BEGIN');
    row = (await client.query('SELECT * FROM member_add_requests WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (row.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: `This request is already ${row.status}` }); }

    if (status === 'approved') {
      let student_id = row.student_id, newUser = null;
      if (!student_id) {
        const found = await findExisting({ phone: row.phone, email: row.email });   // may have been added since the request
        if (found && found.length === 1) student_id = found[0].id;
      }
      if (!student_id) {
        const digits = digits10(row.phone);
        const email = isRealEmail(row.email) ? row.email : (digits ? `p${digits}@noemail.bvrv` : `na-${uuidv4()}@noemail.bvrv`);
        newUser = { id: uuidv4(), name: row.name, email, phone: row.phone, gender: row.gender };
      }
      const mentorOk = await client.query(`SELECT 1 FROM users WHERE id = $1 AND (role = 'mentor' OR secondary_role = 'mentor')`, [row.mentor_id]);
      if (!mentorOk.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The requesting BV Leader is no longer a BV Leader' }); }
      const done = await applyBVMember(client, { mentor_id: row.mentor_id, subject_id: row.subject_id, student_id, newUser });
      result = { student_id: done.sid, created: !!newUser, previous_leader: done.previous };
      if (newUser) await logAudit(req.user.id, 'create_user', 'user', done.sid, { role: 'student', via: 'member_request' });
    }
    await client.query(
      `UPDATE member_add_requests SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW(), student_id = COALESCE($5, student_id) WHERE id = $4`,
      [status, adminNote, req.user.id, id, result.student_id || null]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'A user with that email already exists. Reject this and add them from All Users / BV Members' });
    throw err;
  } finally {
    client.release();
  }
  await logAudit(req.user.id, `member_request_${status}`, 'member_add_request', id, { mentor_id: row.mentor_id, name: row.name, ...result });
  res.json({ id, status, ...result });
}

const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(err); if (!res.headersSent) res.status(500).json({ error: 'Server error' }); }
};
export const myMemberRequestsSafe = safe(myMemberRequests);
export const createMemberRequestSafe = safe(createMemberRequest);
export const cancelMemberRequestSafe = safe(cancelMemberRequest);
export const listMemberRequestsSafe = safe(listMemberRequests);
export const reviewMemberRequestSafe = safe(reviewMemberRequest);
