export default function StatCard({ label, value, sub, onClick, variant = 'default' }) {
  const accent =
    variant === 'warning' ? 'before:bg-gold-500'
    : variant === 'danger' ? 'before:bg-red-600'
    : 'before:bg-temple-200';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden text-left bg-white rounded-xl border border-ivory-300 shadow-sm pl-5 pr-4 py-4 flex flex-col gap-1
        before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}
        ${onClick ? 'cursor-pointer hover:shadow-altar hover:border-gold-300 transition-all duration-150' : ''}`}
    >
      <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-semibold text-temple-900 leading-tight tabular-nums">{value ?? '—'}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </Tag>
  );
}
