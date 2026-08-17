import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #631 + #1037 — `body` and the app shell must be the same height.
 *
 * body used to say `min-height: 100svh` and AppShell's narrow root `h-[100svh]`
 * — two copies of one number, kept equal by hand. #631 explains why they must
 * match: a body taller than the shell is a document scroll that slides the
 * whole page past the bottom tab bar. #1037 then had to change that number for
 * the iOS home-screen app, which is exactly the moment a hand-kept pair goes
 * out of step, so both sides now read `--app-shell-height`.
 *
 * This suite reads CSS text, which no other gate here does. It is the only
 * option: jsdom loads no stylesheet, so nothing about `body`'s computed height
 * is observable at runtime, and the failure being guarded (one side inlined
 * back to a literal) breaks neither the build nor any render.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const indexCss = read("../src/index.css");
const appShell = read("../../shared/src/components/AppShell.tsx");

describe("the shell height is declared once (#631 / #1037)", () => {
  it("sizes body from the shared token", () => {
    expect(indexCss).toMatch(/min-height:\s*var\(--app-shell-height\)\s*;/);
  });

  it("sizes the narrow shell root from the same token", () => {
    expect(appShell).toContain("h-[var(--app-shell-height)]");
  });

  it("leaves no literal viewport height behind on either side", () => {
    // A leftover `100svh` on one of the two is the regression: it looks
    // harmless, keeps working in every browser tab, and re-opens the blank
    // band under the tab bar in the installed iOS app. The token's own
    // definition lives in shared/src/styles/tokens.css, so neither of these
    // two files should still spell a viewport unit in a declaration.
    expect(indexCss).not.toMatch(/min-height:\s*100[sld]?vh/);
    expect(appShell).not.toMatch(/h-\[100[sld]?vh\]/);
  });
});
