// "Bhakti Shastri 1 (English)" -> "Bhakti Shastri 1 - English"
export const className = name => String(name || '').replace(/\s*\((English|Hindi|Telugu)\)\s*$/, ' - $1');

// "BS1-E" -> 1, "KR-E" -> null
export const classYear = code => { const m = /^[A-Z]+(\d+)-/i.exec(String(code || '')); return m ? Number(m[1]) : null; };

// Semesters are for the BVRV courses (GF, BS, KR); Bhakti Vaibhav runs without semesters.
const NO_SEMESTER_COURSES = ['BV'];
// leading letters of the course or class code: "BV", "BV1-T" -> "BV"; "BS1-E" -> "BS"
const courseCode = s => (/^([A-Z]+)/i.exec(String(s?.course_code || s?.code || s?.subject_code || ''))?.[1] || '').toUpperCase();
export const hasSemesters = s => !!(s?.semester_id || s?.semester_label) && !NO_SEMESTER_COURSES.includes(courseCode(s));

// "Sem 2", "Sem 1 (past)" or '' for a course without semesters
export const semText = s => (hasSemesters(s) ? `${s.semester_label}${s.semester_is_current === false ? ' (past)' : ''}` : '');

// "Bhakti Shastri 1 - English (BS1-E) · Sem 1"
export const classLabel = (s, { semester = true } = {}) =>
  `${className(s.name)} (${s.code})${semester && semText(s) ? ` · ${semText(s)}` : ''}`;

// Semester filter: 'current' or a semester label ("Sem 1", "Sem 2"). Classes of a course without semesters always show.
export const semesterChoices = list => ['current', ...[...new Set((list || []).filter(hasSemesters).map(s => s.semester_label))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))];
export const inSemester = (s, sel) => (!hasSemesters(s) ? true
  : sel === 'current' ? s.semester_is_current !== false : s.semester_label === sel);
