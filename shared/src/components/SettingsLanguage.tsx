import { Check, Globe } from "lucide-react";
import { cn } from "./cn";
import type { Language } from "../context/ThemeContextValue";

export interface SettingsLanguageProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  /** Stack the options full-width (Mobile) instead of a 2-up grid (Desktop). */
  stacked?: boolean;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    english: string;
    japanese: string;
  };
}

/*
 * Language settings card (W1, redesigned). Pure / props-injected: language +
 * setter from the host (useThemeContext), copy via `labels`. lumen-* tokens
 * only. Selection = accent 2px border + check; Desktop is a 2-up grid, Mobile
 * stacks full-width rows (§6.4 / §5).
 */
export function SettingsLanguage({
  language,
  onLanguageChange,
  stacked = false,
  labels,
}: SettingsLanguageProps) {
  const options: { value: Language; label: string }[] = [
    { value: "en", label: labels.english },
    { value: "ja", label: labels.japanese },
  ];

  return (
    <div className="flex flex-col gap-3" data-section-id="language">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Globe size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={labels.heading}
        className={cn(
          stacked ? "flex flex-col gap-2" : "grid grid-cols-2 gap-3",
        )}
      >
        {options.map(({ value, label }) => {
          const selected = language === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onLanguageChange(value)}
              className={cn(
                "relative flex h-12 items-center rounded-lumen-md bg-lumen-bg text-sm",
                "transition-colors focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-lumen-accent",
                stacked ? "justify-between px-3.5" : "justify-center",
                selected
                  ? "border-2 border-lumen-accent font-medium text-lumen-text"
                  : "border border-lumen-border text-lumen-text-secondary hover:border-lumen-border-strong",
              )}
            >
              <span>{label}</span>
              {selected && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-full bg-lumen-accent text-lumen-on-accent",
                    stacked ? "" : "absolute right-3 top-1/2 -translate-y-1/2",
                  )}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
