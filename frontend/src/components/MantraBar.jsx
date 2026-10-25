import React, { useCallback, useEffect, useRef, useState } from 'react';

const MANTRA = 'Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare · Hare Rāma Hare Rāma Rāma Rāma Hare Hare';
// Srila Prabhupada chanting the Hare Kṛṣṇa Mahā-mantra (Bhaktivedanta Archives,
// CD 12-2, "Hare Krishna Mahamantra", 9:54), from prabhupadavani.org. A 2s
// fade-in was added so the loop does not jolt (the track already fades out).
// preload="none": ~4.8 MB must not be fetched on every sign-in over mobile data;
// it downloads only when the visitor's first interaction starts it.
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

// Anything a visitor does on the page counts as a cue to start the kirtan.
// The browser only *accepts* the start after a real tap, click or key press
// (a scroll or mouse move alone is refused), so we try on every one of these
// and keep trying until a play() is finally allowed — i.e. the earliest moment
// the browser permits it. Touch screens start on the very first touch.
const CUES = ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'keydown', 'wheel', 'pointermove', 'scroll'];

/**
 * Plays the kirtan on a loop for as long as the portal is open, with no button
 * to press: it simply begins by itself on the visitor's first interaction and
 * carries on across every page. A small speaker icon at the end of the strip
 * lets anyone silence it (a teacher marking attendance in a quiet room must be
 * able to), and that choice is remembered. If the audio file is missing the
 * icon hides.
 */
function KirtanPlayer() {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);
  const wanted = () => localStorage.getItem(PREF_KEY) !== 'off';

  const start = useCallback(() => {
    const a = audio.current;
    if (!a || !a.paused || !wanted()) return;
    a.volume = 0.5;
    a.play().then(() => setPlaying(true)).catch(() => {});   // refused → try again on the next cue
  }, []);

  useEffect(() => {
    if (!wanted()) return undefined;
    const a = audio.current;
    const onPlay = () => { CUES.forEach((e) => document.removeEventListener(e, start, true)); };
    a?.addEventListener('playing', onPlay);
    // capture phase on document so scrolling inside the page's own scroll
    // containers (which do not bubble 'scroll') is seen too
    CUES.forEach((e) => document.addEventListener(e, start, { capture: true, passive: true }));
    start();
    return () => {
      a?.removeEventListener('playing', onPlay);
      CUES.forEach((e) => document.removeEventListener(e, start, true));
    };
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
      <audio ref={audio} src={KIRTAN_SRC} loop preload="none" onError={() => setAvailable(false)} />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Mute kirtan' : 'Play kirtan'}
        title={playing ? 'Mute kirtan' : 'Play kirtan'}
        className="relative flex-shrink-0 flex items-center justify-center h-full min-h-[34px] w-9 border-l border-gold-600/50 bg-temple-800 hover:bg-temple-700 text-gold-200"
      >
        {playing ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" /><path d="m16 9.5 5 5m0-5-5 5" />
          </svg>
        )}
      </button>
    </>
  );
}
