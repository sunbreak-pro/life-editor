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
