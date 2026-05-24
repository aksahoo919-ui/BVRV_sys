import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// ── Assigned Students ────────────────────────────────────────────────────

export async function getAssignedStudents(req, res) {
  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const r = await query(`
    SELECT u.id, u.name, u.email, u.avatar_url, ma.assigned_at,
      (
        SELECT COUNT(DISTINCT sess.id) FROM class_enrollments ce
        JOIN sessions sess ON sess.subject_id=ce.subject_id AND sess.closed=true
        WHERE ce.student_id=u.id
      ) AS total_sessions,
      (
        SELECT COUNT(DISTINCT al.session_id) FROM attendance_logs al
        JOIN sessions sess ON sess.id=al.session_id AND sess.closed=true
        WHERE al.student_id=u.id AND al.status='present' AND al.replayed=false
      ) AS attended_sessions
    FROM mentor_assignments ma JOIN users u ON u.id=ma.student_id
    WHERE ma.mentor_id=$1 ORDER BY u.name`,
    [req.user.id]
  );

  res.json(r.rows.map(s => {
    const pct = s.total_sessions > 0 ? Math.round(s.attended_sessions / s.total_sessions * 100) : 0;
    return { ...s, attendance_percentage: pct, below_threshold: pct < threshold };
  }));
}

export async function getStudentSummary(req, res) {
  const { student_id } = req.params;
  // Verify this student is assigned to this mentor
  const check = await query(
    'SELECT id FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2',
    [req.user.id, student_id]
  );
  if (!check.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });

  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const [attendance, marks, recentNotes, upcomingMeetings] = await Promise.all([
    query(`
      SELECT s.id, s.code, s.name,
        COUNT(DISTINCT sess.id) AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended,
        CASE WHEN COUNT(DISTINCT sess.id)>0
          THEN ROUND((COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
               /COUNT(DISTINCT sess.id))*100,1) ELSE 0 END AS percentage
      FROM subjects s
      JOIN class_enrollments ce ON ce.subject_id=s.id AND ce.student_id=$1
      LEFT JOIN sessions sess ON sess.subject_id=s.id AND sess.closed=true
      LEFT JOIN attendance_logs al ON al.session_id=sess.id AND al.student_id=$1
      GROUP BY s.id ORDER BY s.name`,
      [student_id]
    ),
    query(`
      SELECT m.*, s.name AS subject_name, sem.number AS semester_number
      FROM marks m
      JOIN subjects s ON s.id=m.subject_id
      JOIN semesters sem ON sem.id=m.semester_id
      WHERE m.student_id=$1 ORDER BY sem.number DESC, s.name, m.assessment_type`,
      [student_id]
    ),
    query(`SELECT * FROM counseling_notes WHERE mentor_id=$1 AND student_id=$2 ORDER BY meeting_date DESC LIMIT 5`, [req.user.id, student_id]),
    query(`SELECT * FROM meeting_schedules WHERE mentor_id=$1 AND student_id=$2 AND status='pending' AND scheduled_at>NOW() ORDER BY scheduled_at LIMIT 3`, [req.user.id, student_id]),
  ]);

  res.json({
    attendance: attendance.rows.map(a => ({ ...a, below_threshold: Number(a.percentage) < threshold })),
    marks: marks.rows,
    recent_notes: recentNotes.rows,
    upcoming_meetings: upcomingMeetings.rows,
  });
}

// ── Counseling Notes ──────────────────────────────────────────────────────

export async function getCounselingNotes(req, res) {
  const { student_id } = req.query;
  const params = [req.user.id];
  const clause = student_id ? `AND cn.student_id=$${params.push(student_id)}` : '';
  const r = await query(`
    SELECT cn.*, u.name AS student_name
    FROM counseling_notes cn JOIN users u ON u.id=cn.student_id
    WHERE cn.mentor_id=$1 ${clause} ORDER BY cn.meeting_date DESC`,
    params
  );
  res.json(r.rows);
}

export async function createCounselingNote(req, res) {
  const { student_id, note, meeting_date } = req.body;
  if (!student_id || !note || !meeting_date) return res.status(400).json({ error: 'Missing fields' });
  const check = await query('SELECT id FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2', [req.user.id, student_id]);
  if (!check.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    'INSERT INTO counseling_notes (id,mentor_id,student_id,note,meeting_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [uuidv4(), req.user.id, student_id, note, meeting_date]
  );
  res.status(201).json(r.rows[0]);
}

export async function updateCounselingNote(req, res) {
  const { note, meeting_date } = req.body;
  const r = await query(
    'UPDATE counseling_notes SET note=COALESCE($1,note), meeting_date=COALESCE($2,meeting_date) WHERE id=$3 AND mentor_id=$4 RETURNING *',
    [note, meeting_date, req.params.id, req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

export async function deleteCounselingNote(req, res) {
  await query('DELETE FROM counseling_notes WHERE id=$1 AND mentor_id=$2', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
}

// ── Parent Contact Records ────────────────────────────────────────────────

export async function getParentContacts(req, res) {
  const { student_id } = req.query;
  const params = [req.user.id];
  const clause = student_id ? `AND pcr.student_id=$${params.push(student_id)}` : '';
  const r = await query(`
    SELECT pcr.*, u.name AS student_name
    FROM parent_contact_records pcr JOIN users u ON u.id=pcr.student_id
    WHERE pcr.mentor_id=$1 ${clause} ORDER BY pcr.contact_date DESC`,
    params
  );
  res.json(r.rows);
}

export async function createParentContact(req, res) {
  const { student_id, contact_date, medium, summary } = req.body;
  if (!student_id || !contact_date || !medium || !summary) return res.status(400).json({ error: 'Missing fields' });
  const check = await query('SELECT id FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2', [req.user.id, student_id]);
  if (!check.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    'INSERT INTO parent_contact_records (id,mentor_id,student_id,contact_date,medium,summary) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [uuidv4(), req.user.id, student_id, contact_date, medium, summary]
  );
  res.status(201).json(r.rows[0]);
}

// ── Meeting Schedules ─────────────────────────────────────────────────────

export async function getMeetings(req, res) {
  const { student_id, status } = req.query;
  const params = [req.user.id];
  const clauses = [];
  if (student_id) clauses.push(`ms.student_id=$${params.push(student_id)}`);
  if (status) clauses.push(`ms.status=$${params.push(status)}`);
  const where = clauses.length ? 'AND ' + clauses.join(' AND ') : '';
  const r = await query(`
    SELECT ms.*, u.name AS student_name
    FROM meeting_schedules ms JOIN users u ON u.id=ms.student_id
    WHERE ms.mentor_id=$1 ${where} ORDER BY ms.scheduled_at DESC`,
    params
  );
  res.json(r.rows);
}

export async function createMeeting(req, res) {
  const { student_id, scheduled_at, agenda } = req.body;
  if (!student_id || !scheduled_at || !agenda) return res.status(400).json({ error: 'Missing fields' });
  const check = await query('SELECT id FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2', [req.user.id, student_id]);
  if (!check.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    'INSERT INTO meeting_schedules (id,mentor_id,student_id,scheduled_at,agenda) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [uuidv4(), req.user.id, student_id, scheduled_at, agenda]
  );
  res.status(201).json(r.rows[0]);
}

export async function updateMeeting(req, res) {
  const { scheduled_at, agenda, status, notes } = req.body;
  const r = await query(
    `UPDATE meeting_schedules SET
       scheduled_at=COALESCE($1,scheduled_at), agenda=COALESCE($2,agenda),
       status=COALESCE($3,status), notes=COALESCE($4,notes)
     WHERE id=$5 AND mentor_id=$6 RETURNING *`,
    [scheduled_at, agenda, status, notes, req.params.id, req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

// ── Alerts ────────────────────────────────────────────────────────────────

export async function getAlerts(req, res) {
  const settingsR = await query(
    'SELECT min_attendance_threshold, mentor_alert_gpa_threshold FROM institution_settings LIMIT 1'
  );
  const attThreshold = settingsR.rows[0]?.min_attendance_threshold || 75;
  const gpaThreshold = settingsR.rows[0]?.mentor_alert_gpa_threshold || 5.0;

  // Get all assigned students with latest GPA and overall attendance
  const r = await query(`
    SELECT
      u.id, u.name, u.email, u.avatar_url, u.roll_number,
      -- Overall attendance
      (
        SELECT COUNT(DISTINCT sess.id)
        FROM class_enrollments ce2
        JOIN sessions sess ON sess.subject_id = ce2.subject_id AND sess.closed = true
        WHERE ce2.student_id = u.id
      ) AS total_sessions,
      (
        SELECT COUNT(DISTINCT al.session_id)
        FROM attendance_logs al
        JOIN sessions sess ON sess.id = al.session_id AND sess.closed = true
        WHERE al.student_id = u.id AND al.status = 'present' AND al.replayed = false
      ) AS attended_sessions,
      -- Latest GPA (most recent published result)
      (
        SELECT r.gpa FROM results r
        JOIN semesters sem ON sem.id = r.semester_id
        WHERE r.student_id = u.id AND r.published = true
        ORDER BY sem.start_date DESC LIMIT 1
      ) AS latest_gpa
    FROM mentor_assignments ma
    JOIN users u ON u.id = ma.student_id
    WHERE ma.mentor_id = $1
  `, [req.user.id]);

  const alerts = r.rows
    .map(s => {
      const pct = s.total_sessions > 0
        ? Math.round(s.attended_sessions / s.total_sessions * 100)
        : 0;
      const reasons = [];
      if (pct < attThreshold && s.total_sessions > 0) reasons.push(`Attendance ${pct}% < ${attThreshold}%`);
      if (s.latest_gpa != null && Number(s.latest_gpa) < gpaThreshold)
        reasons.push(`GPA ${s.latest_gpa} < ${gpaThreshold}`);
      return { ...s, attendance_percentage: pct, alert_reasons: reasons };
    })
    .filter(s => s.alert_reasons.length > 0);

  res.json({ thresholds: { attendance: attThreshold, gpa: gpaThreshold }, alerts });
}

// ── Send message to assigned students ────────────────────────────────────

export async function sendMentorMessage(req, res) {
  const { student_id, body } = req.body;
  if (!body) return res.status(400).json({ error: 'body required' });

  // If student_id provided, verify assignment
  if (student_id) {
    const check = await query(
      'SELECT id FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2',
      [req.user.id, student_id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });
  }

  const r = await query(
    `INSERT INTO messages (id, sender_id, subject_id, body, audience)
     VALUES ($1, $2, NULL, $3, $4) RETURNING *`,
    [uuidv4(), req.user.id, body, student_id ? 'class_students' : 'assigned_students']
  );

  // If targeting a specific student, insert a targeted message_read placeholder via notification
  // (existing messages table is used as-is; the student's inbox query already handles 'assigned_students')
  res.status(201).json(r.rows[0]);
}
