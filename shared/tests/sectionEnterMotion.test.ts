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
 *  - the duration, which is the normal motion step since #2036 (the Issue's
 *    0.3s snapped to 250ms — the step's VALUE is pinned by
 *    tokensMotionSteps.test.ts, so only the reference is checked here),
 *  - the `backwards` fill (#2497). A `both` / `forwards` fill holds the last
 *    keyframe for as long as the class stays on, and Chrome holds it as an
 *    identity matrix even when the frame says `transform: none` — which makes
 *    the section root the containing block for every `position: fixed`
 *    descendant, so a fixed menu opened on the first visit to a section landed
 *    offset by the section's origin. Reduced motion still lands on the
 *    finished state: once the 0.001ms run ends, the element shows its own
 *    styles, which equal the `to` frame,
 *  - `transform: none` as the final frame rather than translateY(0), so the
 *    `to` frame and the element's own styles stay the same thing.
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

  it("runs on the normal motion step", () => {
    expect(rule?.[1]).toMatch(/var\(--duration-lumen-normal\)/);
  });

  it("fills backwards only, so no transform outlives the animation", () => {
    expect(rule?.[1]).toMatch(/\bbackwards\b/);
    expect(rule?.[1]).not.toMatch(/\b(both|forwards)\b/);
  });

  it("leaves the element's own styles equal to the final frame", () => {
    // Without a forwards fill the element drops back to its own styles when
    // the animation ends; if the rule set opacity or transform itself, the
    // section would snap away from the `to` frame at that moment.
    const own = (rule?.[1] ?? "").replace(/animation:[^;]*;/, "");
    expect(own).not.toMatch(/\b(opacity|transform)\s*:/);
    expect(keyframes?.[1]).toMatch(/to\s*\{[^}]*opacity:\s*1/);
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
