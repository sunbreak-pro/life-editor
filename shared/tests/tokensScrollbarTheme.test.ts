import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #827 — native scroll UI must follow the theme.
 *
 * jsdom does not paint scrollbars, so the fix cannot be verified as runtime
 * behavior here. This pins the tokens.css declarations instead: losing any of
 * them silently brings back Chromium's default light scrollbars on the dark
 * theme (the regression #827 fixed), which no other gate would catch.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

describe("tokens.css scrollbar theming (#827)", () => {
  it("declares color-scheme for both themes", () => {
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/color-scheme:\s*dark/);
  });

  it("scopes the dark color-scheme to the dark theme attribute", () => {
    // The dark declaration must live under [data-theme="dark"] — a bare
    // :root { color-scheme: dark } would darken the light theme's UA chrome.
    expect(css).toMatch(/\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark/);
  });

  it("colors the scrollbar thumb through a token, not a hardcoded color", () => {
    const match = /scrollbar-color:\s*([^;]+);/.exec(css);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^var\(--/);
  });
});
