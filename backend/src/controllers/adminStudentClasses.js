import { query, pool } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';

// ── Student classes (All Users > Course) ───────────────────────────────────
// Change = move the enrolment and the BV leader link from one class to another.
// Past attendance stays on the old class's sessions (history is not rewritten).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function classesOf(studentId) {
  const r = await query(`
    SELECT s.id AS subject_id, s.code, COALESCE(c.name || ' (' || s.code || ')', s.code) AS label,
      (SELECT m.name FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id
        WHERE cma.subject_id = s.id AND cma.student_id = ce.student_id) AS bv_leader,
      (SELECT COUNT(DISTINCT x.session_date) FROM sessions x JOIN attendance_logs a ON a.session_id = x.id
        WHERE x.subject_id = s.id AND a.student_id = ce.student_id AND a.status IN ('present','service') AND a.replayed = false)::int AS days_present
    FROM class_enrollments ce
    JOIN subjects s ON s.id = ce.subject_id
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE ce.student_id = $1
    ORDER BY s.code`, [studentId]);
  return r.rows;
}

// GET /admin/users/:id/classes
async function getStudentClasses(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  res.json(await classesOf(id));
}

// POST /admin/users/:id/classes  { from_subject_id?, to_subject_id? }
//   both  = change class (BV leader link moves along)
//   to    = add a class (BV leader copied when the student has exactly one)
//   from  = remove the class (and its BV leader link)
async function changeStudentClass(req, res) {
  const { id } = req.params;
  const from = req.body.from_subject_id || null;
  const to = req.body.to_subject_id || null;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!from && !to) return res.status(400).json({ error: 'Pick a class' });
  if ((from && !UUID_RE.test(from)) || (to && !UUID_RE.test(to))) return res.status(400).json({ error: 'Invalid class' });
  if (from && to && from === to) return res.status(400).json({ error: 'That is the same class' });

  const u = await query('SELECT id, role FROM users WHERE id = $1', [id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'User not found' });
  if (u.rows[0].role !== 'student') return res.status(400).json({ error: 'Only students have classes here' });
  if (to && !(await query('SELECT 1 FROM subjects WHERE id = $1', [to])).rows.length) return res.status(400).json({ error: 'Class not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (from && !(await client.query('SELECT 1 FROM class_enrollments WHERE student_id=$1 AND subject_id=$2', [id, from])).rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The student is not in that class' });
    }
    if (to) {
      await client.query(
        `INSERT INTO class_enrollments (id, subject_id, student_id) VALUES (gen_random_uuid(), $1, $2)
         ON CONFLICT (subject_id, student_id) DO NOTHING`, [to, id]);
      const hasLeader = (await client.query('SELECT 1 FROM class_mentor_assignments WHERE student_id=$1 AND subject_id=$2', [id, to])).rows.length;
      if (!hasLeader) {
        if (from) {
          await client.query('UPDATE class_mentor_assignments SET subject_id=$3, assigned_at=NOW() WHERE student_id=$1 AND subject_id=$2', [id, from, to]);
        } else {
          const leaders = (await client.query('SELECT DISTINCT mentor_id FROM class_mentor_assignments WHERE student_id=$1', [id])).rows;
          if (leaders.length === 1) {
            await client.query(
              `INSERT INTO class_mentor_assignments (id, subject_id, mentor_id, student_id) VALUES (gen_random_uuid(), $1, $2, $3)
               ON CONFLICT (subject_id, student_id) DO NOTHING`, [to, leaders[0].mentor_id, id]);
          }
        }
      }
    }
    if (from) {
      await client.query('DELETE FROM class_mentor_assignments WHERE student_id=$1 AND subject_id=$2', [id, from]);
      await client.query('DELETE FROM class_enrollments WHERE student_id=$1 AND subject_id=$2', [id, from]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await logAudit(req.user.id, from && to ? 'change_class' : to ? 'add_class' : 'remove_class', 'user', id, { from, to });
  res.json(await classesOf(id));
}

// Express 4 does not catch async errors: answer 500 instead of leaving the request hanging.
const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(err); if (!res.headersSent) res.status(500).json({ error: 'Server error' }); }
};
export const getStudentClassesSafe = safe(getStudentClasses);
export const changeStudentClassSafe = safe(changeStudentClass);
