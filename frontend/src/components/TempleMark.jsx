import React from 'react';

/**
 * ISKCON Abids — Sri Sri Radha Madanmohan Mandir.
 *
 * The lotus-in-a-beaded-roundel follows the ISKCON Hyderabad mark. It is drawn
 * as vector rather than loaded as a bitmap so it stays crisp from the 16px
 * favicon up to the login panel, and costs no extra request.
 */
export function TempleMark({ className = 'w-10 h-10', tone = 'gold' }) {
  const ink = tone === 'gold' ? '#E0B750' : '#124A36';
  const ring = tone === 'gold' ? '#C8992E' : '#0B3B2E';
  const face = tone === 'gold' ? '#0B3B2E' : '#FAF0D7';

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ISKCON Abids temple emblem">
      <circle cx="32" cy="32" r="31" fill={face} />
      <circle cx="32" cy="32" r="30" fill="none" stroke={ring} strokeWidth="1" />
      {/* beaded border */}
      <circle cx="32" cy="32" r="27.5" fill="none" stroke={ink} strokeWidth="1.6" strokeDasharray="1.2 3.1" strokeLinecap="round" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke={ring} strokeWidth="0.9" />
      {/* lotus: upright centre petal flanked by two pairs of curved petals */}
      <g fill="none" stroke={ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {/* upright centre petal */}
        <path d="M32 46 C28.4 38 28.4 27 32 17 C35.6 27 35.6 38 32 46 Z" />
        {/* inner pair */}
        <path d="M32 46 C24 40 19.5 31 20.5 21.5 C27.5 26 31 35 32 46 Z" />
        <path d="M32 46 C40 40 44.5 31 43.5 21.5 C36.5 26 33 35 32 46 Z" />
        {/* outer pair, opening wide like the logo's lower petals */}
        <path d="M32 46 C22 44 12.5 38 10.5 29 C19.5 30 28 36.5 32 46 Z" />
        <path d="M32 46 C42 44 51.5 38 53.5 29 C44.5 30 36 36.5 32 46 Z" />
      </g>
      {/* seed at the base of the lotus */}
      <path d="M32 45 C29.4 48.4 29.6 51.6 32 54 C34.4 51.6 34.6 48.4 32 45 Z" fill={ink} />
    </svg>
  );
}

/**
 * Full temple lockup for sidebars, the login panel and the mobile bar.
 * `ground="dark"` is for temple-green chrome, `"light"` for marble panels.
 */
export function TempleLockup({ ground = 'dark', subtitle = 'BVRV Attendance', compact = false }) {
  const dark = ground === 'dark';
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <TempleMark className={compact ? 'w-7 h-7 flex-shrink-0' : 'w-9 h-9 flex-shrink-0'} tone={dark ? 'gold' : 'green'} />
      <div className="min-w-0">
        <p className={`font-temple leading-tight ${compact ? 'text-sm' : 'text-[15px]'} ${dark ? 'text-gold-200' : 'text-temple-800'}`}>
          Sri&nbsp;Sri Radha Madanmohan
        </p>
        <p className={`text-[10px] uppercase tracking-[0.1em] leading-snug ${dark ? 'text-gold-300' : 'text-temple-600'}`}>
          ISKCON Abids
        </p>
        <p className={`text-[10px] uppercase tracking-[0.1em] leading-snug ${dark ? 'text-temple-200' : 'text-temple-600'}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default TempleMark;
