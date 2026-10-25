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
      ? 'text-amber-700 hover:text-amber-800'
      : 'text-red-700 hover:text-red-800';

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
        className={`ml-2 flex-shrink-0 inline-flex items-center justify-center min-w-[24px] min-h-[24px] font-bold text-lg leading-none ${btnClass}`}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
