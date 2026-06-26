/**
 * emailService.js
 * Nodemailer-based transactional email service.
 * All functions are fire-and-forget — they never throw.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
 */
import nodemailer from 'nodemailer';
import { query } from '../config/db.js';

// ── Transport (lazy — only created if SMTP_HOST is set) ───────────────────

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _transport;
}

async function isEnabled() {
  try {
    const r = await query('SELECT email_alerts_enabled FROM institution_settings LIMIT 1');
    return r.rows[0]?.email_alerts_enabled !== false;
  } catch { return false; }
}

// ── Core send ─────────────────────────────────────────────────────────────

export async function sendEmail({ to, bcc, subject, html, text }) {
  try {
    const transport = getTransport();
    if (!transport) return; // SMTP not configured — silent no-op
    if (!(await isEnabled())) return; // email_alerts_enabled = false
    if (!to && !(bcc && bcc.length)) return;
    await transport.sendMail({
      from:    process.env.FROM_EMAIL || process.env.SMTP_USER,
      to:      to || (process.env.FROM_EMAIL || process.env.SMTP_USER),
      bcc:     bcc && bcc.length ? bcc : undefined,
      subject, html, text,
    });
  } catch (err) {
    console.warn('[email] send failed:', err.message);
  }
}

// Re-export the HTML layout so other services can build consistent emails.
export function emailLayout(title, bodyHtml) { return layout(title, bodyHtml); }

// ── HTML layout helper ────────────────────────────────────────────────────

function layout(title, bodyHtml) {
  const inst = 'BVRV, ISKCON ABIDS';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
  .card { background: #fff; border-radius: 8px; max-width: 560px; margin: 0 auto;
          box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; }
  .header { background: #1e3a5f; color: #fff; padding: 20px 28px; }
  .header h2 { margin: 0; font-size: 18px; }
  .header p  { margin: 4px 0 0; font-size: 13px; opacity: .8; }
  .body { padding: 24px 28px; color: #334155; font-size: 14px; line-height: 1.6; }
  .badge { display:inline-block; padding:3px 10px; border-radius:9999px; font-size:12px; font-weight:600; }
  .badge-green { background:#dcfce7; color:#15803d; }
  .badge-red   { background:#fee2e2; color:#b91c1c; }
  .badge-amber { background:#fef9c3; color:#92400e; }
  .footer { padding: 12px 28px; font-size: 11px; color: #94a3b8;
            border-top: 1px solid #e2e8f0; text-align: center; }
</style></head>
<body>
<div class="card">
  <div class="header"><h2>${inst}</h2><p>${title}</p></div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">This is an automated message — please do not reply.</div>
</div></body></html>`;
}

// ── Specific email senders ────────────────────────────────────────────────

/** Password reset link */
export async function emailPasswordReset(user, link) {
  await sendEmail({
    to: user.email,
    subject: 'Reset your BVRV Attendance password',
    html: layout('Password Reset', `
      <p>Hare Krishna <strong>${user.name}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to set a new one.
         This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:18px 0">
        <a href="${link}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a>
      </p>
      <p style="font-size:12px;color:#64748b">If the button doesn't work, copy this link:<br>${link}</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

/** Account approved */
export async function emailAccountApproved(user) {
  await sendEmail({
    to: user.email,
    subject: 'Your account has been approved',
    html: layout('Account Approved', `
      <p>Hare Krishna <strong>${user.name}</strong>,</p>
      <p>Your account has been approved. You can now log in and access the system.</p>
      <p><span class="badge badge-green">✓ Approved</span></p>
      <p>Role assigned: <strong>${user.role}</strong></p>
    `),
  });
}

/** Account rejected / suspended */
export async function emailAccountRejected(user) {
  await sendEmail({
    to: user.email,
    subject: 'Account registration update',
    html: layout('Account Not Approved', `
      <p>Hare Krishna <strong>${user.name}</strong>,</p>
      <p>Unfortunately, your account registration was not approved at this time.
         Please contact the administration for further information.</p>
      <p><span class="badge badge-red">✗ Not Approved</span></p>
    `),
  });
}

/** Leave request status changed */
export async function emailLeaveRequestStatus(student, status, fromDate, toDate) {
  const badge = status === 'approved'
    ? '<span class="badge badge-green">✓ Approved</span>'
    : '<span class="badge badge-red">✗ Rejected</span>';
  await sendEmail({
    to: student.email,
    subject: `Leave request ${status}`,
    html: layout(`Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`, `
      <p>Hare Krishna <strong>${student.name}</strong>,</p>
      <p>Your leave request for <strong>${fromDate}</strong> to <strong>${toDate}</strong>
         has been <strong>${status}</strong>. ${badge}</p>
    `),
  });
}

/** Attendance correction request status changed (to teacher who submitted it) */
export async function emailCorrectionStatus(teacher, status, studentName, subjectName) {
  const badge = status === 'approved'
    ? '<span class="badge badge-green">✓ Approved</span>'
    : '<span class="badge badge-red">✗ Rejected</span>';
  await sendEmail({
    to: teacher.email,
    subject: `Attendance correction ${status}`,
    html: layout(`Correction ${status.charAt(0).toUpperCase() + status.slice(1)}`, `
      <p>Hare Krishna <strong>${teacher.name}</strong>,</p>
      <p>Your attendance correction request for <strong>${studentName}</strong>
         in <strong>${subjectName}</strong> has been <strong>${status}</strong>. ${badge}</p>
    `),
  });
}

/**
 * emailAttendanceAlert(studentEmail, studentName, subjectName, percentage, threshold, mentorEmail, mentorName)
 * Called after session close when a student's running attendance drops below threshold.
 */
export async function emailAttendanceAlert({
  studentEmail, studentName, subjectName, percentage, threshold, mentorEmail, mentorName,
}) {
  // Email student
  await sendEmail({
    to: studentEmail,
    subject: `⚠ Attendance warning: ${subjectName}`,
    html: layout('Attendance Warning', `
      <p>Hare Krishna <strong>${studentName}</strong>,</p>
      <p>Your attendance in <strong>${subjectName}</strong> has dropped to
         <strong>${percentage}%</strong>, which is below the required threshold of
         <strong>${threshold}%</strong>.</p>
      <p><span class="badge badge-amber">⚠ Below Threshold</span></p>
      <p>Please attend upcoming sessions to avoid being marked a defaulter.</p>
    `),
  });

  // Email mentor if assigned
  if (mentorEmail) {
    await sendEmail({
      to: mentorEmail,
      subject: `Attendance alert for ${studentName}`,
      html: layout('Student Attendance Alert', `
        <p>Hare Krishna <strong>${mentorName}</strong>,</p>
        <p>Your mentee <strong>${studentName}</strong> has attendance of
           <strong>${percentage}%</strong> in <strong>${subjectName}</strong>
           (threshold: ${threshold}%). Please follow up.</p>
      `),
    });
  }
}

/**
 * emailLowGpaAlert(mentor, students)
 * students: [{ name, email, gpa, threshold }]
 */
export async function emailLowGpaAlert(mentor, students) {
  if (!students.length) return;
  const rows = students.map(s =>
    `<tr><td>${s.name}</td><td>${s.gpa}</td><td>${s.threshold}</td></tr>`
  ).join('');
  await sendEmail({
    to: mentor.email,
    subject: 'GPA alert for assigned students',
    html: layout('Low GPA Alert', `
      <p>Hare Krishna <strong>${mentor.name}</strong>,</p>
      <p>The following students have GPA below the configured threshold:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr style="background:#e2e8f0"><th style="padding:6px;text-align:left">Student</th>
          <th style="padding:6px">GPA</th><th style="padding:6px">Threshold</th></tr>
        ${rows}
      </table>
      <p>Please schedule counseling sessions as needed.</p>
    `),
  });
}

/**
 * emailNotificationBroadcast(notification, recipientEmails)
 * notification: { title, body, audience }
 * recipientEmails: string[] — resolved by controller before calling
 */
export async function emailNotificationBroadcast(notification, recipientEmails) {
  if (!recipientEmails?.length) return;
  for (const to of recipientEmails) {
    await sendEmail({
      to,
      subject: notification.title,
      html: layout('New Notification', `
        <p><strong>${notification.title}</strong></p>
        <p>${notification.body.replace(/\n/g, '<br>')}</p>
      `),
    });
  }
}
