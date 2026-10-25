import Icon from '../Icon';

// One tile style for every role's quick actions: ivory card, line icon in a
// green roundel that turns gold-on-green on hover. `icon` is an Icon name.
export default function QuickAction({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-2.5 rounded-xl bg-white border border-ivory-300 px-3 py-4 text-center shadow-sm transition-all duration-150 hover:border-gold-400 hover:shadow-altar hover:-translate-y-0.5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-temple-50 text-temple-700 ring-1 ring-gold-200 transition-colors group-hover:bg-temple-700 group-hover:text-gold-200">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className="text-[13px] font-medium leading-tight text-temple-900">{label}</span>
    </button>
  );
}
