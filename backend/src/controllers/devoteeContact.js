import { query } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';

// A BVRV teacher or BV Leader can correct a devotee's email, phone number and
// initiated name — the details they hear first and that are most often wrong
// (621 placeholder emails and 99 missing phones on 24 Oct). Name, role,
// username and password stay admin-only (admin.updateUser).
//
// Scope: a teacher only for a devotee enrolled in one of their classes, a
// BV Leader only for a devotee assigned to them. Every change is audit-logged
// with the old and new values, since it edits someone else's personal data.

const FIELDS = ['email', 'phone', 'initiated_name'];

// Same rules as admin.updateUser, plus phone normalisation: digits only, and
// an Indian mobile is 10 digits (a leading 91 / 0 is dropped).
function validate(body) {
  const set = {};
  if (body.email !== undefined) {
    const e = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'Please enter a valid email address' };
    set.email = e;
  }
  if (body.phone !== undefined) {
    let d = String(body.phone || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d && d.length !== 10) return { error: 'Phone number must have 10 digits' };
    set.phone = d || null;
  }
  if (body.initiated_name !== undefined) {
    const n = String(body.initiated_name || '').replace(/\s+/g, ' ').trim();
    if (n.length > 120) return { error: 'Initiated name is too long' };
    set.initiated_name = n || null;
  }
  if (!Object.keys(set).length) return { error: 'Nothing to update' };
  return { set };
}

async function applyUpdate(req, res, studentId) {
  const v = validate(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });

  const before = await query(
    `SELECT id, name, email, phone, initiated_name FROM users WHERE id = $1 AND role = 'student'`,
    [studentId]
  );
  if (!before.rows.length) return res.status(404).json({ error: 'Devotee not found' });
  const old = before.rows[0];

  // Only write what actually changed, so the audit trail stays meaningful.
  const changed = Object.entries(v.set).filter(([k, val]) => (old[k] ?? null) !== val);
  if (!changed.length) return res.json({ ...old, unchanged: true });

  const cols = changed.map(([k], i) => `${k} = $${i + 1}`);
  const vals = changed.map(([, val]) => val);
  vals.push(studentId);
  try {
    const r = await query(
      `UPDATE users SET ${cols.join(', ')} WHERE id = $${vals.length}
       RETURNING id, name, email, phone, initiated_name`,
      vals
    );
    await logAudit(req.user.id, 'update_devotee_contact', 'user', studentId, {
      by_role: req.user.role,
      changes: Object.fromEntries(changed.map(([k, val]) => [k, { from: old[k] ?? null, to: val }])),
    });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already used by another devotee' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /api/teacher/students/:student_id/contact
export async function teacherUpdateDevoteeContact(req, res) {
  const { student_id } = req.params;
  const mine = await query(
    `SELECT 1 FROM class_enrollments s
       JOIN class_enrollments t ON t.subject_id = s.subject_id AND t.instructor_id = $2
      WHERE s.student_id = $1 LIMIT 1`,
    [student_id, req.user.id]
  );
  if (!mine.rows.length) return res.status(403).json({ error: 'This devotee is not in any of your classes' });
  return applyUpdate(req, res, student_id);
}

// PATCH /api/mentor/students/:student_id/contact
export async function mentorUpdateDevoteeContact(req, res) {
  const { student_id } = req.params;
  const mine = await query(
    'SELECT 1 FROM class_mentor_assignments WHERE mentor_id = $1 AND student_id = $2 LIMIT 1',
    [req.user.id, student_id]
  );
  if (!mine.rows.length) return res.status(403).json({ error: 'This devotee is not one of your members' });
  return applyUpdate(req, res, student_id);
}

export { FIELDS as DEVOTEE_CONTACT_FIELDS, validate as validateDevoteeContact };
