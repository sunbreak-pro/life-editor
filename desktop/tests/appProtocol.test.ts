import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_ENTRY_URL,
  APP_HOST,
  APP_SCHEME,
  FALLBACK_CONTENT_TYPE,
  contentTypeFor,
  resolveBundlePath,
} from "../src/main/appProtocol";

/*
 * #1636 — the renderer's origin, and the file server that comes with it.
 *
 * Two different things are pinned here.
 *
 * The first is the ORIGIN. Whether the packaged app keeps a theme across a
 * restart comes down to one line in main/index.ts choosing between `loadFile`
 * (file://, storage dropped) and `loadURL(APP_ENTRY_URL)` (app://bundle,
 * storage kept). Nothing else can tell the two apart: both type-check, both
 * build, and dev runs on http://localhost either way — the difference only
 * shows up after quitting a packaged build, which no CI here does. So the
 * guard is a text comparison, the same shape macTitleBar.test.ts uses for the
 * same reason.
 *
 * The second is the HANDLER. Serving a scheme makes main a file server with
 * main's privileges; `resolveBundlePath` is the whole of its access control,
 * so the traversal cases below are the point of this file rather than
 * decoration around the happy path.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve("/srv/life-editor/out/renderer");

describe("app:// path resolution (#1636)", () => {
  it("serves index.html for the bare root", () => {
    expect(resolveBundlePath(`${APP_SCHEME}://${APP_HOST}/`, ROOT)).toBe(
      resolve(ROOT, "index.html"),
    );
  });

  it("serves the entry URL main actually loads", () => {
    expect(resolveBundlePath(APP_ENTRY_URL, ROOT)).toBe(
      resolve(ROOT, "index.html"),
    );
  });

  it("serves bundled assets under the renderer root", () => {
    expect(
      resolveBundlePath(
        `${APP_SCHEME}://${APP_HOST}/assets/index-abc123.js`,
        ROOT,
      ),
    ).toBe(resolve(ROOT, "assets", "index-abc123.js"));
  });

  it("serves the public files index.html references by absolute path", () => {
    // favicon.svg / manifest.webmanifest / apple-touch-icon.png come from
    // web/public and are referenced from the document root.
    expect(
      resolveBundlePath(
        `${APP_SCHEME}://${APP_HOST}/manifest.webmanifest`,
        ROOT,
      ),
    ).toBe(resolve(ROOT, "manifest.webmanifest"));
  });

  it("decodes percent-encoded names", () => {
    expect(
      resolveBundlePath(`${APP_SCHEME}://${APP_HOST}/assets/a%20b.png`, ROOT),
    ).toBe(resolve(ROOT, "assets", "a b.png"));
  });

  it("refuses another host on the same scheme", () => {
    // The host is half the origin, so answering for more than one would hand
    // out more than one storage partition.
    expect(
      resolveBundlePath(`${APP_SCHEME}://elsewhere/index.html`, ROOT),
    ).toBe(null);
  });

  it("refuses another scheme", () => {
    expect(resolveBundlePath("https://bundle/index.html", ROOT)).toBe(null);
    expect(resolveBundlePath("file:///etc/passwd", ROOT)).toBe(null);
  });

  it("refuses a URL that does not parse", () => {
    expect(resolveBundlePath("not a url", ROOT)).toBe(null);
  });

  it("collapses the dot segments the URL parser already normalizes", () => {
    // `%2e%2e` counts as a double-dot segment in the URL spec, so the parser
    // removes it before this function ever sees it and the request lands back
    // inside the bundle. Written down rather than assumed: it is the reason
    // the encoded-SLASH cases below are the ones that matter.
    expect(
      resolveBundlePath(
        `${APP_SCHEME}://${APP_HOST}/%2e%2e/%2e%2e/index.html`,
        ROOT,
      ),
    ).toBe(resolve(ROOT, "index.html"));
  });

  it("refuses traversal hidden behind encoded slashes", () => {
    // What the parser cannot collapse is a segment whose SLASH is encoded: it
    // stays one opaque segment until decodeURIComponent turns it into a path.
    // So the guard has to be the resolved absolute path, not the shape of the
    // URL.
    for (const attack of [
      "/..%2f..%2fsecret.txt",
      "/assets%2f..%2f..%2f..%2fetc%2fpasswd",
    ]) {
      expect(
        resolveBundlePath(`${APP_SCHEME}://${APP_HOST}${attack}`, ROOT),
      ).toBe(null);
    }
  });

  it("refuses a sibling directory that merely shares the root's prefix", () => {
    // `/srv/life-editor/out/renderer-private` starts with the root string but
    // is not inside it — the separator in the check is what rejects it.
    expect(
      resolveBundlePath(
        `${APP_SCHEME}://${APP_HOST}/..%2frenderer-private%2fkeys.json`,
        ROOT,
      ),
    ).toBe(null);
  });

  it("refuses a NUL byte", () => {
    // It would truncate the path inside the OS call while passing every check
    // written in JavaScript above it.
    expect(
      resolveBundlePath(`${APP_SCHEME}://${APP_HOST}/index.html%00.png`, ROOT),
    ).toBe(null);
  });

  it("refuses malformed percent-encoding instead of guessing", () => {
    expect(resolveBundlePath(`${APP_SCHEME}://${APP_HOST}/%zz.js`, ROOT)).toBe(
      null,
    );
  });

  it("keeps every resolved path inside the renderer root", () => {
    const allowed = [
      "/",
      "/index.html",
      "/assets/index-abc123.js",
      "/assets/index-abc123.css",
    ];
    for (const path of allowed) {
      const resolved = resolveBundlePath(
        `${APP_SCHEME}://${APP_HOST}${path}`,
        ROOT,
      );
      expect(resolved).not.toBeNull();
      expect(resolved?.startsWith(ROOT + sep)).toBe(true);
    }
  });
});

describe("app:// content types (#1636)", () => {
  it("labels module scripts as JavaScript", () => {
    // Chromium refuses a `type="module"` script served under any other type,
    // and the whole window comes up blank — in the packaged build only.
    expect(contentTypeFor("/out/renderer/assets/index-abc123.js")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(contentTypeFor("/out/renderer/assets/chunk.mjs")).toBe(
      "text/javascript; charset=utf-8",
    );
  });

  it("labels the document, styles and icons", () => {
    expect(contentTypeFor("/out/renderer/index.html")).toBe(
      "text/html; charset=utf-8",
    );
    expect(contentTypeFor("/out/renderer/assets/index.css")).toBe(
      "text/css; charset=utf-8",
    );
    expect(contentTypeFor("/out/renderer/favicon.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("/out/renderer/apple-touch-icon.png")).toBe(
      "image/png",
    );
    expect(contentTypeFor("/out/renderer/manifest.webmanifest")).toBe(
      "application/manifest+json; charset=utf-8",
    );
  });

  it("ignores case in the extension", () => {
    expect(contentTypeFor("/out/renderer/ICON.PNG")).toBe("image/png");
  });

  it("falls back for an extension it does not know", () => {
    expect(contentTypeFor("/out/renderer/data.bin")).toBe(
      FALLBACK_CONTENT_TYPE,
    );
    expect(contentTypeFor("/out/renderer/LICENSE")).toBe(FALLBACK_CONTENT_TYPE);
  });
});

describe("main loads the renderer over app:// (#1636)", () => {
  const mainProcess = readFileSync(
    resolve(here, "../src/main/index.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("registers the scheme as standard and secure before ready", () => {
    // `standard` is the flag that gives the renderer a real origin, and so the
    // one that decides whether localStorage survives a restart. `secure` keeps
    // it a secure context. Dropping either silently restores the bug.
    expect(mainProcess).toContain("registerSchemesAsPrivileged");
    expect(mainProcess).toMatch(/standard:\s*true/);
    expect(mainProcess).toMatch(/secure:\s*true/);
  });

  it("loads the entry URL and never falls back to loadFile", () => {
    expect(mainProcess).toContain("mainWindow.loadURL(APP_ENTRY_URL)");
    // The regression this whole change exists to prevent.
    expect(mainProcess).not.toContain("loadFile(");
  });

  it("registers the handler before the window asks for a file", () => {
    // Scoped to the ready block: `createWindow()` is also called from
    // showMainWindow / the macOS activate handler, and those are not the
    // ordering this is about.
    const readyBlock = mainProcess.slice(
      mainProcess.indexOf("app.whenReady()"),
    );
    const handlerAt = readyBlock.indexOf("registerAppProtocol();");
    const windowAt = readyBlock.indexOf("createWindow();");
    expect(handlerAt).toBeGreaterThan(-1);
    expect(windowAt).toBeGreaterThan(-1);
    expect(handlerAt).toBeLessThan(windowAt);
  });
});
