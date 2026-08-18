import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1049 — the section entrance animation's declarations.
 *
 * jsdom runs no animations and resolves no custom properties, so the motion
 * itself cannot be observed here (same constraint as the #887 token test).
 * What this pins is the three things about the declaration that a later edit
 * could silently undo:
 *
 *  - the duration the Issue asked for (0.3s),
 *  - `both`, so a reduced-motion user lands on the finished state instead of
 *    being left mid-fade at 0.001ms (the app-wide block below only neutralises
 *    the DURATION),
 *  - `transform: none` as the final frame rather than translateY(0) — an
 *    identity transform still makes the element a containing block for every
 *    `position: fixed` descendant, for the rest of the session.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

const rule = /\.lumen-section-in\s*\{([^}]*)\}/.exec(css);
const keyframes = /@keyframes\s+lumen-section-in\s*\{([\s\S]*?)\n\}/.exec(css);

describe("section entrance motion", () => {
  it("declares the class and its keyframes", () => {
    expect(rule).not.toBeNull();
    expect(keyframes).not.toBeNull();
  });

  it("runs for the 0.3s the brief asked for", () => {
    expect(rule?.[1]).toMatch(/\b0\.3s\b/);
  });

  it("fills both ways so reduced motion lands on the finished state", () => {
    expect(rule?.[1]).toMatch(/\bboth\b/);
  });

  it("ends on transform: none, not an identity translate", () => {
    expect(keyframes?.[1]).toMatch(/transform:\s*none/);
    expect(keyframes?.[1]).not.toMatch(/translateY\(0\)/);
  });

  it("is covered by the app-wide reduced-motion neutraliser", () => {
    // The class carries no duration of its own outside `animation`, so the
    // `animation-duration: 0.001ms !important` blocks reach it. Guard that
    // those blocks still exist rather than re-implementing the query here.
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/:root\[data-reduce-motion="reduce"\]/);
  });
});
