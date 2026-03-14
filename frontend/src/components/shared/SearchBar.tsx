import { useState, useRef, useEffect, useCallback } from "react";
import { Search, StickyNote, BookOpen } from "lucide-react";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  icon?: "note" | "memo";
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rightAction?: React.ReactNode;
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (id: string) => void;
  showSuggestionsOnFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  rightAction,
  suggestions,
  onSuggestionSelect,
  showSuggestionsOnFocus = true,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showDropdown =
    isFocused &&
    showSuggestionsOnFocus &&
    suggestions &&
    suggestions.length > 0;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node)
    ) {
      setIsFocused(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFocused, handleClickOutside]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  const IconComponent = ({ icon }: { icon?: "note" | "memo" }) => {
    if (icon === "note")
      return (
        <StickyNote size={12} className="text-notion-text-secondary shrink-0" />
      );
    if (icon === "memo")
      return (
        <BookOpen size={12} className="text-notion-text-secondary shrink-0" />
      );
    return null;
  };

  return (
    <div className="p-3 border-b border-notion-border" ref={containerRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-notion-bg border border-notion-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSuggestionSelect?.(s.id);
                    setIsFocused(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-notion-hover transition-colors"
                >
                  <IconComponent icon={s.icon} />
                  <span className="text-xs text-notion-text truncate flex-1">
                    {s.label}
                  </span>
                  {s.sublabel && (
                    <span className="text-[10px] text-notion-text-secondary shrink-0">
                      {s.sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {rightAction}
      </div>
    </div>
  );
}
