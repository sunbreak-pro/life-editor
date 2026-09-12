import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TOOLS } from "../src/tools.js";
import { REMOTE_TOOL_DEFINITIONS, remoteRegistry } from "../src/remoteTools.js";
import { VERIFICATION_TOOLS } from "../src/tools/verification.js";

/*
 * The remote (Cloudflare Worker) tool set — plan:
 * .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md
 *
 * Two things can silently break the phone, and neither shows up on the
 * desktop:
 *
 * 1. A new domain lands in `tools.ts` instead of `remoteTools.ts`. Claude on
 *    the phone is then told the tool does not exist — there is no error, no
 *    log line, just a capability that quietly is not there. So the difference
 *    between the two registries is pinned to exactly the verification domain.
 *
 * 2. Something in the portable half starts importing a Node built-in Workers
 *    does not have. `wrangler deploy` would catch node:fs at bundle time, but
 *    the deploy is a manual step that happens days after the merge — and CI
 *    never runs it. The module walk below fails in CI instead.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

describe("the remote registry is the full one minus verification", () => {
  it("publishes every tool except the verification harness", () => {
    const verification = VERIFICATION_TOOLS.map((t) => t.name).sort();
    const remote = REMOTE_TOOL_DEFINITIONS.map((t) => t.name).sort();
    const all = TOOLS.map((t) => t.name).sort();

    expect(remote).toEqual(
      all.filter((name) => !verification.includes(name)).sort(),
    );
    // The harness must be a real subtraction, or this suite proves nothing.
    expect(verification.length).toBeGreaterThan(0);
    for (const name of verification) expect(remote).not.toContain(name);
  });

  it("hands the Worker a dispatchable registry", () => {
    expect(remoteRegistry.tools.map((t) => t.name)).toEqual(
      REMOTE_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it("refuses a verification tool by name rather than dispatching it", async () => {
    const name = VERIFICATION_TOOLS[0].name;
    await expect(remoteRegistry.call(name, {})).rejects.toThrow(
      `Unknown tool: ${name}`,
    );
  });
});

/**
 * Every src/ file reachable from `entry` by relative import.
 *
 * Import specifiers are written Node16-style (`./foo.js`) and the sources are
 * `.ts`, so the mapping back is mechanical. Package imports are not followed:
 * this is about what OUR code pulls in.
 */
function reachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    const specifiers = source.matchAll(/from\s+"(\.[^"]+)"/g);
    for (const [, specifier] of specifiers) {
      const asTs = specifier.replace(/\.js$/, ".ts");
      queue.push(resolve(dirname(file), asTs));
    }
  }

  return [...seen];
}

describe("the remote tool set stays deployable to Workers", () => {
  /*
   * node:crypto is fine — Workers implement randomUUID, and nodejs_compat is
   * on in wrangler.jsonc. The rest of this list is what a Worker genuinely
   * does not have; node:fs is the one that already applies (the verification
   * ledger), and it is why the split exists at all.
   */
  const FORBIDDEN = ["node:fs", "node:path", "node:url", "node:child_process"];

  it("imports no Node built-in that Workers lack", () => {
    const offenders: string[] = [];
    for (const file of reachableFrom(resolve(srcDir, "remoteTools.ts"))) {
      const source = readFileSync(file, "utf8");
      for (const builtin of FORBIDDEN) {
        if (source.includes(`"${builtin}"`)) {
          offenders.push(`${file.slice(srcDir.length + 1)} imports ${builtin}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("walks a graph big enough to mean something", () => {
    // A regex that stopped matching would make the test above vacuously green.
    const files = reachableFrom(resolve(srcDir, "remoteTools.ts"));
    expect(files.length).toBeGreaterThan(20);
  });

  it("would have caught the verification domain", () => {
    // The control: the same walk from tools.ts DOES reach node:fs, which is
    // what the Worker registry exists to avoid bundling.
    const viaFullRegistry = reachableFrom(resolve(srcDir, "tools.ts"))
      .filter((f) => readFileSync(f, "utf8").includes('"node:fs"'))
      .map((f) => f.slice(srcDir.length + 1));
    expect(viaFullRegistry).toContain("utils/verification.ts");
  });
});
