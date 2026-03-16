import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  StickyNote,
  BookOpen,
  CheckSquare,
  Folder,
  Volume2,
  ListMusic,
  Settings2,
  Tag,
  X,
} from "lucide-react";

export type SearchSuggestionIconType =
  | "note"
  | "memo"
  | "task"
  | "folder"
  | "sound"
  | "playlist"
  | "settings"
  | "tag";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  icon?: SearchSuggestionIconType;
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rightAction?: React.ReactNode;
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (id: string) => void;
  showSuggestionsOnFocus?: boolean;
  autoFocus?: boolean;
  onClose?: () => void;
  className?: string;
  clearable?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  rightAction,
  suggestions,
  onSuggestionSelect,
  showSuggestionsOnFocus = true,
  autoFocus = false,
  onClose,
  className = "p-3 border-b border-notion-border",
  clearable = true,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showDropdown =
    isFocused &&
    suggestions &&
    suggestions.length > 0 &&
    (showSuggestionsOnFocus || value.trim().length > 0);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node)
    ) {
      setIsFocused(false);
    }
  }, []);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (isFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFocused, handleClickOutside]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (value) {
        onChange("");
      } else {
        setIsFocused(false);
        onClose?.();
      }
    }
  };

  const IconComponent = ({ icon }: { icon?: SearchSuggestionIconType }) => {
    const cls = "text-notion-text-secondary shrink-0";
    switch (icon) {
      case "note":
        return <StickyNote size={12} className={cls} />;
      case "memo":
        return <BookOpen size={12} className={cls} />;
      case "task":
        return <CheckSquare size={12} className={cls} />;
      case "folder":
        return <Folder size={12} className={cls} />;
      case "sound":
        return <Volume2 size={12} className={cls} />;
      case "playlist":
        return <ListMusic size={12} className={cls} />;
      case "settings":
        return <Settings2 size={12} className={cls} />;
      case "tag":
        return <Tag size={12} className={cls} />;
      default:
        return null;
    }
  };

  return (
    <div className={className} ref={containerRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
          />
          {value && clearable && (
            <button
              onClick={() => onChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text transition-colors"
            >
              <X size={14} />
            </button>
          )}
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
