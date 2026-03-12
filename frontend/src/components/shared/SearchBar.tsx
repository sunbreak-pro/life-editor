import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rightAction?: React.ReactNode;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  rightAction,
}: SearchBarProps) {
  return (
    <div className="p-3 border-b border-notion-border">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
          />
        </div>
        {rightAction}
      </div>
    </div>
  );
}
