import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface MonthGroupProps {
  monthLabel: string;
  itemCount: number;
  defaultOpen: boolean;
  children: ReactNode;
}

export function MonthGroup({
  monthLabel,
  itemCount,
  defaultOpen,
  children,
}: MonthGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-notion-text-secondary hover:text-notion-text transition-colors"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex-1 text-left">{monthLabel}</span>
        <span className="text-[10px] tabular-nums opacity-60">{itemCount}</span>
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}
