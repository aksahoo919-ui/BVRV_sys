import { query } from '../config/db.js';
import redis from '../config/redis.js';
import { v4 as uuidv4 } from 'uuid';
import { generatePin } from '../utils/pin.js';

export async function getSubjects(req, res) {
  try {
    const result = await query(
      `SELECT s.id, s.code, s.name, s.created_at,
        COUNT(DISTINCT ce2.student_id) AS student_count,
        MAX(sess.opened_at) AS last_session_date
       FROM subjects s
       JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.instructor_id = $1
       LEFT JOIN class_enrollments ce2 ON ce2.subject_id = s.id AND ce2.student_id IS NOT NULL
       LEFT JOIN sessions sess ON sess.subject_id = s.id
       GROUP BY s.id
       ORDER BY s.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function openSession(req, res) {
  const { subject_id } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id required' });

  try {
    // Verify instructor is assigned to subject
    const assigned = await query(
      'SELECT id FROM class_enrollments WHERE subject_id = $1 AND instructor_id = $2',
      [subject_id, req.user.id]
    );
    if (!assigned.rows.length) {
      return res.status(403).json({ error: 'Not assigned to this subject' });
    }

    // Close any open sessions for this subject
    await query(
      `UPDATE sessions SET closed = true WHERE subject_id = $1 AND closed = false AND expires_at > NOW()`,
      [subject_id]
    );

    const { pin, tokenHash } = generatePin(subject_id, req.user.id);
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // +3 minutes

    await query(
      `INSERT INTO sessions (id, subject_id, instructor_id, token_hash, pin_display, opened_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, subject_id, req.user.id, tokenHash, pin, now, expiresAt]
    );

    res.status(201).json({ session_id: sessionId, pin_display: pin, expires_at: expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getLiveAttendance(req, res) {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT al.id, al.student_id, al.submitted_at, al.status, al.replayed,
              u.name, u.email, u.avatar_url
       FROM attendance_logs al
       JOIN users u ON u.id = al.student_id
       WHERE al.session_id = $1
       ORDER BY al.submitted_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function closeSession(req, res) {
  const { id } = req.params;
  try {
    const result = await query(
      `UPDATE sessions SET closed = true WHERE id = $1 AND instructor_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function overrideAttendance(req, res) {
  const { log_id } = req.params;
  const { status } = req.body;
  const valid = ['present', 'late', 'flagged'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    // Verify the session belongs to this instructor
    const result = await query(
      `UPDATE attendance_logs al SET status = $1
       FROM sessions sess
       WHERE al.id = $2 AND al.session_id = sess.id AND sess.instructor_id = $3
       RETURNING al.*`,
      [status, log_id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Log not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getSubjectReport(req, res) {
  const { subject_id } = req.params;
  try {
    // Verify ownership
    const owned = await query(
      'SELECT id FROM class_enrollments WHERE subject_id = $1 AND instructor_id = $2',
      [subject_id, req.user.id]
    );
    if (!owned.rows.length) return res.status(403).json({ error: 'Not authorized' });

    const settingsResult = await query('SELECT attendance_threshold FROM institution_settings LIMIT 1');
    const threshold = settingsResult.rows[0]?.attendance_threshold || 75;

    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.avatar_url,
        COUNT(DISTINCT sess.id) AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false) AS attended,
        CASE WHEN COUNT(DISTINCT sess.id) > 0
          THEN ROUND(
            (COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false)::numeric
            / COUNT(DISTINCT sess.id)) * 100, 1
          )
          ELSE 0
        END AS percentage
      FROM users u
      JOIN class_enrollments ce ON ce.student_id = u.id AND ce.subject_id = $1
      LEFT JOIN sessions sess ON sess.subject_id = $1 AND sess.closed = true
      LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.name
    `, [subject_id]);

    res.json(result.rows.map(r => ({ ...r, below_threshold: Number(r.percentage) < threshold })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function sendMessage(req, res) {
  const { subject_id, body } = req.body;
  if (!subject_id || !body) return res.status(400).json({ error: 'subject_id and body required' });

  try {
    // Verify ownership
    const owned = await query(
      'SELECT id FROM class_enrollments WHERE subject_id = $1 AND instructor_id = $2',
      [subject_id, req.user.id]
    );
    if (!owned.rows.length) return res.status(403).json({ error: 'Not assigned to this subject' });

    const result = await query(
      `INSERT INTO messages (id, sender_id, subject_id, body, audience)
       VALUES ($1, $2, $3, $4, 'class_students') RETURNING *`,
      [uuidv4(), req.user.id, subject_id, body]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
