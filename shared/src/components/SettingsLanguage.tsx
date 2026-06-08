import { Globe } from "lucide-react";
import { cn } from "./cn";
import type { Language } from "../context/ThemeContextValue";

export interface SettingsLanguageProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    english: string;
    japanese: string;
  };
}

/*
 * Language settings part (W1). Pure / props-injected: language + setter from
 * the host (useThemeContext), copy via `labels`. notion-* tokens only.
 */
export function SettingsLanguage({
  language,
  onLanguageChange,
  labels,
}: SettingsLanguageProps) {
  const options: { value: Language; label: string }[] = [
    { value: "en", label: labels.english },
    { value: "ja", label: labels.japanese },
  ];

  return (
    <div className="space-y-4" data-section-id="language">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-notion-text-secondary" />
        <h3 className="text-lg font-semibold text-notion-text">
          {labels.heading}
        </h3>
      </div>
      <p className="text-xs text-notion-text-secondary">{labels.description}</p>
      <div className="flex gap-2">
        {options.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onLanguageChange(value)}
            aria-pressed={language === value}
            className={cn(
              "rounded-md border px-4 py-2 text-sm transition-colors",
              language === value
                ? "border-notion-accent bg-notion-bg-secondary text-notion-accent"
                : "border-notion-border text-notion-text-secondary hover:border-notion-text-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
