import { query, pool } from '../config/db.js';
import { logAudit } from '../middleware/audit.js';
import { setLeader } from './adminSemesters.js';
import { applyClassChange } from './adminStudentClasses.js';

// ── Attendance history + profile change requests ─────────────────────────
// History: every class the student has been in (all semesters) with each class
// day and whether they attended, plus their BV Leader class days. Used by the
// student's "My Attendance" page and by the admin student Timeline.
// Requests: a student asks for a BV Leader or course change from their profile;
// nothing changes until an admin approves it.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_BY_RANK = ['present', 'service', 'absent'];

async function threshold() {
  const r = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
  return Number(r.rows[0]?.min_attendance_threshold) || 75;
}

function summarise(days) {
  const total = days.length;
  const attended = days.filter(d => d.status !== 'absent').length;
  return { total_days: total, attended, percentage: total ? Math.round(attended / total * 1000) / 10 : null };
}

// Classes the student is in, plus classes they left but have attendance in
// (a course change keeps the old class's attendance; those show as "Left").
export async function attendanceHistory(studentId) {
  const classes = (await query(`
    SELECT s.id AS subject_id, s.code, s.name AS class_name, c.name AS course_name,
      EXISTS (SELECT 1 FROM class_enrollments e WHERE e.subject_id = s.id AND e.student_id = $1) AS enrolled,
      COALESCE(sem.label, 'Sem ' || sem.number) AS semester_label,
      to_char(sem.start_date, 'YYYY-MM-DD') AS start_date, to_char(sem.end_date, 'YYYY-MM-DD') AS end_date,
      (sem.id IS NULL OR sem.is_current) AS is_current,
      (SELECT STRING_AGG(t.name, ', ' ORDER BY t.name) FROM class_enrollments te JOIN users t ON t.id = te.instructor_id
        WHERE te.subject_id = s.id) AS teachers
    FROM subjects s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.id IN (SELECT subject_id FROM class_enrollments WHERE student_id = $1
                   UNION SELECT x.subject_id FROM sessions x JOIN attendance_logs a ON a.session_id = x.id WHERE a.student_id = $1)
    ORDER BY sem.start_date DESC NULLS LAST, c.name, s.code`, [studentId])).rows;

  // One row per class day; several sessions on a day count once (best status wins).
  const days = (await query(`
    SELECT x.subject_id, to_char(x.session_date, 'YYYY-MM-DD') AS date,
      MIN(CASE WHEN a.replayed = false AND a.status = 'present' THEN 0
               WHEN a.replayed = false AND a.status = 'service' THEN 1 ELSE 2 END) AS rank,
      BOOL_OR(a.id IS NOT NULL) AS marked
    FROM sessions x
    LEFT JOIN attendance_logs a ON a.session_id = x.id AND a.student_id = $1
    WHERE x.subject_id = ANY($2::uuid[]) AND x.closed = true AND x.session_date IS NOT NULL
    GROUP BY x.subject_id, x.session_date
    ORDER BY x.session_date`, [studentId, classes.map(c => c.subject_id)])).rows;

  const bySubject = {};
  for (const d of days) (bySubject[d.subject_id] ||= []).push({ date: d.date, status: STATUS_BY_RANK[d.rank], marked: d.marked });
  const classRows = classes.map(c => {
    let list = bySubject[c.subject_id] || [];
    if (!c.enrolled) {
      // left this class: count its days only up to the last day they were marked in it
      const last = list.filter(d => d.marked).pop()?.date;
      list = last ? list.filter(d => d.date <= last) : [];
    }
    list = list.map(({ date, status }) => ({ date, status }));
    return { ...c, ...summarise(list), days: list };
  });

  // BV Leader classes (kept apart from course classes, same rule as /student/bv-attendance)
  const leaders = (await query(`
    SELECT DISTINCT u.id AS mentor_id, u.name AS mentor_name
    FROM class_mentor_assignments cma JOIN users u ON u.id = cma.mentor_id
    WHERE cma.student_id = $1 ORDER BY u.name`, [studentId])).rows;
  const leaderRows = [];
  for (const l of leaders) {
    const r = await query(`
      SELECT to_char(ms.session_date, 'YYYY-MM-DD') AS date,
        MIN(CASE mat.status WHEN 'present' THEN 0 WHEN 'service' THEN 1 ELSE 2 END) AS rank
      FROM mentor_sessions ms
      LEFT JOIN mentor_attendance mat ON mat.session_id = ms.id AND mat.student_id = $2
      WHERE ms.mentor_id = $1
      GROUP BY ms.session_date
      ORDER BY ms.session_date`, [l.mentor_id, studentId]);
    const list = r.rows.map(d => ({ date: d.date, status: STATUS_BY_RANK[d.rank] }));
    leaderRows.push({ ...l, ...summarise(list), days: list });
  }
  return { threshold: await threshold(), classes: classRows, bv_leader_classes: leaderRows };
}

// GET /student/attendance/history
async function getMyAttendanceHistory(req, res) {
  res.json(await attendanceHistory(req.user.id));
}

// GET /mentor/students/:student_id/attendance-history — only for the BV Leader's own students
async function getMentorStudentAttendanceHistory(req, res) {
  const { student_id } = req.params;
  if (!UUID_RE.test(student_id)) return res.status(400).json({ error: 'Invalid id' });
  const mine = await query('SELECT 1 FROM class_mentor_assignments WHERE mentor_id = $1 AND student_id = $2 LIMIT 1', [req.user.id, student_id]);
  if (!mine.rows.length) return res.status(403).json({ error: 'Student not assigned to you' });
  res.json(await attendanceHistory(student_id));
}

// GET /admin/users/:id/attendance-history
async function getUserAttendanceHistory(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  res.json(await attendanceHistory(req.params.id));
}

// ── Change requests: student side ─────────────────────────────────────────

const REQUEST_SELECT = `
  SELECT r.id, r.kind, r.status, r.note, r.admin_note, r.created_at, r.reviewed_at,
    r.student_id, st.name AS student_name, st.email AS student_email, st.phone AS student_phone,
    r.mentor_id, m.name AS mentor_name,
    r.from_subject_id, fs.code AS from_code, fc.name AS from_course,
    r.to_subject_id, ts.code AS to_code, tc.name AS to_course,
    rv.name AS reviewed_by_name,
    (SELECT STRING_AGG(DISTINCT cm.name, ' / ') FROM class_mentor_assignments cma JOIN users cm ON cm.id = cma.mentor_id
      LEFT JOIN subjects s2 ON s2.id = cma.subject_id LEFT JOIN semesters sem2 ON sem2.id = s2.semester_id
      WHERE cma.student_id = r.student_id AND (cma.subject_id IS NULL OR sem2.id IS NULL OR sem2.is_current)) AS current_leader
  FROM profile_change_requests r
  JOIN users st ON st.id = r.student_id
  LEFT JOIN users m ON m.id = r.mentor_id
  LEFT JOIN subjects fs ON fs.id = r.from_subject_id LEFT JOIN courses fc ON fc.id = fs.course_id
  LEFT JOIN subjects ts ON ts.id = r.to_subject_id LEFT JOIN courses tc ON tc.id = ts.course_id
  LEFT JOIN users rv ON rv.id = r.reviewed_by`;

const CURRENT_CLASSES_SQL = `
  SELECT s.id AS subject_id, s.code, c.name AS course_name, COALESCE(sem.label, 'Sem ' || sem.number) AS semester_label
  FROM subjects s
  LEFT JOIN courses c ON c.id = s.course_id
  LEFT JOIN semesters sem ON sem.id = s.semester_id
  WHERE (sem.id IS NULL OR sem.is_current)`;

// GET /student/change-requests — my requests + what I can pick from
async function getMyChangeRequests(req, res) {
  const id = req.user.id;
  const [requests, leaders, myClasses, classes, myLeader] = await Promise.all([
    query(`${REQUEST_SELECT} WHERE r.student_id = $1 ORDER BY r.created_at DESC`, [id]),
    query(`SELECT id, name FROM users WHERE (role = 'mentor' OR secondary_role = 'mentor') AND status = 'active' ORDER BY name`),
    query(`${CURRENT_CLASSES_SQL} AND s.id IN (SELECT subject_id FROM class_enrollments WHERE student_id = $1) ORDER BY c.name, s.code`, [id]),
    query(`${CURRENT_CLASSES_SQL} ORDER BY c.name, s.code`),
    query(`SELECT DISTINCT cma.mentor_id, m.name FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id
           LEFT JOIN subjects s ON s.id = cma.subject_id LEFT JOIN semesters sem ON sem.id = s.semester_id
           WHERE cma.student_id = $1 AND (cma.subject_id IS NULL OR sem.id IS NULL OR sem.is_current)`, [id]),
  ]);
  res.json({
    requests: requests.rows,
    leaders: leaders.rows,
    my_classes: myClasses.rows,
    classes: classes.rows,
    my_leaders: myLeader.rows,
  });
}

// POST /student/change-requests
//   { kind: 'bv_leader', mentor_id, note? }
//   { kind: 'course', from_subject_id?, to_subject_id, note? }
async function createChangeRequest(req, res) {
  const id = req.user.id;
  const { kind } = req.body;
  const note = String(req.body.note || '').trim().slice(0, 500) || null;
  let mentorId = null, from = null, to = null;

  if (kind === 'bv_leader') {
    mentorId = req.body.mentor_id;
    if (!UUID_RE.test(mentorId || '')) return res.status(400).json({ error: 'Pick a BV Leader' });
    if (!(await query(`SELECT 1 FROM users WHERE id = $1 AND (role = 'mentor' OR secondary_role = 'mentor') AND status = 'active'`, [mentorId])).rows.length)
      return res.status(400).json({ error: 'BV Leader not found' });
    const cur = (await query(`SELECT DISTINCT cma.mentor_id FROM class_mentor_assignments cma
      LEFT JOIN subjects s ON s.id = cma.subject_id LEFT JOIN semesters sem ON sem.id = s.semester_id
      WHERE cma.student_id = $1 AND (cma.subject_id IS NULL OR sem.id IS NULL OR sem.is_current)`, [id])).rows;
    if (cur.length === 1 && cur[0].mentor_id === mentorId) return res.status(400).json({ error: 'That is already your BV Leader' });
  } else if (kind === 'course') {
    from = req.body.from_subject_id || null;
    to = req.body.to_subject_id;
    if (!UUID_RE.test(to || '') || (from && !UUID_RE.test(from))) return res.status(400).json({ error: 'Pick a course' });
    if (from === to) return res.status(400).json({ error: 'That is the same course' });
    if (!(await query(`${CURRENT_CLASSES_SQL} AND s.id = $1`, [to])).rows.length)
      return res.status(400).json({ error: 'Pick a course of the current semester' });
    if ((await query('SELECT 1 FROM class_enrollments WHERE student_id = $1 AND subject_id = $2', [id, to])).rows.length)
      return res.status(400).json({ error: 'You are already in that course' });
    if (from && !(await query('SELECT 1 FROM class_enrollments WHERE student_id = $1 AND subject_id = $2', [id, from])).rows.length)
      return res.status(400).json({ error: 'You are not in the course you want to leave' });
  } else {
    return res.status(400).json({ error: 'Unknown request type' });
  }

  try {
    const r = await query(
      `INSERT INTO profile_change_requests (student_id, kind, mentor_id, from_subject_id, to_subject_id, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [id, kind, mentorId, from, to, note]);
    await logAudit(id, 'request_change', 'profile_change_request', r.rows[0].id, { kind, mentor_id: mentorId, from, to });
    res.status(201).json({ id: r.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already have a pending request of this type — wait for the admin or cancel it' });
    throw err;
  }
}

// POST /student/change-requests/:id/cancel — only my own pending request
async function cancelChangeRequest(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await query(
    `UPDATE profile_change_requests SET status = 'cancelled', reviewed_at = NOW()
     WHERE id = $1 AND student_id = $2 AND status = 'pending' RETURNING id`, [req.params.id, req.user.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No pending request to cancel' });
  res.json({ message: 'Request cancelled' });
}

// ── Change requests: admin side ───────────────────────────────────────────

// GET /admin/profile-requests?status=pending|approved|rejected|cancelled|all
async function listProfileRequests(req, res) {
  const status = req.query.status || 'pending';
  const all = status === 'all';
  if (!all && !['pending', 'approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await query(`${REQUEST_SELECT} ${all ? '' : 'WHERE r.status = $1'} ORDER BY r.created_at DESC LIMIT 500`, all ? [] : [status]);
  const counts = (await query(`SELECT status, COUNT(*)::int AS n FROM profile_change_requests GROUP BY status`)).rows;
  res.json({ requests: r.rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) });
}

// PATCH /admin/profile-requests/:id  { status: 'approved' | 'rejected', admin_note? }
// Approve applies the change: BV Leader in all current classes, or the class move.
async function reviewProfileRequest(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const adminNote = String(req.body.admin_note || '').trim().slice(0, 500) || null;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const client = await pool.connect();
  let reqRow;
  try {
    await client.query('BEGIN');
    reqRow = (await client.query('SELECT * FROM profile_change_requests WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!reqRow) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (reqRow.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: `This request is already ${reqRow.status}` }); }

    if (status === 'approved') {
      if (reqRow.kind === 'bv_leader') {
        if (!reqRow.mentor_id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The requested BV Leader no longer exists' }); }
        await setLeader(client, reqRow.student_id, reqRow.mentor_id);
      } else {
        if (!reqRow.to_subject_id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The requested course no longer exists' }); }
        const from = reqRow.from_subject_id;
        if (from && !(await client.query('SELECT 1 FROM class_enrollments WHERE student_id = $1 AND subject_id = $2', [reqRow.student_id, from])).rows.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'The student is no longer in the course they wanted to leave — reject this and change it in All Users' });
        }
        await applyClassChange(client, reqRow.student_id, from, reqRow.to_subject_id);
      }
    }
    await client.query(
      `UPDATE profile_change_requests SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4`,
      [status, adminNote, req.user.id, id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await logAudit(req.user.id, `profile_request_${status}`, 'profile_change_request', id,
    { student_id: reqRow.student_id, kind: reqRow.kind, mentor_id: reqRow.mentor_id, from: reqRow.from_subject_id, to: reqRow.to_subject_id });
  res.json({ id, status });
}

// Express 4 does not catch async errors: answer 500 instead of leaving the request hanging.
const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(err); if (!res.headersSent) res.status(500).json({ error: 'Server error' }); }
};
export const getMyAttendanceHistorySafe = safe(getMyAttendanceHistory);
export const getUserAttendanceHistorySafe = safe(getUserAttendanceHistory);
export const getMentorStudentAttendanceHistorySafe = safe(getMentorStudentAttendanceHistory);
export const getMyChangeRequestsSafe = safe(getMyChangeRequests);
export const createChangeRequestSafe = safe(createChangeRequest);
export const cancelChangeRequestSafe = safe(cancelChangeRequest);
export const listProfileRequestsSafe = safe(listProfileRequests);
export const reviewProfileRequestSafe = safe(reviewProfileRequest);
