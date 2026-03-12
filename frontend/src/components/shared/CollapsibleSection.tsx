import { ChevronRight, ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  label,
  icon,
  isOpen,
  onToggle,
  rightAction,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border-b border-notion-border last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2 hover:bg-notion-hover transition-colors">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-notion-text-secondary uppercase tracking-wider"
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {icon}
          <span>{label}</span>
        </button>
        {rightAction}
      </div>
      {isOpen && <div className="px-1 pb-1">{children}</div>}
    </div>
  );
}
