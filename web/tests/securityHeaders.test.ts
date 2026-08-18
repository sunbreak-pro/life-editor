import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guard for the response headers served on the public Web URL (#1005).
 *
 * `web/public/_headers` is a plain text file that only ever runs in
 * production: Vite copies it into dist/ untouched and Cloudflare Workers
 * (Static Assets) reads it when serving. Nothing in the build, the type
 * checker or any other suite looks inside it, so a typo'd directive name or a
 * dropped header would ship silently and show up only as a missing header on
 * a `curl -I` nobody runs. This suite reads the file instead.
 *
 * Text rather than behaviour, deliberately — the same call as
 * lazySectionChunks.test.ts: what is protected is a DEPLOY property, and jsdom
 * has no notion of a CSP at all.
 *
 * The assertions are deliberately about SHAPE, not about the exact directive
 * string: tightening `img-src` or adding a directive should not turn this red.
 * What must not change quietly is that both headers exist, that the policy
 * covers every fetch directive the app actually uses, and that script-src
 * stays free of the escape hatches that would make the whole header
 * decorative.
 */

const here = dirname(fileURLToPath(import.meta.url));
// CRLF-normalised: this repo is edited on both macOS and Windows.
const source = readFileSync(
  resolve(here, "../public/_headers"),
  "utf8",
).replace(/\r\n/g, "\n");

/**
 * Parse the `_headers` rules for one path pattern.
 *
 * Cloudflare's format is a path line in column 0 followed by indented
 * `Name: value` lines, and `#` lines are comments. Parsing rather than
 * grepping matters here: this file explains each directive in a long comment
 * block, so a bare regex for `script-src 'self'` would happily match the
 * prose and pass even if the rule itself were deleted.
 */
const rulesFor = (pattern: string): Map<string, string> => {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === pattern);
  expect(start, `no rule block for "${pattern}"`).toBeGreaterThanOrEqual(0);

  const headers = new Map<string, string>();
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("#") || line.trim() === "") break;
    if (!/^\s+\S/.test(line)) break;
    const separator = line.indexOf(":");
    expect(separator, `un-parseable header line: ${line}`).toBeGreaterThan(0);
    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }
  return headers;
};

/** Split a CSP into `directive -> source list`. */
const directivesOf = (policy: string): Map<string, string> => {
  const directives = new Map<string, string>();
  for (const part of policy.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const space = trimmed.indexOf(" ");
    directives.set(
      space === -1 ? trimmed : trimmed.slice(0, space),
      space === -1 ? "" : trimmed.slice(space + 1).trim(),
    );
  }
  return directives;
};

const headers = rulesFor("/*");

describe("the public Web URL ships security response headers (#1005)", () => {
  it("sets a Content-Security-Policy and a Referrer-Policy on every path", () => {
    expect(headers.has("content-security-policy")).toBe(true);
    expect(headers.get("referrer-policy")).toBe("no-referrer");
  });

  const csp = directivesOf(headers.get("content-security-policy") ?? "");

  it("defaults to 'self' so an unlisted fetch directive cannot fall open", () => {
    expect(csp.get("default-src")).toBe("'self'");
  });

  it("keeps script-src free of 'unsafe-inline' / 'unsafe-eval'", () => {
    // The point of the header. An injected <script> is exactly the threat
    // #919 widened (a recovery token now rides in the URL), and either
    // keyword here would let one run.
    const scriptSrc = csp.get("script-src");
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
  });

  // Every origin the app reaches at runtime is one Supabase project:
  // PostgREST + Auth over https, Realtime over wss, and the `sounds` storage
  // bucket. Losing any of these rows breaks the app rather than the policy,
  // which is why they are asserted individually.
  const SUPABASE_REACHES = [
    { directive: "connect-src", origin: "https://*.supabase.co" },
    { directive: "connect-src", origin: "wss://*.supabase.co" },
    { directive: "media-src", origin: "https://*.supabase.co" },
    { directive: "img-src", origin: "https://*.supabase.co" },
  ] as const;

  for (const { directive, origin } of SUPABASE_REACHES) {
    it(`allows ${origin} in ${directive}`, () => {
      expect(csp.get(directive)).toContain(origin);
    });
  }

  it("denies framing, plugins and <base> rewriting", () => {
    expect(csp.get("frame-ancestors")).toBe("'none'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("base-uri")).toBe("'self'");
  });
});
