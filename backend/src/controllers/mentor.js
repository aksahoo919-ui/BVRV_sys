import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { calculateGrade } from '../services/gradeService.js';
import { generatePin } from '../utils/pin.js';

// A student is "mine" if I mentor them in at least one class.
async function isMyStudent(mentorId, studentId) {
  const r = await query(
    'SELECT 1 FROM class_mentor_assignments WHERE mentor_id=$1 AND student_id=$2 LIMIT 1',
    [mentorId, studentId]
  );
  return r.rows.length > 0;
}

// ── Assigned Students ────────────────────────────────────────────────────
// Attendance % shown to the mentor is based on the mentor's OWN weekly
// sessions (mentor_sessions / mentor_attendance), not academic sessions.

export async function getAssignedStudents(req, res) {
  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const r = await query(`
    SELECT u.id, u.name, u.email, u.avatar_url, u.roll_number,
      MIN(cma.assigned_at) AS assigned_at,
      STRING_AGG(DISTINCT s.code, ', ') AS subject_codes,
      COUNT(DISTINCT ms.id) AS total_sessions,
      COUNT(DISTINCT ma.session_id) FILTER (WHERE ma.status='present') AS attended_sessions
    FROM class_mentor_assignments cma
    JOIN users u    ON u.id = cma.student_id
    JOIN subjects s ON s.id = cma.subject_id
    LEFT JOIN mentor_sessions ms   ON ms.subject_id = cma.subject_id AND ms.mentor_id = $1
    LEFT JOIN mentor_attendance ma ON ma.session_id = ms.id AND ma.student_id = u.id
    WHERE cma.mentor_id = $1
    GROUP BY u.id
    ORDER BY u.name`,
    [req.user.id]
  );

  res.json(r.rows.map(s => {
    const pct = s.total_sessions > 0 ? Math.round(s.attended_sessions / s.total_sessions * 100) : 0;
    return { ...s, attendance_percentage: pct, below_threshold: s.total_sessions > 0 && pct < threshold };
  }));
}

export async function getStudentSummary(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id)))
    return res.status(403).json({ error: 'Student not assigned to you' });

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
      SELECT m.*, s.name AS subject_name, ay.label AS year_label
      FROM marks m
      JOIN subjects s ON s.id=m.subject_id
      LEFT JOIN academic_years ay ON ay.id=m.academic_year_id
      WHERE m.student_id=$1 ORDER BY ay.start_date DESC NULLS LAST, s.name, m.assessment_type`,
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
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
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
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
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
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
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

  // All mentored students, with mentor-class attendance and latest GPA.
  const r = await query(`
    SELECT
      u.id AS student_id, u.name AS student_name, u.email AS student_email,
      u.avatar_url, u.roll_number,
      COUNT(DISTINCT ms.id) AS total_sessions,
      COUNT(DISTINCT mat.session_id) FILTER (WHERE mat.status = 'present') AS attended_sessions,
      (
        SELECT r.gpa FROM results r
        LEFT JOIN academic_years ay ON ay.id = r.academic_year_id
        WHERE r.student_id = u.id AND r.published = true
        ORDER BY ay.start_date DESC NULLS LAST LIMIT 1
      ) AS latest_gpa
    FROM class_mentor_assignments cma
    JOIN users u ON u.id = cma.student_id
    LEFT JOIN mentor_sessions ms    ON ms.subject_id = cma.subject_id AND ms.mentor_id = $1
    LEFT JOIN mentor_attendance mat ON mat.session_id = ms.id AND mat.student_id = u.id
    WHERE cma.mentor_id = $1
    GROUP BY u.id
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
  if (student_id && !(await isMyStudent(req.user.id, student_id))) {
    return res.status(403).json({ error: 'Student not assigned to you' });
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

// ── Mentor classes (subjects the mentor is assigned to) ───────────────────

export async function getMentorSubjects(req, res) {
  const r = await query(`
    SELECT DISTINCT s.id, s.code, s.name,
      s.academic_year_id, ay.label AS academic_year_label,
      COUNT(DISTINCT cma.student_id) AS student_count
    FROM class_mentor_assignments cma
    JOIN subjects s ON s.id = cma.subject_id
    LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
    WHERE cma.mentor_id = $1
    GROUP BY s.id, ay.label
    ORDER BY s.name`,
    [req.user.id]
  );
  res.json(r.rows);
}

// Students the mentor mentors within a given subject
export async function getMentorSubjectStudents(req, res) {
  const { subject_id } = req.params;
  const r = await query(`
    SELECT u.id, u.name, u.email, u.roll_number
    FROM class_mentor_assignments cma
    JOIN users u ON u.id = cma.student_id
    WHERE cma.mentor_id = $1 AND cma.subject_id = $2
    ORDER BY u.name`,
    [req.user.id, subject_id]
  );
  res.json(r.rows);
}

// ── Mentor weekly sessions ────────────────────────────────────────────────

export async function createMentorSession(req, res) {
  const { subject_id, title, session_date } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id required' });
  // Verify the mentor actually mentors students in this subject
  const owns = await query(
    'SELECT 1 FROM class_mentor_assignments WHERE mentor_id=$1 AND subject_id=$2 LIMIT 1',
    [req.user.id, subject_id]
  );
  if (!owns.rows.length) return res.status(403).json({ error: 'You are not a mentor for this class' });
  const r = await query(
    `INSERT INTO mentor_sessions (id, subject_id, mentor_id, title, session_date)
     VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE)) RETURNING *`,
    [uuidv4(), subject_id, req.user.id, title || null, session_date || null]
  );
  res.status(201).json(r.rows[0]);
}

export async function getMentorSessions(req, res) {
  const { subject_id } = req.query;
  const params = [req.user.id];
  const clause = subject_id ? `AND ms.subject_id=$${params.push(subject_id)}` : '';
  const r = await query(`
    SELECT ms.*, s.code AS subject_code, s.name AS subject_name,
      COUNT(mat.id) FILTER (WHERE mat.status='present') AS present_count,
      COUNT(mat.id) FILTER (WHERE mat.status='absent')  AS absent_count
    FROM mentor_sessions ms
    JOIN subjects s ON s.id = ms.subject_id
    LEFT JOIN mentor_attendance mat ON mat.session_id = ms.id
    WHERE ms.mentor_id=$1 ${clause}
    GROUP BY ms.id, s.code, s.name
    ORDER BY ms.session_date DESC, ms.created_at DESC`,
    params
  );
  res.json(r.rows);
}

// Attendance roster for one session (mentor's students in that subject + their marks)
export async function getMentorSessionAttendance(req, res) {
  const { id } = req.params;
  const sess = await query('SELECT * FROM mentor_sessions WHERE id=$1 AND mentor_id=$2', [id, req.user.id]);
  if (!sess.rows.length) return res.status(404).json({ error: 'Session not found' });
  const session = sess.rows[0];
  const r = await query(`
    SELECT u.id, u.name, u.roll_number, mat.status
    FROM class_mentor_assignments cma
    JOIN users u ON u.id = cma.student_id
    LEFT JOIN mentor_attendance mat ON mat.session_id = $1 AND mat.student_id = u.id
    WHERE cma.mentor_id = $2 AND cma.subject_id = $3
    ORDER BY u.name`,
    [id, req.user.id, session.subject_id]
  );
  res.json({ session, roster: r.rows });
}

// Open a code-based (PIN) attendance session — students submit the PIN to mark present.
export async function openMentorCodeSession(req, res) {
  const { subject_id, title, session_date } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id required' });
  const owns = await query(
    'SELECT 1 FROM class_mentor_assignments WHERE mentor_id=$1 AND subject_id=$2 LIMIT 1',
    [req.user.id, subject_id]
  );
  if (!owns.rows.length) return res.status(403).json({ error: 'You are not a mentor for this class' });

  const { pin } = generatePin(subject_id, req.user.id);
  const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5-minute window
  const id = uuidv4();
  await query(
    `INSERT INTO mentor_sessions (id, subject_id, mentor_id, title, session_date, pin_display, expires_at, closed)
     VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE),$6,$7,false)`,
    [id, subject_id, req.user.id, title || 'Code attendance', session_date || null, pin, expires_at.toISOString()]
  );
  res.status(201).json({ session_id: id, pin, expires_at });
}

export async function closeMentorCodeSession(req, res) {
  const { id } = req.params;
  const r = await query(
    'UPDATE mentor_sessions SET closed=true WHERE id=$1 AND mentor_id=$2 RETURNING id',
    [id, req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Session not found' });
  res.json({ message: 'Closed' });
}

// Bulk upsert manual attendance for a session
export async function markMentorAttendance(req, res) {
  const { id } = req.params;
  const { entries } = req.body; // [{ student_id, status: 'present'|'absent' }]
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
  const sess = await query('SELECT id FROM mentor_sessions WHERE id=$1 AND mentor_id=$2', [id, req.user.id]);
  if (!sess.rows.length) return res.status(404).json({ error: 'Session not found' });

  let saved = 0;
  for (const e of entries) {
    if (!e.student_id) continue;
    const status = e.status === 'absent' ? 'absent' : 'present';
    await query(
      `INSERT INTO mentor_attendance (id, session_id, student_id, status)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (session_id, student_id) DO UPDATE SET status=$4, marked_at=NOW()`,
      [uuidv4(), id, e.student_id, status]
    );
    saved++;
  }
  res.json({ saved });
}

// ── Mentor defaulters (based on mentor-class attendance) ──────────────────

export async function getMentorDefaulters(req, res) {
  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const { subject_id } = req.query;
  const params = [req.user.id];
  const clause = subject_id ? `AND cma.subject_id=$${params.push(subject_id)}` : '';

  const r = await query(`
    SELECT u.id, u.name, u.email, u.roll_number,
      STRING_AGG(DISTINCT s.code, ', ') AS subject_codes,
      COUNT(DISTINCT ms.id) AS total_sessions,
      COUNT(DISTINCT mat.session_id) FILTER (WHERE mat.status='present') AS attended_sessions
    FROM class_mentor_assignments cma
    JOIN users u    ON u.id = cma.student_id
    JOIN subjects s ON s.id = cma.subject_id
    LEFT JOIN mentor_sessions ms    ON ms.subject_id = cma.subject_id AND ms.mentor_id = $1
    LEFT JOIN mentor_attendance mat ON mat.session_id = ms.id AND mat.student_id = u.id
    WHERE cma.mentor_id = $1 ${clause}
    GROUP BY u.id
    ORDER BY u.name`,
    params
  );

  const defaulters = r.rows
    .map(s => {
      const pct = s.total_sessions > 0 ? Math.round(s.attended_sessions / s.total_sessions * 100) : 0;
      return { ...s, attendance_percentage: pct };
    })
    .filter(s => s.total_sessions > 0 && s.attendance_percentage < threshold);

  res.json({ threshold, defaulters });
}

// ── Student detail tabs (Overview / Attendance / Marks / Counseling / Contacts / Leave) ──

export async function getStudentOverview(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });

  const settingsR = await query('SELECT min_attendance_threshold, mentor_alert_gpa_threshold FROM institution_settings LIMIT 1');
  const attThreshold = settingsR.rows[0]?.min_attendance_threshold || 75;
  const gpaThreshold = settingsR.rows[0]?.mentor_alert_gpa_threshold || 5.0;

  const userR = await query('SELECT name, email, roll_number FROM users WHERE id=$1', [student_id]);
  if (!userR.rows.length) return res.status(404).json({ error: 'Student not found' });
  const user = userR.rows[0];

  const courseR = await query(`
    SELECT STRING_AGG(DISTINCT c.name, ', ') AS course_name
    FROM class_enrollments ce
    JOIN subjects s ON s.id = ce.subject_id
    JOIN courses c ON c.id = s.course_id
    WHERE ce.student_id = $1
  `, [student_id]);

  const attR = await query(`
    SELECT
      COUNT(DISTINCT sess.id) AS total,
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended
    FROM class_enrollments ce
    JOIN sessions sess ON sess.subject_id = ce.subject_id AND sess.closed = true
    LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
    WHERE ce.student_id = $1
  `, [student_id]);
  const total = Number(attR.rows[0]?.total) || 0;
  const attended = Number(attR.rows[0]?.attended) || 0;
  const attendance_pct = total > 0 ? Math.round(attended / total * 1000) / 10 : 0;

  const resR = await query(`
    SELECT r.gpa, r.cgpa, r.rank, r.academic_year_id, r.course_id
    FROM results r LEFT JOIN academic_years ay ON ay.id = r.academic_year_id
    WHERE r.student_id = $1 AND r.published = true
    ORDER BY ay.start_date DESC NULLS LAST LIMIT 1
  `, [student_id]);
  const result = resR.rows[0] || {};
  let total_students = null;
  if (result.academic_year_id && result.course_id) {
    const tsR = await query('SELECT COUNT(*)::int AS n FROM results WHERE academic_year_id=$1 AND course_id=$2', [result.academic_year_id, result.course_id]);
    total_students = tsR.rows[0].n;
  }

  const alert_reasons = [];
  if (total > 0 && attendance_pct < attThreshold) alert_reasons.push(`Attendance ${attendance_pct}% < ${attThreshold}%`);
  if (result.gpa != null && Number(result.gpa) < gpaThreshold) alert_reasons.push(`GPA ${result.gpa} < ${gpaThreshold}`);

  res.json({
    name: user.name, email: user.email, roll_number: user.roll_number,
    course_name: courseR.rows[0]?.course_name || null,
    attendance_pct,
    latest_gpa: result.gpa ?? null,
    cgpa: result.cgpa ?? null,
    rank: result.rank ?? null,
    total_students,
    alert_reasons,
  });
}

export async function getStudentAttendanceDetail(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(`
    SELECT s.code AS subject_code, s.name AS subject_name,
      COUNT(DISTINCT sess.id) AS total,
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended,
      CASE WHEN COUNT(DISTINCT sess.id) > 0
        THEN ROUND(COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
             / COUNT(DISTINCT sess.id) * 100, 1)
        ELSE 0 END AS percentage
    FROM subjects s
    JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.student_id = $1
    LEFT JOIN sessions sess ON sess.subject_id = s.id AND sess.closed = true
    LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
    GROUP BY s.id
    ORDER BY s.name
  `, [student_id]);
  res.json(r.rows);
}

export async function getStudentMarksDetail(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const settingsR = await query('SELECT grade_boundaries FROM institution_settings LIMIT 1');
  const gb = settingsR.rows[0]?.grade_boundaries || { S:90, A:80, B:70, C:60, D:50, F:0 };
  // Individual assessment rows so the UI can show the OBE/CBE/Sloka breakdown.
  const r = await query(`
    SELECT ay.id AS year_id, ay.label AS year_label, ay.start_date,
           s.id AS subject_id, s.code, s.name,
           m.semester_no, m.assessment_type, m.scored_marks, m.max_marks, m.assessed_on
    FROM marks m
    JOIN subjects s ON s.id = m.subject_id
    LEFT JOIN academic_years ay ON ay.id = m.academic_year_id
    WHERE m.student_id = $1
    ORDER BY ay.start_date DESC NULLS LAST, m.semester_no, s.name, m.assessment_type
  `, [student_id]);

  const yearMap = {};
  for (const row of r.rows) {
    const sem = row.semester_no || 1;
    const yKey = `${row.year_id || 'none'}|${sem}`;
    if (!yearMap[yKey]) {
      const yl = row.year_label ? ` · ${row.year_label}` : '';
      yearMap[yKey] = { label: `Semester ${sem}${yl}`, _subjects: {} };
    }
    const sKey = row.subject_id;
    if (!yearMap[yKey]._subjects[sKey]) {
      yearMap[yKey]._subjects[sKey] = {
        code: row.code, name: row.name,
        assessments: [], total_scored: 0, total_max: 0,
      };
    }
    const subj = yearMap[yKey]._subjects[sKey];
    subj.assessments.push({
      type: row.assessment_type,
      scored: Number(row.scored_marks),
      max: Number(row.max_marks),
      assessed_on: row.assessed_on,
    });
    subj.total_scored += Number(row.scored_marks);
    subj.total_max += Number(row.max_marks);
  }

  const semesters = Object.values(yearMap).map(y => ({
    label: y.label,
    subjects: Object.values(y._subjects).map(s => {
      const pct = s.total_max > 0 ? Math.round(s.total_scored / s.total_max * 1000) / 10 : null;
      return {
        code: s.code, name: s.name,
        assessments: s.assessments,
        total_marks: s.total_scored,
        max_marks: s.total_max,
        percentage: pct,
        grade: pct != null ? calculateGrade(pct, gb) : null,
      };
    }),
  }));
  res.json({ semesters });
}

export async function getStudentCounseling(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(`
    SELECT cn.id, cn.note, cn.meeting_date AS created_at, m.name AS created_by_name
    FROM counseling_notes cn
    LEFT JOIN users m ON m.id = cn.mentor_id
    WHERE cn.student_id = $1 AND cn.mentor_id = $2
    ORDER BY cn.meeting_date DESC
  `, [student_id, req.user.id]);
  res.json(r.rows);
}

export async function addStudentCounseling(req, res) {
  const { student_id } = req.params;
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note required' });
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    'INSERT INTO counseling_notes (id, mentor_id, student_id, note, meeting_date) VALUES ($1,$2,$3,$4,CURRENT_DATE) RETURNING *',
    [uuidv4(), req.user.id, student_id, note]
  );
  res.status(201).json(r.rows[0]);
}

export async function getStudentContacts(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query('SELECT * FROM student_contacts WHERE student_id=$1 ORDER BY created_at DESC', [student_id]);
  res.json(r.rows);
}

export async function addStudentContact(req, res) {
  const { student_id } = req.params;
  const { name, relationship, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    `INSERT INTO student_contacts (id, student_id, name, relationship, phone, email, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [uuidv4(), student_id, name, relationship || null, phone || null, email || null, req.user.id]
  );
  res.status(201).json(r.rows[0]);
}

export async function deleteStudentContact(req, res) {
  const { student_id, contact_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  await query('DELETE FROM student_contacts WHERE id=$1 AND student_id=$2', [contact_id, student_id]);
  res.json({ message: 'Deleted' });
}

export async function getStudentLeaveRequests(req, res) {
  const { student_id } = req.params;
  if (!(await isMyStudent(req.user.id, student_id))) return res.status(403).json({ error: 'Student not assigned to you' });
  const r = await query(
    `SELECT id, from_date, to_date, reason, status, reviewed_at
     FROM leave_requests WHERE student_id=$1 ORDER BY from_date DESC`,
    [student_id]
  );
  res.json(r.rows);
}
