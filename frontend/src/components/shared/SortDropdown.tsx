import { useState, useRef, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../hooks/useClickOutside";

export type SortDirection = "asc" | "desc";

interface SortDropdownProps<T extends string> {
  sortMode: T;
  onSortChange: (mode: T) => void;
  options: readonly T[];
  labelMap: Record<T, string>;
  defaultMode?: T;
  title?: string;
  sortDirection?: SortDirection;
  onDirectionChange?: (direction: SortDirection) => void;
  noDirectionModes?: readonly T[];
}

export function SortDropdown<T extends string>({
  sortMode,
  onSortChange,
  options,
  labelMap,
  defaultMode,
  title,
  sortDirection = "asc",
  onDirectionChange,
  noDirectionModes,
}: SortDropdownProps<T>) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const isNonDefault = defaultMode != null && sortMode !== defaultMode;
  const showDirection =
    onDirectionChange != null &&
    (!noDirectionModes || !noDirectionModes.includes(sortMode));

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
        {showDirection &&
          isNonDefault &&
          (sortDirection === "asc" ? (
            <ArrowUp size={8} />
          ) : (
            <ArrowDown size={8} />
          ))}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-28">
          {showDirection && (
            <>
              <div className="flex items-center justify-center gap-1 px-3 py-1.5">
                <button
                  onClick={() => onDirectionChange("asc")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                    sortDirection === "asc"
                      ? "bg-notion-accent/10 text-notion-accent font-medium"
                      : "text-notion-text-secondary hover:text-notion-text"
                  }`}
                  title={t("taskTree.sortAscending")}
                >
                  <ArrowUp size={10} />
                  {t("taskTree.sortAscending")}
                </button>
                <button
                  onClick={() => onDirectionChange("desc")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                    sortDirection === "desc"
                      ? "bg-notion-accent/10 text-notion-accent font-medium"
                      : "text-notion-text-secondary hover:text-notion-text"
                  }`}
                  title={t("taskTree.sortDescending")}
                >
                  <ArrowDown size={10} />
                  {t("taskTree.sortDescending")}
                </button>
              </div>
              <div className="h-px bg-notion-border my-1" />
            </>
          )}
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
