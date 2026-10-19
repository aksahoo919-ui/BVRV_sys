import { query, pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../middleware/audit.js';
import { defaultUsername } from '../utils/password.js';
import { isValidYmd } from '../utils/istDate.js';

// ── Course semesters ──────────────────────────────────────────────────────
// Each course has its own semesters (own months). Every class belongs to one
// semester; "Start next semester" copies the classes, so past semesters keep
// their enrolments, attendance, teachers and BV leader links untouched.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /admin/course-semesters — every course semester with class / student counts
async function listCourseSemesters(req, res) {
  const r = await query(`
    SELECT sem.id, sem.course_id, sem.number, COALESCE(sem.label, 'Sem ' || sem.number) AS label,
      to_char(sem.start_date, 'YYYY-MM-DD') AS start_date, to_char(sem.end_date, 'YYYY-MM-DD') AS end_date,
      sem.is_current, c.name AS course_name, c.code AS course_code,
      (SELECT COUNT(*) FROM subjects s WHERE s.semester_id = sem.id)::int AS class_count,
      (SELECT COUNT(DISTINCT ce.student_id) FROM class_enrollments ce JOIN subjects s ON s.id = ce.subject_id
        WHERE s.semester_id = sem.id AND ce.student_id IS NOT NULL)::int AS student_count
    FROM semesters sem
    JOIN courses c ON c.id = sem.course_id
    ORDER BY c.name, sem.number`);
  res.json(r.rows);
}

// PATCH /admin/course-semesters/:id  { label?, start_date?, end_date? }
async function updateCourseSemester(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const { label, start_date, end_date } = req.body;
  for (const v of [start_date, end_date]) if (v && !isValidYmd(v)) return res.status(400).json({ error: 'Use YYYY-MM-DD dates' });
  const cur = (await query(`SELECT to_char(start_date, 'YYYY-MM-DD') AS s, to_char(end_date, 'YYYY-MM-DD') AS e
                            FROM semesters WHERE id = $1 AND course_id IS NOT NULL`, [id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'Semester not found' });
  if ((end_date || cur.e) < (start_date || cur.s)) return res.status(400).json({ error: 'End date is before the start date' });
  const r = await query(
    `UPDATE semesters SET label = COALESCE(NULLIF($1, ''), label), start_date = COALESCE($2, start_date), end_date = COALESCE($3, end_date)
     WHERE id = $4 AND course_id IS NOT NULL RETURNING id`,
    [label?.trim() ?? null, start_date || null, end_date || null, id]);
  await logAudit(req.user.id, 'update', 'semester', id, { label, start_date, end_date });
  res.json(r.rows[0]);
}

// POST /admin/course-semesters/:id/set-current — current within its course only
async function setCurrentCourseSemester(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const sem = (await query('SELECT id, course_id FROM semesters WHERE id = $1 AND course_id IS NOT NULL', [id])).rows[0];
  if (!sem) return res.status(404).json({ error: 'Semester not found' });
  await query('UPDATE semesters SET is_current = (id = $1) WHERE course_id = $2', [id, sem.course_id]);
  await logAudit(req.user.id, 'set_current', 'semester', id);
  res.json({ message: 'Current semester changed' });
}

// POST /admin/course-semesters/:id/next
//   { start_date, end_date, label?, carry_students?, carry_teachers? }
// Creates the next semester of the same course, copies every class of this
// semester into it (same code and name), optionally with the same teachers,
// timetable, students and BV leader links, and makes it the current one.
async function startNextSemester(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const { start_date, end_date } = req.body;
  const carryStudents = req.body.carry_students !== false;
  const carryTeachers = req.body.carry_teachers !== false;
  if (!isValidYmd(start_date) || !isValidYmd(end_date)) return res.status(400).json({ error: 'Start and end dates are required (YYYY-MM-DD)' });
  if (end_date < start_date) return res.status(400).json({ error: 'End date is before the start date' });

  const from = (await query('SELECT * FROM semesters WHERE id = $1 AND course_id IS NOT NULL', [id])).rows[0];
  if (!from) return res.status(404).json({ error: 'Semester not found' });
  const number = (await query('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM semesters WHERE course_id = $1', [from.course_id])).rows[0].n;
  const label = String(req.body.label || '').trim() || `Sem ${number}`;

  const client = await pool.connect();
  const summary = { classes: 0, teachers: 0, students: 0, bv_leader_links: 0 };
  let newId;
  try {
    await client.query('BEGIN');
    newId = (await client.query(
      `INSERT INTO semesters (id, academic_year_id, course_id, number, label, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
      [uuidv4(), from.academic_year_id, from.course_id, number, label, start_date, end_date])).rows[0].id;

    const classes = (await client.query('SELECT * FROM subjects WHERE semester_id = $1 ORDER BY code', [id])).rows;
    for (const s of classes) {
      const sid = (await client.query(
        `INSERT INTO subjects (id, code, name, created_by, course_id, academic_year_id, credits, semester_number, semester_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [uuidv4(), s.code, s.name, req.user.id, s.course_id, s.academic_year_id, s.credits, s.semester_number, newId])).rows[0].id;
      summary.classes++;
      if (carryTeachers) {
        summary.teachers += (await client.query(
          `INSERT INTO class_enrollments (id, subject_id, instructor_id)
           SELECT gen_random_uuid(), $2, instructor_id FROM class_enrollments WHERE subject_id = $1 AND instructor_id IS NOT NULL`,
          [s.id, sid])).rowCount;
        await client.query(
          `INSERT INTO timetable_slots (id, subject_id, teacher_id, day_of_week, start_time, end_time, room)
           SELECT gen_random_uuid(), $2, teacher_id, day_of_week, start_time, end_time, room FROM timetable_slots WHERE subject_id = $1`,
          [s.id, sid]);
      }
      if (carryStudents) {
        summary.students += (await client.query(
          `INSERT INTO class_enrollments (id, subject_id, student_id)
           SELECT gen_random_uuid(), $2, ce.student_id FROM class_enrollments ce JOIN users u ON u.id = ce.student_id
           WHERE ce.subject_id = $1 AND u.status = 'active'`,
          [s.id, sid])).rowCount;
        summary.bv_leader_links += (await client.query(
          `INSERT INTO class_mentor_assignments (id, subject_id, mentor_id, student_id)
           SELECT gen_random_uuid(), $2, cma.mentor_id, cma.student_id FROM class_mentor_assignments cma
           JOIN class_enrollments ce ON ce.subject_id = $2 AND ce.student_id = cma.student_id
           WHERE cma.subject_id = $1`,
          [s.id, sid])).rowCount;
      }
    }
    await client.query('UPDATE semesters SET is_current = (id = $1) WHERE course_id = $2', [newId, from.course_id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await logAudit(req.user.id, 'start_semester', 'semester', newId, { from: id, label, ...summary });
  res.status(201).json({ id: newId, label, ...summary });
}

// ── Student timeline ──────────────────────────────────────────────────────
// GET /admin/users/:id/timeline — every class the student has been in, newest
// semester first, with teachers, BV leader and attendance for that class.
async function getStudentTimeline(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const u = (await query('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = $1', [id])).rows[0];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const r = await query(`
    SELECT s.id AS subject_id, s.code, s.name AS class_name, c.name AS course_name,
      sem.id AS semester_id, COALESCE(sem.label, 'Sem ' || sem.number) AS semester_label, sem.number AS semester_number,
      to_char(sem.start_date, 'YYYY-MM-DD') AS start_date, to_char(sem.end_date, 'YYYY-MM-DD') AS end_date,
      (sem.id IS NULL OR sem.is_current) AS is_current,
      (SELECT STRING_AGG(t.name, ', ' ORDER BY t.name) FROM class_enrollments te JOIN users t ON t.id = te.instructor_id
        WHERE te.subject_id = s.id) AS teachers,
      (SELECT m.name FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id
        WHERE cma.subject_id = s.id AND cma.student_id = ce.student_id) AS bv_leader,
      (SELECT COUNT(DISTINCT x.session_date) FROM sessions x WHERE x.subject_id = s.id AND x.closed = true)::int AS class_days,
      (SELECT COUNT(DISTINCT x.session_date) FROM sessions x JOIN attendance_logs a ON a.session_id = x.id
        WHERE x.subject_id = s.id AND x.closed = true AND a.student_id = ce.student_id
          AND a.status IN ('present','service') AND a.replayed = false)::int AS days_present,
      (SELECT to_char(MIN(x.session_date), 'YYYY-MM-DD') FROM sessions x WHERE x.subject_id = s.id) AS first_class,
      (SELECT to_char(MAX(x.session_date), 'YYYY-MM-DD') FROM sessions x WHERE x.subject_id = s.id) AS last_class
    FROM class_enrollments ce
    JOIN subjects s ON s.id = ce.subject_id
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN semesters sem ON sem.id = s.semester_id
    WHERE ce.student_id = $1
    ORDER BY sem.start_date DESC NULLS LAST, c.name, s.code`, [id]);
  const rows = r.rows.map(x => ({
    ...x,
    percentage: x.class_days > 0 ? Math.round(x.days_present / x.class_days * 1000) / 10 : null,
  }));
  res.json({ user: u, timeline: rows });
}

// ── Class details (Class BV Leaders header) ───────────────────────────────
// GET /admin/subjects/:id/details — semester and teachers of one class
async function getClassDetails(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const s = (await query(`
    SELECT s.id, s.code, s.name, c.name AS course_name,
      sem.id AS semester_id, COALESCE(sem.label, 'Sem ' || sem.number) AS semester_label,
      to_char(sem.start_date, 'YYYY-MM-DD') AS start_date, to_char(sem.end_date, 'YYYY-MM-DD') AS end_date,
      (sem.id IS NULL OR sem.is_current) AS is_current,
      (SELECT COUNT(DISTINCT x.session_date) FROM sessions x WHERE x.subject_id = s.id AND x.closed = true)::int AS class_days,
      (SELECT to_char(MAX(x.session_date), 'YYYY-MM-DD') FROM sessions x WHERE x.subject_id = s.id) AS last_class
    FROM subjects s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.id = $1`, [id])).rows[0];
  if (!s) return res.status(404).json({ error: 'Class not found' });
  const t = await query(`
    SELECT u.id, u.name, u.email, u.phone, u.gender,
      (SELECT STRING_AGG((ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[ts.day_of_week + 1] || ' ' ||
          to_char(ts.start_time, 'HH24:MI') || '–' || to_char(ts.end_time, 'HH24:MI'), ', ' ORDER BY ts.day_of_week, ts.start_time)
        FROM timetable_slots ts WHERE ts.subject_id = $1 AND ts.teacher_id = u.id) AS timetable
    FROM class_enrollments ce JOIN users u ON u.id = ce.instructor_id
    WHERE ce.subject_id = $1
    ORDER BY u.name`, [id]);
  res.json({ ...s, teachers: t.rows });
}

// ── Add BV Member ─────────────────────────────────────────────────────────
// POST /admin/bv-members/:mentor_id/members
//   { subject_id, student_id }                       existing student
//   { subject_id, new_student: { name, email?, phone?, gender? } }  new student
// Enrols the student in the class (if not yet) and links them to the BV Leader there.
async function addBVMember(req, res) {
  const { mentor_id } = req.params;
  const { subject_id, student_id, new_student } = req.body;
  if (!UUID_RE.test(mentor_id)) return res.status(400).json({ error: 'Invalid BV Leader id' });
  if (!subject_id || !UUID_RE.test(subject_id)) return res.status(400).json({ error: 'Pick a class' });
  if (!student_id && !new_student) return res.status(400).json({ error: 'Pick a student or enter a new one' });
  if (student_id && !UUID_RE.test(student_id)) return res.status(400).json({ error: 'Invalid student' });

  const leader = (await query(`SELECT id, name FROM users WHERE id = $1 AND (role = 'mentor' OR secondary_role = 'mentor')`, [mentor_id])).rows[0];
  if (!leader) return res.status(404).json({ error: 'BV Leader not found' });
  if (!(await query('SELECT 1 FROM subjects WHERE id = $1', [subject_id])).rows.length) return res.status(400).json({ error: 'Class not found' });

  let newUser = null;
  if (new_student) {
    const name = String(new_student.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const phone = String(new_student.phone || '').trim() || null;
    const gender = ['Male', 'Female'].includes(new_student.gender) ? new_student.gender : null;
    let email = String(new_student.email || '').trim();
    if (!email || email.toUpperCase() === 'NA') {
      const digits = String(phone || '').replace(/\D/g, '');
      email = digits ? `p${digits}@noemail.bvrv` : `na-${uuidv4()}@noemail.bvrv`;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    newUser = { id: uuidv4(), name, email, phone, gender };
  } else {
    const s = (await query('SELECT id, role FROM users WHERE id = $1', [student_id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Student not found' });
    if (s.role !== 'student') return res.status(400).json({ error: 'Only students can be BV Members' });
  }

  const client = await pool.connect();
  let sid = student_id;
  let previous = null;
  try {
    await client.query('BEGIN');
    if (newUser) {
      await client.query(
        `INSERT INTO users (id, name, email, role, phone, gender, status, username)
         VALUES ($1, $2, $3, 'student', $4, $5, 'active', $6)`,
        [newUser.id, newUser.name, newUser.email, newUser.phone, newUser.gender, defaultUsername(newUser.email, newUser.name)]);
      sid = newUser.id;
    }
    await client.query(
      `INSERT INTO class_enrollments (id, subject_id, student_id) VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (subject_id, student_id) DO NOTHING`, [subject_id, sid]);
    previous = (await client.query(
      `SELECT m.name FROM class_mentor_assignments cma JOIN users m ON m.id = cma.mentor_id
       WHERE cma.subject_id = $1 AND cma.student_id = $2 AND cma.mentor_id <> $3`, [subject_id, sid, mentor_id])).rows[0]?.name || null;
    await client.query(
      `INSERT INTO class_mentor_assignments (id, subject_id, mentor_id, student_id) VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (subject_id, student_id) DO UPDATE SET mentor_id = $2, assigned_at = NOW()`, [subject_id, mentor_id, sid]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'A user with that email already exists — pick them from the list instead' });
    throw err;
  } finally {
    client.release();
  }
  if (newUser) await logAudit(req.user.id, 'create_user', 'user', sid, { role: 'student', via: 'add_bv_member' });
  await logAudit(req.user.id, 'add_bv_member', 'user', sid, { mentor_id, subject_id, previous_leader: previous });
  res.status(201).json({ student_id: sid, created: !!newUser, previous_leader: previous });
}

// Express 4 does not catch async errors: answer 500 instead of leaving the request hanging.
const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(err); if (!res.headersSent) res.status(500).json({ error: 'Server error' }); }
};
export const listCourseSemestersSafe = safe(listCourseSemesters);
export const updateCourseSemesterSafe = safe(updateCourseSemester);
export const setCurrentCourseSemesterSafe = safe(setCurrentCourseSemester);
export const startNextSemesterSafe = safe(startNextSemester);
export const getStudentTimelineSafe = safe(getStudentTimeline);
export const getClassDetailsSafe = safe(getClassDetails);
export const addBVMemberSafe = safe(addBVMember);
