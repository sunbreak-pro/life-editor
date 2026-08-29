import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsAppearance } from "../src/components";
import {
  MOBILE_FONT_SIZE_STEPS,
  DEFAULT_MOBILE_FONT_SIZE_STEP,
  nearestMobileFontSize,
  fontSizeToPx,
} from "../src/constants/fontSize";

/*
 * Mobile font-size presets (#1182).
 *
 * The reported problem was the CONTROL, not the scale: ten stops on a slider
 * are indistinguishable under a thumb 「段階の幅として使いにくい」. Narrow
 * widths get three named sizes instead — mapped onto the same 1-10 scale, so
 * the setter, the stored preference and the root px are all unchanged and a
 * size chosen on Desktop still means what it meant.
 *
 * Two halves are pinned here. The mapping (which preset an arbitrary stored
 * value reads as, including values the phone could never have chosen), and
 * the card actually swapping controls on `touch` — the slider and the presets
 * must never both be up, and the value handed back has to stay a scale step
 * rather than becoming 0/1/2.
 */

const LABELS = {
  heading: "外観",
  theme: "テーマ",
  light: "ライト",
  dark: "ダーク",
  system: "システム",
  fontSize: "文字サイズ",
  fontSizeValue: "18px（5/10）",
  fontSizeSmall: "小 12px",
  fontSizeLarge: "大 25px",
  fontSizePresetSmall: "小",
  fontSizePresetMedium: "中",
  fontSizePresetLarge: "大",
  fontSizePx: "18px",
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

const onFontSizeChange = vi.fn();

function renderCard(props: { fontSize: number; touch: boolean }) {
  render(
    <SettingsAppearance
      themeMode="system"
      fontSize={props.fontSize}
      fontFamily="system"
      reduceMotion="system"
      onThemeModeChange={vi.fn()}
      onFontSizeChange={onFontSizeChange}
      onFontFamilyChange={vi.fn()}
      onReduceMotionChange={vi.fn()}
      touch={props.touch}
      labels={LABELS}
    />,
  );
}

beforeEach(() => {
  onFontSizeChange.mockClear();
});

describe("nearestMobileFontSize", () => {
  it("offers three stops at 14 / 18 / 22px", () => {
    expect(MOBILE_FONT_SIZE_STEPS.map(fontSizeToPx)).toEqual([14, 18, 22]);
  });

  it("keeps the app's default step as the middle preset", () => {
    expect(DEFAULT_MOBILE_FONT_SIZE_STEP).toBe(5);
    expect(MOBILE_FONT_SIZE_STEPS[1]).toBe(DEFAULT_MOBILE_FONT_SIZE_STEP);
  });

  it("returns each preset unchanged", () => {
    for (const step of MOBILE_FONT_SIZE_STEPS) {
      expect(nearestMobileFontSize(step)).toBe(step);
    }
  });

  it("snaps a size the phone never offered to the nearest preset", () => {
    expect(nearestMobileFontSize(1)).toBe(3); // 12px → 14px
    expect(nearestMobileFontSize(2)).toBe(3); // 13px → 14px
    expect(nearestMobileFontSize(6)).toBe(5); // 19px → 18px
    expect(nearestMobileFontSize(9)).toBe(8); // 23px → 22px
    expect(nearestMobileFontSize(10)).toBe(8); // 25px → 22px
  });

  it("rounds an exact tie up, toward legibility", () => {
    // 16px is 2px from both 14 and 18; 20px is 2px from both 18 and 22.
    expect(nearestMobileFontSize(4)).toBe(5);
    expect(nearestMobileFontSize(7)).toBe(8);
  });

  it("never leaves the group with nothing selected", () => {
    // Out of range entirely — fontSizeToPx falls back, and so must this.
    expect(MOBILE_FONT_SIZE_STEPS).toContain(nearestMobileFontSize(99));
  });
});

describe("SettingsAppearance — the font-size control", () => {
  it("offers three named presets on touch, and no slider", () => {
    renderCard({ fontSize: 5, touch: true });

    for (const name of ["小", "中", "大"]) {
      screen.getByRole("radio", { name });
    }
    expect(screen.queryByRole("slider")).toBe(null);
  });

  it("hands back a step on the shared scale, not a preset index", () => {
    renderCard({ fontSize: 5, touch: true });

    fireEvent.click(screen.getByRole("radio", { name: "大" }));

    expect(onFontSizeChange.mock.calls).toEqual([[8]]);
  });

  it("marks the preset a Desktop-chosen size reads as", () => {
    // 19px: never offered on the phone, one step above the middle preset.
    renderCard({ fontSize: 6, touch: true });

    expect(
      screen.getByRole("radio", { name: "中" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps the 10-step slider on a pointer, and no presets", () => {
    renderCard({ fontSize: 5, touch: false });

    const slider = screen.getByRole("slider", { name: "文字サイズ" });
    expect(slider.getAttribute("aria-valuemax")).toBe("10");
    expect(screen.queryByRole("radio", { name: "中" })).toBe(null);
  });
});
