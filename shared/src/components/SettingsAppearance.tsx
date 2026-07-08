import { cn } from "./cn";
import { ThemePreviewCard } from "./ThemePreviewCard";
import { SteppedSlider } from "./SteppedSlider";
import type { Theme, FontSize } from "../context/ThemeContextValue";
import { fontSizeToPx } from "../constants/fontSize";

export interface SettingsAppearanceProps {
  theme: Theme;
  fontSize: FontSize;
  onThemeChange: (theme: Theme) => void;
  onFontSizeChange: (size: FontSize) => void;
  /** Larger touch targets (Mobile): bumps the slider thumb. */
  touch?: boolean;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    theme: string;
    light: string;
    dark: string;
    fontSize: string;
    /** Formatted current value, e.g. "16px（4/10）". */
    fontSizeValue: string;
    fontSizeSmall: string;
    fontSizeLarge: string;
    /** Live preview sentence rendered at the current font size. */
    previewText: string;
  };
}

/*
 * Appearance settings card (W1, redesigned). Pure / props-injected: theme +
 * fontSize + setters from the host (it owns useThemeContext), copy via
 * `labels`. lumen-* tokens only, no hardcoded colors (CLAUDE.md §6.4).
 * Theme = miniature preview radios; font size = discrete tick slider + a live
 * preview sentence at the current px.
 */
export function SettingsAppearance({
  theme,
  fontSize,
  onThemeChange,
  onFontSizeChange,
  touch = false,
  labels,
}: SettingsAppearanceProps) {
  const px = fontSizeToPx(fontSize);

  return (
    <div className="flex flex-col gap-6" data-section-id="appearance">
      <h3 className="text-base font-semibold text-lumen-text">
        {labels.heading}
      </h3>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-lumen-text">
          {labels.theme}
        </span>
        <div
          role="radiogroup"
          aria-label={labels.theme}
          className="grid grid-cols-2 gap-3"
        >
          <ThemePreviewCard
            value="light"
            label={labels.light}
            selected={theme === "light"}
            onSelect={onThemeChange}
          />
          <ThemePreviewCard
            value="dark"
            label={labels.dark}
            selected={theme === "dark"}
            onSelect={onThemeChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-lumen-text">
            {labels.fontSize}
          </span>
          <span className="text-sm tabular-nums text-lumen-text-secondary">
            {labels.fontSizeValue}
          </span>
        </div>
        <SteppedSlider
          value={fontSize}
          min={1}
          max={10}
          onChange={onFontSizeChange}
          ariaLabel={labels.fontSize}
          valueText={labels.fontSizeValue}
          minLabel={labels.fontSizeSmall}
          maxLabel={labels.fontSizeLarge}
          size={touch ? "lg" : "md"}
        />
        <p
          className={cn("mt-1 leading-normal text-lumen-text")}
          style={{ fontSize: `${px}px` }}
        >
          {labels.previewText}
        </p>
      </div>
    </div>
  );
}
