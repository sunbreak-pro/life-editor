import { useState, useRef, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

interface SortDropdownProps<T extends string> {
  sortMode: T;
  onSortChange: (mode: T) => void;
  options: readonly T[];
  labelMap: Record<T, string>;
  defaultMode?: T;
  title?: string;
}

export function SortDropdown<T extends string>({
  sortMode,
  onSortChange,
  options,
  labelMap,
  defaultMode,
  title,
}: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const isNonDefault = defaultMode != null && sortMode !== defaultMode;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
          isNonDefault
            ? "bg-notion-accent/10 text-notion-accent"
            : "text-notion-text-secondary hover:text-notion-text"
        }`}
        title={title}
      >
        <ArrowUpDown size={10} />
        <span>{labelMap[sortMode]}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-28">
          {options.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onSortChange(mode);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                sortMode === mode
                  ? "bg-notion-accent/10 text-notion-accent font-medium"
                  : "text-notion-text hover:bg-notion-hover"
              }`}
            >
              {labelMap[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
