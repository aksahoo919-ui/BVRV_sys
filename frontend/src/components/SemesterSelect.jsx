import React from 'react';

// Current / Sem 1 / Sem 2 picker for lists of BVRV classes (options from semesterChoices()).
export default function SemesterSelect({ value, onChange, options, className = '' }) {
  return (
    <label className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      Semester
      <select className="input w-auto py-1.5" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o === 'current' ? 'Current semester' : o}</option>)}
      </select>
    </label>
  );
}
