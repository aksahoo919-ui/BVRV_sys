import { useState } from 'react';

export default function AlertBanner({ message, onClick, variant = 'danger' }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const colorClass =
    variant === 'warning'
      ? 'bg-amber-50 border-amber-400 text-amber-800'
      : 'bg-red-50 border-red-400 text-red-800';

  const btnClass =
    variant === 'warning'
      ? 'text-amber-500 hover:text-amber-700'
      : 'text-red-400 hover:text-red-600';

  return (
    <div className={`flex items-center justify-between gap-3 border-l-4 rounded-lg px-4 py-3 text-sm font-medium ${colorClass}`}>
      <span
        onClick={onClick}
        className={onClick ? 'cursor-pointer hover:underline flex-1' : 'flex-1'}
      >
        {message}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className={`ml-2 flex-shrink-0 font-bold text-lg leading-none ${btnClass}`}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
