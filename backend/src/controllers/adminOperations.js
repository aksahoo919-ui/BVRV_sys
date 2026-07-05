import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../middleware/audit.js';
import { stringify } from 'csv-stringify/sync';

// ── Attendance Corrections ─────────────────────────────────────────────────

export async function getAttendanceCorrections(req, res) {
  const { status } = req.query;
  const r = await query(`
    SELECT ac.*,
           u_req.name AS requested_by_name,
           u_stu.name AS student_name, u_stu.email AS student_email,
           sess.opened_at AS session_date,
           sub.name AS subject_name
    FROM attendance_corrections ac
    JOIN users u_req ON u_req.id = ac.requested_by
    JOIN users u_stu ON u_stu.id = ac.student_id
    JOIN sessions sess ON sess.id = ac.session_id
    JOIN subjects sub ON sub.id = sess.subject_id
    ${status ? 'WHERE ac.status=$1' : ''}
    ORDER BY ac.created_at DESC
  `, status ? [status] : []);
  res.json(r.rows);
}

export async function reviewAttendanceCorrection(req, res) {
  const { status } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(
    `UPDATE attendance_corrections SET status=$1, reviewed_by=$2 WHERE id=$3 RETURNING *`,
    [status, req.user.id, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });

  if (status === 'approved') {
    const corr = r.rows[0];
    await query(
      `UPDATE attendance_logs SET status=$1 WHERE session_id=$2 AND student_id=$3`,
      [corr.requested_status, corr.session_id, corr.student_id]
    );
  }
  await logAudit(req.user.id, `correction_${status}`, 'attendance_correction', req.params.id);
  // Email the teacher who submitted the correction
  const corr = r.rows[0];
  Promise.all([
    query('SELECT name, email FROM users WHERE id=$1', [corr.requested_by]),
    query('SELECT name FROM users WHERE id=$1', [corr.student_id]),
    query(`SELECT sub.name FROM subjects sub
           JOIN sessions sess ON sess.subject_id = sub.id
           WHERE sess.id = $1`, [corr.session_id]),
  ]).then(async ([teacherR, studentR, subjR]) => {
    if (!teacherR.rows.length) return;
    const { emailCorrectionStatus } = await import('../services/emailService.js');
    emailCorrectionStatus(
      teacherR.rows[0], status,
      studentR.rows[0]?.name || '?',
      subjR.rows[0]?.name  || '?'
    ).catch(() => {});
  }).catch(() => {});
  res.json(corr);
}

// ── Reset Attendance ───────────────────────────────────────────────────────
// Deletes class (academic) sessions and their attendance records. Scope:
//   - subject_id only     → class-wise
//   - date only           → date-wise (all classes on that day)
//   - subject_id + date    → that class on that day
//   - neither (bulk)       → ALL class attendance (requires confirm === 'RESET')
// attendance_logs & attendance_corrections cascade-delete with their sessions.
// BV Leader (mentor) attendance is separate and is NOT touched here.
export async function resetAttendance(req, res) {
  const { subject_id, date, confirm } = req.body || {};
  const bulk = !subject_id && !date;
  if (bulk && confirm !== 'RESET') {
    return res.status(400).json({ error: 'A full reset requires confirm="RESET".' });
  }
  try {
    const params = [];
    const clauses = [];
    if (subject_id) { params.push(subject_id); clauses.push(`subject_id = $${params.length}`); }
    if (date)       { params.push(date);       clauses.push(`opened_at::date = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const del = await query(`DELETE FROM sessions ${where} RETURNING id`, params);
    await logAudit(
      req.user.id, 'reset_attendance', 'sessions',
      subject_id || (date ? `date:${date}` : 'ALL')
    );
    res.json({ deleted_sessions: del.rowCount });
  } catch (err) {
    console.error('[resetAttendance]', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Leave Requests ─────────────────────────────────────────────────────────

export async function getLeaveRequests(req, res) {
  const { status } = req.query;
  const r = await query(`
    SELECT lr.*, u.name AS student_name, u.email AS student_email,
           rev.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN users u ON u.id = lr.student_id
    LEFT JOIN users rev ON rev.id = lr.reviewed_by
    ${status ? 'WHERE lr.status=$1' : ''}
    ORDER BY lr.created_at DESC
  `, status ? [status] : []);
  res.json(r.rows);
}

export async function reviewLeaveRequest(req, res) {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(
    `UPDATE leave_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3 RETURNING *`,
    [status, req.user.id, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, `leave_${status}`, 'leave_request', req.params.id);
  // Email student
  const lr = r.rows[0];
  query('SELECT name, email FROM users WHERE id=$1', [lr.student_id]).then(async sr => {
    if (!sr.rows.length) return;
    const { emailLeaveRequestStatus } = await import('../services/emailService.js');
    emailLeaveRequestStatus(sr.rows[0], lr.status, lr.from_date, lr.to_date).catch(() => {});
  }).catch(() => {});
  res.json(lr);
}

// ── Notifications (new table, separate from messages) ─────────────────────

export async function sendNotification(req, res) {
  const { title, body, audience, subject_id } = req.body;
  if (!title || !body || !audience) return res.status(400).json({ error: 'title, body, audience required' });
  const valid = ['everyone','all_students','all_teachers','all_mentors','class_students','assigned_students'];
  if (!valid.includes(audience)) return res.status(400).json({ error: 'Invalid audience' });
  const r = await query(
    `INSERT INTO notifications (id, sender_id, title, body, audience, subject_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [uuidv4(), req.user.id, title, body, audience, subject_id || null]
  );
  await logAudit(req.user.id, 'send_notification', 'notification', r.rows[0].id, { audience });
  // Fire-and-forget: resolve recipients and email
  _broadcastNotificationEmail(r.rows[0]).catch(() => {});
  res.status(201).json(r.rows[0]);
}

async function _broadcastNotificationEmail(notif) {
  const { emailNotificationBroadcast } = await import('../services/emailService.js');
  let emails = [];
  try {
    let result;
    switch (notif.audience) {
      case 'everyone':
        result = await query(`SELECT email FROM users WHERE status='active'`);
        emails = result.rows.map(u => u.email);
        break;
      case 'all_students':
        result = await query(`SELECT email FROM users WHERE role='student' AND status='active'`);
        emails = result.rows.map(u => u.email);
        break;
      case 'all_teachers':
        result = await query(`SELECT email FROM users WHERE role = 'teacher' AND status='active'`);
        emails = result.rows.map(u => u.email);
        break;
      case 'all_mentors':
        result = await query(`SELECT email FROM users WHERE role='mentor' AND status='active'`);
        emails = result.rows.map(u => u.email);
        break;
      case 'class_students':
        if (notif.subject_id) {
          result = await query(
            `SELECT u.email FROM class_enrollments ce JOIN users u ON u.id=ce.student_id WHERE ce.subject_id=$1`,
            [notif.subject_id]
          );
          emails = result.rows.map(u => u.email);
        }
        break;
      case 'assigned_students':
        result = await query(
          `SELECT u.email FROM mentor_assignments ma JOIN users u ON u.id=ma.student_id WHERE ma.mentor_id=$1`,
          [notif.sender_id]
        );
        emails = result.rows.map(u => u.email);
        break;
    }
    await emailNotificationBroadcast(notif, emails);
  } catch (err) {
    console.warn('[notification email]', err.message);
  }
}

export async function getNotifications(req, res) {
  const r = await query(`
    SELECT n.*, u.name AS sender_name
    FROM notifications n JOIN users u ON u.id = n.sender_id
    ORDER BY n.sent_at DESC LIMIT 100
  `);
  res.json(r.rows);
}

// ── Audit Logs ────────────────────────────────────────────────────────────

export async function getAuditLogs(req, res) {
  const { limit = 100, offset = 0, actor_id, entity_type, from_date, to_date } = req.query;
  const conditions = [];
  const params = [];
  if (actor_id)    { conditions.push(`al.actor_id=$${params.push(actor_id)}`); }
  if (entity_type) { conditions.push(`al.entity_type=$${params.push(entity_type)}`); }
  if (from_date)   { conditions.push(`al.created_at >= $${params.push(from_date)}`); }
  if (to_date)     { conditions.push(`al.created_at <  $${params.push(to_date + 'T23:59:59')}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(Number(limit), Number(offset));
  const r = await query(`
    SELECT al.*, u.name AS actor_name, u.email AS actor_email
    FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT $${params.length-1} OFFSET $${params.length}
  `, params);
  const total = await query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params.slice(0, -2));
  res.json({ rows: r.rows, total: Number(total.rows[0].count) });
}

// ── Backups ───────────────────────────────────────────────────────────────

export async function createBackup(req, res) {
  // Export key tables to JSON — lightweight in-app snapshot
  const tables = ['users','subjects','class_enrollments','sessions','attendance_logs',
                  'departments','courses','academic_years','semesters','marks','results',
                  'leave_requests','mentor_assignments'];
  const snapshot = {};
  for (const t of tables) {
    try {
      const r = await query(`SELECT * FROM ${t}`);
      snapshot[t] = r.rows;
    } catch { snapshot[t] = []; }
  }

  const json = JSON.stringify(snapshot, null, 2);
  const filename = `backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  const size = Buffer.byteLength(json, 'utf8');

  const r = await query(
    'INSERT INTO backups (id, created_by, filename, size_bytes) VALUES ($1,$2,$3,$4) RETURNING *',
    [uuidv4(), req.user.id, filename, size]
  );
  await logAudit(req.user.id, 'create_backup', 'backup', r.rows[0].id, { filename, size });

  // Stream the JSON file as a download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
}

export async function getBackups(req, res) {
  const r = await query(`
    SELECT b.*, u.name AS created_by_name
    FROM backups b LEFT JOIN users u ON u.id = b.created_by
    ORDER BY b.created_at DESC LIMIT 50
  `);
  res.json(r.rows);
}

export async function downloadBackup(req, res) {
  // The existing backup system streams JSON at creation time only.
  // Re-generate the same snapshot on demand — no files stored on disk.
  const backup = await query('SELECT * FROM backups WHERE id=$1', [req.params.id]);
  if (!backup.rows.length) return res.status(404).json({ error: 'Backup record not found' });

  const tables = ['users','subjects','class_enrollments','sessions','attendance_logs',
                  'departments','courses','academic_years','semesters','marks','results',
                  'leave_requests','mentor_assignments','course_enrollments'];
  const snapshot = {};
  for (const t of tables) {
    try { const r = await query(`SELECT * FROM ${t}`); snapshot[t] = r.rows; }
    catch { snapshot[t] = []; }
  }
  const json = JSON.stringify(snapshot, null, 2);
  const b = backup.rows[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${b.filename}"`);
  res.send(json);
}
