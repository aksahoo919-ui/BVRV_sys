import React, { useCallback, useEffect, useRef, useState } from 'react';

const MANTRA = 'Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare · Hare Rāma Hare Rāma Rāma Rāma Hare Hare';
const KIRTAN_SRC = '/audio/prabhupada-kirtan.mp3';
const PREF_KEY = 'bvrv.kirtan';           // 'on' | 'off'

/**
 * The Hare Kṛṣṇa Maha-mantra, scrolling along the foot of every screen in the
 * portal (login included), with the kirtan player at its right-hand end.
 *
 * Mounted once in App.jsx, outside the routes, so the strip — and the audio —
 * carry on uninterrupted while a devotee moves between pages.
 */
export default function MantraBar() {
  return (
    <div
      role="region"
      aria-label="Hare Krishna Maha-mantra"
      className="mantra-bar fixed inset-x-0 bottom-0 z-40 flex items-center bg-temple-900 border-t border-gold-600/60 text-gold-200"
    >
      <div className="toran absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="mantra-marquee flex-1 min-w-0 overflow-hidden">
        {/* two identical halves so the loop is seamless at translateX(-50%) */}
        <div className="mantra-track" aria-hidden="true">
          {[0, 1].map((half) => (
            <span key={half} className="mantra-half font-temple italic text-[15px] tracking-wide">
              {[0, 1, 2].map((i) => (
                <React.Fragment key={i}>
                  {MANTRA}
                  <span className="mx-5 text-gold-400" aria-hidden="true">❖</span>
                </React.Fragment>
              ))}
            </span>
          ))}
        </div>
        {/* screen readers get the mantra once, not on a loop */}
        <span className="sr-only">{MANTRA}</span>
      </div>
      <KirtanPlayer />
    </div>
  );
}

/**
 * Plays the kirtan on a loop for as long as the portal is open.
 *
 * Browsers refuse to start sound until the visitor has interacted with the
 * page, so it begins on the first click, tap or key press anywhere; after that
 * it keeps going across every page. A visible button lets anyone pause it, and
 * the choice is remembered — a teacher taking attendance in a quiet room must
 * be able to silence it. If the audio file is missing the button hides.
 */
function KirtanPlayer() {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);
  const wanted = () => localStorage.getItem(PREF_KEY) !== 'off';

  const start = useCallback(() => {
    const a = audio.current;
    if (!a || !wanted()) return;
    a.volume = 0.5;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  // begin on the first interaction, then stop listening
  useEffect(() => {
    if (!wanted()) return undefined;
    const go = () => start();
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    start();                                   // allowed straight away if the browser permits
    return () => events.forEach((e) => window.removeEventListener(e, go));
  }, [start]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      localStorage.setItem(PREF_KEY, 'on');
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      localStorage.setItem(PREF_KEY, 'off');
      a.pause();
      setPlaying(false);
    }
  }

  if (!available) return null;
  return (
    <>
      <audio ref={audio} src={KIRTAN_SRC} loop preload="auto" onError={() => setAvailable(false)} />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Pause kirtan' : 'Play Srila Prabhupada kirtan'}
        title={playing ? 'Pause kirtan' : 'Play Srila Prabhupada kirtan'}
        className="relative flex-shrink-0 flex items-center gap-2 h-full min-h-[34px] px-3 border-l border-gold-600/50 bg-temple-800 hover:bg-temple-700 text-gold-200 text-xs font-medium"
      >
        {playing ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        )}
        <span className="hidden sm:inline">{playing ? 'Kirtan' : 'Play kirtan'}</span>
        {playing && (
          <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
            <i className="kirtan-eq" /><i className="kirtan-eq" style={{ animationDelay: '.2s' }} /><i className="kirtan-eq" style={{ animationDelay: '.4s' }} />
          </span>
        )}
      </button>
    </>
  );
}
