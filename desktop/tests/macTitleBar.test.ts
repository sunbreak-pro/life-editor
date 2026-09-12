import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1590 — the traffic lights and the band they sit in are one measurement kept
 * in two files.
 *
 * The shell places the buttons (`trafficLightPosition` in main/index.ts, a
 * BrowserWindow option) and the renderer reserves the strip they land on
 * (`--spacing-lumen-titlebar-mac` in shared/src/styles/tokens.css). Nothing in
 * either language links them: change the band to 40px and the buttons stay
 * pinned near the top of it, change the y offset and they drift onto the brand
 * header again. Neither shows up in a typecheck, a build, or any render — and
 * it cannot be observed from this Windows machine at all, which is exactly why
 * the guard has to be a text comparison rather than a runtime check.
 *
 * Same shape as web/tests/shellHeightLockstep.test.ts, for the same reason.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const mainProcess = read("../src/main/index.ts");
const tokensCss = read("../../shared/src/styles/tokens.css");
const appShell = read("../../shared/src/components/AppShell.tsx");

/** macOS draws the three buttons at 12 CSS px across and 12 tall. */
const BUTTON_SIZE = 12;

function bandHeightPx(): number {
  const match = tokensCss.match(/--spacing-lumen-titlebar-mac:\s*(\d+)px\s*;/);
  if (!match) throw new Error("tokens.css declares no px mac title-bar band");
  return Number(match[1]);
}

function trafficLightPosition(): { x: number; y: number } {
  const match = mainProcess.match(
    /trafficLightPosition:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}/,
  );
  if (!match) throw new Error("main declares no trafficLightPosition");
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe("macOS title-bar band (#1590)", () => {
  it("centers the traffic lights in the band the renderer reserves", () => {
    const band = bandHeightPx();
    const { y } = trafficLightPosition();
    // The buttons have to clear the band's bottom edge, or they overlap the
    // brand header the band exists to protect.
    expect(y + BUTTON_SIZE).toBeLessThanOrEqual(band);
    expect(y).toBe((band - BUTTON_SIZE) / 2);
  });

  it("keeps the band in px so the type scale cannot move it", () => {
    // The rest of tokens.css is rem on purpose (the Settings font-size step
    // drives documentElement). This one is not, because the OS offset above is
    // not a rem — a rem band drifts out from under the buttons at the steps.
    expect(tokensCss).toMatch(/--spacing-lumen-titlebar-mac:\s*\d+px\s*;/);
  });

  it("positions the lights only on darwin", () => {
    // On Windows and Linux the frame is real: the option would either be
    // ignored or (with a frameless variant later) move buttons that the OS
    // never drew. Keeping it behind the platform check is what makes this a
    // macOS-only change.
    expect(mainProcess).toMatch(
      /\.\.\.\(process\.platform === "darwin"\s*\n?\s*\?\s*\{ trafficLightPosition/,
    );
  });

  it("reserves the band from the token, never from a literal", () => {
    expect(appShell).toContain("h-lumen-titlebar-mac");
    expect(appShell).not.toMatch(/h-\[\s*28px\s*\]/);
  });
});
