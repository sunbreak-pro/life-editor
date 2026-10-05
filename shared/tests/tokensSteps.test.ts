import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #2036 — the spacing, icon-size and motion steps in tokens.css.
 *
 * jsdom runs no animations and resolves no custom properties (same constraint
 * as the #887 token test), so what is pinned is the declarations:
 *
 *  - the step values themselves, so a later edit cannot quietly move a step
 *    that the design-critique measurement and the Claude Design kit both copy;
 *  - that no `animation:` carries a number of its own — the DoD of #2036, and
 *    the only way the steps stay the single place a duration is decided;
 *  - that the reduced-motion blocks still override the duration LONGHAND, which
 *    is what keeps a var() inside the shorthand harmless for those users.
 */

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");
// Comments explain the steps in prose ("`animation:` below …"), so match code only.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

const decl = (name: string): string | undefined =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(theme)?.[1].trim();

const DURATIONS = { fast: "150ms", normal: "250ms", slow: "400ms" };
const EASINGS = ["out", "in"];

describe("motion steps (#2036)", () => {
  it.each(Object.entries(DURATIONS))(
    "declares the %s duration as %s",
    (step, value) => {
      expect(decl(`--duration-lumen-${step}`)).toBe(value);
    },
  );

  it.each(EASINGS)("declares the %s easing as a cubic-bezier", (name) => {
    expect(decl(`--ease-lumen-${name}`)).toMatch(/^cubic-bezier\(/);
  });

  const shorthands = [...css.matchAll(/\banimation:\s*([^;]+);/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim(),
  );

  it("finds the existing animations", () => {
    expect(shorthands.length).toBeGreaterThanOrEqual(5);
  });

  it.each(shorthands)("'%s' carries no duration of its own", (value) => {
    expect(value).not.toMatch(/(?<![\w-])\d*\.?\d+m?s\b/);
  });

  it.each(shorthands)("'%s' reads a duration and an easing step", (value) => {
    expect(value).toMatch(/var\(--duration-lumen-(fast|normal|slow)\)/);
    expect(value).toMatch(/var\(--ease-lumen-(out|in)\)/);
  });

  it("still neutralises the duration longhand for reduced motion", () => {
    // One block follows the OS setting, the other the app's forced "reduce".
    const anim = css.match(/animation-duration:\s*0\.001ms\s*!important/g);
    const trans = css.match(/transition-duration:\s*0\.001ms\s*!important/g);
    expect(anim).toHaveLength(2);
    expect(trans).toHaveLength(2);
  });
});

describe("spacing steps (#2036)", () => {
  it.each([1, 2, 3, 4, 6])("--spacing-lumen-%i is that many 4px", (n) => {
    expect(decl(`--spacing-lumen-${n}`)).toBe(`${n * 4}px`);
  });
});

describe("icon size steps (#2036)", () => {
  it("makes the smallest step the icon floor itself", () => {
    expect(decl("--spacing-lumen-icon-sm")).toBe(
      "var(--spacing-lumen-icon-min)",
    );
  });

  it("keeps the steps in rem and growing", () => {
    const rem = (name: string): number => {
      const value = decl(name) ?? "";
      expect(value).toMatch(/^\d*\.?\d+rem$/);
      return parseFloat(value);
    };
    const min = rem("--spacing-lumen-icon-min");
    const md = rem("--spacing-lumen-icon-md");
    const lg = rem("--spacing-lumen-icon-lg");
    expect(md).toBeGreaterThan(min);
    expect(lg).toBeGreaterThan(md);
  });
});
