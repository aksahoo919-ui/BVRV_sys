import React, { useEffect, useRef, useState } from 'react';

/**
 * Type-to-search dropdown. Requested 27 Oct 2026 by Lakshminadh Prabhu for
 * the attendance-correction forms: "display student names as search option
 * with dropdown matching list then select from there" instead of a plain
 * <select> or a pasted UUID.
 *
 * options: [{ value, searchText, label: ReactNode }]
 */
export default function SearchableSelect({ options, value, onChange, placeholder = 'Search…', disabled, emptyText = 'No matches' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter(o => o.searchText.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : (selected ? selected.searchText : '')}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && !disabled && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{emptyText}</p>
          ) : (
            filtered.map(o => (
              <button
                type="button"
                key={o.value}
                onClick={() => { onChange(o.value); setQuery(''); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-temple-50 ${o.value === value ? 'bg-temple-50' : ''}`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
