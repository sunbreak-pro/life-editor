/*
 * Issue a key for the extension-app gateway (#2146).
 *
 *   npm run gateway-key -- issue --app subscrecorder
 *   npm run gateway-key -- issue --app subscrecorder --browser --origin https://subscrecorder.example
 *   npm run gateway-key -- issue --app subscrecorder-review --account review --scopes read,write
 *   npm run gateway-key -- secret
 *
 * `issue` prints the key ONCE and the entry to put in the
 * LIFE_EDITOR_GATEWAY_APPS secret. The gateway keeps only the SHA-256, so a key
 * that is lost is re-issued, not recovered. Nothing here talks to Cloudflare or
 * Supabase: the output is yours to paste.
 *
 * ISSUING (a new app):
 *   1. Run `issue` with the app name (lowercase letters, digits, hyphens; it is
 *      what items_meta.origin_app will hold).
 *   2. Copy the `apps` entry from the output into the secret's JSON and put it:
 *        npx wrangler@4 secret put LIFE_EDITOR_GATEWAY_APPS -c wrangler.gateway.jsonc
 *      (paste the whole JSON: {"apps":[ ...every app... ]}).
 *   3. Give the app the key. It is not recoverable from the secret.
 *
 * ISSUING (a second key for an app that exists): run `issue` with the same
 * --app, and add only the printed `keys` element to that app's `keys` array.
 *
 * REVOKING ONE KEY: in the secret's JSON find the key's entry (its `id` is the
 * 8 characters after `lek_` in the key) and add `"revoked": true`, then `wrangler
 * secret put` the whole JSON again. That key is a 404 from the next request on;
 * the app's other keys and its session tokens are untouched. To cut an app off
 * entirely, remove the app's entry: its session tokens stop working too, because
 * the app is looked up on every request.
 *
 * The session secret for /exchange is separate: `secret` prints a fresh one for
 * `wrangler secret put LIFE_EDITOR_GATEWAY_SESSION_SECRET`. Changing it ends
 * every session token that is out, which is the way to cut all browser sessions
 * at once.
 *
 * Reads dist/, so build first: `npm run gateway-key` chains the two.
 */

import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const command = args[0];

const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

if (command === "secret") {
  console.log(randomBytes(32).toString("hex"));
  process.exit(0);
}

if (command !== "issue") {
  console.error(
    "usage: gateway-key issue --app <name> [--account owner|review] " +
      "[--scopes read,write] [--browser --origin <origin>]...\n" +
      "       gateway-key secret",
  );
  process.exit(1);
}

let auth;
try {
  auth = await import("../dist/gatewayAuth.js");
} catch (e) {
  console.error(
    "[gateway-key] cannot read dist/gatewayAuth.js — build first:\n" +
      "  cd mcp-server && npm run build\n",
    e,
  );
  process.exit(1);
}

const app = flag("app");
if (!app || !/^[a-z0-9-]{1,40}$/.test(app)) {
  console.error(
    "[gateway-key] --app is required: lowercase letters, digits and hyphens, " +
      "at most 40 characters.",
  );
  process.exit(1);
}

const origins = args.flatMap((a, i) =>
  a === "--origin" && args[i + 1] ? [args[i + 1]] : [],
);
const entry = { app, keys: [] };
const account = flag("account");
if (account) entry.account = account;
const scopes = flag("scopes");
if (scopes) entry.scopes = scopes.split(",");
if (origins.length > 0) entry.origins = origins;
if (has("browser")) entry.browser = true;

const { key, id, hash } = await auth.generateKey();
entry.keys.push({ id, hash });

// The same parser the gateway runs: refuse here what the Worker would refuse
// there, instead of finding out as a 404 after `secret put`.
if (!auth.parseGatewayConfig(JSON.stringify({ apps: [entry] }))) {
  console.error(
    "[gateway-key] these options would make the gateway reject its own " +
      "config (an origin must be exactly scheme://host[:port]; --browser needs " +
      "at least one --origin; scopes are read and/or write).",
  );
  process.exit(1);
}

console.log(`KEY (shown once, give it to the app): ${key}`);
console.log("");
console.log("apps entry (new app):");
console.log(JSON.stringify(entry, null, 2));
console.log("");
console.log("keys element (second key for an existing app):");
console.log(JSON.stringify(entry.keys[0], null, 2));
