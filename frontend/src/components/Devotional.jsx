import React, { useId } from 'react';

/**
 * Krishna's peacock feather (mor-pankh), the portal's devotional ornament.
 * Eye colours: shyama (Krishna's dark-blue complexion) at the heart, then
 * peacock teal, a gold ring and a green feathery aura; barbs drawn as strokes.
 */
export function PeacockFeather({ className = 'w-8 h-20', glow = true }) {
  const id = useId().replace(/:/g, '');
  const cx = 30, cy = 40;
  // radiating barbs around the eye
  const rays = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return { x1: cx + Math.cos(a) * 13, y1: cy + Math.sin(a) * 17, x2: cx + Math.cos(a) * 24, y2: cy + Math.sin(a) * 32 };
  });
  // side barbs along the shaft, shortening towards the quill
  const barbs = Array.from({ length: 14 }, (_, i) => {
    const y = 74 + i * 4.6;
    const w = 18 - i * 1.1;
    return { y, w };
  });
  return (
    <svg viewBox="0 0 60 140" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`aura-${id}`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#4E9277" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2A7458" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`shyama-${id}`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3B5BB5" />
          <stop offset="100%" stopColor="#1B2E6B" />
        </radialGradient>
      </defs>
      {/* quill */}
      <path d={`M${cx} 138 C ${cx - 1} 110, ${cx + 1} 80, ${cx} ${cy + 16}`} stroke="#C8992E" strokeWidth="1.2" fill="none" />
      {barbs.map(({ y, w }, i) => (
        <g key={i} stroke="#4E9277" strokeOpacity="0.55" strokeWidth="0.7">
          <line x1={cx} y1={y} x2={cx - w} y2={y - 9} />
          <line x1={cx} y1={y} x2={cx + w} y2={y - 9} />
        </g>
      ))}
      {glow && <ellipse cx={cx} cy={cy} rx="26" ry="35" fill={`url(#aura-${id})`} />}
      <g stroke="#7FB59B" strokeOpacity="0.7" strokeWidth="0.6">
        {rays.map((r, i) => <line key={i} {...r} />)}
      </g>
      <ellipse cx={cx} cy={cy} rx="14" ry="19" fill="#E0B750" />
      <ellipse cx={cx} cy={cy + 1} rx="10.5" ry="14.5" fill="#0E7C86" />
      <ellipse cx={cx} cy={cy + 2} rx="7" ry="9.5" fill={`url(#shyama-${id})`} />
      <path d={`M${cx} ${cy - 2} C ${cx - 4} ${cy + 1}, ${cx - 3} ${cy + 7}, ${cx} ${cy + 9} C ${cx + 3} ${cy + 7}, ${cx + 4} ${cy + 1}, ${cx} ${cy - 2} Z`} fill="#0A1A44" />
    </svg>
  );
}

/** The Hare Krishna Maha-mantra, set quietly at the foot of every sidebar. */
export function MahaMantra() {
  return (
    <div className="px-3 py-3 text-center select-none" aria-label="Hare Krishna Maha-mantra">
      <div className="arch-rule mb-2 opacity-60" aria-hidden="true" />
      <p className="font-temple italic text-[11.5px] leading-tight text-gold-200/90">
        Hare Kṛṣṇa Hare Kṛṣṇa<br />Kṛṣṇa Kṛṣṇa Hare Hare<br />
        Hare Rāma Hare Rāma<br />Rāma Rāma Hare Hare
      </p>
    </div>
  );
}

function todayIST() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

/**
 * Dashboard welcome: "Hare Krishna, <name>" on altar green, today's date,
 * a small darshan of Sri Sri Radha Madanmohan and the peacock feather.
 * `children` sits under the greeting (e.g. the role switcher).
 */
export function WelcomeBanner({ name, role, children }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-temple-800 text-ivory-100 shadow-altar">
      <div className="toran" aria-hidden="true" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='46' viewBox='0 0 80 46'><path d='M0 46 Q20 2 40 46 Q60 2 80 46' fill='none' stroke='%23E0B750' stroke-width='2'/></svg>\")",
          backgroundSize: '80px 46px',
        }} />
      <PeacockFeather className="hidden sm:block absolute right-5 top-1/2 -translate-y-1/2 w-12 h-28 opacity-80" />
      <div className="relative flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-5 sm:pr-20">
        <figure className="flex-shrink-0 w-16 sm:w-20">
          <div className="rounded-t-full rounded-b-lg p-[2px] bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700">
            <img src="/radha-madanmohan.webp" alt="Sri Sri Radha Madanmohan" width="448" height="512"
              className="block w-full h-auto rounded-t-full rounded-b-md" />
          </div>
        </figure>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-300">Hare Krishna</p>
          <h1 className="welcome-title font-temple text-2xl sm:text-3xl leading-tight text-ivory-50 truncate">{name}</h1>
          <p className="text-sm text-temple-100 mt-1">
            {todayIST()}{role ? <span className="text-temple-200"> · {role}</span> : null}
          </p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </section>
  );
}
