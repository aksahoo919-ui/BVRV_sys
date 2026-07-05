import { query } from '../config/db.js';
import redis from '../config/redis.js';
import { v4 as uuidv4 } from 'uuid';
import { generatePin } from '../utils/pin.js';
import { logAudit } from '../middleware/audit.js';

// ── Subjects ──────────────────────────────────────────────────────────────

export async function getSubjects(req, res) {
  const r = await query(`
    SELECT s.id, s.code, s.name, s.created_at,
      s.academic_year_id, s.course_id,
      ay.label AS academic_year_label, ay.is_current AS academic_year_is_current,
      c.name AS course_name, c.code AS course_code,
      COUNT(DISTINCT ce2.student_id) AS student_count,
      MAX(sess.opened_at) AS last_session_date
    FROM subjects s
    JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.instructor_id = $1
    LEFT JOIN class_enrollments ce2 ON ce2.subject_id = s.id AND ce2.student_id IS NOT NULL
    LEFT JOIN sessions sess ON sess.subject_id = s.id
    LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
    LEFT JOIN courses c ON c.id = s.course_id
    GROUP BY s.id, ay.label, ay.is_current, c.name, c.code
    ORDER BY s.name`,
    [req.user.id]
  );
  res.json(r.rows);
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function openSession(req, res) {
  const { subject_id } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id required' });

  const assigned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!assigned.rows.length) return res.status(403).json({ error: 'Not assigned to this subject' });

  // Close any existing open session for this subject
  const existing = await query(
    'UPDATE sessions SET closed=true WHERE subject_id=$1 AND closed=false AND expires_at>NOW() RETURNING pin_display',
    [subject_id]
  );
  // Clean up Redis keys for any closed sessions
  if (redis) {
    for (const row of existing.rows) {
      await redis.del(`active_pin:${row.pin_display}`).catch(() => {});
    }
  }

  // Generate numeric PIN, ensure uniqueness in Redis
  let { pin, tokenHash } = generatePin(subject_id, req.user.id);
  if (redis) {
    let attempts = 0;
    while (attempts < 10) {
      const taken = await redis.exists(`active_pin:${pin}`).catch(() => 0);
      if (!taken) break;
      // Increment within 100000–999999
      pin = String(((parseInt(pin) - 100000 + 1) % 900000) + 100000);
      attempts++;
    }
    if (attempts >= 10) {
      return res.status(503).json({ error: 'Could not generate unique PIN, please try again' });
    }
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // 3 min

  await query(
    `INSERT INTO sessions (id,subject_id,instructor_id,token_hash,pin_display,opened_at,expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sessionId, subject_id, req.user.id, tokenHash, pin, now, expiresAt]
  );

  // Register PIN in Redis with 5-min TTL
  if (redis) {
    await redis.set(`active_pin:${pin}`, sessionId, 'EX', 300).catch(() => {});
  }

  await logAudit(req.user.id, 'open_session', 'session', sessionId, { subject_id });
  res.status(201).json({ session_id: sessionId, pin_display: pin, expires_at: expiresAt });
}

export async function getLiveAttendance(req, res) {
  const r = await query(`
    SELECT al.id, al.student_id, al.submitted_at, al.status, al.replayed,
           u.name, u.email, u.avatar_url
    FROM attendance_logs al JOIN users u ON u.id = al.student_id
    WHERE al.session_id=$1 ORDER BY al.submitted_at`,
    [req.params.id]
  );
  res.json(r.rows);
}

export async function closeSession(req, res) {
  const r = await query(
    'UPDATE sessions SET closed=true WHERE id=$1 AND instructor_id=$2 RETURNING *',
    [req.params.id, req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, 'close_session', 'session', req.params.id);

  const pinDisplay = r.rows[0].pin_display;
  if (redis && pinDisplay) {
    await redis.del(`active_pin:${pinDisplay}`).catch(() => {});
  }

  // Fire-and-forget: check each enrolled student's attendance and alert if below threshold
  _checkAttendanceAlerts(r.rows[0]).catch(err =>
    console.warn('[attendance alert]', err.message)
  );

  res.json(r.rows[0]);
}

async function _checkAttendanceAlerts(session) {
  const { emailAttendanceAlert } = await import('../services/emailService.js');

  const settingsR = await query(
    'SELECT min_attendance_threshold FROM institution_settings LIMIT 1'
  );
  const threshold = Number(settingsR.rows[0]?.min_attendance_threshold) || 75;

  // All students enrolled in this subject
  const studentsR = await query(`
    SELECT u.id, u.name, u.email
    FROM class_enrollments ce
    JOIN users u ON u.id = ce.student_id
    WHERE ce.subject_id = $1 AND u.role = 'student'
  `, [session.subject_id]);

  // Subject name (fetch once)
  const subjR = await query('SELECT name FROM subjects WHERE id=$1', [session.subject_id]);
  const subjectName = subjR.rows[0]?.name || 'Unknown Subject';

  for (const student of studentsR.rows) {
    const attR = await query(`
      SELECT
        COUNT(DISTINCT sess.id)                                                                   AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)   AS attended
      FROM sessions sess
      LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
      WHERE sess.subject_id = $2 AND sess.closed = true
    `, [student.id, session.subject_id]);

    const tot = Number(attR.rows[0]?.total_sessions || 0);
    const att = Number(attR.rows[0]?.attended || 0);
    if (tot < 1) continue;

    const pct = Math.round(att / tot * 100);
    if (pct >= threshold) continue; // OK — no alert

    // Look up assigned BV Leader for this subject
    const mentorR = await query(`
      SELECT u.name, u.email
      FROM class_mentor_assignments cma
      JOIN users u ON u.id = cma.mentor_id
      WHERE cma.student_id = $1 AND cma.subject_id = $2
    `, [student.id, session.subject_id]);
    const mentor = mentorR.rows[0];

    await emailAttendanceAlert({
      studentName:  student.name,
      subjectName,
      percentage:   pct,
      threshold,
      mentorEmail:  mentor?.email,
      mentorName:   mentor?.name,
    });
  }
}

export async function overrideAttendance(req, res) {
  const { status } = req.body;
  if (!['present','late','flagged'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(
    `UPDATE attendance_logs al SET status=$1
     FROM sessions sess WHERE al.id=$2 AND al.session_id=sess.id AND sess.instructor_id=$3 RETURNING al.*`,
    [status, req.params.log_id, req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

// ── Reports ───────────────────────────────────────────────────────────────

export async function getSubjectReport(req, res) {
  const { subject_id } = req.params;
  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not authorized' });

  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const r = await query(`
    SELECT u.id, u.name, u.email, u.avatar_url,
      COUNT(DISTINCT sess.id) AS total_sessions,
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended,
      CASE WHEN COUNT(DISTINCT sess.id)>0
        THEN ROUND((COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
             / COUNT(DISTINCT sess.id))*100,1)
        ELSE 0 END AS percentage
    FROM users u
    JOIN class_enrollments ce ON ce.student_id=u.id AND ce.subject_id=$1
    LEFT JOIN sessions sess ON sess.subject_id=$1 AND sess.closed=true
    LEFT JOIN attendance_logs al ON al.session_id=sess.id AND al.student_id=u.id
    WHERE u.role='student'
    GROUP BY u.id ORDER BY u.name`,
    [subject_id]
  );
  res.json(r.rows.map(r => ({ ...r, below_threshold: Number(r.percentage) < threshold })));
}

// ── Messages (existing — kept for backwards compat) ───────────────────────

export async function sendMessage(req, res) {
  const { subject_id, body } = req.body;
  if (!subject_id || !body) return res.status(400).json({ error: 'subject_id and body required' });
  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not assigned to this subject' });
  const r = await query(
    `INSERT INTO messages (id,sender_id,subject_id,body,audience) VALUES ($1,$2,$3,$4,'class_students') RETURNING *`,
    [uuidv4(), req.user.id, subject_id, body]
  );
  res.status(201).json(r.rows[0]);
}

// ── Timetable ─────────────────────────────────────────────────────────────

export async function getTimetable(req, res) {
  const r = await query(`
    SELECT ts.*, s.name AS subject_name, s.code AS subject_code
    FROM timetable_slots ts JOIN subjects s ON s.id=ts.subject_id
    WHERE ts.teacher_id=$1 ORDER BY ts.day_of_week, ts.start_time`,
    [req.user.id]
  );
  res.json(r.rows);
}

// ── Marks ─────────────────────────────────────────────────────────────────

export async function uploadMarks(req, res) {
  // Body: { subject_id, assessment_type, max_marks, assessed_on?, entries: [{student_id, scored_marks}] }
  // The academic year is derived from the subject itself, NOT the client, so marks
  // always belong to the subject's own academic year (prevents cross-year mixing).
  const { subject_id, assessment_type, max_marks, assessed_on, entries } = req.body;
  const semester_no = [1, 2].includes(Number(req.body.semester)) ? Number(req.body.semester) : 1;
  if (!subject_id || !assessment_type || !max_marks || !Array.isArray(entries))
    return res.status(400).json({ error: 'Missing required fields' });

  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });

  // Resolve the subject's academic year (fall back to the client value if unset)
  const subjRow = await query('SELECT academic_year_id FROM subjects WHERE id=$1', [subject_id]);
  const academic_year_id = subjRow.rows[0]?.academic_year_id || req.body.academic_year_id;
  if (!academic_year_id)
    return res.status(400).json({ error: 'This subject has no academic year set. Ask an admin to assign one.' });

  let inserted = 0;
  for (const e of entries) {
    if (!e.student_id || e.scored_marks == null) continue;
    await query(
      `INSERT INTO marks (id,student_id,subject_id,academic_year_id,semester_no,assessment_type,max_marks,scored_marks,assessed_on,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_id,subject_id,academic_year_id,semester_no,assessment_type)
       DO UPDATE SET scored_marks=$8, max_marks=$7, assessed_on=$9, uploaded_by=$10, uploaded_at=NOW()`,
      [uuidv4(), e.student_id, subject_id, academic_year_id, semester_no, assessment_type, max_marks, e.scored_marks, assessed_on || null, req.user.id]
    );
    inserted++;
  }
  await logAudit(req.user.id, 'upload_marks', 'marks', null, { subject_id, academic_year_id, semester_no, assessment_type, count: inserted });
  res.json({ saved: inserted });
}

export async function getMarksForSubject(req, res) {
  const { subject_id } = req.params;
  const { academic_year_id, semester_id } = req.query;
  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });

  const params = [subject_id];
  let filterClause = '';
  if (academic_year_id) {
    filterClause = `AND m.academic_year_id=$${params.push(academic_year_id)}`;
  } else if (semester_id) {
    filterClause = `AND m.semester_id=$${params.push(semester_id)}`;
  }
  const r = await query(`
    SELECT m.*, u.name AS student_name, u.email AS student_email, u.roll_number
    FROM marks m JOIN users u ON u.id=m.student_id
    WHERE m.subject_id=$1 ${filterClause}
    ORDER BY m.assessment_type, u.name`,
    params
  );
  res.json(r.rows);
}

// ── Leave Requests (teacher reviews for their class students) ─────────────

export async function getLeaveRequestsForMySubjects(req, res) {
  const { status } = req.query;
  const statusClause = status ? 'AND lr.status=$2' : '';
  const params = [req.user.id];
  if (status) params.push(status);
  const r = await query(`
    SELECT DISTINCT lr.*, u.name AS student_name, u.email AS student_email,
           rev.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN users u ON u.id=lr.student_id
    LEFT JOIN users rev ON rev.id=lr.reviewed_by
    WHERE u.id IN (
      SELECT DISTINCT ce.student_id FROM class_enrollments ce
      WHERE ce.instructor_id=$1 AND ce.student_id IS NOT NULL
    ) ${statusClause}
    ORDER BY lr.created_at DESC`,
    params
  );
  res.json(r.rows);
}

export async function reviewLeaveRequest(req, res) {
  const { status } = req.body;
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(
    'UPDATE leave_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3 RETURNING *',
    [status, req.user.id, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, `leave_${status}`, 'leave_request', req.params.id);
  res.json(r.rows[0]);
}

// ── Attendance Corrections ─────────────────────────────────────────────────

export async function requestAttendanceCorrection(req, res) {
  const { session_id, student_id, original_status, requested_status, reason } = req.body;
  if (!session_id || !student_id || !original_status || !requested_status || !reason)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const r = await query(
      `INSERT INTO attendance_corrections (id,session_id,student_id,requested_by,original_status,requested_status,reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), session_id, student_id, req.user.id, original_status, requested_status, reason]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Correction already requested for this student/session' });
    throw err;
  }
}

export async function getMyCorrectionRequests(req, res) {
  const r = await query(`
    SELECT ac.*, u.name AS student_name, sess.opened_at AS session_date, sub.name AS subject_name
    FROM attendance_corrections ac
    JOIN users u ON u.id=ac.student_id
    JOIN sessions sess ON sess.id=ac.session_id
    JOIN subjects sub ON sub.id=sess.subject_id
    WHERE ac.requested_by=$1 ORDER BY ac.created_at DESC`,
    [req.user.id]
  );
  res.json(r.rows);
}

// ── Edit a single mark entry ──────────────────────────────────────────────

export async function editMark(req, res) {
  const { scored_marks, max_marks } = req.body;
  if (scored_marks == null) return res.status(400).json({ error: 'scored_marks required' });

  // Verify the mark belongs to a subject this teacher teaches
  const r = await query(`
    UPDATE marks SET
      scored_marks = $1,
      max_marks    = COALESCE($2, max_marks),
      uploaded_by  = $3,
      uploaded_at  = NOW()
    FROM class_enrollments ce
    WHERE marks.id = $4
      AND marks.subject_id = ce.subject_id
      AND ce.instructor_id = $3
    RETURNING marks.*`,
    [scored_marks, max_marks ?? null, req.user.id, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Mark not found or not authorized' });
  await logAudit(req.user.id, 'edit_mark', 'marks', req.params.id, { scored_marks });
  res.json(r.rows[0]);
}

// ── Manual attendance marking (roster, no PIN) ────────────────────────────

export async function markAttendanceManual(req, res) {
  // Body: { subject_id, session_date?, entries: [{ student_id, status: 'present'|'absent' }] }
  const { subject_id, session_date, entries } = req.body;
  if (!subject_id || !Array.isArray(entries))
    return res.status(400).json({ error: 'subject_id and entries are required' });

  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });

  // Create a closed, manual session to anchor the logs.
  const sessionId = uuidv4();
  const opened = session_date ? new Date(session_date) : new Date();
  await query(
    `INSERT INTO sessions (id, subject_id, instructor_id, token_hash, pin_display, opened_at, expires_at, closed, manual)
     VALUES ($1,$2,$3,'manual','MANUAL',$4,$4,true,true)`,
    [sessionId, subject_id, req.user.id, opened.toISOString()]
  );

  // Only present students get a log row (absence stays implicit, matching the rest of the app).
  let present = 0, absent = 0;
  for (const e of entries) {
    if (!e.student_id) continue;
    if (e.status === 'absent') { absent++; continue; }
    await query(
      `INSERT INTO attendance_logs (id, session_id, student_id, status, replayed)
       VALUES ($1,$2,$3,'present',false)
       ON CONFLICT (session_id, student_id) DO NOTHING`,
      [uuidv4(), sessionId, e.student_id]
    );
    present++;
  }
  await logAudit(req.user.id, 'mark_attendance_manual', 'session', sessionId, { subject_id, present, absent });
  res.status(201).json({ session_id: sessionId, present, absent });
}

// ── Student performance per subject ──────────────────────────────────────

export async function getStudentPerformance(req, res) {
  const { subject_id } = req.params;
  const { academic_year_id, semester_id } = req.query;

  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });

  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const params = [subject_id];
  let semClause = '';
  if (academic_year_id) {
    semClause = `AND m.academic_year_id = $${params.push(academic_year_id)}`;
  } else if (semester_id) {
    semClause = `AND m.semester_id = $${params.push(semester_id)}`;
  }

  const r = await query(`
    SELECT
      u.id, u.name, u.email, u.roll_number,
      -- Assigned BV Leader for this subject
      mu.name AS current_mentor_name,
      cma.mentor_id AS current_mentor_id,
      -- Attendance
      COUNT(DISTINCT sess.id)                                                                    AS total_sessions,
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)    AS attended,
      CASE WHEN COUNT(DISTINCT sess.id) > 0
        THEN ROUND(COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
             / COUNT(DISTINCT sess.id) * 100, 1)
        ELSE 0 END                                                                               AS attendance_pct,
      -- Marks aggregate (across all assessment types)
      COALESCE(SUM(m.scored_marks), 0)                                                           AS total_scored,
      COALESCE(SUM(m.max_marks), 0)                                                              AS total_max
    FROM users u
    JOIN class_enrollments ce ON ce.student_id = u.id AND ce.subject_id = $1
    LEFT JOIN class_mentor_assignments cma ON cma.student_id = u.id AND cma.subject_id = $1
    LEFT JOIN users mu ON mu.id = cma.mentor_id
    LEFT JOIN sessions sess ON sess.subject_id = $1 AND sess.closed = true
    LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = u.id
    LEFT JOIN marks m ON m.student_id = u.id AND m.subject_id = $1 ${semClause}
    WHERE u.role = 'student'
    GROUP BY u.id, mu.name, cma.mentor_id
    ORDER BY u.name
  `, params);

  res.json(r.rows.map(s => ({
    ...s,
    below_threshold: Number(s.attendance_pct) < threshold,
    marks_percentage: s.total_max > 0
      ? Math.round(s.total_scored / s.total_max * 100)
      : null,
  })));
}

// ── Academic Years ────────────────────────────────────────────────────────

export async function getAcademicYears(req, res) {
  try {
    const r = await query(
      `SELECT id, label, start_date, end_date, is_current
       FROM academic_years ORDER BY start_date DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Mentors ───────────────────────────────────────────────────────────────

export async function getMentors(req, res) {
  try {
    const r = await query(
      `SELECT id, name, email, avatar_url
       FROM users WHERE role = 'mentor' AND status = 'active'
       ORDER BY name`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Assign Mentor to Student ──────────────────────────────────────────────

export async function assignMentorToStudent(req, res) {
  const { student_id } = req.params;
  const { mentor_id, subject_id } = req.body;
  if (!mentor_id || !subject_id) return res.status(400).json({ error: 'mentor_id and subject_id required' });
  try {
    // Verify student is enrolled in this teacher's subject
    const check = await query(
      `SELECT 1 FROM class_enrollments ce
       WHERE ce.student_id = $1 AND ce.subject_id = $2 AND ce.instructor_id = $3
       LIMIT 1`,
      [student_id, subject_id, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Student not in your class' });

    await query(
      `INSERT INTO class_mentor_assignments (subject_id, mentor_id, student_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (subject_id, student_id) DO UPDATE SET mentor_id = $2, assigned_at = NOW()`,
      [subject_id, mentor_id, student_id]
    );
    await logAudit(req.user.id, 'assign_mentor', 'class_mentor_assignment', student_id);
    res.json({ message: 'BV Leader assigned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Active & Recent Sessions ──────────────────────────────────────────────

// GET /api/teacher/sessions/active
export async function getActiveSessions(req, res) {
  try {
    const r = await query(`
      SELECT sess.id AS session_id, sess.subject_id, s.name AS subject_name,
             s.code AS subject_code, sess.pin_display, sess.opened_at, sess.expires_at,
             COUNT(al.id) FILTER (WHERE al.status='present' AND al.replayed=false) AS present_count
      FROM sessions sess
      JOIN subjects s ON s.id = sess.subject_id
      LEFT JOIN attendance_logs al ON al.session_id = sess.id
      WHERE sess.instructor_id = $1 AND sess.closed = false AND sess.expires_at > NOW()
      GROUP BY sess.id, s.name, s.code
    `, [req.user.id]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/teacher/sessions/recent?limit=N
export async function getRecentSessions(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  try {
    const r = await query(`
      SELECT sess.id, sess.subject_id, s.name AS subject_name, s.code AS subject_code,
             sess.opened_at, sess.closed,
             COUNT(DISTINCT al.student_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS present_count,
             COUNT(DISTINCT ce.student_id) AS total_students
      FROM sessions sess
      JOIN subjects s ON s.id = sess.subject_id
      LEFT JOIN attendance_logs al ON al.session_id = sess.id
      LEFT JOIN class_enrollments ce ON ce.subject_id = sess.subject_id AND ce.student_id IS NOT NULL
      WHERE sess.instructor_id = $1
      GROUP BY sess.id, s.name, s.code
      ORDER BY sess.opened_at DESC
      LIMIT $2
    `, [req.user.id, limit]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Defaulter report ─────────────────────────────────────────────────────

export async function getDefaulters(req, res) {
  const { subject_id } = req.params;

  const owned = await query(
    'SELECT id FROM class_enrollments WHERE subject_id=$1 AND instructor_id=$2',
    [subject_id, req.user.id]
  );
  if (!owned.rows.length) return res.status(403).json({ error: 'Not your subject' });

  const settingsR = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  const threshold = settingsR.rows[0]?.min_attendance_threshold || 75;

  const r = await query(`
    SELECT
      u.id, u.name, u.email, u.roll_number,
      COUNT(DISTINCT sess.id)                                                                  AS total_sessions,
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)  AS attended,
      ROUND(
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
        / NULLIF(COUNT(DISTINCT sess.id), 0) * 100, 1
      )                                                                                        AS percentage
    FROM users u
    JOIN class_enrollments ce ON ce.student_id = u.id AND ce.subject_id = $1
    LEFT JOIN sessions sess ON sess.subject_id = $1 AND sess.closed = true
    LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = u.id
    WHERE u.role = 'student'
    GROUP BY u.id
    HAVING ROUND(
      COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false)::numeric
      / NULLIF(COUNT(DISTINCT sess.id), 0) * 100, 1
    ) < $2 OR COUNT(DISTINCT sess.id) = 0
    ORDER BY percentage NULLS FIRST, u.name
  `, [subject_id, threshold]);

  res.json({ threshold, defaulters: r.rows });
}
