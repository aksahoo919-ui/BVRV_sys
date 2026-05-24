export default function StatCard({ label, value, sub, onClick, variant = 'default' }) {
  const borderClass =
    variant === 'warning'
      ? 'border-l-4 border-amber-400'
      : variant === 'danger'
      ? 'border-l-4 border-red-500'
      : '';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 ${borderClass} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150' : ''
      }`}
    >
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
