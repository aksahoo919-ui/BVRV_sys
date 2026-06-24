/**
 * Run a scheduled email job manually from the server (no HTTP/token needed).
 * Usage:  node src/scripts/runEmailJob.js <monthly|weekly|reminder>
 * Uses the backend .env (SMTP_*, DATABASE_URL, TEST_EMAIL_RECIPIENTS).
 */
import dotenv from 'dotenv';
dotenv.config();

import {
  runMonthlyReports,
  runWeeklyReports,
  sendAttendanceReminders,
} from '../services/scheduledEmails.js';

const type = process.argv[2];
const jobs = {
  monthly: runMonthlyReports,
  weekly: runWeeklyReports,
  reminder: sendAttendanceReminders,
};

const fn = jobs[type];
if (!fn) {
  console.error('Usage: node src/scripts/runEmailJob.js <monthly|weekly|reminder>');
  process.exit(1);
}

fn()
  .then((count) => { console.log(`✓ Job '${type}' done. Recipients/leaders: ${count}`); process.exit(0); })
  .catch((err) => { console.error(`✗ Job '${type}' failed:`, err.message); process.exit(1); });
