import { pool, query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const adminEmail = process.env.ADMIN_GMAIL;
  if (!adminEmail) {
    console.error('ADMIN_GMAIL not set in environment');
    process.exit(1);
  }

  // Upsert admin user
  const existing = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  let adminId;
  if (existing.rows.length === 0) {
    adminId = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, role, status)
       VALUES ($1, 'Administrator', $2, 'admin', 'active')`,
      [adminId, adminEmail]
    );
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    adminId = existing.rows[0].id;
    await query(
      `UPDATE users SET role = 'admin', status = 'active' WHERE id = $1`,
      [adminId]
    );
    console.log(`Admin user already exists, ensured active: ${adminEmail}`);
  }

  // Sample subjects
  const subjects = [
    { id: uuidv4(), code: 'CS101', name: 'Introduction to Computer Science' },
    { id: uuidv4(), code: 'MATH201', name: 'Calculus II' },
  ];

  for (const sub of subjects) {
    const exists = await query('SELECT id FROM subjects WHERE code = $1', [sub.code]);
    if (exists.rows.length === 0) {
      await query(
        'INSERT INTO subjects (id, code, name, created_by) VALUES ($1, $2, $3, $4)',
        [sub.id, sub.code, sub.name, adminId]
      );
      console.log(`Created subject: ${sub.code} - ${sub.name}`);
    } else {
      console.log(`Subject ${sub.code} already exists, skipping.`);
      subjects[subjects.indexOf(sub)].id = exists.rows[0].id;
    }
  }

  // Sample teacher (status=active, no google_id — links on first OAuth login)
  const instructorEmail = 'teacher@example.com';
  const instrExisting = await query('SELECT id FROM users WHERE email = $1', [instructorEmail]);
  let instructorId;
  if (instrExisting.rows.length === 0) {
    instructorId = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, role, status)
       VALUES ($1, 'Sample Teacher', $2, 'teacher', 'active')`,
      [instructorId, instructorEmail]
    );
    console.log(`Created sample teacher: ${instructorEmail}`);
  } else {
    instructorId = instrExisting.rows[0].id;
    // also migrate role if this user is still 'instructor'
    await query(`UPDATE users SET role='teacher' WHERE id=$1 AND role='instructor'`, [instructorId]);
    console.log(`Teacher ${instructorEmail} already exists.`);
  }

  // Assign instructor to both subjects
  for (const sub of subjects) {
    const subId = (await query('SELECT id FROM subjects WHERE code = $1', [sub.code])).rows[0]?.id;
    if (!subId) continue;
    const ceExists = await query(
      'SELECT id FROM class_enrollments WHERE subject_id = $1 AND instructor_id = $2',
      [subId, instructorId]
    );
    if (ceExists.rows.length === 0) {
      await query(
        'INSERT INTO class_enrollments (id, subject_id, instructor_id) VALUES ($1, $2, $3)',
        [uuidv4(), subId, instructorId]
      );
    }
  }

  // 3 sample students (bulk-imported style)
  const students = [
    { email: 'student1@example.com', name: 'Alice Johnson' },
    { email: 'student2@example.com', name: 'Bob Smith' },
    { email: 'student3@example.com', name: 'Carol Williams' },
  ];

  for (const st of students) {
    const stExists = await query('SELECT id FROM users WHERE email = $1', [st.email]);
    let studentId;
    if (stExists.rows.length === 0) {
      studentId = uuidv4();
      await query(
        `INSERT INTO users (id, name, email, role, status)
         VALUES ($1, $2, $3, 'student', 'active')`,
        [studentId, st.name, st.email]
      );
      console.log(`Created student: ${st.email}`);
    } else {
      studentId = stExists.rows[0].id;
      console.log(`Student ${st.email} already exists.`);
    }

    // Enroll in CS101
    const cs101 = (await query('SELECT id FROM subjects WHERE code = $1', ['CS101'])).rows[0];
    if (cs101) {
      const enrolled = await query(
        'SELECT id FROM class_enrollments WHERE subject_id = $1 AND student_id = $2',
        [cs101.id, studentId]
      );
      if (enrolled.rows.length === 0) {
        await query(
          'INSERT INTO class_enrollments (id, subject_id, student_id) VALUES ($1, $2, $3)',
          [uuidv4(), cs101.id, studentId]
        );
      }
    }
  }

  // ── Department ────────────────────────────────────────────────────────────
  console.log('[seed] Seeding department...');
  const deptRes = await query(
    `INSERT INTO departments (name, code, created_by)
     VALUES ('Computer Science', 'CS', $1)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [adminId]
  );
  const deptId = deptRes.rows[0].id;
  console.log('[seed] Department id:', deptId);

  // ── Course ────────────────────────────────────────────────────────────────
  console.log('[seed] Seeding course...');
  const courseRes = await query(
    `INSERT INTO courses (name, code, department_id, duration_years)
     VALUES ('B.Tech Computer Science', 'BTCS', $1, 4)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [deptId]
  );
  const courseId = courseRes.rows[0].id;
  console.log('[seed] Course id:', courseId);

  // ── Academic Year ─────────────────────────────────────────────────────────
  console.log('[seed] Seeding academic year...');
  const acadYearRes = await query(
    `INSERT INTO academic_years (label, start_date, end_date, is_current, created_by)
     VALUES ('2024-2025', '2024-07-01', '2025-06-30', true, $1)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [adminId]
  );
  let acadYearId;
  if (acadYearRes.rows.length > 0) {
    acadYearId = acadYearRes.rows[0].id;
  } else {
    const existing = await query(`SELECT id FROM academic_years WHERE label = '2024-2025'`);
    acadYearId = existing.rows[0].id;
  }
  console.log('[seed] Academic year id:', acadYearId);

  // ── Semesters ─────────────────────────────────────────────────────────────
  console.log('[seed] Seeding semesters...');
  const sem1Res = await query(
    `INSERT INTO semesters (academic_year_id, number, start_date, end_date, is_current)
     VALUES ($1, 1, '2024-07-01', '2024-12-31', true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [acadYearId]
  );
  let sem1Id;
  if (sem1Res.rows.length > 0) {
    sem1Id = sem1Res.rows[0].id;
  } else {
    const existing = await query(
      `SELECT id FROM semesters WHERE academic_year_id = $1 AND number = 1`,
      [acadYearId]
    );
    sem1Id = existing.rows[0].id;
  }
  console.log('[seed] Semester 1 id:', sem1Id);

  const sem2Res = await query(
    `INSERT INTO semesters (academic_year_id, number, start_date, end_date, is_current)
     VALUES ($1, 2, '2025-01-01', '2025-06-30', false)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [acadYearId]
  );
  let sem2Id;
  if (sem2Res.rows.length > 0) {
    sem2Id = sem2Res.rows[0].id;
  } else {
    const existing = await query(
      `SELECT id FROM semesters WHERE academic_year_id = $1 AND number = 2`,
      [acadYearId]
    );
    sem2Id = existing.rows[0].id;
  }
  console.log('[seed] Semester 2 id:', sem2Id);

  // ── Mentor user ───────────────────────────────────────────────────────────
  console.log('[seed] Seeding mentor user...');
  const mentorRes = await query(
    `INSERT INTO users (name, email, role, status, google_id)
     VALUES ('Dr. Mentor Demo', 'mentor.demo@gmail.com', 'mentor', 'active', 'mentor_demo_google_id')
     ON CONFLICT (email) DO UPDATE SET role = 'mentor', status = 'active'
     RETURNING id`,
    []
  );
  const mentorId = mentorRes.rows[0].id;
  console.log('[seed] Mentor id:', mentorId);

  // ── Update existing students: set department_id ───────────────────────────
  console.log('[seed] Updating student department_id...');
  await query(
    `UPDATE users SET department_id = $1 WHERE role = 'student' AND status = 'active'`,
    [deptId]
  );

  // ── Update existing teachers: set department_id ───────────────────────────
  console.log('[seed] Updating teacher department_id...');
  await query(
    `UPDATE users SET department_id = $1 WHERE role = 'teacher' AND status = 'active'`,
    [deptId]
  );

  // ── Fetch active students ─────────────────────────────────────────────────
  const activeStudentsRes = await query(
    `SELECT id FROM users WHERE role = 'student' AND status = 'active'`
  );
  const activeStudents = activeStudentsRes.rows;
  console.log('[seed] Active students found:', activeStudents.length);

  // ── Course enrollments ────────────────────────────────────────────────────
  console.log('[seed] Seeding course enrollments...');
  for (const { id: studentId } of activeStudents) {
    await query(
      `INSERT INTO course_enrollments (student_id, course_id, academic_year_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [studentId, courseId, acadYearId]
    );
  }

  // ── Mentor assignments ────────────────────────────────────────────────────
  console.log('[seed] Seeding mentor assignments...');
  for (const { id: studentId } of activeStudents) {
    await query(
      `INSERT INTO mentor_assignments (mentor_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [mentorId, studentId]
    );
  }

  // ── Timetable slots ───────────────────────────────────────────────────────
  console.log('[seed] Seeding timetable slots...');
  const timetableSubjectsRes = await query(`SELECT id, code FROM subjects LIMIT 3`);
  const timetableSubjects = timetableSubjectsRes.rows;

  for (let i = 0; i < timetableSubjects.length; i++) {
    const subject = timetableSubjects[i];
    // Find first teacher assigned to this subject via class_enrollments
    const teacherRes = await query(
      `SELECT instructor_id FROM class_enrollments
       WHERE subject_id = $1 AND instructor_id IS NOT NULL
       LIMIT 1`,
      [subject.id]
    );
    if (teacherRes.rows.length === 0) {
      console.log(`[seed] No teacher found for subject ${subject.code}, skipping timetable slot.`);
      continue;
    }
    const teacherId = teacherRes.rows[0].instructor_id;
    await query(
      `INSERT INTO timetable_slots (subject_id, teacher_id, day_of_week, start_time, end_time, room)
       VALUES ($1, $2, $3, '09:00', '10:00', $4)
       ON CONFLICT DO NOTHING`,
      [subject.id, teacherId, i % 5, `Room 10${i}`]
    );
    console.log(`[seed] Timetable slot for subject ${subject.code}, day ${i % 5}`);
  }

  // ── Sample marks ──────────────────────────────────────────────────────────
  console.log('[seed] Seeding sample marks...');
  // Find first teacher user for entered_by
  const firstTeacherRes = await query(
    `SELECT id FROM users WHERE role = 'teacher' AND status = 'active' LIMIT 1`
  );
  const enteredBy = firstTeacherRes.rows.length > 0
    ? firstTeacherRes.rows[0].id
    : adminId;

  for (const { id: studentId } of activeStudents) {
    for (const subject of timetableSubjects) {
      // internal: score 15–25, max 25
      const internalScore = Math.floor(Math.random() * 11) + 15;
      await query(
        `INSERT INTO marks (student_id, subject_id, semester_id, assessment_type, scored_marks, max_marks, uploaded_by)
         VALUES ($1, $2, $3, 'internal', $4, 25, $5)
         ON CONFLICT (student_id, subject_id, semester_id, assessment_type) DO NOTHING`,
        [studentId, subject.id, sem1Id, internalScore, enteredBy]
      );
      // midterm: score 40–70, max 75
      const midtermScore = Math.floor(Math.random() * 31) + 40;
      await query(
        `INSERT INTO marks (student_id, subject_id, semester_id, assessment_type, scored_marks, max_marks, uploaded_by)
         VALUES ($1, $2, $3, 'midterm', $4, 75, $5)
         ON CONFLICT (student_id, subject_id, semester_id, assessment_type) DO NOTHING`,
        [studentId, subject.id, sem1Id, midtermScore, enteredBy]
      );
    }
  }
  console.log('[seed] Sample marks inserted.');

  // ── Generate results preview ──────────────────────────────────────────────
  console.log('[seed] Generating results preview for semester 1...');
  try {
    const { generateResultsForSemester } = await import('../services/gradeService.js');
    await generateResultsForSemester(sem1Id, adminId);
    console.log('[seed] Results generated for semester 1.');
  } catch (err) {
    console.log('[seed] Results generation skipped or failed (non-fatal):', err.message);
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
