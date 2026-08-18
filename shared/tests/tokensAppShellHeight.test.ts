import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1037 — the app shell must reach the real bottom of the screen in the iOS
 * home-screen app.
 *
 * `black-translucent` + `viewport-fit=cover` makes iOS draw the document under
 * the status bar by shifting it up, WITHOUT giving that strip back to the
 * viewport height. `100svh` therefore stops one status bar short and the tab
 * bar floats above a band of blank space — the report in #791, still there
 * after #805 shaved off the smaller part of it.
 *
 * jsdom resolves neither `env()` nor `@media (display-mode: …)`, so the fix
 * itself is a real-device check (issue DoD). What CAN be pinned is the shape of
 * the declaration, and the shape is the whole safety argument: the correction
 * is scoped to standalone (so browser tabs stay byte-identical) and sized by
 * `env(safe-area-inset-top)` (so it self-cancels to 0 wherever no status bar is
 * overlaid — Android, desktop, and iOS in landscape). A hand-typed `59px`, or
 * the same calc applied unconditionally, would pass a "does the shell look
 * right on my iPhone" check and break one of those.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

/** The body of the `@media (display-mode: standalone)` block, if any. */
const standaloneBlock = (): string => {
  const opener = /@media\s*\(\s*display-mode:\s*standalone\s*\)\s*\{/.exec(css);
  if (opener === null) return "";
  // Brace-count rather than regex to the first `}`: the block nests a :root
  // rule, so a lazy match would stop one level too early.
  let depth = 1;
  let i = opener.index + opener[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  return css.slice(start, i - 1);
};

describe("tokens.css — --app-shell-height (#1037)", () => {
  it("declares a plain small-viewport height as the base value", () => {
    // Outside the installed app this must stay exactly what it always was:
    // the SMALL viewport, so mobile Chrome's collapsing URL bar cannot make
    // body taller than the shell and open a document scroll (#631).
    expect(css).toMatch(/--app-shell-height:\s*100svh\s*;/);
  });

  it("corrects the height only inside an installed app", () => {
    const block = standaloneBlock();
    expect(block, "no @media (display-mode: standalone) block").not.toBe("");
    expect(block).toMatch(/--app-shell-height:\s*calc\(/);
  });

  it("sizes the correction with the top inset rather than a fixed number", () => {
    // env(safe-area-inset-top) is exactly the strip iOS took away, and it is 0
    // wherever nothing is overlaid — that is what makes the rule safe to ship
    // to Android and desktop installs at the same time.
    expect(standaloneBlock()).toMatch(
      /--app-shell-height:\s*calc\(\s*100svh\s*\+\s*env\(safe-area-inset-top\)\s*\)/,
    );
  });

  it("keeps the correction out of the unconditional declaration", () => {
    // The base value must not carry the calc: in a Safari tab the viewport is
    // already whole, so adding the inset there would push the tab bar below
    // the fold — the opposite regression.
    const at = css.search(/@media\s*\(\s*display-mode:\s*standalone\s*\)/);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(css.slice(0, at)).not.toMatch(/--app-shell-height:\s*calc\(/);
  });
});
