// "Bhakti Shastri 1 (English)" -> "Bhakti Shastri 1 - English"
export const className = name => String(name || '').replace(/\s*\((English|Hindi|Telugu)\)\s*$/, ' - $1');

// "Bhakti Shastri 1 - English (BS1-E) · Sem 1"
export const classLabel = (s, { semester = true } = {}) =>
  `${className(s.name)} (${s.code})${semester && s.semester_id ? ` · ${s.semester_label}${s.semester_is_current === false ? ' (past)' : ''}` : ''}`;
