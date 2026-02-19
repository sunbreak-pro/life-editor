import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onClose?: () => void;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus = true,
  onClose,
  className = "",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose?.();
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 border-b border-notion-border ${className}`}
    >
      <Search size={14} className="text-notion-text-secondary shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-notion-text placeholder:text-notion-text-secondary outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-notion-text-secondary hover:text-notion-text transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
