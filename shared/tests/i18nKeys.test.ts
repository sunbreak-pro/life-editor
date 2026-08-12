import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";

/*
 * Runtime guard for the translation catalog (#671 C4 S7).
 *
 * i18next has no compile-time knowledge of the catalog here: shared UI
 * takes `t` as a prop (CLAUDE.md §6.4) and web calls `useTranslation()`,
 * so in both trees a key is just a string. A typo or a key added to en and
 * forgotten in ja does not fail the build — it ships, and the user sees the
 * raw key ("schedule.repeat.everyDay") in the UI instead of a sentence.
 * That is the failure mode this test closes.
 *
 * Two checks:
 *   1. en and ja declare the same keys (i18next plural variants folded to
 *      their base, since Japanese legitimately has only `_other`).
 *   2. every literal `t("...")` in shared/src and web/src names a key the
 *      catalog actually has.
 *
 * This file is the only place the catalogs' KEY SETS are checked — parity,
 * the `_other` requirement, and the plural-suffix normalization they share.
 * i18n.test.ts asserted the same two invariants with its own copy of the
 * plural regex until #778 folded them here; two copies meant a change to the
 * suffix handling could leave the looser one green, and one real violation
 * turned two files red without saying which to read. i18n.test.ts now covers
 * runtime behaviour only (init, fallbackLng, plurals through `t()`).
 *
 * Dynamic keys (`t(labelKey)`, template literals) are outside a runtime
 * scan's reach — closing those needs the i18next `CustomTypeOptions` type
 * extension, which is tracked separately.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const SCAN_ROOTS = ["shared/src", "web/src"];

/** i18next plural categories (CLDR). `key` resolves via any of these. */
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

type Catalog = { [key: string]: string | Catalog };

function flatten(node: Catalog, prefix = "", out = new Set<string>()) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.add(key);
    else flatten(v, key, out);
  }
  return out;
}

const EN_KEYS = flatten(en as Catalog);
const JA_KEYS = flatten(ja as Catalog);

function resolvesIn(key: string, catalog: Set<string>): boolean {
  if (catalog.has(key)) return true;
  // A plural key is written as `foo_one` / `foo_other`; call sites pass the
  // bare `foo` and i18next picks the variant from `count`.
  return PLURAL_SUFFIXES.some((s) => catalog.has(`${key}_${s}`));
}

function baseKeys(catalog: Set<string>): Set<string> {
  return new Set([...catalog].map((k) => k.replace(PLURAL_SUFFIX_RE, "")));
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Literal keys passed to `t(...)` in one file, with the line and column so a
 * failure points straight at the call site.
 *
 * Comment lines are skipped: several component headers document their API
 * with `t("rename")`-style examples, and those keys are illustrations, not
 * call sites. The filter is deliberately shallow (a line whose first
 * non-space character opens or continues a comment) — this repo writes
 * block comments in the `/*` + ` *` style, so that covers them, and a
 * shallow rule cannot desync the way a full tokenizer can.
 */
function literalKeysIn(file: string): Array<{ key: string; where: string }> {
  const found: Array<{ key: string; where: string }> = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  lines.forEach((line, i) => {
    const head = line.trimStart();
    if (
      head.startsWith("*") ||
      head.startsWith("//") ||
      head.startsWith("/*")
    ) {
      return;
    }
    // `t("a.b")` / `t('a.b')`, but not `.t(` or `format(` etc.
    for (const m of line.matchAll(/(?<![\w.$])t\(\s*(["'])([^"'\\]+)\1/g)) {
      found.push({ key: m[2], where: `${rel}:${i + 1}` });
    }
  });
  return found;
}

const CALL_SITES = SCAN_ROOTS.flatMap((root) => {
  const dir = resolve(repoRoot, root);
  return existsSync(dir) ? sourceFiles(dir).flatMap(literalKeysIn) : [];
});

describe("i18n catalog", () => {
  it("declares the same keys in en and ja", () => {
    const enBase = [...baseKeys(EN_KEYS)].sort();
    const jaBase = [...baseKeys(JA_KEYS)].sort();
    expect(jaBase).toEqual(enBase);
  });

  it("gives every plural key at least the `_other` variant in both locales", () => {
    for (const [locale, keys] of [
      ["en", EN_KEYS],
      ["ja", JA_KEYS],
    ] as const) {
      const plurals = [...keys].filter((k) => PLURAL_SUFFIX_RE.test(k));
      const missingOther = [
        ...new Set(plurals.map((k) => k.replace(PLURAL_SUFFIX_RE, ""))),
      ].filter((base) => !keys.has(`${base}_other`));
      expect(missingOther, `${locale}: plural base without _other`).toEqual([]);
    }
  });
});

describe("i18n call sites", () => {
  it("finds the literal t() calls it is supposed to be checking", () => {
    // Guards the scanner itself: if the regex or the tree layout drifts and
    // this drops to a handful, the two tests below would pass vacuously.
    expect(CALL_SITES.length).toBeGreaterThan(500);
  });

  it("names only keys the en catalog has", () => {
    const unknown = CALL_SITES.filter(
      ({ key }) => !resolvesIn(key, EN_KEYS),
    ).map(({ key, where }) => `${where} -> ${key}`);
    expect(unknown).toEqual([]);
  });

  it("names only keys the ja catalog has", () => {
    const unknown = CALL_SITES.filter(
      ({ key }) => !resolvesIn(key, JA_KEYS),
    ).map(({ key, where }) => `${where} -> ${key}`);
    expect(unknown).toEqual([]);
  });
});
