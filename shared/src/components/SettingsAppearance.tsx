import { cn } from "./cn";
import { ThemePreviewCard } from "./ThemePreviewCard";
import { SteppedSlider } from "./SteppedSlider";
import { SettingsSegment } from "./SettingsSegment";
import type {
  ThemeMode,
  FontSize,
  FontFamily,
  ReduceMotion,
} from "../context/ThemeContextValue";
import {
  fontSizeToPx,
  MOBILE_FONT_SIZE_STEPS,
  nearestMobileFontSize,
} from "../constants/fontSize";

export interface SettingsAppearanceProps {
  themeMode: ThemeMode;
  fontSize: FontSize;
  fontFamily: FontFamily;
  reduceMotion: ReduceMotion;
  onThemeModeChange: (mode: ThemeMode) => void;
  onFontSizeChange: (size: FontSize) => void;
  onFontFamilyChange: (family: FontFamily) => void;
  onReduceMotionChange: (reduceMotion: ReduceMotion) => void;
  /*
   * The narrow (Mobile) rendering of the font-size control. It used to mean
   * "same 10-step slider, bigger thumb"; since #1182 it swaps the slider for
   * THREE named presets — ten stops under a thumb is a control nobody can
   * aim, which is what 「段階の幅として使いにくい」 was describing. The value
   * handed back is still a step on the same 1-10 scale.
   */
  touch?: boolean;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    theme: string;
    light: string;
    dark: string;
    /** OS-follow theme option. */
    system: string;
    fontSize: string;
    /** Formatted current value, e.g. "16px（4/10）". */
    fontSizeValue: string;
    fontSizeSmall: string;
    fontSizeLarge: string;
    /** Mobile preset names (`touch`); e.g. "Small" / "Medium" / "Large". */
    fontSizePresetSmall: string;
    fontSizePresetMedium: string;
    fontSizePresetLarge: string;
    /** Bare px readout for the preset row, e.g. "18px" — the preset group
        has no step number to report, so `fontSizeValue` would read wrong. */
    fontSizePx: string;
    /** Live preview sentence rendered at the current font size. */
    previewText: string;
    /** Font-family group. */
    fontFamily: string;
    fontFamilyDesc: string;
    fontFamilySystem: string;
    fontFamilySerif: string;
    fontFamilyMono: string;
    /** Reduce-motion group. */
    reduceMotion: string;
    reduceMotionDesc: string;
    reduceMotionSystem: string;
    reduceMotionReduce: string;
    reduceMotionOff: string;
  };
}

/*
 * Appearance settings card (W1, redesigned; §216 extended). Pure /
 * props-injected: theme mode + fontSize + fontFamily + reduceMotion + setters
 * from the host (it owns useThemeContext), copy via `labels`. lumen-* tokens
 * only, no hardcoded colors (CLAUDE.md §6.4).
 *   - Theme = light/dark miniature preview radios + a "system" (OS-follow) card.
 *   - Font size = a discrete tick slider (pointer) or three named presets
 *     (`touch`, #1182), plus a live preview sentence at the resolved px.
 *   - Font family = 3-way segment (system/serif/mono).
 *   - Reduce motion = 3-way segment (system/reduce/off).
 */
export function SettingsAppearance({
  themeMode,
  fontSize,
  fontFamily,
  reduceMotion,
  onThemeModeChange,
  onFontSizeChange,
  onFontFamilyChange,
  onReduceMotionChange,
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
          className="grid grid-cols-3 gap-3"
        >
          <ThemePreviewCard
            value="light"
            label={labels.light}
            selected={themeMode === "light"}
            onSelect={onThemeModeChange}
          />
          <ThemePreviewCard
            value="dark"
            label={labels.dark}
            selected={themeMode === "dark"}
            onSelect={onThemeModeChange}
          />
          <ThemePreviewCard
            value="system"
            label={labels.system}
            selected={themeMode === "system"}
            onSelect={onThemeModeChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-lumen-text">
            {labels.fontSize}
          </span>
          <span className="text-sm tabular-nums text-lumen-text-secondary">
            {touch ? labels.fontSizePx : labels.fontSizeValue}
          </span>
        </div>
        {touch ? (
          /*
           * #1182. The value handed back is still a step on the 1–10 scale,
           * so the setter, the stored pref and the root px are untouched —
           * only how many stops the phone offers changed. The selected preset
           * is the NEAREST one to whatever is stored rather than an exact
           * match, so a size chosen on Desktop still lights a segment up.
           *
           * `hideLabel`: the heading row above already prints the group's name
           * beside the px readout, and printing it again here stacked the same
           * words twice (#1253). The radiogroup keeps the name for AT either
           * way — only the second visible copy goes.
           */
          <SettingsSegment<string>
            label={labels.fontSize}
            hideLabel
            value={String(nearestMobileFontSize(fontSize))}
            onChange={(value) => onFontSizeChange(Number(value))}
            options={MOBILE_FONT_SIZE_STEPS.map((step, i) => ({
              value: String(step),
              label: [
                labels.fontSizePresetSmall,
                labels.fontSizePresetMedium,
                labels.fontSizePresetLarge,
              ][i],
            }))}
          />
        ) : (
          <SteppedSlider
            value={fontSize}
            min={1}
            max={10}
            onChange={onFontSizeChange}
            ariaLabel={labels.fontSize}
            valueText={labels.fontSizeValue}
            minLabel={labels.fontSizeSmall}
            maxLabel={labels.fontSizeLarge}
          />
        )}
        <p
          className={cn("mt-1 leading-normal text-lumen-text")}
          style={{ fontSize: `${px}px` }}
        >
          {labels.previewText}
        </p>
      </div>

      <SettingsSegment
        label={labels.fontFamily}
        description={labels.fontFamilyDesc}
        value={fontFamily}
        onChange={onFontFamilyChange}
        options={[
          { value: "system", label: labels.fontFamilySystem },
          { value: "serif", label: labels.fontFamilySerif },
          { value: "mono", label: labels.fontFamilyMono },
        ]}
      />

      <SettingsSegment
        label={labels.reduceMotion}
        description={labels.reduceMotionDesc}
        value={reduceMotion}
        onChange={onReduceMotionChange}
        options={[
          { value: "system", label: labels.reduceMotionSystem },
          { value: "reduce", label: labels.reduceMotionReduce },
          { value: "off", label: labels.reduceMotionOff },
        ]}
      />
    </div>
  );
}
