import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { pwaOptions } from "../pwa.config";

/*
 * #2334 (plan P1c steps 1, 2 and 6) — the choices a passing build would not
 * show. The worker itself runs only in a browser, so this pins what it is built
 * from, and the shape of the files around it.
 */

const webRoot = resolve(__dirname, "..");
const read = (path: string) => readFileSync(join(webRoot, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("the Service Worker build", () => {
  it("caches no network request, so Supabase is never served from it", () => {
    expect(pwaOptions.workbox?.runtimeCaching).toBeUndefined();
    expect(JSON.stringify(pwaOptions)).not.toMatch(/supabase/i);
  });

  it("puts the whole app on the device, lazy chunks included", () => {
    const patterns = pwaOptions.workbox?.globPatterns ?? [];
    expect(patterns.join()).toMatch(/\bjs\b/);
    expect(patterns.join()).toMatch(/\bcss\b/);
    expect(patterns.join()).toMatch(/\bhtml\b/);
    expect(pwaOptions.workbox?.maximumFileSizeToCacheInBytes).toBeGreaterThan(
      2 * 1024 * 1024,
    );
  });

  it("sends every navigation to the app and blocks none", () => {
    expect(pwaOptions.workbox?.navigateFallback).toBe("index.html");
    expect(pwaOptions.workbox?.navigateFallbackDenylist).toBeUndefined();
  });

  it("never takes over a page by itself", () => {
    expect(pwaOptions.registerType).toBe("prompt");
    expect(pwaOptions.workbox?.skipWaiting).toBeUndefined();
    expect(pwaOptions.workbox?.clientsClaim).toBeUndefined();
  });

  it("adds no script to the page, which the CSP would refuse", () => {
    expect(pwaOptions.injectRegister).toBe(false);
  });
});

describe("the web build", () => {
  it("runs these options through the plugin", () => {
    expect(read("vite.config.ts")).toMatch(/\bVitePWA\(pwaOptions\)/);
  });

  it("is checked before it deploys: the worker exists and lists every chunk", () => {
    const deploy = readFileSync(
      resolve(webRoot, "../.github/workflows/deploy-web.yml"),
      "utf8",
    );
    expect(deploy).toContain("test -f web/dist/sw.js");
    expect(deploy).toContain('grep -qF "assets/$(basename "$chunk")" web/dist/sw.js');
  });
});

describe("what the shells build", () => {
  it("keeps the plugin's virtual module out of the bundle Desktop builds too", () => {
    const uses = sourceFiles(join(webRoot, "src")).filter((path) =>
      /(from\s+|import\()["']virtual:pwa/.test(readFileSync(path, "utf8")),
    );
    expect(uses).toEqual([]);
  });
});

describe("_headers", () => {
  const headers = read("public/_headers");

  it("revalidates the worker on every check", () => {
    expect(headers).toMatch(/^\/sw\.js\r?\n\s+Cache-Control: no-cache/m);
  });

  it("keeps script-src to this origin", () => {
    expect(headers).toMatch(/script-src 'self';/);
  });
});

describe("the offline band's copy", () => {
  it("says view only, and that a new Todo is the one thing held", () => {
    expect(ja.offline.message).toContain("オフライン — 見るだけ");
    expect(ja.offline.message).toContain("Todo");
    expect(ja.offline.message).toContain("送信します");
    expect(ja.offline.message).toContain("ほかの変更は保存されません");
    expect(en.offline.message).toContain("view only");
    expect(en.offline.message).toContain("Todo");
    expect(en.offline.message).toContain("Other changes are not saved");
  });
});
