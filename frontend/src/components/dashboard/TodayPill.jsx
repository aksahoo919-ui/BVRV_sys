export default function TodayPill({ subjectName, status, onClick }) {
  if (status === 'present') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        {subjectName}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 animate-pulse" />
        {subjectName}
      </button>
    );
  }

  // 'none' or fallback
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
      {subjectName}
    </span>
  );
}
