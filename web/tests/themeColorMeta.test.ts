import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1007 lockstep — ThemeProvider selects the status-bar metas with
 * `meta[data-theme-color]` (shared/src/context/ThemeContext.tsx). Rename or
 * drop the attribute here and the updater no-ops SILENTLY: the toolbar just
 * falls back to the OS scheme and no other gate notices. jsdom never loads
 * index.html, so pin the markup itself (same technique as
 * shared/tests/tokensNestedTheme.test.ts).
 */

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "../index.html"), "utf8");

/*
 * Assert against MARKUP, not the raw file: index.html's comment block quotes
 * `<meta name="theme-color">` and `data-theme-color` in prose, so matching the
 * whole file would both miscount the tags and let a comment alone satisfy the
 * attribute checks.
 */
const markup = html.replace(/<!--[\s\S]*?-->/g, "");

describe("index.html theme-color metas (#1007)", () => {
  it("tags both metas with the data-theme-color the provider selects on", () => {
    expect(markup).toMatch(/data-theme-color="light"/);
    expect(markup).toMatch(/data-theme-color="dark"/);
  });

  it("keeps exactly two theme-color metas", () => {
    expect(markup.match(/name="theme-color"/g)).toHaveLength(2);
  });

  it("keeps the manifest on the LIGHT pair on purpose", () => {
    // A manifest cannot express a media query and background_color is baked
    // into the splash at install time, so it stays on the app's default
    // (light) theme rather than chasing the runtime theme (#1007 option b,
    // rejected).
    //
    // Match each meta and check WHICH one carries the manifest colour. Asking
    // only whether the colour appears somewhere in the markup passes just as
    // happily when the manifest is flipped to the dark value (it then matches
    // the dark meta) or when the two literals are swapped — the two mutations
    // this case exists to catch.
    const manifest = JSON.parse(
      readFileSync(join(here, "../public/manifest.webmanifest"), "utf8"),
    ) as { theme_color: string; background_color: string };
    const metaFor = (role: string) =>
      markup.match(
        new RegExp(`<meta[^>]*data-theme-color="${role}"[^>]*>`),
      )?.[0] ?? "";

    expect(metaFor("light")).toContain(`content="${manifest.theme_color}"`);
    expect(metaFor("dark")).not.toContain(`content="${manifest.theme_color}"`);
    expect(manifest.background_color).toBe(manifest.theme_color);
  });
});
