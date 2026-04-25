import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OPEN_COMMAND_PALETTE_EVENT } from "../../constants/events";

interface SearchTriggerProps {
  className?: string;
  title?: string;
}

export function SearchTrigger({ className = "", title }: SearchTriggerProps) {
  const { t } = useTranslation();
  const label = title ?? t("commandPalette.openSearch", "Search (⌘K)");
  return (
    <div className={className}>
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() =>
          window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
        }
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
      >
        <Search size={14} />
      </button>
    </div>
  );
}
