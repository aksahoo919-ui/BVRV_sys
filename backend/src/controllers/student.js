import { query } from '../config/db.js';
import redis from '../config/redis.js';
import { v4 as uuidv4 } from 'uuid';

export async function getSubjects(req, res) {
  try {
    const settingsResult = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
    const threshold = settingsResult.rows[0]?.min_attendance_threshold || 75;

    const result = await query(`
      SELECT
        s.id, s.code, s.name,
        COUNT(DISTINCT sess.id) AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false) AS attended,
        CASE WHEN COUNT(DISTINCT sess.id) > 0
          THEN ROUND(
            (COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false)::numeric
            / COUNT(DISTINCT sess.id)) * 100, 1
          )
          ELSE 0
        END AS percentage
      FROM subjects s
      JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.student_id = $1
      LEFT JOIN sessions sess ON sess.subject_id = s.id AND sess.closed = true
      LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
      GROUP BY s.id
      ORDER BY s.name
    `, [req.user.id]);

    res.json(result.rows.map(r => ({ ...r, warning: Number(r.percentage) < threshold && Number(r.total_sessions) > 0 })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function submitAttendance(req, res) {
  const { pin, subject_id } = req.body;
  if (!pin || !subject_id) return res.status(400).json({ error: 'pin and subject_id required' });

  try {
    // Find open, non-expired session for subject_id
    const sessionResult = await query(
      `SELECT * FROM sessions
       WHERE subject_id = $1 AND closed = false AND expires_at > NOW()
       ORDER BY opened_at DESC LIMIT 1`,
      [subject_id]
    );

    if (!sessionResult.rows.length) {
      return res.status(400).json({ error: 'No active session for this subject' });
    }

    const session = sessionResult.rows[0];

    // Check PIN against stored pin_display
    if (pin.toUpperCase() !== session.pin_display.toUpperCase()) {
      return res.status(400).json({ error: 'Invalid PIN' });
    }

    // Check DB first (always reliable, even without Redis)
    const existingLog = await query(
      'SELECT id FROM attendance_logs WHERE session_id = $1 AND student_id = $2',
      [session.id, req.user.id]
    );
    if (existingLog.rows.length > 0) {
      return res.status(409).json({ error: 'Already marked' });
    }

    // Also check Redis if available (faster for hot-path replay protection)
    const redisKey = `used:${session.id}:${req.user.id}`;
    if (redis) {
      try {
        const alreadyUsed = await redis.get(redisKey);
        if (alreadyUsed) {
          return res.status(409).json({ error: 'Already marked' });
        }
      } catch {
        // Redis unavailable — DB check above is sufficient
      }
    }

    // Set Redis key with 24h TTL (best-effort)
    if (redis) {
      try { await redis.set(redisKey, '1', 'EX', 86400); } catch { /* ignore */ }
    }

    // Insert attendance log
    await query(
      `INSERT INTO attendance_logs (id, session_id, student_id, status, replayed)
       VALUES ($1, $2, $3, 'present', false)`,
      [uuidv4(), session.id, req.user.id]
    );

    res.json({ message: 'Attendance marked!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAttendanceSummary(req, res) {
  try {
    const settingsResult = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
    const threshold = settingsResult.rows[0]?.min_attendance_threshold || 75;

    const result = await query(`
      SELECT
        s.id AS subject_id, s.code, s.name,
        COUNT(DISTINCT sess.id) AS total_sessions,
        COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false) AS attended,
        CASE WHEN COUNT(DISTINCT sess.id) > 0
          THEN ROUND(
            (COUNT(DISTINCT al.session_id) FILTER (WHERE al.status = 'present' AND al.replayed = false)::numeric
            / COUNT(DISTINCT sess.id)) * 100, 1
          )
          ELSE 0
        END AS percentage
      FROM subjects s
      JOIN class_enrollments ce ON ce.subject_id = s.id AND ce.student_id = $1
      LEFT JOIN sessions sess ON sess.subject_id = s.id AND sess.closed = true
      LEFT JOIN attendance_logs al ON al.session_id = sess.id AND al.student_id = $1
      GROUP BY s.id
      ORDER BY s.name
    `, [req.user.id]);

    res.json(result.rows.map(r => ({
      ...r,
      warning: Number(r.percentage) < threshold && Number(r.total_sessions) > 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getMessages(req, res) {
  try {
    // Get subjects for this student
    const subjectsResult = await query(
      'SELECT subject_id FROM class_enrollments WHERE student_id = $1',
      [req.user.id]
    );
    const subjectIds = subjectsResult.rows.map(r => r.subject_id);

    const result = await query(`
      SELECT
        m.id, m.body, m.audience, m.sent_at, m.subject_id,
        u.name AS sender_name, u.avatar_url AS sender_avatar,
        mr.read_at IS NOT NULL AS is_read,
        s.name AS subject_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = $1
      LEFT JOIN subjects s ON s.id = m.subject_id
      WHERE
        m.audience = 'everyone'
        OR m.audience = 'all_students'
        OR (m.audience = 'class_students' AND m.subject_id = ANY($2::uuid[]))
      ORDER BY m.sent_at DESC
    `, [req.user.id, subjectIds]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markRead(req, res) {
  const { id } = req.params;
  try {
    await query(
      `INSERT INTO message_reads (id, message_id, user_id)
       VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id) DO NOTHING`,
      [uuidv4(), id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Marks ─────────────────────────────────────────────────────────────────

export async function getMarks(req, res) {
  try {
    const { semester_id } = req.query;
    const params = [req.user.id];
    const semClause = semester_id ? `AND m.semester_id=$${params.push(semester_id)}` : '';
    const r = await query(`
      SELECT m.*, s.name AS subject_name, s.code AS subject_code,
             sem.number AS semester_number,
             COALESCE(ay.label, ay2.label) AS year_label
      FROM marks m
      JOIN subjects s ON s.id = m.subject_id
      LEFT JOIN semesters sem ON sem.id = m.semester_id
      LEFT JOIN academic_years ay ON ay.id = sem.academic_year_id
      LEFT JOIN academic_years ay2 ON ay2.id = m.academic_year_id
      WHERE m.student_id=$1 ${semClause}
      ORDER BY sem.number DESC NULLS LAST, s.name, m.assessment_type`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Results ───────────────────────────────────────────────────────────────

export async function getResults(req, res) {
  try {
    const r = await query(`
      SELECT r.*, sem.number AS semester_number, ay.label AS year_label
      FROM results r
      JOIN semesters sem ON sem.id = r.semester_id
      JOIN academic_years ay ON ay.id = sem.academic_year_id
      WHERE r.student_id=$1 AND r.published=true
      ORDER BY sem.number DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Leave Requests ────────────────────────────────────────────────────────

export async function submitLeaveRequest(req, res) {
  try {
    const { from_date, to_date, reason } = req.body;
    if (!from_date || !to_date || !reason) return res.status(400).json({ error: 'from_date, to_date, reason required' });
    const r = await query(
      'INSERT INTO leave_requests (id,student_id,from_date,to_date,reason) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [uuidv4(), req.user.id, from_date, to_date, reason]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

export async function getMyLeaveRequests(req, res) {
  try {
    const r = await query(`
      SELECT lr.*, rev.name AS reviewed_by_name
      FROM leave_requests lr LEFT JOIN users rev ON rev.id=lr.reviewed_by
      WHERE lr.student_id=$1 ORDER BY lr.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Meetings (view scheduled by mentor) ────────────────────────────────────

export async function getMyMeetings(req, res) {
  try {
    const r = await query(`
      SELECT ms.*, u.name AS mentor_name, u.avatar_url AS mentor_avatar
      FROM meeting_schedules ms JOIN users u ON u.id=ms.mentor_id
      WHERE ms.student_id=$1 ORDER BY ms.scheduled_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Notifications (new table) ─────────────────────────────────────────────

export async function getNotifications(req, res) {
  try {
    const subjectsR = await query('SELECT subject_id FROM class_enrollments WHERE student_id=$1', [req.user.id]);
    const subjectIds = subjectsR.rows.map(r => r.subject_id);

    const r = await query(`
      SELECT n.*, u.name AS sender_name, u.avatar_url AS sender_avatar,
             nr.read_at IS NOT NULL AS is_read,
             s.name AS subject_name
      FROM notifications n
      JOIN users u ON u.id=n.sender_id
      LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=$1
      LEFT JOIN subjects s ON s.id=n.subject_id
      WHERE n.audience='everyone' OR n.audience='all_students'
        OR (n.audience='class_students' AND n.subject_id=ANY($2::uuid[]))
      ORDER BY n.sent_at DESC`,
      [req.user.id, subjectIds]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

export async function markNotificationRead(req, res) {
  try {
    await query(
      `INSERT INTO notification_reads (id,notification_id,user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [uuidv4(), req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Timetable ─────────────────────────────────────────────────────────────

export async function getTimetable(req, res) {
  try {
    const r = await query(`
      SELECT ts.*, s.name AS subject_name, s.code AS subject_code,
             u.name AS teacher_name, u.email AS teacher_email
      FROM timetable_slots ts
      JOIN subjects s ON s.id = ts.subject_id
      JOIN users u ON u.id = ts.teacher_id
      WHERE ts.subject_id IN (
        SELECT subject_id FROM class_enrollments WHERE student_id = $1
      )
      ORDER BY ts.day_of_week, ts.start_time
    `, [req.user.id]);
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Report card (student self-download) ───────────────────────────────────

export async function getMyReportCard(req, res) {
  try {
    const { semester_id } = req.params;

    const [marksR, attendanceR, resultR, settingsR, semR, studentR] = await Promise.all([
      query(`
        SELECT m.assessment_type, m.scored_marks, m.max_marks,
               s.name AS subject_name, s.code AS subject_code, s.credits
        FROM marks m JOIN subjects s ON s.id = m.subject_id
        WHERE m.student_id = $1 AND m.semester_id = $2
        ORDER BY s.name, m.assessment_type`, [req.user.id, semester_id]),
      query(`
        SELECT s.name AS subject_name, s.code,
          COUNT(DISTINCT sess.id) AS total_sessions,
          COUNT(DISTINCT al.session_id) FILTER (WHERE al.status='present' AND al.replayed=false) AS attended
        FROM subjects s
        JOIN class_enrollments ce ON ce.subject_id=s.id AND ce.student_id=$1
        LEFT JOIN sessions sess ON sess.subject_id=s.id AND sess.closed=true
        LEFT JOIN attendance_logs al ON al.session_id=sess.id AND al.student_id=$1
        GROUP BY s.id ORDER BY s.name`, [req.user.id]),
      query(`SELECT * FROM results WHERE student_id=$1 AND semester_id=$2 AND published=true`, [req.user.id, semester_id]),
      query(`SELECT grade_boundaries, gpa_scale, min_attendance_threshold FROM institution_settings LIMIT 1`),
      query(`SELECT s.number, ay.label FROM semesters s JOIN academic_years ay ON ay.id=s.academic_year_id WHERE s.id=$1`, [semester_id]),
      query(`SELECT name, email, roll_number, phone FROM users WHERE id=$1`, [req.user.id]),
    ]);

    if (!resultR.rows.length) return res.status(404).json({ error: 'Results not published yet' });

    const result   = resultR.rows[0];
    const settings = settingsR.rows[0] || {};
    const semInfo  = semR.rows[0] || {};
    const student  = studentR.rows[0] || {};

    const data = {
      student,
      semester: semInfo,
      marks: marksR.rows,
      attendance: attendanceR.rows.map(a => ({
        ...a,
        percentage: a.total_sessions > 0 ? Math.round(a.attended / a.total_sessions * 100) : 0,
      })),
      result: { gpa: result.gpa, cgpa: result.cgpa, rank: result.rank },
      grade_boundaries: settings.grade_boundaries,
    };

    if (req.query.export === 'pdf') {
      const { buildPdf } = await import('../utils/exportUtils.js');
      const attRows  = data.attendance.map(a => [a.code, a.subject_name, a.attended, a.total_sessions, `${a.percentage}%`]);
      const marksRows = data.marks.map(m => [m.subject_code, m.subject_name, m.assessment_type, m.scored_marks, m.max_marks]);
      const buf = await buildPdf(`Report Card — Semester ${semInfo.number}`, [
        { heading: 'Student Information', keyValues: [
          ['Name', student.name], ['Roll No', student.roll_number ?? '—'], ['Email', student.email],
        ]},
        { heading: 'Marks', headers: ['Code','Subject','Type','Scored','Max'], rows: marksRows },
        { heading: 'Attendance', headers: ['Code','Subject','Attended','Total','%'], rows: attRows },
        { heading: 'Result', keyValues: [['GPA', result.gpa], ['CGPA', result.cgpa], ['Rank', result.rank ?? '—']] },
      ]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-card-sem${semInfo.number}.pdf"`);
      return res.send(buf);
    }

    res.json(data);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Marks memo ────────────────────────────────────────────────────────────

export async function getMarksMemo(req, res) {
  try {
    const { semester_id } = req.params;
    const [marksR, semR, studentR] = await Promise.all([
      query(`
        SELECT m.*, s.name AS subject_name, s.code AS subject_code
        FROM marks m JOIN subjects s ON s.id = m.subject_id
        WHERE m.student_id = $1 AND m.semester_id = $2
        ORDER BY s.name, m.assessment_type`, [req.user.id, semester_id]),
      query(`SELECT s.number, ay.label FROM semesters s JOIN academic_years ay ON ay.id=s.academic_year_id WHERE s.id=$1`, [semester_id]),
      query(`SELECT name, email, roll_number FROM users WHERE id=$1`, [req.user.id]),
    ]);

    const student = studentR.rows[0] || {};
    const semInfo = semR.rows[0] || {};

    if (req.query.export === 'pdf') {
      const { buildPdf } = await import('../utils/exportUtils.js');
      const rows = marksR.rows.map(m => [m.subject_code, m.subject_name, m.assessment_type, m.scored_marks, m.max_marks,
        m.max_marks > 0 ? Math.round(m.scored_marks / m.max_marks * 100) + '%' : '—']);
      const buf = await buildPdf(`Marks Memo — Semester ${semInfo.number}`, [
        { heading: 'Student', keyValues: [['Name', student.name], ['Roll No', student.roll_number ?? '—']] },
        { headers: ['Code','Subject','Type','Scored','Max','%'], rows },
      ]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="marks-memo-sem${semInfo.number}.pdf"`);
      return res.send(buf);
    }

    res.json({ student, semester: semInfo, marks: marksR.rows });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Profile ───────────────────────────────────────────────────────────────

export async function getProfile(req, res) {
  try {
    const r = await query(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.roll_number,
             u.employee_id, u.phone, u.date_of_birth, u.profile_updated_at,
             u.created_at, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
    `, [req.user.id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

export async function updateProfile(req, res) {
  try {
    const { phone, date_of_birth } = req.body;
    // Students can only update phone and date_of_birth; name/email come from Google
    const r = await query(`
      UPDATE users SET
        phone            = COALESCE($1, phone),
        date_of_birth    = COALESCE($2, date_of_birth),
        profile_updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, email, phone, date_of_birth, roll_number, profile_updated_at
    `, [phone ?? null, date_of_birth ?? null, req.user.id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}

// ── Student Settings ──────────────────────────────────────────────────────

// GET /api/student/settings
export async function getStudentSettings(req, res) {
  try {
    const r = await query('SELECT min_attendance_threshold FROM institution_settings LIMIT 1');
    res.json({ attendance_threshold: r.rows[0]?.min_attendance_threshold ?? 75 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/student/attendance/today
export async function getTodayAttendance(req, res) {
  try {
    const studentId = req.user.id;
    // All subjects this student is enrolled in
    const subjR = await query(`
      SELECT s.id AS subject_id, s.name AS subject_name, s.code AS subject_code
      FROM class_enrollments ce
      JOIN subjects s ON s.id = ce.subject_id
      WHERE ce.student_id = $1
    `, [studentId]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const results = [];
    for (const subj of subjR.rows) {
      // Find open session for this subject today
      const sessR = await query(`
        SELECT id, expires_at, pin_display
        FROM sessions
        WHERE subject_id = $1 AND closed = false AND expires_at > NOW()
        LIMIT 1
      `, [subj.subject_id]);

      const session = sessR.rows[0] || null;

      // Check if student already marked today
      let alreadyMarked = false;
      if (session) {
        const markR = await query(
          'SELECT 1 FROM attendance_logs WHERE session_id=$1 AND student_id=$2',
          [session.id, studentId]
        );
        alreadyMarked = markR.rows.length > 0;
      } else {
        // Check if there was any session today and student was present
        const todayR = await query(`
          SELECT 1 FROM attendance_logs al
          JOIN sessions sess ON sess.id = al.session_id
          WHERE sess.subject_id=$1 AND al.student_id=$2
            AND sess.opened_at >= $3 AND sess.opened_at < $4
          LIMIT 1
        `, [subj.subject_id, studentId, today, tomorrow]);
        alreadyMarked = todayR.rows.length > 0;
      }

      results.push({
        subject_id: subj.subject_id,
        subject_name: subj.subject_name,
        subject_code: subj.subject_code,
        session_open: !!session,
        session_id: session?.id ?? null,
        expires_at: session?.expires_at ?? null,
        already_marked: alreadyMarked,
      });
    }
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Assigned mentor ───────────────────────────────────────────────────────

export async function getMyMentor(req, res) {
  try {
    const r = await query(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.phone
      FROM mentor_assignments ma
      JOIN users u ON u.id = ma.mentor_id
      WHERE ma.student_id = $1
    `, [req.user.id]);
    if (!r.rows.length) return res.json(null);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
}
