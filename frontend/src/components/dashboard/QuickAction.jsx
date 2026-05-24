const colorMap = {
  blue: 'bg-blue-50 hover:bg-blue-100 text-blue-700',
  green: 'bg-green-50 hover:bg-green-100 text-green-700',
  purple: 'bg-purple-50 hover:bg-purple-100 text-purple-700',
  amber: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
  red: 'bg-red-50 hover:bg-red-100 text-red-700',
};

export default function QuickAction({ icon, label, onClick, color = 'blue' }) {
  const cls = colorMap[color] || colorMap.blue;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${cls}`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}
