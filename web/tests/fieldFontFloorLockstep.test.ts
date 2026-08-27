import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WIDE_BREAKPOINT_PX } from "@life-editor/shared";

/*
 * #1134 — the mobile text-field font floor spans two stylesheets and one TS
 * constant, and nothing in the build makes them agree.
 *
 * tokens.css floors `[contenteditable="true"]`, which IS what TipTap puts on
 * the note body — but `.note-editor .ProseMirror` in web/src/index.css is
 * (0,2,0) against that selector's (0,1,0) and both are unlayered, so the
 * editor keeps its 0.875rem and keeps auto-zooming unless the floor is
 * repeated there. That second copy is easy to lose in a merge: it breaks no
 * build, no type and no other suite, and the symptom only shows on a phone.
 *
 * The `767` in both stylesheets is likewise a hand-kept copy of
 * WIDE_BREAKPOINT_PX. A media query cannot read a custom property, so the
 * duplication is unavoidable — constants/breakpoints.ts asks in its own header
 * for the pair to be pinned, which is what this does.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const indexCss = read("../src/index.css");
const tokensCss = read("../../shared/src/styles/tokens.css");
const indexHtml = read("../index.html");

const NARROW_MAX = WIDE_BREAKPOINT_PX - 1;

describe("mobile field font floor stays in lockstep (#1134)", () => {
  it("uses the shared breakpoint in both stylesheets", () => {
    const query = new RegExp(
      `@media\\s*\\(\\s*max-width:\\s*${NARROW_MAX}px\\s*\\)`,
    );
    expect(tokensCss, "tokens.css floor breakpoint drifted").toMatch(query);
    expect(indexCss, "index.css editor floor breakpoint drifted").toMatch(
      query,
    );
  });

  it("floors the editor body from the shared token", () => {
    expect(indexCss).toMatch(
      /\.note-editor\s+\.ProseMirror\s*\{\s*font-size:\s*max\(\s*var\(--field-font-size-min\)\s*,\s*0\.875rem\s*\)/,
    );
  });

  it("keeps the editor's desktop reading size", () => {
    // The floor is additive. If the unconditional 0.875rem ever disappears the
    // editor silently grows on every desktop too, which is not what #1134 asks
    // for.
    expect(indexCss).toMatch(
      /\.note-editor\s+\.ProseMirror\s*\{[^}]*font-size:\s*0\.875rem\s*;/,
    );
  });
});

describe("pinch zoom stays available (#1134 approach B stays rejected)", () => {
  it("never locks the viewport scale", () => {
    // Approach B (`maximum-scale=1, user-scalable=no`) removes the symptom in
    // one line and takes pinch zoom with it — an a11y regression the Issue
    // rules out. The retired Tauri prototype shipped exactly that, so this is
    // a road the repo has already been down.
    const viewport =
      /<meta[^>]+name="viewport"[^>]*>/.exec(indexHtml)?.[0] ?? "";
    expect(viewport, "no viewport meta found").not.toBe("");
    expect(viewport).not.toContain("user-scalable");
    expect(viewport).not.toContain("maximum-scale");
  });

  it("keeps viewport-fit=cover, which safe areas depend on", () => {
    // #320: env(safe-area-inset-*) resolves to 0 without it, collapsing the
    // BottomTabBar / MobileDrawer padding. Unrelated to zoom, and the easiest
    // thing to drop while editing this same attribute.
    const viewport =
      /<meta[^>]+name="viewport"[^>]*>/.exec(indexHtml)?.[0] ?? "";
    expect(viewport).toContain("viewport-fit=cover");
  });
});
