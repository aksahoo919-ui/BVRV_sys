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

function ymd(d) { return d.toISOString().slice(0, 10); }
function isRealEmail(e) {
  const s = String(e || '').toLowerCase();
  return s.includes('@') && !s.endsWith('@noemail.bvrv');
}

// ── Data ──────────────────────────────────────────────────────────────────

async function getBVLeaders() {
  const r = await query(
    `SELECT id, name, email FROM users
     WHERE (role='mentor' OR secondary_role='mentor') AND status='active'`
  );
  return r.rows;
}

// Attendance of a BV Leader's students within [start, end] (their weekly-class sessions)
async function studentsForLeader(mentorId, start, end) {
  const r = await query(`
    SELECT u.name, u.roll_number,
      COUNT(DISTINCT ms.id) AS total_sessions,
      COUNT(DISTINCT mat.session_id) FILTER (WHERE mat.status='present') AS attended
    FROM class_mentor_assignments cma
    JOIN users u ON u.id = cma.student_id
    LEFT JOIN mentor_sessions ms
      ON ms.subject_id = cma.subject_id AND ms.mentor_id = $1
      AND ms.session_date >= $2 AND ms.session_date <= $3
    LEFT JOIN mentor_attendance mat ON mat.session_id = ms.id AND mat.student_id = u.id
    WHERE cma.mentor_id = $1
    GROUP BY u.id
    ORDER BY u.name
  `, [mentorId, start, end]);
  return r.rows;
}

function reportHtml(leaderName, rows, periodLabel) {
  if (!rows.length) {
    return emailLayout(`Attendance Report — ${periodLabel}`,
      `<p>Hi <strong>${leaderName}</strong>,</p><p>You have no students assigned yet.</p>`);
  }
  const body = rows.map(s => {
    const total = Number(s.total_sessions) || 0;
    const att = Number(s.attended) || 0;
    const pct = total > 0 ? Math.round(att / total * 100) : 0;
    const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#92400e' : '#b91c1c';
    return `<tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${s.name}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${s.roll_number || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${att}/${total}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;color:${color};font-weight:600">${total ? pct + '%' : '—'}</td>
    </tr>`;
  }).join('');
  return emailLayout(`Attendance Report — ${periodLabel}`, `
    <p>Hi <strong>${leaderName}</strong>,</p>
    <p>Here is the attendance of your students for <strong>${periodLabel}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
      <tr style="background:#e2e8f0">
        <th style="padding:6px;text-align:left">Student</th>
        <th style="padding:6px;text-align:left">Roll No</th>
        <th style="padding:6px">Present/Total</th>
        <th style="padding:6px">%</th>
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
    if (!isRealEmail(leader.email)) continue;
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
  const recipients = r.rows.map(x => x.email).filter(isRealEmail);
  if (!recipients.length) { console.log('[scheduled] reminder: no recipients'); return 0; }
  await sendEmail({
    bcc: recipients,
    subject: 'Reminder: please mark & verify attendance',
    html: emailLayout('Attendance Reminder', `
      <p>Dear Teachers and BV Leaders,</p>
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
