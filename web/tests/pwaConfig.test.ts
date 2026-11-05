import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

  /*
   * #2664: the check moved from the workflow's bash into scripts/deploy-web.mjs,
   * which both the hand deploy and the workflow call. Run against a fixture
   * rather than matched as text, so a rewrite of the check cannot keep the
   * words and lose the behaviour.
   */
  const verifyScript = resolve(webRoot, "../scripts/deploy-web.mjs");
  const DIST_FILES = [
    "index.html",
    "manifest.webmanifest",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
  ];
  function fixtureDist(swLists: string[]): string {
    const dist = mkdtempSync(join(tmpdir(), "deploy-web-"));
    mkdirSync(join(dist, "assets"));
    for (const f of DIST_FILES)
      writeFileSync(join(dist, f), "<title>Life Editor</title>");
    writeFileSync(join(dist, "assets", "index-abc.js"), "");
    writeFileSync(join(dist, "assets", "NotesScreen-def.js"), "");
    writeFileSync(
      join(dist, "sw.js"),
      swLists.map((c) => `"assets/${c}"`).join(","),
    );
    return dist;
  }
  const verify = (dist: string) =>
    spawnSync(
      process.execPath,
      [verifyScript, "--verify-only", "--dist", dist],
      {
        encoding: "utf8",
      },
    );

  it("is checked before it deploys: the worker exists and lists every chunk", () => {
    const complete = fixtureDist(["index-abc.js", "NotesScreen-def.js"]);
    const missingChunk = fixtureDist(["index-abc.js"]);
    try {
      expect(verify(complete).status).toBe(0);
      const bad = verify(missingChunk);
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain("assets/NotesScreen-def.js");
      rmSync(join(complete, "sw.js"));
      expect(verify(complete).status).toBe(1);
    } finally {
      rmSync(complete, { recursive: true, force: true });
      rmSync(missingChunk, { recursive: true, force: true });
    }
  });

  it("runs that check on both deploy routes", () => {
    const workflow = readFileSync(
      resolve(webRoot, "../.github/workflows/deploy-web.yml"),
      "utf8",
    );
    expect(workflow).toContain("node scripts/deploy-web.mjs --verify-only");
    expect(JSON.parse(read("package.json")).scripts.deploy).toBe(
      "node ../scripts/deploy-web.mjs",
    );
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
  it("says view only, and that other changes need a connection", () => {
    expect(ja.offline.message).toContain("オフライン — 見るだけ");
    expect(ja.offline.message).toContain("Todo");
    expect(ja.offline.message).toContain("送信します");
    // #2337: other changes need a connection; nothing typed is thrown away.
    expect(ja.offline.message).toContain("ほかの変更には接続が必要です");
    expect(en.offline.message).toContain("view only");
    expect(en.offline.message).toContain("Todo");
    expect(en.offline.message).toContain("Other changes need a connection");
  });
});
