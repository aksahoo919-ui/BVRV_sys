// IST (Asia/Kolkata, UTC+05:30, no DST) calendar helpers.
// All attendance days and the weekly edit lock are evaluated in IST,
// independent of the server's or database's own timezone.

const IST_OFFSET_MS = 330 * 60 * 1000;

// SQL expression for "today" in IST.
export const SQL_TODAY_IST = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;

// Statuses that count as "attended" (service = came to class, then sent for service).
export const SQL_ATTENDED = `('present','service')`;

// 'YYYY-MM-DD' for the IST calendar day of `d` (defaults to now).
export function istDateString(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(ymd, n) {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// Weekly lock: every Saturday (00:00 IST) the previous week's attendance locks.
// A day is locked when it is on or before (most recent Saturday − 7 days), so
// every record stays editable for at least a full week after it was taken.
export function lockCutoffDate(now = new Date()) {
  const today = istDateString(now);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  const lastSaturday = addDays(today, -((dow + 1) % 7));
  return addDays(lastSaturday, -7);
}

export function isDateLocked(ymd, now = new Date()) {
  return String(ymd).slice(0, 10) <= lockCutoffDate(now);
}

export function isValidYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
