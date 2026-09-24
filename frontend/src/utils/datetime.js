// All dates and times in the app are shown in IST (Asia/Kolkata), whatever the
// device's timezone is.

export const IST = 'Asia/Kolkata';

// Make every toLocale*String() call in the app default to IST unless a caller
// explicitly passes its own timeZone. Imported once from main.jsx.
for (const fn of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
  const orig = Date.prototype[fn];
  if (orig.__ist) continue;
  const patched = function (locales, options) {
    return orig.call(this, locales, { timeZone: IST, ...(options || {}) });
  };
  patched.__ist = true;
  Date.prototype[fn] = patched;
}

// A 'YYYY-MM-DD' value is a calendar day: anchor it to IST midnight so it never
// shifts to the previous/next day.
function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00+05:30`);
  return new Date(v);
}

// Today's date in IST as 'YYYY-MM-DD' (for <input type="date"> defaults).
export function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
}

// Current IST day-of-week (0=Sun … 6=Sat) and minutes since IST midnight.
export function nowPartsIST() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(x => [x.type, x.value])
  );
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { dow, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// e.g. "24 Sep 2026"
export function fmtDateIST(v) {
  if (!v) return '—';
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' });
}

// e.g. "Thu, 24 Sep 2026"
export function fmtDayIST(v) {
  if (!v) return '—';
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// e.g. "24 Sep 2026, 11:42 pm IST"
export function fmtDateTimeIST(v) {
  if (!v) return '—';
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} IST`;
}

// Weekly lock: every Saturday (IST) the previous week's attendance locks, so a
// day stays editable for at least a week. Returns the 'YYYY-MM-DD' Saturday on
// which the given day locks (mirrors backend/src/utils/istDate.js).
export function lockDateFor(ymd) {
  const t = Date.parse(`${ymd}T00:00:00Z`) + 7 * 86400000;
  const dow = new Date(t).getUTCDay();
  return new Date(t + ((6 - dow + 7) % 7) * 86400000).toISOString().slice(0, 10);
}
