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
 * the host (useThemeContext), copy via `labels`. lumen-* tokens only.
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
        <Globe size={18} className="text-lumen-text-secondary" />
        <h3 className="text-lg font-semibold text-lumen-text">
          {labels.heading}
        </h3>
      </div>
      <p className="text-xs text-lumen-text-secondary">{labels.description}</p>
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
                ? "border-lumen-accent bg-lumen-bg-secondary text-lumen-accent"
                : "border-lumen-border text-lumen-text-secondary hover:border-lumen-text-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
