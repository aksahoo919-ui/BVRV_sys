/**
 * gradeService.js
 * Pure computation helpers for grades, GPA, and result generation.
 */
import { query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// ── Core grade / GPA calculators ──────────────────────────────────────────

/**
 * calculateGrade(percentage, gradeBoundaries)
 * gradeBoundaries: { "S": 90, "A": 80, "B": 70, "C": 60, "D": 50, "F": 0 }
 * Returns the highest letter grade whose threshold the percentage meets.
 */
export function calculateGrade(percentage, gradeBoundaries) {
  const pct = Number(percentage);
  if (!gradeBoundaries || isNaN(pct)) return 'F';
  const sorted = Object.entries(gradeBoundaries)
    .sort(([, a], [, b]) => Number(b) - Number(a));
  for (const [grade, threshold] of sorted) {
    if (pct >= Number(threshold)) return grade;
  }
  return 'F';
}

/**
 * calculateGPA(percentage, gpaScale, gradeBoundaries)
 * Maps percentage to a GPA on the configured scale.
 * Step-based: highest grade → scale, each grade step down → -1, F → 0.
 * e.g. 10-point scale, 6 grades: S→10, A→9, B→8, C→7, D→6, F→0
 */
export function calculateGPA(percentage, gpaScale, gradeBoundaries) {
  const pct = Number(percentage);
  const scale = Number(gpaScale) || 10;
  if (isNaN(pct) || !gradeBoundaries) return 0;

  const sorted = Object.entries(gradeBoundaries)
    .sort(([, a], [, b]) => Number(b) - Number(a));

  // Find grade index (position in descending boundary list)
  let gradeIdx = sorted.length - 1; // default to last (lowest)
  for (let i = 0; i < sorted.length; i++) {
    if (pct >= Number(sorted[i][1])) { gradeIdx = i; break; }
  }

  const [gradeName] = sorted[gradeIdx];
  if (gradeName === 'F') return 0;
  return Math.max(0, scale - gradeIdx);
}

/**
 * calculateCGPA(allSemesterGPAs)
 * Simple arithmetic mean, rounded to 2 decimal places.
 */
export function calculateCGPA(allSemesterGPAs) {
  const valid = (allSemesterGPAs || []).filter(g => g != null && !isNaN(Number(g)));
  if (!valid.length) return 0;
  const sum = valid.reduce((a, g) => a + Number(g), 0);
  return Math.round(sum / valid.length * 100) / 100;
}

// ── Result generation ─────────────────────────────────────────────────────

/**
 * generateResultsForSemester(semesterId, actorId)
 * For every student who has marks in the given semester:
 *  1. Aggregates subject-wise marks → percentage → GPA (credit-weighted)
 *  2. Fetches all other semester GPAs → computes CGPA
 *  3. Upserts into results table
 *  4. Assigns sequential ranks (by GPA desc)
 * Returns array of { studentId, gpa, cgpa, rank }
 */
export async function generateResultsForSemester(semesterId, actorId) {
  // 1. Settings
  const settingsR = await query(
    'SELECT gpa_scale, grade_boundaries, min_attendance_threshold FROM institution_settings LIMIT 1'
  );
  const settings       = settingsR.rows[0] || {};
  const gpaScale       = Number(settings.gpa_scale) || 10;
  const gradeBoundaries = settings.grade_boundaries || { S:90, A:80, B:70, C:60, D:50, F:0 };

  // 2. Aggregate marks per student per subject for this semester
  const marksR = await query(`
    SELECT m.student_id, m.subject_id,
           COALESCE(s.credits, 3)    AS credits,
           SUM(m.scored_marks)::numeric AS total_scored,
           SUM(m.max_marks)::numeric    AS total_max
    FROM marks m
    JOIN subjects s ON s.id = m.subject_id
    WHERE m.semester_id = $1
    GROUP BY m.student_id, m.subject_id, s.credits
  `, [semesterId]);

  if (!marksR.rows.length) return [];

  // 3. Group by student
  const byStudent = {};
  for (const row of marksR.rows) {
    if (!byStudent[row.student_id]) byStudent[row.student_id] = [];
    byStudent[row.student_id].push(row);
  }

  // 4. Compute per-student GPA
  const computed = [];
  for (const [studentId, subjects] of Object.entries(byStudent)) {
    let weightedGPASum = 0;
    let totalCredits   = 0;

    for (const subj of subjects) {
      const pct = subj.total_max > 0
        ? (Number(subj.total_scored) / Number(subj.total_max)) * 100
        : 0;
      const subjectGPA = calculateGPA(pct, gpaScale, gradeBoundaries);
      const credits    = Number(subj.credits) || 3;
      weightedGPASum  += subjectGPA * credits;
      totalCredits    += credits;
    }

    const semesterGPA = totalCredits > 0
      ? Math.round(weightedGPASum / totalCredits * 100) / 100
      : 0;

    // CGPA: average across all semesters (excluding current, then include)
    const prevR = await query(
      `SELECT gpa FROM results WHERE student_id = $1 AND semester_id != $2`,
      [studentId, semesterId]
    );
    const cgpa = calculateCGPA([...prevR.rows.map(r => r.gpa), semesterGPA]);

    computed.push({ studentId, gpa: semesterGPA, cgpa });
  }

  // 5. Sort by GPA desc and assign ranks
  computed.sort((a, b) => b.gpa - a.gpa);
  let rank = 1;
  for (const s of computed) s.rank = rank++;

  // 6. Upsert results
  for (const s of computed) {
    await query(
      `INSERT INTO results (id, student_id, semester_id, gpa, cgpa, rank)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_id, semester_id) DO UPDATE
         SET gpa=$4, cgpa=$5, rank=$6`,
      [uuidv4(), s.studentId, semesterId, s.gpa, s.cgpa, s.rank]
    );
  }

  return computed;
}

/**
 * generateResultsForCourseYear(academicYearId, courseId, actorId)
 * Results are scoped to a single (academic_year, course) so different
 * courses and years never merge.
 *  1. Aggregates marks for subjects in this course + year → credit-weighted GPA
 *  2. CGPA = mean of this student's GPAs across all years for the SAME course
 *  3. Upserts into results keyed by (student_id, academic_year_id, course_id)
 *  4. Ranks within the course + year (by GPA desc)
 * Returns array of { studentId, gpa, cgpa, rank }
 */
export async function generateResultsForCourseYear(academicYearId, courseId, actorId) {
  const settingsR = await query(
    'SELECT gpa_scale, grade_boundaries, min_attendance_threshold FROM institution_settings LIMIT 1'
  );
  const settings        = settingsR.rows[0] || {};
  const gpaScale        = Number(settings.gpa_scale) || 10;
  const gradeBoundaries = settings.grade_boundaries || { S:90, A:80, B:70, C:60, D:50, F:0 };

  // Aggregate marks per student per subject for this course + academic year
  const marksR = await query(`
    SELECT m.student_id, m.subject_id,
           COALESCE(s.credits, 3)       AS credits,
           SUM(m.scored_marks)::numeric AS total_scored,
           SUM(m.max_marks)::numeric    AS total_max
    FROM marks m
    JOIN subjects s ON s.id = m.subject_id
    WHERE m.academic_year_id = $1 AND s.course_id = $2
    GROUP BY m.student_id, m.subject_id, s.credits
  `, [academicYearId, courseId]);

  if (!marksR.rows.length) return [];

  const byStudent = {};
  for (const row of marksR.rows) {
    if (!byStudent[row.student_id]) byStudent[row.student_id] = [];
    byStudent[row.student_id].push(row);
  }

  const computed = [];
  for (const [studentId, subjects] of Object.entries(byStudent)) {
    let weightedGPASum = 0;
    let totalCredits   = 0;

    for (const subj of subjects) {
      const pct = subj.total_max > 0
        ? (Number(subj.total_scored) / Number(subj.total_max)) * 100
        : 0;
      const subjectGPA = calculateGPA(pct, gpaScale, gradeBoundaries);
      const credits    = Number(subj.credits) || 3;
      weightedGPASum  += subjectGPA * credits;
      totalCredits    += credits;
    }

    const yearGPA = totalCredits > 0
      ? Math.round(weightedGPASum / totalCredits * 100) / 100
      : 0;

    // CGPA: average across all years for this student within the SAME course
    const prevR = await query(
      `SELECT gpa FROM results
       WHERE student_id = $1 AND course_id = $2 AND academic_year_id IS DISTINCT FROM $3`,
      [studentId, courseId, academicYearId]
    );
    const cgpa = calculateCGPA([...prevR.rows.map(r => r.gpa), yearGPA]);

    computed.push({ studentId, gpa: yearGPA, cgpa });
  }

  computed.sort((a, b) => b.gpa - a.gpa);
  let rank = 1;
  for (const s of computed) s.rank = rank++;

  for (const s of computed) {
    await query(
      `INSERT INTO results (id, student_id, academic_year_id, course_id, gpa, cgpa, rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (student_id, academic_year_id, course_id) DO UPDATE
         SET gpa=$5, cgpa=$6, rank=$7`,
      [uuidv4(), s.studentId, academicYearId, courseId, s.gpa, s.cgpa, s.rank]
    );
  }

  return computed;
}
