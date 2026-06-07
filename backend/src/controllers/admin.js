import { query, pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { stringify } from 'csv-stringify/sync';
import { logAudit } from '../middleware/audit.js';

// ── Users ──────────────────────────────────────────────────────────────────

export async function getPendingUsers(req, res) {
  try {
    const result = await query(
      `SELECT id, name, email, role, status, avatar_url, created_at
       FROM users WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const result = await query(
      `SELECT id, name, email, role, status, avatar_url, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function approveUser(req, res) {
  try {
    const result = await query(
      `UPDATE users SET status = 'active' WHERE id = $1 RETURNING id, name, email, role, status`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    // Fire-and-forget email
    import('../services/emailService.js').then(({ emailAccountApproved }) =>
      emailAccountApproved(result.rows[0]).catch(() => {})
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function rejectUser(req, res) {
  try {
    const result = await query(
      `UPDATE users SET status = 'suspended' WHERE id = $1 RETURNING id, name, email, role, status`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    import('../services/emailService.js').then(({ emailAccountRejected }) =>
      emailAccountRejected(result.rows[0]).catch(() => {})
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Suspend an active user (soft remove — reversible via approve)
export async function suspendUser(req, res) {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    const result = await query(
      `UPDATE users SET status = 'suspended'
       WHERE id = $1 AND role != 'admin' RETURNING id, name, email, role, status`,
      [req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'User not found or cannot suspend an admin' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Permanently delete a user (cannot be undone)
export async function deleteUser(req, res) {
  const { id } = req.params;
  if (id === req.user.id)
    return res.status(400).json({ error: 'You cannot delete your own account' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm user exists and is not an admin
    const check = await client.query(
      `SELECT id, name, email, role FROM users WHERE id = $1`,
      [id]
    );
    if (!check.rows.length)
      return res.status(404).json({ error: 'User not found' });
    if (check.rows[0].role === 'admin')
      return res.status(403).json({ error: 'Cannot delete an admin account' });

    const user = check.rows[0];

    // Null-out every NO ACTION / RESTRICT reference so the final DELETE succeeds
    await client.query(`UPDATE subjects            SET created_by   = NULL WHERE created_by   = $1`, [id]);
    await client.query(`UPDATE institution_settings SET updated_by  = NULL WHERE updated_by   = $1`, [id]);
    await client.query(`UPDATE sessions            SET instructor_id = NULL WHERE instructor_id = $1`, [id]);
    await client.query(`UPDATE messages            SET sender_id    = NULL WHERE sender_id    = $1`, [id]);
    // class_enrollments has a check constraint — rows must be deleted, not nulled
    await client.query(`DELETE FROM class_enrollments WHERE instructor_id = $1`, [id]);
    await client.query(`DELETE FROM class_enrollments WHERE student_id   = $1`, [id]);
    await client.query(`UPDATE marks               SET uploaded_by  = NULL WHERE uploaded_by  = $1`, [id]);
    await client.query(`UPDATE leave_requests      SET reviewed_by  = NULL WHERE reviewed_by  = $1`, [id]);
    await client.query(`UPDATE attendance_corrections SET reviewed_by = NULL WHERE reviewed_by = $1`, [id]);

    // Now delete — everything else (marks, results, logs, enrollments…) cascades automatically
    await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ message: `${user.name} has been permanently removed` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteUser error:', err.message);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
}

export async function bulkImport(req, res) {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });

  const csv = req.file.buffer.toString('utf8');
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const nameIdx = header.indexOf('name');
  const emailIdx = header.indexOf('email');
  const roleIdx = header.indexOf('role');
  // Optional phone column — accepts "phone" or "phone number"
  const phoneIdx = header.indexOf('phone') !== -1 ? header.indexOf('phone') : header.indexOf('phone number');

  if (nameIdx === -1 || emailIdx === -1 || roleIdx === -1) {
    return res.status(400).json({ error: 'CSV must have columns: name, email, role' });
  }

  let imported = 0;
  const skipped = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const name = cols[nameIdx];
    const email = cols[emailIdx];
    const role = cols[roleIdx]?.toLowerCase();
    const phone = phoneIdx !== -1 ? (cols[phoneIdx] || null) : null;

    if (!name || !email || !['student', 'teacher', 'mentor'].includes(role)) {
      skipped.push({ row: i + 1, reason: 'Invalid data', email });
      continue;
    }

    try {
      const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (exists.rows.length > 0) {
        skipped.push({ row: i + 1, reason: 'Email already exists', email });
        continue;
      }
      await query(
        `INSERT INTO users (id, name, email, role, phone, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
        [uuidv4(), name, email, role, phone]
      );
      imported++;
    } catch (err) {
      skipped.push({ row: i + 1, reason: err.message, email });
    }
  }

  res.json({ imported, skipped });
}

// ── Subjects ───────────────────────────────────────────────────────────────

export async function getSubjects(req, res) {
  try {
    const result = await query(
      `SELECT s.*,
              c.name AS course_name, c.code AS course_code,
              ay.label AS academic_year_label,
              u.name AS created_by_name
       FROM subjects s
       LEFT JOIN courses c ON c.id = s.course_id
       LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
       LEFT JOIN users u ON u.id = s.created_by
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createSubject(req, res) {
  const { code, name, course_id, academic_year_id, credits } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  try {
    const result = await query(
      `INSERT INTO subjects (id, code, name, created_by, course_id, academic_year_id, credits)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [uuidv4(), code.toUpperCase(), name, req.user.id,
       course_id || null, academic_year_id || null, credits ?? 3]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Subject code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSubject(req, res) {
  const { code, name, course_id, academic_year_id, credits } = req.body;
  try {
    const result = await query(
      `UPDATE subjects
       SET code             = COALESCE($1, code),
           name             = COALESCE($2, name),
           course_id        = COALESCE($3, course_id),
           academic_year_id = COALESCE($4, academic_year_id),
           credits          = COALESCE($5, credits)
       WHERE id = $6 RETURNING *`,
      [code?.toUpperCase(), name, course_id, academic_year_id, credits, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteSubject(req, res) {
  try {
    const result = await query('DELETE FROM subjects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Classes ────────────────────────────────────────────────────────────────

export async function assignInstructor(req, res) {
  const { subject_id, instructor_id } = req.body;
  if (!subject_id || !instructor_id) return res.status(400).json({ error: 'Missing fields' });
  try {
    const result = await query(
      `INSERT INTO class_enrollments (id, subject_id, instructor_id)
       VALUES ($1, $2, $3) ON CONFLICT (subject_id, instructor_id) DO NOTHING RETURNING *`,
      [uuidv4(), subject_id, instructor_id]
    );
    res.status(201).json(result.rows[0] || { message: 'Already assigned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function enrollStudent(req, res) {
  const { subject_id, student_id } = req.body;
  if (!subject_id || !student_id) return res.status(400).json({ error: 'Missing fields' });
  try {
    const result = await query(
      `INSERT INTO class_enrollments (id, subject_id, student_id)
       VALUES ($1, $2, $3) ON CONFLICT (subject_id, student_id) DO NOTHING RETURNING *`,
      [uuidv4(), subject_id, student_id]
    );
    res.status(201).json(result.rows[0] || { message: 'Already enrolled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function removeInstructor(req, res) {
  const { subject_id, instructor_id } = req.body;
  try {
    await query(
      'DELETE FROM class_enrollments WHERE subject_id = $1 AND instructor_id = $2',
      [subject_id, instructor_id]
    );
    res.json({ message: 'Instructor removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function removeStudent(req, res) {
  const { subject_id, student_id } = req.body;
  try {
    await query(
      'DELETE FROM class_enrollments WHERE subject_id = $1 AND student_id = $2',
      [subject_id, student_id]
    );
    res.json({ message: 'Student removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getClassMembers(req, res) {
  const { subject_id } = req.params;
  try {
    const instructors = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, 'teacher' AS member_type
       FROM class_enrollments ce JOIN users u ON ce.instructor_id = u.id
       WHERE ce.subject_id = $1 AND ce.instructor_id IS NOT NULL`,
      [subject_id]
    );
    const students = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, 'student' AS member_type
       FROM class_enrollments ce JOIN users u ON ce.student_id = u.id
       WHERE ce.subject_id = $1 AND ce.student_id IS NOT NULL`,
      [subject_id]
    );
    res.json({ instructors: instructors.rows, students: students.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function reportInstructors(req, res) {
  try {
    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.avatar_url,
        COUNT(DISTINCT ce.subject_id) AS subject_count,
        ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) AS subjects,
        COUNT(DISTINCT sess.id) AS sessions_opened,
        MAX(sess.opened_at) AS last_session_date
      FROM users u
      LEFT JOIN class_enrollments ce ON ce.instructor_id = u.id
      LEFT JOIN subjects s ON s.id = ce.subject_id
      LEFT JOIN sessions sess ON sess.instructor_id = u.id
      WHERE u.role = 'teacher'
      GROUP BY u.id
      ORDER BY u.name
    `);

    if (req.query.export === 'csv') {
      const csv = stringify(result.rows, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="instructors.csv"');
      return res.send(csv);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function reportStudents(req, res) {
  try {
    const settingsResult = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
    const threshold = settingsResult.rows[0]?.min_attendance_threshold || 75;

    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.avatar_url,
        s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
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
      JOIN class_enrollments ce ON ce.student_id = u.id
      JOIN subjects s ON s.id = ce.subject_id
      LEFT JOIN sessions sess ON sess.subject_id = s.id AND sess.closed = true
      LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id, s.id
      ORDER BY u.name, s.name
    `);

    const rows = result.rows.map((r) => ({
      ...r,
      below_threshold: Number(r.percentage) < threshold,
    }));

    if (req.query.export === 'csv') {
      const csv = stringify(rows, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
      return res.send(csv);
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function reportSubject(req, res) {
  const { id } = req.params;
  try {
    const sessionsResult = await query(`
      SELECT
        sess.id, sess.opened_at, sess.closed,
        COUNT(al.id) FILTER (WHERE al.status = 'present' AND al.replayed = false) AS present_count,
        COUNT(al.id) FILTER (WHERE al.status = 'flagged') AS flagged_count,
        (
          SELECT COUNT(*) FROM class_enrollments ce WHERE ce.subject_id = sess.subject_id AND ce.student_id IS NOT NULL
        ) - COUNT(al.id) FILTER (WHERE al.status = 'present' AND al.replayed = false) AS absent_count
      FROM sessions sess
      LEFT JOIN attendance_logs al ON al.session_id = sess.id
      WHERE sess.subject_id = $1
      GROUP BY sess.id
      ORDER BY sess.opened_at DESC
    `, [id]);

    if (req.query.export === 'csv') {
      const csv = stringify(sessionsResult.rows, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="subject_report.csv"');
      return res.send(csv);
    }
    res.json(sessionsResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(req, res) {
  try {
    const result = await query('SELECT * FROM institution_settings LIMIT 1');
    res.json(result.rows[0] || { min_attendance_threshold: 75 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSettings(req, res) {
  const {
    min_attendance_threshold,
    gpa_scale,
    grade_boundaries,
    email_alerts_enabled,
    mentor_alert_gpa_threshold,
    multi_admin_enabled,
  } = req.body;

  // Validate provided fields
  if (min_attendance_threshold != null) {
    const v = Number(min_attendance_threshold);
    if (isNaN(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: 'min_attendance_threshold must be 0-100' });
    }
  }
  if (grade_boundaries != null && (typeof grade_boundaries !== 'object' || Array.isArray(grade_boundaries))) {
    return res.status(400).json({ error: 'grade_boundaries must be an object' });
  }

  // Build dynamic SET clause
  const setClauses = [];
  const params = [];

  if (min_attendance_threshold != null) {
    params.push(Number(min_attendance_threshold));
    setClauses.push(`min_attendance_threshold = $${params.length}`);
  }
  if (gpa_scale != null) {
    params.push(gpa_scale);
    setClauses.push(`gpa_scale = $${params.length}`);
  }
  if (grade_boundaries != null) {
    params.push(JSON.stringify(grade_boundaries));
    setClauses.push(`grade_boundaries = $${params.length}`);
  }
  if (email_alerts_enabled != null) {
    params.push(Boolean(email_alerts_enabled));
    setClauses.push(`email_alerts_enabled = $${params.length}`);
  }
  if (mentor_alert_gpa_threshold != null) {
    params.push(mentor_alert_gpa_threshold);
    setClauses.push(`mentor_alert_gpa_threshold = $${params.length}`);
  }
  if (multi_admin_enabled != null) {
    params.push(Boolean(multi_admin_enabled));
    setClauses.push(`multi_admin_enabled = $${params.length}`);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  params.push(req.user.id);
  setClauses.push(`updated_by = $${params.length}`);
  setClauses.push(`updated_at = NOW()`);

  try {
    const result = await query(
      `UPDATE institution_settings SET ${setClauses.join(', ')} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Admin Reports (extended) ───────────────────────────────────────────────

// GET /api/admin/reports/department-attendance
export async function reportDepartmentAttendance(req, res) {
  try {
    // For each course (used as "department" since departments are removed from UI),
    // compute average attendance % across subjects in that course
    const r = await query(`
      SELECT
        COALESCE(c.name, 'Unassigned') AS department_name,
        c.id AS course_id,
        ROUND(
          100.0 * SUM(CASE WHEN al.id IS NOT NULL THEN 1 ELSE 0 END)
          / NULLIF(COUNT(DISTINCT ce.student_id) * COUNT(DISTINCT sess.id), 0),
          1
        ) AS average_attendance_pct,
        COUNT(DISTINCT s.id) AS subject_count
      FROM subjects s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.student_id IS NOT NULL
      LEFT JOIN sessions sess ON sess.subject_id = s.id AND sess.closed = true
      LEFT JOIN attendance_logs al ON al.session_id = sess.id
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/admin/reports/teacher-activity-today
export async function reportTeacherActivityToday(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const r = await query(`
      SELECT
        u.id AS teacher_id,
        u.name AS teacher_name,
        s.name AS subject_name,
        s.code AS subject_code,
        CASE
          WHEN sess.closed = false AND sess.expires_at > NOW() THEN 'in_progress'
          WHEN sess.id IS NOT NULL THEN 'done'
          ELSE 'not_started'
        END AS session_status,
        sess.id AS session_id
      FROM users u
      JOIN class_enrollments ce ON ce.instructor_id = u.id
      JOIN subjects s ON s.id = ce.subject_id
      LEFT JOIN sessions sess ON sess.subject_id = s.id
        AND sess.instructor_id = u.id
        AND sess.opened_at >= $1 AND sess.opened_at < $2
      WHERE u.role = 'teacher' AND u.status = 'active'
      ORDER BY u.name, s.name
    `, [today, tomorrow]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function sendMessage(req, res) {
  const { body, audience, subject_id } = req.body;
  if (!body || !audience) return res.status(400).json({ error: 'body and audience required' });
  const validAudiences = ['class_students', 'all_students', 'all_instructors', 'everyone'];
  if (!validAudiences.includes(audience)) return res.status(400).json({ error: 'Invalid audience' });

  try {
    const result = await query(
      `INSERT INTO messages (id, sender_id, subject_id, body, audience)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuidv4(), req.user.id, subject_id || null, body, audience]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
