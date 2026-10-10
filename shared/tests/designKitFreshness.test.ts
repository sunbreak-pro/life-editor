import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SECTION_IDS } from "../src/sections";

/*
 * The Claude Design kit against the code it describes (#2152).
 *
 * Claude Design cannot read this repository. What it knows about the app's
 * colors, steps and screens comes from the "DesignSystem" project, whose
 * local mirror is `shared/design-system/claude-design/`. The pages there are
 * hand-written HTML, so they CAN drift: change a hex in tokens.css, ship it,
 * and every new design keeps proposing yesterday's color. This suite makes
 * that drift fail the build instead of surfacing in a design review.
 *
 * Direction matters. Each test walks the SOURCE (tokens.css, the section
 * registry) and looks for every entry in the kit, so a token added to the
 * code without a kit row fails as loudly as a changed value. Nothing here
 * counts rows — a count would be a second copy of a fact the source already
 * owns (数値の非複製原則).
 *
 * When this fails, fix the kit page, not this test — and then send the page
 * to the DesignSystem project (shared/design-system/claude-design/README.md
 * §同期), or Claude Design keeps the old one.
 */

const here = dirname(fileURLToPath(import.meta.url));
// Line endings normalized: a Windows checkout reads CRLF.
const read = (path: string) =>
  readFileSync(join(here, path), "utf8").replace(/\r\n/g, "\n");
const KIT = "../design-system/claude-design/foundations/";

const css = read("../src/styles/tokens.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of the first rule whose selector starts exactly like this. */
function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`tokens.css has no "${selector}" block`);
  return css.slice(start, css.indexOf("}", start));
}

/** `--name: value;` declarations in a block, by name. */
function declarations(body: string, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`--(${prefix}[\\w-]*):\\s*([^;]+);`, "g");
  for (const m of body.matchAll(re)) out.set(m[1], m[2].trim());
  return out;
}

/** `<b>name</b><span>value</span>` swatch rows in a slice of colors.html. */
function swatches(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<b>([\w-]+)<\/b><span>([^<]+)<\/span>/g)) {
    out.set(m[1], m[2].trim().toLowerCase());
  }
  return out;
}

const FIX = "update the kit page, then send it to DesignSystem (README §同期)";

describe("foundations/colors.html", () => {
  const html = read(`${KIT}colors.html`);
  const darkAt = html.indexOf("class='panel dark'");
  const light = swatches(html.slice(0, darkAt));
  const dark = swatches(html.slice(darkAt));
  const lightTokens = declarations(
    block(':root,\n[data-theme="light"] {'),
    "color-",
  );
  const darkTokens = declarations(block('[data-theme="dark"] {'), "color-");

  it("finds both theme panels and both token blocks", () => {
    expect(darkAt).toBeGreaterThan(0);
    expect(lightTokens.size).toBeGreaterThan(0);
    expect(darkTokens.size).toBeGreaterThan(0);
  });

  it("shows every light color with its tokens.css value", () => {
    for (const [name, value] of lightTokens) {
      const key = name.replace(/^color-/, "");
      expect(light.get(key), `light ${key} — ${FIX}`).toBe(value.toLowerCase());
    }
  });

  it("shows every dark override with its tokens.css value", () => {
    for (const [name, value] of darkTokens) {
      const key = name.replace(/^color-/, "");
      expect(dark.get(key), `dark ${key} — ${FIX}`).toBe(value.toLowerCase());
    }
  });

  it("shows nothing tokens.css does not define", () => {
    const known = new Set(
      [...lightTokens.keys()].map((n) => n.replace(/^color-/, "")),
    );
    const extra = [...light.keys(), ...dark.keys()].filter(
      (k) => !known.has(k),
    );
    expect(extra, `stale swatches — ${FIX}`).toEqual([]);
  });
});

describe("foundations/steps.html", () => {
  const html = read(`${KIT}steps.html`);
  const theme = block("@theme {");
  const all = new Map([
    ...declarations(theme, "spacing-lumen-"),
    ...declarations(theme, "duration-lumen-"),
    ...declarations(theme, "ease-lumen-"),
  ]);
  /*
   * The steps are the numbered spacing scale, the page gutters, the three
   * icon sizes and the motion tokens (#2036). The other spacing-lumen-*
   * entries are single layout dimensions (header height, the mac titlebar,
   * the icon / tap floors) rather than steps to choose between, and the kit
   * does not list them.
   */
  const isStep = (name: string) =>
    /^spacing-lumen-(\d+|gutter(-wide)?|icon-(sm|md|lg))$/.test(name) ||
    /^(duration|ease)-lumen-/.test(name);
  const steps = [...all].filter(([name]) => isStep(name));

  /** Follow `var(--x)` to x's own value, so icon-sm shows icon-min's. */
  const resolve = (value: string): string => {
    const ref = /^var\(--([\w-]+)\)$/.exec(value);
    return ref ? resolve(all.get(ref[1]) ?? value) : value;
  };

  /** The `<b>` naming the token plus the `<span>` after it, as one line. */
  const row = (name: string): string | undefined => {
    const re = new RegExp(`<b>--${name}(?:\\s[^<]*)?</b><span>([^<]*)`);
    const m = re.exec(html);
    if (!m) return undefined;
    return m[0].replace(/<[^>]+>/g, " ");
  };

  it("finds the steps in tokens.css", () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  /** The value as a whole word, so "4px" is not found inside "14px". */
  const asWord = (value: string): RegExp =>
    new RegExp(
      `(?<![\\w.#-])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.%])`,
    );

  it("shows every step with its tokens.css value", () => {
    for (const [name, value] of steps) {
      const line = row(name);
      expect(line, `${name} has no row — ${FIX}`).toBeDefined();
      expect(line, `${name} value — ${FIX}`).toMatch(asWord(resolve(value)));
    }
  });
});

describe("foundations/app.html", () => {
  const html = read(`${KIT}app.html`);

  it("lists every section in the registry", () => {
    const listed = new Set(
      [...html.matchAll(/<code>([\w-]+)<\/code>/g)].map((m) => m[1]),
    );
    const missing = SECTION_IDS.filter((id) => !listed.has(id));
    expect(missing, `sections missing from app.html — ${FIX}`).toEqual([]);
  });
});
