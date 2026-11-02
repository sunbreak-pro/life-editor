// Run: node --test .claude/scripts/scope-overlap.test.mjs
// Fixed data only, so the cases keep passing after the PRs they were modelled on are merged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, globToRegExp, loadMap } from "./scope-overlap.mjs";

const SCRIPT = fileURLToPath(new URL("./scope-overlap.mjs", import.meta.url));
const map = loadMap();
const dir = mkdtempSync(join(tmpdir(), "scope-overlap-"));
let seq = 0;

function cli(fixture, args = []) {
  const path = join(dir, `fx-${seq++}.json`);
  writeFileSync(path, JSON.stringify(fixture));
  try {
    const out = execFileSync(process.execPath, [SCRIPT, "--fixture", path, ...args], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) + String(e.stderr) };
  }
}
const json = (r) => JSON.parse(r.out);
const blocks = (r) => json(r).findings.filter((f) => f.level === "BLOCK");

test("glob matcher", () => {
  const sched = globToRegExp("shared/src/components/schedule/**");
  assert.ok(sched.test("shared/src/components/schedule/a/b.tsx"));
  assert.ok(!sched.test("shared/src/components/scheduleX/a.tsx"));
  const loc = globToRegExp("shared/src/i18n/locales/*.json");
  assert.ok(loc.test("shared/src/i18n/locales/en.json"));
  assert.ok(!loc.test("shared/src/i18n/locales/en/x.json"));
  assert.ok(globToRegExp("web/tests/schedule*").test("web/tests/scheduleFoo.test.tsx"));
  assert.ok(globToRegExp("web\\src\\wikitag\\").test("web/src/wikitag/TagPicker.tsx"));
});

test("same file in another open PR blocks, with the auto-merge hint when merge-tree is clean", () => {
  const r = cli(
    {
      selfBranch: "claude/event-edit-cancel-tags-2447",
      selfFiles: ["web/src/wikitag/TagPicker.tsx", "web/tests/tagPickerOutsideClose.test.tsx"],
      prs: [
        {
          number: 2475,
          headRefName: "claude/tag-picker-outside-close-2448",
          isDraft: false,
          files: ["web/src/wikitag/TagPicker.tsx", "shared/src/components/schedule/EventEditorPane.tsx"],
        },
      ],
      worktrees: [],
      tree: [],
      mergeTree: {},
    },
    ["--json"],
  );
  assert.equal(r.code, 1);
  const b = blocks(r);
  assert.equal(b.length, 1);
  assert.equal(b[0].kind, "same-file");
  assert.equal(b[0].file, "web/src/wikitag/TagPicker.tsx");
  assert.equal(b[0].with, "PR #2475");
  assert.match(b[0].detail, /自動で合流/);
});

test("i18n append hub is INFO unless merge-tree reports a conflict", () => {
  const base = {
    selfBranch: "self",
    selfFiles: ["shared/src/i18n/locales/en.json"],
    prs: [{ number: 10, headRefName: "other", files: ["shared/src/i18n/locales/en.json"] }],
    worktrees: [],
    tree: [],
    mergeTree: {},
  };
  const clean = cli(base, ["--json"]);
  assert.equal(clean.code, 0);
  assert.deepEqual(
    json(clean).findings.map((f) => [f.level, f.kind]),
    [["INFO", "append"]],
  );
  const conflict = cli({ ...base, mergeTree: { other: ["shared/src/i18n/locales/en.json"] } }, ["--json"]);
  assert.equal(conflict.code, 1);
  assert.equal(blocks(conflict)[0].kind, "CONFLICT");
  // A conflict with main itself is reported against origin/main, not blamed on the other PR.
  const stale = cli({ ...base, baseConflicts: ["shared/src/i18n/locales/en.json"] }, ["--json"]);
  assert.equal(stale.code, 1);
  assert.deepEqual(
    blocks(stale).map((f) => [f.kind, f.with]),
    [["CONFLICT", "origin/main"]],
  );
});

test("generated hub is INFO only", () => {
  const r = cli(
    {
      selfFiles: ["shared/src/generated/mcpToolCatalog.json"],
      prs: [{ number: 11, headRefName: "o", files: ["shared/src/generated/mcpToolCatalog.json"] }],
      worktrees: [],
      mergeTree: {},
    },
    ["--json"],
  );
  assert.equal(r.code, 0);
  assert.equal(json(r).findings[0].kind, "generated");
});

test("ANSWERS.md is owner-only", () => {
  const self = { files: [".claude/comm/decisions/ANSWERS.md"] };
  const others = [{ with: "PR #2465", type: "pr", strength: "strong", headRefName: "x", files: self.files }];
  const lane = classify({ self: { ...self, lane: "connect-refine" }, others, map });
  assert.ok(lane.blocked);
  assert.ok(lane.findings.every((f) => f.kind === "owner-only"));
  const owner = classify({ self: { ...self, lane: "chat-main" }, others, map });
  assert.equal(owner.blocked, false);
});

test("the same migration number in another PR blocks", () => {
  const r = classify({
    self: { files: ["supabase/migrations/0043_a.sql"] },
    others: [{ with: "PR #1", type: "pr", strength: "strong", files: ["supabase/migrations/0043_b.sql"] }],
    map,
  });
  assert.ok(r.findings.some((f) => f.level === "BLOCK" && f.kind === "migration-number"));
});

test("offline siblings sharing service files block on each file", () => {
  const r = cli(
    {
      selfBranch: "claude/offline-notes-2337",
      selfFiles: ["shared/src/services/dataServiceFactory.ts", "shared/src/services/offlineDataService.ts"],
      prs: [
        { number: 2454, headRefName: "claude/offline-daily-2336", files: ["shared/src/services/dataServiceFactory.ts"] },
        { number: 2499, headRefName: "claude/other", files: ["shared/src/services/offlineDataService.ts"] },
      ],
      worktrees: [],
      mergeTree: {},
    },
    ["--json"],
  );
  assert.equal(r.code, 1);
  const b = blocks(r);
  assert.equal(b.length, 2);
  assert.ok(b.every((f) => f.kind === "same-file"));
});

test("an unavailable PR list exits 3 and never claims no overlap", () => {
  for (const args of [["--json"], []]) {
    const r = cli({ error: true, selfFiles: ["a.ts"] }, args);
    assert.equal(r.code, 3);
    assert.ok(!r.out.includes("重なりなし"));
  }
});
