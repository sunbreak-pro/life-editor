import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TOOLS } from "../src/tools.js";
import type { ToolDefinition } from "../src/tools/defineTool.js";

/*
 * The tools/handlers pairing (#895).
 *
 * `TOOL_DEFINITIONS` used to be one 986-line array in `tools.ts` while the
 * handlers had been split across `handlers/` on domain lines for far longer.
 * Splitting the definitions the same way only helps if the two stay paired —
 * otherwise the next tool lands in whichever file its author happened to open,
 * and the directory stops meaning anything.
 *
 * So the pairing is checked rather than agreed: a domain with a tools file and
 * no handlers file (or the reverse) fails here. #671 does the same for i18n
 * and routing.
 *
 * The second half is the one that would actually break users: a domain file
 * `tools.ts` forgets to spread is invisible — every test that walks `TOOLS`
 * simply never sees those tools, and Claude Code is told they do not exist.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

const listTs = (dir: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.slice(0, -3));

/** `todoHandlers` -> `todo`. */
const handlerDomains = listTs(resolve(srcDir, "handlers"))
  .map((f) => f.replace(/Handlers$/, ""))
  .sort();

/** Every file under `tools/` except the shared constructor, which owns none. */
const toolDomains = listTs(resolve(srcDir, "tools"))
  .filter((f) => f !== "defineTool")
  .sort();

describe("tools/ and handlers/ describe the same domains (#895)", () => {
  it("has a tools file for every handlers file", () => {
    expect(toolDomains).toEqual(handlerDomains);
  });

  it("names handler files with the Handlers suffix", () => {
    // The mapping above only holds while the convention does.
    for (const file of listTs(resolve(srcDir, "handlers"))) {
      expect(file).toMatch(/Handlers$/);
    }
  });
});

describe("every domain reaches the registry (#895)", () => {
  it("publishes exactly the union of the domain files", () => {
    // Vite expands this glob at transform time, so a new domain file is picked
    // up without editing this suite — the point of checking the directory
    // rather than a hand-written list.
    const modules = import.meta.glob("../src/tools/*.ts", {
      eager: true,
    }) as Record<string, Record<string, unknown>>;

    const fromDomains: string[] = [];
    for (const domain of toolDomains) {
      const entry = Object.entries(modules).find(([path]) =>
        path.endsWith(`/${domain}.ts`),
      );
      expect(entry, `no module loaded for ${domain}`).toBeDefined();
      const arrays = Object.values(entry![1]).filter(
        (v): v is ToolDefinition[] => Array.isArray(v),
      );
      // One exported array per domain file — a second one would mean half the
      // file is unreachable from `tools.ts`, which spreads a single name.
      expect(arrays).toHaveLength(1);
      expect(arrays[0].length).toBeGreaterThan(0);
      fromDomains.push(...arrays[0].map((def) => def.name));
    }

    // Set equality both ways: a domain `tools.ts` forgot to spread is missing
    // from TOOLS, and a tool defined outside any domain file is missing here.
    expect([...fromDomains].sort()).toEqual(
      [...TOOLS.map((t) => t.name)].sort(),
    );
  });

  it("never publishes the same tool name twice", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
