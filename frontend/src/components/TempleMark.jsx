import React from 'react';

/**
 * ISKCON Abids — Sri Sri Radha Madanmohan Mandir.
 *
 * The lotus-in-a-beaded-roundel follows the ISKCON Hyderabad mark. It is drawn
 * as vector rather than loaded as a bitmap so it stays crisp from the 16px
 * favicon up to the login panel, and costs no extra request.
 */
/**
 * The temple's own emblem — the official ISKCON Hyderabad lotus roundel,
 * used as-is rather than redrawn, so the portal carries the real mark.
 * `tone="gold"` is for the altar-green chrome (the logo already reads gold on
 * dark), `"green"` for marble panels, where it sits in a soft green disc.
 */
export function TempleMark({ className = 'w-10 h-10', tone = 'gold' }) {
  return (
    <img
      src="/iskcon-logo.png"
      alt="ISKCON Hyderabad"
      width="256"
      height="256"
      className={`${className} object-contain ${tone === 'green' ? 'rounded-full bg-temple-50 p-0.5 ring-1 ring-gold-300' : ''}`}
    />
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
