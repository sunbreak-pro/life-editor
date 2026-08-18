import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1050 — the detail panel's entrance declarations.
 *
 * jsdom runs no animations (same constraint as the #887 token test), so what
 * is pinned here is the set of decisions a later edit could quietly undo:
 *
 *  - NO fill-mode on any of the three. A `forwards` fill would leave the final
 *    transform applied and outrank the inline one the drawer's drag writes
 *    (#792) — the panel would stop following the finger, and only in a real
 *    browser.
 *  - The wide panel animates `margin-right`, not `width` (which squashes its
 *    contents) and not `transform` (which turns the push-in panel into the
 *    overlay the brief forbids).
 *  - The mobile drawer enters from the same edge it leaves by.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

const ruleOf = (name: string) =>
  new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
const keyframesOf = (name: string) =>
  new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1];

const CLASSES = [
  "lumen-drawer-in-left",
  "lumen-scrim-in",
  "lumen-panel-in-right",
];

describe("detail panel entrance motion", () => {
  it.each(CLASSES)("declares %s and its keyframes", (name) => {
    expect(ruleOf(name)).toBeDefined();
    expect(keyframesOf(name)).toBeDefined();
  });

  it.each(CLASSES)("leaves %s without a fill-mode", (name) => {
    // `both` / `forwards` here would pin the final frame permanently — see the
    // header comment. `backwards` is harmless but has no reason to appear.
    expect(ruleOf(name)).not.toMatch(/\b(both|forwards|backwards)\b/);
  });

  it("brings the drawer in from its own edge", () => {
    expect(keyframesOf("lumen-drawer-in-left")).toMatch(
      /transform:\s*translateX\(-100%\)/,
    );
  });

  it("pushes the wide panel in by margin, not by width or transform", () => {
    const frames = keyframesOf("lumen-panel-in-right") ?? "";
    expect(frames).toMatch(/margin-right:/);
    expect(frames).not.toMatch(/\bwidth:/);
    expect(frames).not.toMatch(/transform:/);
  });

  it("degrades to no slide when the host forgets --lumen-panel-w", () => {
    expect(keyframesOf("lumen-panel-in-right")).toMatch(
      /var\(--lumen-panel-w,\s*0px\)/,
    );
  });
});
