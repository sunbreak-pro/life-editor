import { cn } from "./cn";
import type { Theme, FontSize } from "../context/ThemeContextValue";
import { fontSizeToPx } from "../constants/fontSize";

export interface SettingsAppearanceProps {
  theme: Theme;
  fontSize: FontSize;
  onThemeChange: (theme: Theme) => void;
  onFontSizeChange: (size: FontSize) => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    darkMode: string;
    darkModeDesc: string;
    light: string;
    dark: string;
    fontSize: string;
    fontSizeSmall: string;
    fontSizeLarge: string;
  };
}

/*
 * Appearance settings part (W1). Pure / props-injected: theme + fontSize
 * value + setters come from the host (it owns useThemeContext), copy comes
 * via `labels`. ink-* tokens only, no hardcoded colors (CLAUDE.md §6.4).
 */
export function SettingsAppearance({
  theme,
  fontSize,
  onThemeChange,
  onFontSizeChange,
  labels,
}: SettingsAppearanceProps) {
  const px = fontSizeToPx(fontSize);

  return (
    <div className="space-y-6" data-section-id="appearance">
      <h3 className="text-lg font-semibold text-ink-text">
        {labels.heading}
      </h3>

      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-ink-text">
            {labels.darkMode}
          </p>
          <p className="text-xs text-ink-text-secondary">
            {labels.darkModeDesc}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onThemeChange("light")}
            aria-pressed={theme === "light"}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              theme === "light"
                ? "bg-ink-accent text-ink-on-accent"
                : "bg-ink-hover text-ink-text",
            )}
          >
            {labels.light}
          </button>
          <button
            type="button"
            onClick={() => onThemeChange("dark")}
            aria-pressed={theme === "dark"}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              theme === "dark"
                ? "bg-ink-accent text-ink-on-accent"
                : "bg-ink-hover text-ink-text",
            )}
          >
            {labels.dark}
          </button>
        </div>
      </div>

      <div className="py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-text">
            {labels.fontSize}
          </p>
          <span className="text-xs tabular-nums text-ink-text-secondary">
            {px}px
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          aria-label={labels.fontSize}
          className="w-full accent-[var(--color-ink-accent)]"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-text-secondary">
          <span>{labels.fontSizeSmall}</span>
          <span>{labels.fontSizeLarge}</span>
        </div>
      </div>
    </div>
  );
}
