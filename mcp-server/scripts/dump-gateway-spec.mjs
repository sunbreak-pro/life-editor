/*
 * Write the extension-app gateway's contract to spec/extension-gateway.json
 * (#2144).
 *
 * The contract is what another repository's stand-in is built from, so this
 * script does what the Settings catalog dump does not: it refuses to write a
 * change that needs a version bump the code has not made. The classification is
 * `classifySpecChange` (src/extensionGateway.ts); the version is
 * EXTENSION_GATEWAY_VERSION. Removing a tool, narrowing a type, adding a
 * required argument or a conditional rule all demand a new major.
 *
 * `lifeEditorCommit` is HEAD at generation time — the commit this file was
 * derived from, not the one that will contain it. tests/extensionGateway.test.ts
 * ignores that one field when it checks the file is current.
 *
 * Reads dist/, so build first: `npm run gateway-spec` chains the two.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../spec/extension-gateway.json");

let gateway;
try {
  gateway = await import("../dist/extensionGateway.js");
} catch (e) {
  console.error(
    "[dump-gateway-spec] cannot read dist/extensionGateway.js — build first:\n" +
      "  cd mcp-server && npm run build\n",
    e,
  );
  process.exit(1);
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: here,
  encoding: "utf8",
}).trim();

const next = gateway.buildGatewaySpec(commit);

if (existsSync(out)) {
  const prev = JSON.parse(readFileSync(out, "utf8"));
  const needed = gateway.classifySpecChange(prev, next);
  const made = gateway.versionBump(prev.gatewayVersion, next.gatewayVersion);
  const rank = { none: 0, patch: 1, minor: 2, major: 3 };
  if (made === "downgrade" || rank[made] < rank[needed]) {
    console.error(
      `[dump-gateway-spec] this change needs a ${needed} version bump, but ` +
        `${prev.gatewayVersion} -> ${next.gatewayVersion} is ${made}. ` +
        "Raise EXTENSION_GATEWAY_VERSION in src/extensionGateway.ts, " +
        "rebuild, and run this again.",
    );
    process.exit(1);
  }
}

mkdirSync(dirname(out), { recursive: true });
// Trailing newline + 2-space indent: the repo's Prettier settings for JSON.
writeFileSync(out, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(
  `[dump-gateway-spec] wrote ${next.tools.length} tools, v${next.gatewayVersion} -> ${out}`,
);
