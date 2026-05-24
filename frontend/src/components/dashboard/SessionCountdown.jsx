import { useState, useEffect } from 'react';

export default function SessionCountdown({ expiresAt }) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }

    function calcSeconds() {
      const diff = Math.floor((new Date(expiresAt) - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    }

    setSecondsLeft(calcSeconds());

    const id = setInterval(() => {
      const s = calcSeconds();
      setSecondsLeft(s);
      if (s <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  if (secondsLeft === null || secondsLeft <= 0) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const colorClass =
    secondsLeft < 30
      ? 'text-red-600 animate-pulse'
      : secondsLeft < 60
      ? 'text-amber-500'
      : 'text-gray-500';

  return (
    <span className={`text-sm font-mono font-semibold ${colorClass}`}>
      {mm}:{ss} left
    </span>
  );
}
