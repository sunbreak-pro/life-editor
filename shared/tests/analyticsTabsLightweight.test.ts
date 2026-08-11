import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_TAB_ORDER } from "../src/components/Analytics/tabs";

/*
 * Guard for the chart-free Analytics tab vocabulary (#676 (a)).
 *
 * The shell builds its lifted SectionHeader tab band from ANALYTICS_TAB_ORDER
 * and the shell is in the initial chunk. While that constant lived in
 * AnalyticsView.tsx, that single eager import dragged the whole dashboard —
 * every tab and every recharts chart — into the initial chunk, so making the
 * Analytics section lazy bought almost nothing (60 kB of it moved only after
 * the split). Keeping tabs.ts import-free is what holds that line.
 */

const here = dirname(fileURLToPath(import.meta.url));
const tabsModule = resolve(here, "../src/components/Analytics/tabs.ts");
const subBarrel = resolve(here, "../src/components/Analytics/index.ts");
const packageJson = resolve(here, "../package.json");

describe("Analytics tab vocabulary stays chart-free", () => {
  it("has no imports at all in tabs.ts", () => {
    const source = readFileSync(tabsModule, "utf8");
    const imports = source.match(/^\s*import\s/gm) ?? [];
    expect(imports).toEqual([]);
  });

  it("re-exports the order from tabs, not from AnalyticsView", () => {
    const source = readFileSync(subBarrel, "utf8");
    const line = source
      .split("\n")
      .find((l) => l.includes("ANALYTICS_TAB_ORDER"));
    expect(line).toBeDefined();
    expect(line).toContain('from "./tabs"');
  });

  it("keeps the canonical order the view renders", () => {
    expect(ANALYTICS_TAB_ORDER).toEqual([
      "overview",
      "tasks",
      "work",
      "schedule",
    ]);
  });
});

/*
 * The `sideEffects` declaration is what actually lets the bundler drop the
 * unused half of the root barrel — one line worth ~100 kB of initial chunk
 * (Connect's d3 stack had nothing eager referencing it and still shipped).
 * Drop it in a merge or a dependency bump and NOTHING else notices: types,
 * lint and every suite stay green while the bundle quietly doubles back.
 */
describe("shared declares its import-time effects", () => {
  it("exempts only the i18n module, in both src and dist form", () => {
    const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as {
      sideEffects?: unknown;
    };
    // An array, not `false`: i18n/index.ts DOES run i18next.init() at import
    // time, and `false` would license the bundler to throw that away.
    expect(pkg.sideEffects).toEqual([
      "./src/i18n/index.ts",
      // `main`/`exports` point at ./dist, so a consumer resolving through the
      // package (rather than the src alias web/desktop use today) needs the
      // built path listed too.
      "./dist/i18n/index.js",
    ]);
  });
});
