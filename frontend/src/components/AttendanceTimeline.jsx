import React, { useMemo, useState } from 'react';
import { hasSemesters } from '../utils/classLabel';

// Attendance over time for one class: a line of the running attendance % (how
// it stood after each class day) with one marker per class day, coloured and
// shaped by what happened that day, plus the needed % as a dashed line.
// Below it every class date, grouped by month. Used by the student's
// "My Attendance" page and the admin student Timeline.

const STATUS = {
  present: { label: 'Present', color: '#16a34a', chip: 'bg-green-50 text-green-700 border-green-200', mark: '✓' },
  service: { label: 'Service', color: '#4f46e5', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', mark: '★' },
  absent:  { label: 'Absent',  color: '#dc2626', chip: 'bg-red-50 text-red-700 border-red-200', mark: '✕' },
};

const DAY = 86400000;
const toTime = d => new Date(`${d}T00:00:00`).getTime();
const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtRange = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function pctTone(pct, threshold) {
  if (pct == null) return 'bg-gray-100 text-gray-600';
  if (pct >= threshold) return 'bg-green-50 text-green-700';
  if (pct >= threshold - 15) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function Marker({ status, x, y }) {
  const c = STATUS[status].color;
  if (status === 'service') return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1.5} fill={c} stroke="#fff" strokeWidth={2} />;
  if (status === 'absent') return <circle cx={x} cy={y} r={4.5} fill="#fff" stroke={c} strokeWidth={2} />;
  return <circle cx={x} cy={y} r={5} fill={c} stroke="#fff" strokeWidth={2} />;
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      {Object.entries(STATUS).map(([k]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><Marker status={k} x={0} y={0} /></svg>
          {STATUS[k].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="18" height="8" aria-hidden="true"><line x1="0" y1="4" x2="18" y2="4" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
        Needed %
      </span>
    </div>
  );
}

export function AttendanceChart({ days, threshold, start, end }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 190, L = 34, R = 12, T = 12, B = 26;

  const pts = useMemo(() => {
    let att = 0;
    return days.map((d, i) => {
      if (d.status !== 'absent') att++;
      return { ...d, t: toTime(d.date), pct: Math.round(att / (i + 1) * 1000) / 10, n: i + 1, att };
    });
  }, [days]);

  if (!pts.length) return null;
  let t0 = Math.min(pts[0].t, start ? toTime(start) : Infinity);
  let t1 = Math.max(pts[pts.length - 1].t, end ? Math.min(toTime(end), Date.now()) : -Infinity);
  if (t1 - t0 < 7 * DAY) { t0 -= 3 * DAY; t1 += 3 * DAY; }
  const x = t => L + (t - t0) / (t1 - t0) * (W - L - R);
  const y = p => T + (100 - p) / 100 * (H - T - B);

  // month ticks
  const ticks = [];
  const m = new Date(t0); m.setDate(1); m.setHours(0, 0, 0, 0);
  if (m.getTime() < t0) m.setMonth(m.getMonth() + 1);
  while (m.getTime() <= t1) {
    ticks.push({ t: m.getTime(), label: m.toLocaleDateString('en-IN', { month: 'short' }) });
    m.setMonth(m.getMonth() + 1);
  }

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const h = hover != null ? pts[hover] : null;

  return (
    <div className="overflow-x-auto -mx-1 px-1">
    <div className="relative min-w-[480px]" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img"
        aria-label={`Attendance over time: ${pts[pts.length - 1].pct}% after ${pts.length} class days`}>
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={L - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="#9ca3af">{g}%</text>
          </g>
        ))}
        {ticks.map(tk => (
          <g key={tk.t}>
            <line x1={x(tk.t)} x2={x(tk.t)} y1={H - B} y2={H - B + 4} stroke="#d1d5db" />
            <text x={x(tk.t) + 3} y={H - 8} fontSize="10" fill="#9ca3af">{tk.label}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#e5e7eb" />
        <line x1={L} x2={W - R} y1={y(threshold)} y2={y(threshold)} stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={W - R} y={y(threshold) - 4} textAnchor="end" fontSize="10" fill="#6b7280">{threshold}% needed</text>
        {h && <line x1={x(h.t)} x2={x(h.t)} y1={T} y2={H - B} stroke="#d1d5db" strokeWidth="1" />}
        <path d={path} fill="none" stroke="#475569" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <Marker key={p.date} status={p.status} x={x(p.t)} y={y(p.pct)} />)}
        {pts.map((p, i) => (
          <circle key={`hit-${p.date}`} cx={x(p.t)} cy={y(p.pct)} r={11} fill="transparent"
            onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>
      {h && (
        <div className="absolute pointer-events-none bg-white border border-gray-200 shadow-md rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap z-10"
          style={{ left: `${x(h.t) / W * 100}%`, top: `${y(h.pct) / H * 100}%`, transform: `translate(${x(h.t) > W * 0.7 ? '-105%' : '8%'}, -110%)` }}>
          <p className="font-semibold text-gray-800">{fmtDay(h.date)}</p>
          <p className="text-gray-600">{STATUS[h.status].mark} {STATUS[h.status].label}</p>
          <p className="text-gray-500">{h.pct}% so far · {h.att} of {h.n} days</p>
        </div>
      )}
    </div>
    </div>
  );
}

// Every class date, grouped by month, newest month first.
export function DateList({ days }) {
  const months = useMemo(() => {
    const m = new Map();
    for (const d of [...days].reverse()) {
      const key = d.date.slice(0, 7);
      if (!m.has(key)) m.set(key, { key, label: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), days: [] });
      m.get(key).days.push(d);
    }
    return [...m.values()];
  }, [days]);
  return (
    <div className="space-y-2">
      {months.map(mo => {
        const att = mo.days.filter(d => d.status !== 'absent').length;
        return (
          <div key={mo.key}>
            <p className="text-xs font-medium text-gray-500 mb-1">{mo.label} <span className="text-gray-500 font-normal">· {att} of {mo.days.length} attended</span></p>
            <div className="flex flex-wrap gap-1.5">
              {mo.days.map(d => (
                <span key={d.date} title={`${fmtDay(d.date)} · ${STATUS[d.status].label}`}
                  className={`text-xs px-2 py-0.5 rounded-md border ${STATUS[d.status].chip}`}>
                  {STATUS[d.status].mark} {fmtShort(d.date)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// One card per class (or BV Leader class): heading, %, graph, dates.
export function AttendanceCard({ title, subtitle, badge, days, threshold, start, end, percentage, attended, total, defaultOpen = true }) {
  const [showDates, setShowDates] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${pctTone(percentage, threshold)}`}>
            {percentage == null ? 'No classes yet' : `${percentage}%`}
          </span>
          {total > 0 && <p className="text-xs text-gray-500 mt-1">{attended} of {total} day{total === 1 ? '' : 's'} attended</p>}
        </div>
      </div>
      {days.length > 0 && (
        <>
          <div className="mt-3"><AttendanceChart days={days} threshold={threshold} start={start} end={end} /></div>
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            <Legend />
            <button onClick={() => setShowDates(s => !s)} className="text-xs text-primary-600 hover:underline inline-flex items-center min-h-[24px]">
              {showDates ? 'Hide dates' : `Show all ${days.length} dates`}
            </button>
          </div>
          {showDates && <div className="mt-3"><DateList days={days} /></div>}
        </>
      )}
    </div>
  );
}

// Full history from GET /student/attendance/history or /admin/users/:id/attendance-history
export default function AttendanceTimeline({ data, showPast = true, datesOpen = true }) {
  const classes = (data?.classes || []).filter(c => showPast || (c.is_current && c.enrolled !== false));
  const leaders = data?.bv_leader_classes || [];
  const threshold = data?.threshold ?? 75;
  if (!classes.length && !leaders.length) return <p className="text-sm text-gray-500">No attendance yet.</p>;
  return (
    <div className="space-y-3">
      {classes.map(c => (
        <AttendanceCard key={c.subject_id}
          title={`${c.course_name ? `${c.course_name} · ` : ''}${c.code}${hasSemesters(c) ? ` · ${c.semester_label}` : ''}`}
          subtitle={[c.start_date && `${fmtRange(c.start_date)} – ${fmtRange(c.end_date)}`, c.teachers && `Teacher: ${c.teachers}`].filter(Boolean).join(' · ')}
          badge={<span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.enrolled === false ? 'bg-amber-50 text-amber-700' : c.is_current ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.enrolled === false ? 'Left' : c.is_current ? 'Current' : 'Past'}</span>}
          days={c.days} threshold={threshold} start={c.start_date} end={c.end_date}
          percentage={c.percentage} attended={c.attended} total={c.total_days} defaultOpen={datesOpen} />
      ))}
      {leaders.filter(l => l.days.length > 0).map(l => (
        <AttendanceCard key={l.mentor_id}
          title={`BV Leader class · ${l.mentor_name}`}
          subtitle="Your class with your BV Leader (counted separately)"
          days={l.days} threshold={threshold}
          percentage={l.percentage} attended={l.attended} total={l.total_days} defaultOpen={datesOpen} />
      ))}
    </div>
  );
}
