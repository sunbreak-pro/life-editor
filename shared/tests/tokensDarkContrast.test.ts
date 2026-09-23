import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1951 — the Dark half of #1844. The Light fix lifted --color-text-tertiary to
 * 4.5:1 and left Dark at #75839d, which measured 4.05:1 on bg-secondary and
 * 3.39:1 on hover.
 *
 * Same approach as tokensLightContrast.test.ts: jsdom resolves no custom
 * properties, so the ratios are computed from the declarations in tokens.css,
 * against every Dark surface the tier can sit on, worst case included.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

/** The first `[data-theme="dark"]` block — the palette, not the alias block. */
const darkBlock = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);
if (!darkBlock) throw new Error("tokens.css has no dark block");

const dark = new Map<string, string>();
for (const [, name, hex] of darkBlock[1].matchAll(
  /(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
)) {
  dark.set(name, hex);
}

function value(token: string): string {
  const hex = dark.get(token);
  if (!hex) throw new Error(`tokens.css dark block has no ${token}`);
  return hex;
}

/** WCAG 2.x relative luminance of an #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => {
    const srgb = parseInt(hex.slice(at, at + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/*
 * Every Dark surface a text token is set on. In Dark the lightest surface is
 * the worst case, and that is hover.
 */
const SURFACES = [
  "--color-bg-primary",
  "--color-bg-secondary",
  "--color-bg-subsidebar",
  "--color-hover",
  "--color-surface-sunken",
  "--color-success-subtle",
  "--color-accent-subtle",
] as const;

describe("Dark theme text contrast (#1951)", () => {
  it.each(SURFACES)("clears AA for tertiary text on %s", (surface) => {
    expect(
      ratio(value("--color-text-tertiary"), value(surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)("clears AA for secondary text on %s", (surface) => {
    expect(
      ratio(value("--color-text-secondary"), value(surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the three tiers in order, lightest first", () => {
    const primary = luminance(value("--color-text-primary"));
    const secondary = luminance(value("--color-text-secondary"));
    const tertiary = luminance(value("--color-text-tertiary"));
    expect(primary).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(tertiary);
  });

  it("reproduces the three ratios the PR reports", () => {
    expect(
      ratio(value("--color-text-tertiary"), value("--color-bg-primary")),
    ).toBeCloseTo(6.13, 1);
    expect(
      ratio(value("--color-text-tertiary"), value("--color-bg-secondary")),
    ).toBeCloseTo(5.45, 1);
    expect(
      ratio(value("--color-text-tertiary"), value("--color-hover")),
    ).toBeCloseTo(4.57, 1);
  });
});
