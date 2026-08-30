import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsAppearance, ThemePreviewCard } from "../src/components";

/*
 * The two cosmetic breaks the narrow font-size work left behind (#1253).
 *
 * 1. The font-size row printed its name twice — once in the heading row that
 *    pairs it with the live px readout, and again from the preset group's own
 *    label. Two identical labels stacked read as a rendering bug, not as a
 *    section title.
 * 2. At the 22px preset the word "System" ran out of its theme card. jsdom has
 *    no layout (every box measures 0), so the overflow itself cannot be
 *    asserted here — what IS assertable is that the label row is allowed to
 *    wrap and the word is allowed to break, which is what keeps it inside.
 *    The runtime measurement lives with the issue (chat-main, real browser).
 */

const LABELS = {
  heading: "外観",
  theme: "テーマ",
  light: "ライト",
  dark: "ダーク",
  system: "システム",
  fontSize: "文字サイズ",
  fontSizeValue: "22px（8/10）",
  fontSizeSmall: "小 12px",
  fontSizeLarge: "大 25px",
  fontSizePresetSmall: "小",
  fontSizePresetMedium: "中",
  fontSizePresetLarge: "大",
  fontSizePx: "22px",
  previewText: "今日のタスク",
  fontFamily: "フォント",
  fontFamilyDesc: "本文に適用されます。",
  fontFamilySystem: "システム",
  fontFamilySerif: "明朝",
  fontFamilyMono: "等幅",
  reduceMotion: "動きを減らす",
  reduceMotionDesc: "アニメーションを抑えます。",
  reduceMotionSystem: "システムに従う",
  reduceMotionReduce: "減らす",
  reduceMotionOff: "オフ",
};

function renderCard(touch: boolean) {
  render(
    <SettingsAppearance
      themeMode="system"
      fontSize={8}
      fontFamily="system"
      reduceMotion="system"
      onThemeModeChange={vi.fn()}
      onFontSizeChange={vi.fn()}
      onFontFamilyChange={vi.fn()}
      onReduceMotionChange={vi.fn()}
      touch={touch}
      labels={LABELS}
    />,
  );
}

describe("SettingsAppearance — font-size label (#1253)", () => {
  it("prints the font-size name once on the narrow layout", () => {
    renderCard(true);
    expect(screen.getAllByText(LABELS.fontSize)).toHaveLength(1);
  });

  it("keeps the preset group named for assistive tech", () => {
    // The visible copy moved to one place; the accessible name must not.
    renderCard(true);
    screen.getByRole("radiogroup", { name: LABELS.fontSize });
  });

  it("still labels the slider row on a pointer", () => {
    renderCard(false);
    expect(screen.getAllByText(LABELS.fontSize)).toHaveLength(1);
  });
});

describe("ThemePreviewCard — label at large font sizes (#1253)", () => {
  it("lets the label drop below the glyph and break rather than overflow", () => {
    render(
      <ThemePreviewCard
        value="system"
        label="System"
        selected={false}
        onSelect={() => {}}
      />,
    );
    const label = screen.getByText("System");
    // The word itself may break when even a line of its own is too narrow.
    expect(label.className).toContain("break-words");
    expect(label.className).toContain("min-w-0");
    // …and it gets that line of its own because the row wraps.
    expect(label.parentElement?.className).toContain("flex-wrap");
  });
});
