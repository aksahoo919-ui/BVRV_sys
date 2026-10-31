import React from 'react';

// Devotee name display convention requested 27 Oct 2026 by Lakshminadh Prabhu
// (Tech, Abids): when an initiated (spiritual) name is on record, show it as
// the main name, with the material name below it in small font — reversed
// from material-name-as-primary, which is what every list/card used before.
export default function DevoteeName({
  name,
  initiatedName,
  primaryClassName = 'font-semibold text-gray-900',
  secondaryClassName = 'text-xs text-gray-500',
  truncate = true,
}) {
  const t = truncate ? 'truncate' : '';
  if (initiatedName) {
    return (
      <span className="block min-w-0">
        <span className={`block ${t} ${primaryClassName}`}>{initiatedName}</span>
        <span className={`block ${t} ${secondaryClassName}`}>{name}</span>
      </span>
    );
  }
  return <span className={`block ${t} ${primaryClassName}`}>{name}</span>;
}

// Plain-text version for places that can't render JSX (toasts, option labels
// inside a native <select>, window.confirm, etc).
export function devoteeDisplayLabel(name, initiatedName) {
  return initiatedName ? `${initiatedName} (${name})` : name || '';
}
