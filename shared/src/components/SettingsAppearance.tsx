import { cn } from "./cn";
import type { Theme, FontSize } from "../context/ThemeContextValue";

const FONT_SIZE_PX: Record<number, number> = {
  1: 12,
  2: 13,
  3: 14,
  4: 16,
  5: 18,
  6: 19,
  7: 20,
  8: 22,
  9: 23,
  10: 25,
};

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
 * via `labels`. notion-* tokens only, no hardcoded colors (CLAUDE.md §6.4).
 */
export function SettingsAppearance({
  theme,
  fontSize,
  onThemeChange,
  onFontSizeChange,
  labels,
}: SettingsAppearanceProps) {
  const px = FONT_SIZE_PX[fontSize] ?? 18;

  return (
    <div className="space-y-6" data-section-id="appearance">
      <h3 className="text-lg font-semibold text-notion-text">
        {labels.heading}
      </h3>

      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-notion-text">
            {labels.darkMode}
          </p>
          <p className="text-xs text-notion-text-secondary">
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
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text",
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
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text",
            )}
          >
            {labels.dark}
          </button>
        </div>
      </div>

      <div className="py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-notion-text">
            {labels.fontSize}
          </p>
          <span className="text-xs tabular-nums text-notion-text-secondary">
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
          className="w-full accent-[var(--color-notion-accent)]"
        />
        <div className="mt-1 flex justify-between text-xs text-notion-text-secondary">
          <span>{labels.fontSizeSmall}</span>
          <span>{labels.fontSizeLarge}</span>
        </div>
      </div>
    </div>
  );
}
