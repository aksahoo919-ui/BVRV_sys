/**
 * scheduledEmails.js
 * Cron-driven emails sent from bvrvhyderabad@gmail.com:
 *   - Monthly: each BV Leader gets an attendance report of their students (1st, 8am IST)
 *   - Weekly:  each BV Leader gets last week's attendance of their students (Sat, 8am IST)
 *   - Reminders: BCC all BV Leaders + teachers to mark/verify attendance (Mon/Wed/Fri, 8am IST)
 *
 * Requires SMTP env vars (see emailService.js). No-op if SMTP isn't configured.
 */
import cron from 'node-cron';
import { query } from '../config/db.js';
import { sendEmail, emailLayout } from './emailService.js';

const TZ = 'Asia/Kolkata';

// Test mode: if TEST_EMAIL_RECIPIENTS is set (comma-separated), ONLY these
// addresses receive any scheduled/triggered mail. Leave unset for production.
const TEST_LIST = (process.env.TEST_EMAIL_RECIPIENTS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function ymd(d) { return d.toISOString().slice(0, 10); }
function isRealEmail(e) {
  const s = String(e || '').toLowerCase();
  return s.includes('@') && !s.endsWith('@noemail.bvrv');
}
// During testing, restrict to the allowlist.
function allowed(email) {
  if (!TEST_LIST.length) return true;
  return TEST_LIST.includes(String(email || '').toLowerCase());
}

// ── Data ──────────────────────────────────────────────────────────────────

async function getBVLeaders() {
  const r = await query(
    `SELECT id, name, email FROM users
     WHERE (role='mentor' OR secondary_role='mentor') AND status='active'`
  );
  return r.rows;
}

// For each of a BV Leader's students within [start, end]:
//  - bv: attendance in the leader's own common weekly class
//  - ac: academic attendance across the subjects the student is enrolled in
async function studentsForLeader(mentorId, start, end) {
  const totalR = await query(
    `SELECT COUNT(*)::int AS n FROM mentor_sessions
     WHERE mentor_id = $1 AND session_date >= $2 AND session_date <= $3`,
    [mentorId, start, end]
  );
  const bvTotal = totalR.rows[0].n;
  const r = await query(`
    SELECT u.name, u.roll_number,
      (SELECT COUNT(*) FROM mentor_attendance mat
         JOIN mentor_sessions ms ON ms.id = mat.session_id
         WHERE ms.mentor_id = $1 AND ms.session_date >= $2 AND ms.session_date <= $3
           AND mat.student_id = u.id AND mat.status='present')::int AS bv_attended,
      (SELECT COUNT(DISTINCT sess.id) FROM class_enrollments ce
         JOIN sessions sess ON sess.subject_id = ce.subject_id AND sess.closed = true
           AND sess.opened_at::date BETWEEN $2 AND $3
         WHERE ce.student_id = u.id)::int AS ac_total,
      (SELECT COUNT(DISTINCT al.session_id) FROM attendance_logs al
         JOIN sessions sess ON sess.id = al.session_id AND sess.closed = true
           AND sess.opened_at::date BETWEEN $2 AND $3
         JOIN class_enrollments ce ON ce.subject_id = sess.subject_id AND ce.student_id = u.id
         WHERE al.student_id = u.id AND al.status='present' AND al.replayed = false)::int AS ac_attended
    FROM (SELECT DISTINCT student_id FROM class_mentor_assignments WHERE mentor_id = $1) cma
    JOIN users u ON u.id = cma.student_id
    ORDER BY u.name
  `, [mentorId, start, end]);
  return r.rows.map(row => ({ ...row, bv_total: bvTotal }));
}

function reportHtml(leaderName, rows, periodLabel) {
  if (!rows.length) {
    return emailLayout(`Attendance Report — ${periodLabel}`,
      `<p>Hare Krishna <strong>${leaderName}</strong>,</p><p>You have no students assigned yet.</p>`);
  }
  const cell = (att, total) => {
    const a = Number(att) || 0, t = Number(total) || 0;
    const pct = t > 0 ? Math.round(a / t * 100) : 0;
    const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#92400e' : '#b91c1c';
    const txt = t > 0 ? `${a}/${t} <span style="color:${color};font-weight:600">(${pct}%)</span>` : '—';
    return `<td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${txt}</td>`;
  };
  const body = rows.map(s => `<tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${s.name}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${s.roll_number || '—'}</td>
      ${cell(s.bv_attended, s.bv_total)}
      ${cell(s.ac_attended, s.ac_total)}
    </tr>`).join('');
  return emailLayout(`Attendance Report — ${periodLabel}`, `
    <p>Hare Krishna <strong>${leaderName}</strong>,</p>
    <p>Here is the attendance of your students for <strong>${periodLabel}</strong> —
       both your weekly BV class and their subject (academic) classes:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
      <tr style="background:#e2e8f0">
        <th style="padding:6px;text-align:left">Student</th>
        <th style="padding:6px;text-align:left">Roll No</th>
        <th style="padding:6px">BV Class</th>
        <th style="padding:6px">Subjects</th>
      </tr>
      ${body}
    </table>
  `);
}

// ── Jobs ──────────────────────────────────────────────────────────────────

export async function sendBVLeaderReports(start, end, periodLabel) {
  const leaders = await getBVLeaders();
  let sent = 0;
  for (const leader of leaders) {
    if (!isRealEmail(leader.email) || !allowed(leader.email)) continue;
    const rows = await studentsForLeader(leader.id, start, end);
    await sendEmail({
      to: leader.email,
      subject: `Student Attendance Report — ${periodLabel}`,
      html: reportHtml(leader.name, rows, periodLabel),
    });
    sent++;
  }
  console.log(`[scheduled] BV Leader reports (${periodLabel}) sent to ${sent} leader(s)`);
  return sent;
}

export async function sendAttendanceReminders() {
  const r = await query(
    `SELECT email FROM users
     WHERE (role IN ('teacher','mentor') OR secondary_role IN ('teacher','mentor'))
       AND status='active'`
  );
  const recipients = r.rows.map(x => x.email).filter(isRealEmail).filter(allowed);
  if (!recipients.length) { console.log('[scheduled] reminder: no recipients'); return 0; }
  await sendEmail({
    bcc: recipients,
    subject: 'Reminder: please mark & verify attendance',
    html: emailLayout('Attendance Reminder', `
      <p>Hare Krishna Teachers and BV Leaders,</p>
      <p>This is a gentle reminder to <strong>mark and verify the attendance</strong> of your students in the BVRV Attendance system.</p>
      <p>Please ensure today's records are up to date. Thank you for your service.</p>
    `),
  });
  console.log(`[scheduled] reminder sent (BCC ${recipients.length})`);
  return recipients.length;
}

export async function runMonthlyReports() {
  // previous calendar month
  const now = new Date();
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrev = new Date(firstThisMonth.getTime() - 86400000);
  const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
  const label = firstPrev.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  return sendBVLeaderReports(ymd(firstPrev), ymd(lastPrev), label);
}

export async function runWeeklyReports() {
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 86400000); // last 7 days incl today
  return sendBVLeaderReports(ymd(start), ymd(now), 'Last Week');
}

// ── Scheduler ───────────────────────────────────────────────────────────────

export function initScheduledEmails() {
  // Monthly — 1st of every month at 08:00 IST
  cron.schedule('0 8 1 * *', () => { runMonthlyReports().catch(e => console.warn('[scheduled] monthly error', e.message)); }, { timezone: TZ });
  // Weekly — every Saturday at 08:00 IST
  cron.schedule('0 8 * * 6', () => { runWeeklyReports().catch(e => console.warn('[scheduled] weekly error', e.message)); }, { timezone: TZ });
  // Reminders — Mon, Wed, Fri at 08:00 IST
  cron.schedule('0 8 * * 1,3,5', () => { sendAttendanceReminders().catch(e => console.warn('[scheduled] reminder error', e.message)); }, { timezone: TZ });
  console.log('[scheduled] email jobs registered (Asia/Kolkata)');
}
