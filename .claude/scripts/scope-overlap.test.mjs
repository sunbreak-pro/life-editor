// Run: node --test .claude/scripts/scope-overlap.test.mjs
// Fixed data only, so the cases keep passing after the PRs they were modelled on are merged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, globToRegExp, issuePairs, loadMap, parsePorcelainZ } from "./scope-overlap.mjs";

const SCRIPT = fileURLToPath(new URL("./scope-overlap.mjs", import.meta.url));
const map = loadMap();
const dir = mkdtempSync(join(tmpdir(), "scope-overlap-"));
let seq = 0;

function cli(fixture, args = []) {
  const path = join(dir, `fx-${seq++}.json`);
  writeFileSync(path, JSON.stringify(fixture));
  try {
    const out = execFileSync(process.execPath, [SCRIPT, "--fixture", path, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
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

test("ANSWERS.md is owner-only, except on record branches", () => {
  const self = { files: [".claude/comm/decisions/ANSWERS.md"] };
  const others = [{ with: "PR #2465", type: "pr", strength: "strong", headRefName: "x", files: self.files }];
  const lane = classify({ self: { ...self, lane: "connect-refine", branch: "claude/x-1" }, others, map });
  assert.ok(lane.blocked);
  assert.ok(lane.findings.every((f) => f.kind === "owner-only"));
  const owner = classify({ self: { ...self, lane: "chat-main" }, others, map });
  assert.equal(owner.blocked, false);
  const record = classify({
    self: { ...self, lane: "connect-refine", branch: "origin/chore/tracker-connect-refine-20261102-2" },
    others,
    map,
  });
  assert.equal(record.blocked, false);
  assert.deepEqual(
    record.findings.map((f) => [f.level, f.kind]),
    [["INFO", "owner-only"]],
  );
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

test("git status -z keeps the leading space of an unstaged first entry", () => {
  assert.deepEqual(parsePorcelainZ(" M a/b.ts\0?? c.ts\0"), ["a/b.ts", "c.ts"]);
  assert.deepEqual(parsePorcelainZ("R  new.ts\0old.ts\0 M .claude/comm/x.md\0"), ["new.ts"]);
});

test("a PR's own conflicts with main are not blamed on self", () => {
  const r = cli(
    {
      selfBranch: "claude/fix-2474",
      selfFiles: ["shared/src/components/materials/NoteDetailPanel.tsx"],
      prs: [
        {
          number: 2460,
          headRefName: "claude/offline-notes-2337",
          files: ["shared/src/components/materials/NoteDetailPanel.tsx", "shared/src/i18n/locales/en.json"],
        },
      ],
      worktrees: [],
      mergeTree: { "claude/offline-notes-2337": ["shared/src/i18n/locales/en.json", "web/src/notes/NoteDetailSurface.tsx"] },
      prBaseConflicts: {
        "claude/offline-notes-2337": ["shared/src/i18n/locales/en.json", "web/src/notes/NoteDetailSurface.tsx"],
      },
    },
    ["--json"],
  );
  assert.equal(r.code, 1);
  assert.deepEqual(
    blocks(r).map((f) => [f.kind, f.file]),
    [["same-file", "shared/src/components/materials/NoteDetailPanel.tsx"]],
  );
  assert.ok(json(r).findings.some((f) => f.kind === "stale-pr" && f.level === "INFO"));
  // A file self touches too still counts, even when the other PR also conflicts with main on it.
  const both = cli(
    {
      selfBranch: "claude/offline-notes-2337",
      selfFiles: ["shared/src/services/dataServiceFactory.ts"],
      prs: [{ number: 2454, headRefName: "claude/offline-daily-2336", files: ["shared/src/services/dataServiceFactory.ts"] }],
      worktrees: [],
      mergeTree: { "claude/offline-daily-2336": ["shared/src/services/dataServiceFactory.ts"] },
      prBaseConflicts: { "claude/offline-daily-2336": ["shared/src/services/dataServiceFactory.ts"] },
    },
    ["--json"],
  );
  assert.deepEqual(
    blocks(both).map((f) => [f.kind, f.with]),
    [["CONFLICT", "PR #2454"]],
  );
});

test("without merge-tree an append hub overlap is WARN and does not block", () => {
  const r = cli(
    {
      tree: ["shared/src/i18n/locales/en.json"],
      prs: [{ number: 12, headRefName: "o", files: ["shared/src/i18n/locales/en.json"] }],
      worktrees: [],
    },
    ["--paths", "shared/src/i18n/locales/en.json"],
  );
  assert.equal(r.code, 0);
  assert.match(r.out, /WARN append/);
  assert.ok(!r.out.includes("結論: 重なりなし"));
  const pairs = issuePairs(
    { "#1": ["shared/src/i18n/locales/en.json"], "#2": ["shared/src/i18n/locales/en.json"] },
    ["shared/src/i18n/locales/en.json"],
    map,
  );
  assert.equal(pairs[0].level, "WARN");
});

test("--branch takes the lane of the worktree holding that branch", () => {
  const r = cli(
    {
      selfPath: "/w/materials-refine",
      selfFiles: ["shared/src/components/goalTree/GoalDetailPanel.tsx", "web/src/wikitag/TagPicker.tsx"],
      prs: [],
      worktrees: [
        { name: "materials-refine", path: "/w/materials-refine", branch: "claude/m-1" },
        { name: "schedule-refine", path: "/w/schedule-refine", branch: "claude/s-2" },
      ],
    },
    ["--branch", "claude/s-2", "--json"],
  );
  assert.equal(r.code, 0);
  const out = json(r);
  assert.equal(out.self.lane, "schedule-refine");
  // goalTree belongs to connect-refine; tag files are open to every lane.
  assert.deepEqual(
    out.findings.map((f) => [f.kind, f.file]),
    [["off-lane", "shared/src/components/goalTree/GoalDetailPanel.tsx"]],
  );
});

test("an unexpected error exits 3, not the BLOCK code 1", () => {
  const r = cli({ prs: "not-a-list", worktrees: [], selfFiles: ["a.ts"] }, []);
  assert.equal(r.code, 3);
  assert.match(r.out, /未確認/);
  assert.ok(!r.out.includes("重なりなし"));
});
