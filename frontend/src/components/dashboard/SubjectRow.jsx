const chipColor = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

export default function SubjectRow({ name, code, value, chip, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 px-1 border-b border-gray-100 last:border-0 ${
        onClick ? 'cursor-pointer hover:bg-gray-50 rounded-lg transition-colors' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded mr-2">
          {code}
        </span>
        <span className="text-sm text-gray-700 truncate">{name}</span>
      </div>
      {value !== undefined && (
        <span className="text-sm font-semibold text-gray-800 flex-shrink-0">{value}</span>
      )}
      {chip && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${chipColor[chip.color] || chipColor.green}`}>
          {chip.label}
        </span>
      )}
    </div>
  );
}
