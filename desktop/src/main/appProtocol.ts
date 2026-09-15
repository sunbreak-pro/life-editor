/*
 * The packaged renderer's delivery scheme (#1636).
 *
 * The packaged app used to be loaded with `loadFile`, which puts the renderer
 * on a `file://` origin. Chromium treats that as an opaque origin and does not
 * reliably persist storage for it, so everything the app keeps in localStorage
 * — theme, font size, language, tour progress, startup section, reminder prefs,
 * shortcut assignments — came back at its default on the next launch. #838 hit
 * the same wall for the Supabase session and moved that ONE value behind IPC;
 * every other device-local preference was still on the losing side.
 *
 * Serving the same bundle from a registered standard scheme (`app://bundle/`)
 * gives the renderer a real, stable origin, and localStorage persists there the
 * way it does in a browser. That fixes the whole class at once instead of
 * lifting keys into IPC one at a time, and `shared/` needs no change at all.
 *
 * Split out of index.ts for the reason ./claudeLauncher.ts was: index.ts
 * imports `electron` at module scope, so anything living there can only be
 * exercised by booting Electron. Nothing below imports electron, which is why
 * the host check, the traversal guard and the MIME table have tests.
 */
import { extname, resolve, sep } from "node:path";

/** Scheme the packaged renderer is served from. Registered as privileged. */
export const APP_SCHEME = "app";

/**
 * The single host the handler answers for. It is what the origin is made of
 * (`app://bundle`), so it must stay stable across releases: changing it points
 * the renderer at a different origin, and every preference saved under the old
 * one becomes invisible — the very bug this scheme exists to fix.
 */
export const APP_HOST = "bundle";

/** What main loads in the packaged app, in place of the old `loadFile`. */
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

/** Served for a bare `/` — the app is one document (no React Router, §3.2). */
const DEFAULT_DOCUMENT = "index.html";

/**
 * Content types by extension. Set explicitly rather than left to whatever the
 * file loader infers: a module script served without a JavaScript MIME type is
 * refused by Chromium's strict checking, and that failure would be a blank
 * window in the packaged app only.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

/** Used for an extension the table does not name. */
export const FALLBACK_CONTENT_TYPE = "application/octet-stream";

export function contentTypeFor(filePath: string): string {
  return (
    CONTENT_TYPES[extname(filePath).toLowerCase()] ?? FALLBACK_CONTENT_TYPE
  );
}

/**
 * Turn a request URL into the file under `rendererRoot` it may read, or null.
 *
 * Null means "answer 404" for every reason: a foreign scheme or host, a path
 * that escapes the bundle, or one that cannot be decoded. A custom scheme
 * handler is a file server running with the main process's privileges, so the
 * containment check is the load-bearing line here — without it
 * `app://bundle/../../../../etc/passwd` reads whatever the user can read.
 *
 * The URL parser collapses dot segments before this sees them — `%2e%2e`
 * included, which the spec counts as one. What it cannot collapse is a segment
 * whose SLASH is encoded (`..%2f..%2f`): that stays a single opaque segment
 * until `decodeURIComponent` below turns it back into a path. So the guard
 * cannot be "the URL looks clean" — it has to be "the resolved absolute path
 * is still inside the root".
 */
export function resolveBundlePath(
  requestUrl: string,
  rendererRoot: string,
): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:`) return null;
  if (url.host !== APP_HOST) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    // Malformed percent-encoding (`%zz`). Refuse rather than guess.
    return null;
  }
  // A NUL would truncate the path inside the OS call while passing every JS
  // check above it.
  if (pathname.includes("\0")) return null;

  const relative =
    pathname === "/" ? DEFAULT_DOCUMENT : pathname.replace(/^\/+/, "");
  if (relative.length === 0) return null;

  const root = resolve(rendererRoot);
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}
