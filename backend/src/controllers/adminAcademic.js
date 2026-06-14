import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../middleware/audit.js';

// ── Departments ────────────────────────────────────────────────────────────

export async function getDepartments(req, res) {
  const r = await query('SELECT * FROM departments ORDER BY name').catch(e => { throw e; });
  res.json(r.rows);
}

export async function createDepartment(req, res) {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  try {
    const r = await query(
      'INSERT INTO departments (id, name, code, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [uuidv4(), name, code.toUpperCase(), req.user.id]
    );
    await logAudit(req.user.id, 'create', 'department', r.rows[0].id);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Department code already exists' });
    throw err;
  }
}

export async function updateDepartment(req, res) {
  const { name, code } = req.body;
  const r = await query(
    'UPDATE departments SET name=COALESCE($1,name), code=COALESCE($2,code) WHERE id=$3 RETURNING *',
    [name, code?.toUpperCase(), req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, 'update', 'department', req.params.id);
  res.json(r.rows[0]);
}

export async function deleteDepartment(req, res) {
  const r = await query('DELETE FROM departments WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, 'delete', 'department', req.params.id);
  res.json({ message: 'Deleted' });
}

// ── Courses ────────────────────────────────────────────────────────────────

export async function getCourses(req, res) {
  const r = await query(`
    SELECT c.*, d.name AS department_name
    FROM courses c LEFT JOIN departments d ON d.id = c.department_id
    ORDER BY c.name
  `);
  res.json(r.rows);
}

export async function createCourse(req, res) {
  const { department_id, name, code, duration_years } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  try {
    const r = await query(
      'INSERT INTO courses (id, department_id, name, code, duration_years) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [uuidv4(), department_id || null, name, code.toUpperCase(), duration_years || 4]
    );
    await logAudit(req.user.id, 'create', 'course', r.rows[0].id);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    throw err;
  }
}

export async function updateCourse(req, res) {
  const { department_id, name, code, duration_years } = req.body;
  const r = await query(
    `UPDATE courses SET
       department_id=COALESCE($1,department_id),
       name=COALESCE($2,name),
       code=COALESCE($3,code),
       duration_years=COALESCE($4,duration_years)
     WHERE id=$5 RETURNING *`,
    [department_id, name, code?.toUpperCase(), duration_years, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

export async function deleteCourse(req, res) {
  const r = await query('DELETE FROM courses WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}

// ── Academic Years ─────────────────────────────────────────────────────────

export async function getAcademicYears(req, res) {
  const r = await query('SELECT * FROM academic_years ORDER BY start_date DESC');
  res.json(r.rows);
}

export async function createAcademicYear(req, res) {
  const { label, start_date, end_date, is_current } = req.body;
  if (!label || !start_date || !end_date) return res.status(400).json({ error: 'label, start_date, end_date required' });
  if (is_current) await query('UPDATE academic_years SET is_current=false');
  const r = await query(
    'INSERT INTO academic_years (id, label, start_date, end_date, is_current, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [uuidv4(), label, start_date, end_date, !!is_current, req.user.id]
  );
  await logAudit(req.user.id, 'create', 'academic_year', r.rows[0].id);
  res.status(201).json(r.rows[0]);
}

export async function updateAcademicYear(req, res) {
  const { label, start_date, end_date, is_current } = req.body;
  if (is_current) await query('UPDATE academic_years SET is_current=false');
  const r = await query(
    `UPDATE academic_years SET
       label=COALESCE($1,label), start_date=COALESCE($2,start_date),
       end_date=COALESCE($3,end_date), is_current=COALESCE($4,is_current)
     WHERE id=$5 RETURNING *`,
    [label, start_date, end_date, is_current, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

export async function deleteAcademicYear(req, res) {
  const r = await query('DELETE FROM academic_years WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}

// ── Semesters ─────────────────────────────────────────────────────────────

export async function getSemesters(req, res) {
  const r = await query(`
    SELECT s.*, ay.label AS year_label
    FROM semesters s JOIN academic_years ay ON ay.id = s.academic_year_id
    ORDER BY ay.start_date DESC, s.number
  `);
  res.json(r.rows);
}

export async function createSemester(req, res) {
  const { academic_year_id, number, start_date, end_date, is_current } = req.body;
  if (!academic_year_id || !number || !start_date || !end_date)
    return res.status(400).json({ error: 'academic_year_id, number, start_date, end_date required' });
  if (is_current) await query('UPDATE semesters SET is_current=false');
  const r = await query(
    'INSERT INTO semesters (id, academic_year_id, number, start_date, end_date, is_current) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [uuidv4(), academic_year_id, number, start_date, end_date, !!is_current]
  );
  res.status(201).json(r.rows[0]);
}

export async function updateSemester(req, res) {
  const { number, start_date, end_date, is_current } = req.body;
  if (is_current) await query('UPDATE semesters SET is_current=false');
  const r = await query(
    `UPDATE semesters SET
       number=COALESCE($1,number), start_date=COALESCE($2,start_date),
       end_date=COALESCE($3,end_date), is_current=COALESCE($4,is_current)
     WHERE id=$5 RETURNING *`,
    [number, start_date, end_date, is_current, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

export async function deleteSemester(req, res) {
  const r = await query('DELETE FROM semesters WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}

// ── Timetable Slots ────────────────────────────────────────────────────────

export async function getTimetableSlots(req, res) {
  const r = await query(`
    SELECT ts.*, s.name AS subject_name, s.code AS subject_code,
           u.name AS teacher_name
    FROM timetable_slots ts
    JOIN subjects s ON s.id = ts.subject_id
    JOIN users u ON u.id = ts.teacher_id
    ORDER BY ts.day_of_week, ts.start_time
  `);
  res.json(r.rows);
}

export async function createTimetableSlot(req, res) {
  const { subject_id, teacher_id, day_of_week, start_time, end_time, room } = req.body;
  if (!subject_id || !teacher_id || day_of_week == null || !start_time || !end_time)
    return res.status(400).json({ error: 'Missing required fields' });
  const r = await query(
    'INSERT INTO timetable_slots (id,subject_id,teacher_id,day_of_week,start_time,end_time,room) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [uuidv4(), subject_id, teacher_id, day_of_week, start_time, end_time, room || null]
  );
  res.status(201).json(r.rows[0]);
}

export async function updateTimetableSlot(req, res) {
  const { subject_id, teacher_id, day_of_week, start_time, end_time, room } = req.body;
  const r = await query(
    `UPDATE timetable_slots SET
       subject_id=COALESCE($1,subject_id), teacher_id=COALESCE($2,teacher_id),
       day_of_week=COALESCE($3,day_of_week), start_time=COALESCE($4,start_time),
       end_time=COALESCE($5,end_time), room=COALESCE($6,room)
     WHERE id=$7 RETURNING *`,
    [subject_id, teacher_id, day_of_week, start_time, end_time, room, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}

export async function deleteTimetableSlot(req, res) {
  const r = await query('DELETE FROM timetable_slots WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}

// ── Mentor Assignments (admin-managed) ────────────────────────────────────

export async function getMentorAssignments(req, res) {
  const r = await query(`
    SELECT ma.*,
           m.name AS mentor_name, m.email AS mentor_email,
           s.name AS student_name, s.email AS student_email
    FROM mentor_assignments ma
    JOIN users m ON m.id = ma.mentor_id
    JOIN users s ON s.id = ma.student_id
    ORDER BY m.name, s.name
  `);
  res.json(r.rows);
}

export async function assignMentor(req, res) {
  const { mentor_id, student_id } = req.body;
  if (!mentor_id || !student_id) return res.status(400).json({ error: 'mentor_id and student_id required' });
  try {
    const r = await query(
      `INSERT INTO mentor_assignments (id, mentor_id, student_id)
       VALUES ($1,$2,$3) ON CONFLICT (student_id) DO UPDATE SET mentor_id=$2, assigned_at=NOW() RETURNING *`,
      [uuidv4(), mentor_id, student_id]
    );
    await logAudit(req.user.id, 'assign_mentor', 'mentor_assignment', r.rows[0].id, { mentor_id, student_id });
    res.status(201).json(r.rows[0]);
  } catch (err) { throw err; }
}

export async function removeMentorAssignment(req, res) {
  await query('DELETE FROM mentor_assignments WHERE student_id=$1', [req.params.student_id]);
  res.json({ message: 'Assignment removed' });
}

// ── Results (admin publishes) ──────────────────────────────────────────────

export async function getResults(req, res) {
  const { academic_year_id, course_id } = req.query;
  const conds = [];
  const params = [];
  if (academic_year_id) conds.push(`r.academic_year_id=$${params.push(academic_year_id)}`);
  if (course_id)        conds.push(`r.course_id=$${params.push(course_id)}`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const r = await query(`
    SELECT r.*, u.name AS student_name, u.email AS student_email,
           ay.label AS year_label, c.name AS course_name, c.code AS course_code
    FROM results r
    JOIN users u ON u.id = r.student_id
    LEFT JOIN academic_years ay ON ay.id = r.academic_year_id
    LEFT JOIN courses c ON c.id = r.course_id
    ${where}
    ORDER BY r.rank NULLS LAST, u.name
  `, params);
  res.json(r.rows);
}

export async function upsertResult(req, res) {
  const { student_id, semester_id, gpa, cgpa, rank } = req.body;
  if (!student_id || !semester_id || gpa == null) return res.status(400).json({ error: 'student_id, semester_id, gpa required' });
  const r = await query(
    `INSERT INTO results (id, student_id, semester_id, gpa, cgpa, rank)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, semester_id) DO UPDATE
       SET gpa=$4, cgpa=$5, rank=$6 RETURNING *`,
    [uuidv4(), student_id, semester_id, gpa, cgpa || 0, rank || null]
  );
  res.json(r.rows[0]);
}

export async function publishResults(req, res) {
  const { academic_year_id, course_id } = req.body;
  if (!academic_year_id || !course_id)
    return res.status(400).json({ error: 'academic_year_id and course_id required' });
  const r = await query(
    `UPDATE results SET published=true, published_at=NOW()
     WHERE academic_year_id=$1 AND course_id=$2 RETURNING id`,
    [academic_year_id, course_id]
  );
  await logAudit(req.user.id, 'publish_results', 'course_year', course_id, { academic_year_id, count: r.rows.length });
  res.json({ published: r.rows.length });
}

// ── Set-current shortcuts ─────────────────────────────────────────────────

export async function setCurrentAcademicYear(req, res) {
  await query('UPDATE academic_years SET is_current=false');
  const r = await query('UPDATE academic_years SET is_current=true WHERE id=$1 RETURNING *', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, 'set_current', 'academic_year', req.params.id);
  res.json(r.rows[0]);
}

export async function setCurrentSemester(req, res) {
  await query('UPDATE semesters SET is_current=false');
  const r = await query('UPDATE semesters SET is_current=true WHERE id=$1 RETURNING *', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await logAudit(req.user.id, 'set_current', 'semester', req.params.id);
  res.json(r.rows[0]);
}

// ── Course Enrollments ────────────────────────────────────────────────────

export async function enrollInCourse(req, res) {
  const { student_id, course_id, academic_year_id } = req.body;
  if (!student_id || !course_id || !academic_year_id)
    return res.status(400).json({ error: 'student_id, course_id, academic_year_id required' });
  try {
    const r = await query(
      `INSERT INTO course_enrollments (id, student_id, course_id, academic_year_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, course_id, academic_year_id) DO NOTHING RETURNING *`,
      [uuidv4(), student_id, course_id, academic_year_id]
    );
    await logAudit(req.user.id, 'enroll_course', 'course_enrollment', r.rows[0]?.id, { student_id, course_id });
    res.status(201).json(r.rows[0] || { message: 'Already enrolled' });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid student_id, course_id, or academic_year_id' });
    throw err;
  }
}

export async function getCourseEnrollments(req, res) {
  const { course_id, academic_year_id } = req.query;
  if (!course_id || !academic_year_id)
    return res.status(400).json({ error: 'course_id and academic_year_id required' });

  // Show every student enrolled in any class (subject) that belongs to this
  // course for this academic year — sourced from class_enrollments, which is
  // what teachers actually use. Each row also lists the subjects the student
  // is enrolled in under the course.
  const r = await query(`
    SELECT
      u.id   AS student_id,
      u.name AS student_name,
      u.email AS student_email,
      u.roll_number,
      STRING_AGG(DISTINCT s.code, ', ') AS subject_codes,
      COUNT(DISTINCT s.id) AS subject_count
    FROM class_enrollments ce
    JOIN subjects s ON s.id = ce.subject_id
    JOIN users u    ON u.id = ce.student_id
    WHERE ce.student_id IS NOT NULL
      AND s.course_id = $1
      AND s.academic_year_id = $2
    GROUP BY u.id, u.name, u.email, u.roll_number
    ORDER BY u.name
  `, [course_id, academic_year_id]);
  res.json(r.rows);
}

// ── Class Mentors (per-class mentor assignment) ───────────────────────────

export async function getMentorsList(req, res) {
  const r = await query(
    `SELECT id, name, email FROM users
     WHERE (role='mentor' OR secondary_role='mentor') AND status='active'
     ORDER BY name`
  );
  res.json(r.rows);
}

// For a subject: every enrolled student + their currently assigned mentor (if any)
export async function getSubjectMentorAssignments(req, res) {
  const { subject_id } = req.params;
  const r = await query(`
    SELECT u.id AS student_id, u.name AS student_name, u.email AS student_email, u.roll_number,
           cma.id AS assignment_id, cma.mentor_id, m.name AS mentor_name
    FROM class_enrollments ce
    JOIN users u ON u.id = ce.student_id
    LEFT JOIN class_mentor_assignments cma ON cma.subject_id = ce.subject_id AND cma.student_id = u.id
    LEFT JOIN users m ON m.id = cma.mentor_id
    WHERE ce.subject_id = $1 AND ce.student_id IS NOT NULL
    ORDER BY u.name
  `, [subject_id]);
  res.json(r.rows);
}

// Assign (or change) a mentor for a student in a subject. mentor_id null clears it.
export async function assignClassMentor(req, res) {
  const { subject_id, student_id, mentor_id } = req.body;
  if (!subject_id || !student_id) return res.status(400).json({ error: 'subject_id and student_id required' });
  try {
    if (!mentor_id) {
      await query('DELETE FROM class_mentor_assignments WHERE subject_id=$1 AND student_id=$2', [subject_id, student_id]);
      return res.json({ message: 'Mentor cleared' });
    }
    const r = await query(
      `INSERT INTO class_mentor_assignments (id, subject_id, mentor_id, student_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (subject_id, student_id) DO UPDATE SET mentor_id=$3, assigned_at=NOW()
       RETURNING *`,
      [uuidv4(), subject_id, mentor_id, student_id]
    );
    await logAudit(req.user.id, 'assign_class_mentor', 'class_mentor_assignment', r.rows[0].id, { subject_id, student_id, mentor_id });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid subject, student, or mentor' });
    throw err;
  }
}

// Import student→mentor assignments for a subject from a CSV (student name, mentor name)
export async function bulkImportClassMentors(req, res) {
  const { subject_id } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id required' });
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });

  const csv = req.file.buffer.toString('utf8');
  const lines = csv.split('\n').map(l => l.replace(/\r$/, '').trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV has no data rows' });

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idx = (...names) => { for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; } return -1; };
  const studentIdx = idx('student name', 'student');
  const mentorIdx = idx('mentor name', 'mentor');
  if (studentIdx === -1 || mentorIdx === -1)
    return res.status(400).json({ error: 'CSV must have columns: student name, mentor name' });

  // Students enrolled in this subject, keyed by lowercased name
  const studR = await query(`
    SELECT u.id, u.name FROM class_enrollments ce
    JOIN users u ON u.id = ce.student_id
    WHERE ce.subject_id = $1 AND ce.student_id IS NOT NULL`, [subject_id]);
  const studentMap = {};
  for (const s of studR.rows) { const k = s.name.trim().toLowerCase(); (studentMap[k] = studentMap[k] || []).push(s.id); }

  // Mentors (primary or secondary), keyed by lowercased name
  const mentR = await query(
    `SELECT id, name FROM users WHERE (role='mentor' OR secondary_role='mentor') AND status='active'`
  );
  const mentorMap = {};
  for (const m of mentR.rows) { const k = m.name.trim().toLowerCase(); (mentorMap[k] = mentorMap[k] || []).push(m.id); }

  let assigned = 0;
  const skipped = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const sName = cols[studentIdx];
    const mName = cols[mentorIdx];
    if (!sName || !mName) { skipped.push({ row: i + 1, reason: 'Missing student or mentor name' }); continue; }
    const sIds = studentMap[sName.toLowerCase()];
    const mIds = mentorMap[mName.toLowerCase()];
    if (!sIds) { skipped.push({ row: i + 1, reason: `Student "${sName}" not enrolled in this subject` }); continue; }
    if (sIds.length > 1) { skipped.push({ row: i + 1, reason: `Multiple students named "${sName}"` }); continue; }
    if (!mIds) { skipped.push({ row: i + 1, reason: `Mentor "${mName}" not found` }); continue; }
    if (mIds.length > 1) { skipped.push({ row: i + 1, reason: `Multiple mentors named "${mName}"` }); continue; }
    try {
      await query(
        `INSERT INTO class_mentor_assignments (id, subject_id, mentor_id, student_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (subject_id, student_id) DO UPDATE SET mentor_id=$3, assigned_at=NOW()`,
        [uuidv4(), subject_id, mIds[0], sIds[0]]
      );
      assigned++;
    } catch (err) { skipped.push({ row: i + 1, reason: err.message }); }
  }
  await logAudit(req.user.id, 'import_class_mentors', 'subject', subject_id, { assigned });
  res.json({ assigned, skipped });
}

// ── Rank List ─────────────────────────────────────────────────────────────

export async function getRankList(req, res) {
  const { semester_id } = req.params;
  const r = await query(`
    SELECT
      RANK() OVER (ORDER BY r.gpa DESC) AS rank,
      u.id, u.name, u.email, u.roll_number,
      r.gpa, r.cgpa, r.published
    FROM results r
    JOIN users u ON u.id = r.student_id
    WHERE r.semester_id = $1
    ORDER BY r.gpa DESC
  `, [semester_id]);

  const semR2 = await query(
    `SELECT s.number, ay.label FROM semesters s JOIN academic_years ay ON ay.id=s.academic_year_id WHERE s.id=$1`,
    [semester_id]
  );
  const semLabel = semR2.rows[0] ? `Semester ${semR2.rows[0].number} — ${semR2.rows[0].label}` : '';

  if (req.query.export === 'xlsx') {
    const { generateExcelReport } = await import('../services/reportService.js');
    const headers = ['Rank', 'Roll No', 'Name', 'GPA', 'CGPA'];
    const rows = r.rows.map(s => [s.rank, s.roll_number ?? '—', s.name, s.gpa, s.cgpa]);
    const buf = await generateExcelReport({ sheetName: 'Rank List', headers, rows, title: `Rank List — ${semLabel}` });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rank-list.xlsx"');
    return res.send(buf);
  }

  if (req.query.export === 'pdf') {
    const { generateRankListPdf } = await import('../services/reportService.js');
    const rankRows = r.rows.map(s => ({
      rank: s.rank, roll_number: s.roll_number ?? '—', name: s.name,
      gpa: s.gpa, cgpa: s.cgpa, attendance_pct: null,
    }));
    const buf = await generateRankListPdf({ semesterLabel: semLabel, rows: rankRows });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rank-list.pdf"');
    return res.send(buf);
  }

  res.json(r.rows);
}

// ── Report Card (admin view) ──────────────────────────────────────────────

export async function getReportCard(req, res) {
  const { student_id, semester_id } = req.params;

  const [studentR, marksR, attendanceR, resultR, settingsR, semR] = await Promise.all([
    query(`SELECT u.*, d.name AS department_name, c.name AS course_name
           FROM users u
           LEFT JOIN departments d ON d.id = u.department_id
           LEFT JOIN course_enrollments ce ON ce.student_id = u.id
           LEFT JOIN courses c ON c.id = ce.course_id
           WHERE u.id = $1 LIMIT 1`, [student_id]),
    query(`
      SELECT m.assessment_type, m.scored_marks, m.max_marks,
             s.name AS subject_name, s.code AS subject_code, s.credits
      FROM marks m JOIN subjects s ON s.id = m.subject_id
      WHERE m.student_id = $1 AND m.semester_id = $2
      ORDER BY s.name, m.assessment_type`, [student_id, semester_id]),
    query(`
      SELECT s.name AS subject_name, s.code,
        COUNT(DISTINCT sess.id) AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended
      FROM subjects s
      JOIN class_enrollments ce ON ce.subject_id=s.id AND ce.student_id=$1
      LEFT JOIN sessions sess ON sess.subject_id=s.id AND sess.closed=true
      LEFT JOIN attendance_logs al ON al.session_id=sess.id AND al.student_id=$1
      GROUP BY s.id ORDER BY s.name`, [student_id]),
    query(`SELECT * FROM results WHERE student_id=$1 AND semester_id=$2`, [student_id, semester_id]),
    query(`SELECT grade_boundaries, gpa_scale, min_attendance_threshold FROM institution_settings LIMIT 1`),
    query(`SELECT s.number, ay.label FROM semesters s JOIN academic_years ay ON ay.id=s.academic_year_id WHERE s.id=$1`, [semester_id]),
  ]);

  if (!studentR.rows.length) return res.status(404).json({ error: 'Student not found' });

  const student  = studentR.rows[0];
  const result   = resultR.rows[0] || {};
  const settings = settingsR.rows[0] || {};
  const semInfo  = semR.rows[0] || {};

  const data = {
    student: { name: student.name, email: student.email, roll_number: student.roll_number,
               department: student.department_name, course: student.course_name },
    semester: { number: semInfo.number, year: semInfo.label },
    marks: marksR.rows,
    attendance: attendanceR.rows.map(a => ({
      ...a,
      percentage: a.total_sessions > 0 ? Math.round(a.attended / a.total_sessions * 100) : 0,
    })),
    result: { gpa: result.gpa, cgpa: result.cgpa, rank: result.rank, published: result.published },
    grade_boundaries: settings.grade_boundaries,
    gpa_scale: settings.gpa_scale,
  };

  if (req.query.export === 'pdf') {
    const { generateReportCardPdf } = await import('../services/reportService.js');
    const { calculateGrade } = await import('../services/gradeService.js');

    // Group marks by subject → internal vs exam breakdown
    const marksGrouped = {};
    for (const m of marksR.rows) {
      const key = m.subject_code;
      if (!marksGrouped[key]) marksGrouped[key] = {
        subject_name: m.subject_name, subject_code: m.subject_code,
        credits: m.credits || 3,
        internal_scored: 0, internal_max: 0,
        exam_scored: 0,     exam_max: 0,
        total_scored: 0,    total_max: 0,
      };
      const sg = marksGrouped[key];
      sg.total_scored += Number(m.scored_marks);
      sg.total_max    += Number(m.max_marks);
      if (m.assessment_type === 'final') {
        sg.exam_scored += Number(m.scored_marks);
        sg.exam_max    += Number(m.max_marks);
      } else {
        sg.internal_scored += Number(m.scored_marks);
        sg.internal_max    += Number(m.max_marks);
      }
    }
    const transformedMarks = Object.values(marksGrouped).map(sg => ({
      ...sg,
      total_pct: sg.total_max > 0 ? Math.round(sg.total_scored / sg.total_max * 100) : 0,
      grade: calculateGrade(
        sg.total_max > 0 ? sg.total_scored / sg.total_max * 100 : 0,
        settings.grade_boundaries
      ),
    }));

    const buf = await generateReportCardPdf({
      student: { ...data.student, name: student.name, email: student.email,
                 roll_number: student.roll_number, department: student.department_name,
                 course: student.course_name },
      semester: data.semester,
      marks: transformedMarks,
      attendance: data.attendance,
      result: data.result,
      gradeBoundaries: settings.grade_boundaries,
      gpaScale: settings.gpa_scale,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${student.name.replace(/\s+/g,'-')}.pdf"`);
    return res.send(buf);
  }

  res.json(data);
}

// ── Generate results for a semester ───────────────────────────────────────

export async function generateResultsSemester(req, res) {
  const { semester_id } = req.params;
  try {
    const { generateResultsForSemester } = await import('../services/gradeService.js');
    const results = await generateResultsForSemester(semester_id, req.user.id);

    await logAudit(req.user.id, 'generate_results', 'semester', semester_id, { count: results.length });

    // Fire-and-forget: email mentors whose students have low GPA
    _emailMentorsLowGpa(results).catch(err => console.warn('[results] email error:', err.message));

    res.json({ generated: results.length, results });
  } catch (err) {
    console.error('[generateResultsSemester]', err);
    res.status(500).json({ error: err.message || 'Failed to generate results' });
  }
}

export async function generateResultsYear(req, res) {
  const { academic_year_id } = req.params;
  const course_id = req.params.course_id || req.body.course_id || req.query.course_id;
  if (!course_id) return res.status(400).json({ error: 'course_id required' });
  try {
    const { generateResultsForCourseYear } = await import('../services/gradeService.js');
    const results = await generateResultsForCourseYear(academic_year_id, course_id, req.user.id);

    await logAudit(req.user.id, 'generate_results', 'course_year', course_id, { academic_year_id, count: results.length });

    // Fire-and-forget: email mentors whose students have low GPA
    _emailMentorsLowGpa(results).catch(err => console.warn('[results] email error:', err.message));

    res.json({ generated: results.length, results });
  } catch (err) {
    console.error('[generateResultsYear]', err);
    res.status(500).json({ error: err.message || 'Failed to generate results' });
  }
}

async function _emailMentorsLowGpa(results) {
  const { emailLowGpaAlert } = await import('../services/emailService.js');
  const settingsR = await query('SELECT mentor_alert_gpa_threshold FROM institution_settings LIMIT 1');
  const gpaThreshold = Number(settingsR.rows[0]?.mentor_alert_gpa_threshold) || 5.0;

  const lowGpa = results.filter(r => Number(r.gpa) < gpaThreshold);
  if (!lowGpa.length) return;

  const mentorMap = {};
  for (const s of lowGpa) {
    const mentorR = await query(`
      SELECT u.id, u.name, u.email
      FROM mentor_assignments ma JOIN users u ON u.id = ma.mentor_id
      WHERE ma.student_id = $1
    `, [s.studentId]);
    if (!mentorR.rows.length) continue;
    const mentor = mentorR.rows[0];

    const studentR = await query('SELECT name, email FROM users WHERE id=$1', [s.studentId]);
    if (!studentR.rows.length) continue;

    if (!mentorMap[mentor.id]) mentorMap[mentor.id] = { mentor, students: [] };
    mentorMap[mentor.id].students.push({ ...studentR.rows[0], gpa: s.gpa, threshold: gpaThreshold });
  }

  for (const { mentor, students } of Object.values(mentorMap)) {
    await emailLowGpaAlert(mentor, students);
  }
}
