import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1775 — one process per profile.
 *
 * Chromium keeps the renderer's localStorage in a leveldb under userData and
 * locks it for the process that opens it first. With close-to-tray on, the
 * window's close button leaves that process resident, so starting the app
 * again lands a SECOND process on the same profile: it cannot take the lock,
 * its renderer boots with an empty localStorage, and every preference reads
 * back at its default while nothing it writes reaches the disk. #1636 fixed
 * the ORIGIN (file:// -> app://bundle) and this is the other half — measured
 * on the packaged 0.2.0 build, where the second instance reported theme
 * "light" against the resident instance's "dark".
 *
 * Guarded as text for the reason appProtocol.test.ts and macTitleBar.test.ts
 * are: index.ts imports electron at module scope, the behaviour only exists in
 * a packaged build with a window already resident, and every variant of this
 * file type-checks, builds and runs identically in dev. A regression here is
 * invisible until someone loses their settings again.
 */

const here = dirname(fileURLToPath(import.meta.url));
const mainProcess = readFileSync(
  resolve(here, "../src/main/index.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("single-instance lock (#1775)", () => {
  it("asks for the lock at all", () => {
    expect(mainProcess).toContain("app.requestSingleInstanceLock()");
  });

  it("takes the lock after userData is renamed, never before", () => {
    // The lock is keyed on the userData path (#837 moved it to "Life Editor").
    // Taken first, two processes would lock two different names and neither
    // would see the other — the lock would be there and do nothing.
    const renameAt = mainProcess.indexOf("useProductNamedUserData();\n\n");
    const lockAt = mainProcess.indexOf("app.requestSingleInstanceLock()");
    expect(renameAt).toBeGreaterThan(-1);
    expect(lockAt).toBeGreaterThan(renameAt);
  });

  it("takes the lock before anything else opens the profile", () => {
    // A process that is about to exit must not copy the legacy prefs file or
    // construct the store (which rewrites config.json when a default is
    // missing). Both would be a second writer on a file the resident instance
    // owns.
    const lockAt = mainProcess.indexOf("app.requestSingleInstanceLock()");
    const legacyCopyAt = mainProcess.indexOf("migrateLegacyUserData();\n\n");
    const storeAt = mainProcess.indexOf("const store = new Store<");
    expect(legacyCopyAt).toBeGreaterThan(lockAt);
    expect(storeAt).toBeGreaterThan(lockAt);
  });

  it("exits the losing process rather than asking it to quit", () => {
    // app.quit() is asynchronous: the rest of this module would still run in
    // the process that lost the lock. Before `ready`, app.exit() terminates
    // directly, which is the only thing that makes "before" above true.
    expect(mainProcess).toMatch(
      /if \(!app\.requestSingleInstanceLock\(\)\) app\.exit\(0\);/,
    );
  });

  it("raises the resident window when a second launch is blocked", () => {
    // Blocking the second process is half an answer. Whoever double-clicked
    // the shortcut is looking for the window, and with close-to-tray it is
    // hidden — doing nothing would read as the app being broken.
    const handler = mainProcess.match(
      /app\.on\("second-instance",[\s\S]*?\n\}\);/,
    );
    expect(handler).not.toBeNull();
    // The name, not a call: it is handed to whenReady rather than invoked, so a
    // launch arriving before the app is ready still lands on a real window.
    expect(handler?.[0]).toContain("showMainWindow");
  });
});
