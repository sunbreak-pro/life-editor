// Run: node --test .claude/scripts/records.test.mjs
// Each case copies records.mjs into a fresh temp `.claude/` tree, because the script resolves
// its paths from its own location. That keeps the cases off the real `.claude/decisions/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./records.mjs", import.meta.url));

function tree({ decisions = {}, answers = null, queues = {} }) {
  const root = mkdtempSync(join(tmpdir(), "records-"));
  const claude = join(root, ".claude");
  for (const d of ["scripts", "decisions", "comm/decisions", "docs/vision/plans", "archive"])
    mkdirSync(join(claude, d), { recursive: true });
  copyFileSync(SCRIPT, join(claude, "scripts", "records.mjs"));
  writeFileSync(join(claude, "decisions", "README.md"), "# Decisions\n");
  writeFileSync(join(claude, "decisions", "_TEMPLATE.md"), "---\nid: x\n---\n\n# x\n");
  for (const [name, text] of Object.entries(decisions)) writeFileSync(join(claude, "decisions", name), text);
  if (answers !== null) writeFileSync(join(claude, "comm", "decisions", "ANSWERS.md"), answers);
  for (const [name, text] of Object.entries(queues)) writeFileSync(join(claude, "comm", "decisions", name), text);
  return root;
}

function run(root, cmd) {
  const r = spawnSync(process.execPath, [join(root, ".claude", "scripts", "records.mjs"), cmd], {
    cwd: root,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const decisionsIndex = (root) => readFileSync(join(root, ".claude", "decisions", "INDEX.md"), "utf8");

// Old records put the ID in the H1; new records carry only the title there.
function record(id, opts = {}) {
  const {
    status = "answered",
    answer = "A",
    topics = "[harness]",
    title = `question of ${id}`,
    supersedes = "[]",
    supersededBy = "[]",
    omit = [],
    fmId = id,
  } = opts;
  const fields = {
    id: fmId,
    type: "decision",
    status,
    asked: "2026-08-01",
    answered: "2026-08-02",
    chat: "main",
    answer,
    topics,
    refs: "[]",
    supersedes,
    "superseded-by": supersededBy,
    "implemented-by": "[]",
    "promoted-to": "null",
  };
  const fm = Object.entries(fields)
    .filter(([k]) => !omit.includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const h1 = id.startsWith("D-") ? `# ${id}: ${title}` : `# ${title}`;
  return `---\n${fm}\n---\n\n${h1}\n\n## 背景\n\nbody\n`;
}

const NEW = "2026-11-15-adopt-shared-merge-rules";

test("old names: check passes and index lists records and open queue entries", () => {
  const root = tree({
    decisions: {
      "D-20260801-main-1.md": record("D-20260801-main-1"),
      "D-20260802-main-1.md": record("D-20260802-main-1", { status: "recorded", answer: "B" }),
    },
    answers: "# ANSWERS\n\n- D-20260801-main-1: A（理由）\n",
    queues: {
      "chat-main.md":
        "# chat-main\n\n### D-20260801-main-1: answered already\n\n### D-20260803-main-1: still open\n\n### D-20260804-main-1: dropped（取り下げ）\n",
    },
  });
  const check = run(root, "check");
  assert.equal(check.code, 0, check.out);
  assert.match(check.out, /records: OK/);
  assert.equal(run(root, "index").code, 0);
  const index = decisionsIndex(root);
  assert.ok(index.includes("| D-20260803-main-1 | still open | main |"), index);
  assert.ok(!index.includes("| D-20260801-main-1 | answered already |"), index);
  assert.ok(!index.includes("D-20260804-main-1"), index);
  assert.ok(index.includes("| [D-20260801-main-1](./D-20260801-main-1.md) | question of D-20260801-main-1 | A |"), index);
  assert.ok(index.includes("| [D-20260802-main-1](./D-20260802-main-1.md) |"), index);
});

test("old names: missing items and a missing answer line are reported", () => {
  const root = tree({
    decisions: { "D-20260801-main-1.md": record("D-20260801-main-1", { topics: "[]" }) },
    answers: "# ANSWERS\n",
  });
  const check = run(root, "check");
  assert.equal(check.code, 1, check.out);
  assert.match(check.out, /decisions\/D-20260801-main-1\.md: topics が空/);
  assert.match(check.out, /decisions\/D-20260801-main-1\.md: status=answered だが comm\/decisions\/ANSWERS\.md に行がない/);
});

test("new names: a complete record passes and appears in the index", () => {
  const root = tree({
    decisions: { [`${NEW}.md`]: record(NEW, { title: "Adopt the shared merge rules" }) },
    answers: `# ANSWERS\n\n- ${NEW}: A（共通の決まりに合わせる）\n`,
  });
  const check = run(root, "check");
  assert.equal(check.code, 0, check.out);
  assert.equal(run(root, "index").code, 0);
  const index = decisionsIndex(root);
  assert.ok(index.includes(`| [${NEW}](./${NEW}.md) | Adopt the shared merge rules | A |`), index);
});

test("new names: missing items are reported by check instead of being skipped", () => {
  const root = tree({
    decisions: { [`${NEW}.md`]: record(NEW, { omit: ["answer", "chat"], topics: "[]" }) },
    answers: `# ANSWERS\n\n- ${NEW}: A\n`,
  });
  const check = run(root, "check");
  assert.equal(check.code, 1, check.out);
  assert.match(check.out, new RegExp(`decisions/${NEW}\\.md: status=answered には answer が必須`));
  assert.match(check.out, new RegExp(`decisions/${NEW}\\.md: topics が空`));
  assert.match(check.out, new RegExp(`decisions/${NEW}\\.md: chat が空`));
});

test("new names: an id that differs from the file name, or a missing title, is reported", () => {
  const noTitle = record("2026-11-16-keep-queue-for-unattended-runs").replace(/^# .*$/m, "");
  const root = tree({
    decisions: {
      [`${NEW}.md`]: record(NEW, { fmId: "2026-11-15-something-else", status: "recorded" }),
      "2026-11-16-keep-queue-for-unattended-runs.md": noTitle.replace("status: answered", "status: recorded"),
    },
  });
  const check = run(root, "check");
  assert.equal(check.code, 1, check.out);
  assert.match(check.out, new RegExp(`decisions/${NEW}\\.md: id \\(2026-11-15-something-else\\) がファイル名と一致しない`));
  assert.match(check.out, /2026-11-16-keep-queue-for-unattended-runs\.md: H1 見出し/);
});

test("a decision file whose name is in neither form is reported", () => {
  const root = tree({
    decisions: {
      "adopt-shared-merge-rules.md": record("adopt-shared-merge-rules", { status: "recorded" }),
      "2026-11-15-Adopt_Rules.md": record("2026-11-15-Adopt_Rules", { status: "recorded" }),
    },
  });
  const check = run(root, "check");
  assert.equal(check.code, 1, check.out);
  assert.match(check.out, /decisions\/adopt-shared-merge-rules\.md: ファイル名が/);
  assert.match(check.out, /decisions\/2026-11-15-Adopt_Rules\.md: ファイル名が/);
});

test("mixed: answers and queues with both forms are matched, and open entries keep date order", () => {
  const answers = [
    "# ANSWERS",
    "",
    "<!-- 例: - 2026-11-15-example-name: A -->",
    "- D-20260801-main-1: A（過去の行）",
    `- ${NEW}: A（新しい行）`,
    "",
  ].join("\n");
  const queues = {
    "chat-main.md": [
      "# chat-main",
      "",
      "### D-20260801-main-1: old answered",
      "",
      "### D-20260805-main-1: old open",
      "",
      `### ${NEW}: new answered`,
      "",
      "### 2026-11-16-keep-queue-for-unattended-runs: new open",
      "",
      "### 2026-11-17-drop-something: new dropped（取り下げ）",
      "",
    ].join("\n"),
  };
  const root = tree({
    decisions: {
      "D-20260801-main-1.md": record("D-20260801-main-1"),
      [`${NEW}.md`]: record(NEW, { title: "new answered" }),
    },
    answers,
    queues,
  });
  const check = run(root, "check");
  assert.equal(check.code, 0, check.out);
  assert.equal(run(root, "index").code, 0);
  const index = decisionsIndex(root);
  const open = index.split("## Active")[0];
  assert.ok(open.includes("| D-20260805-main-1 | old open | main |"), open);
  assert.ok(open.includes("| 2026-11-16-keep-queue-for-unattended-runs | new open | main |"), open);
  assert.ok(!open.includes("old answered") && !open.includes("new answered") && !open.includes("new dropped"), open);
  assert.ok(open.indexOf("D-20260805-main-1") < open.indexOf("2026-11-16-keep"), "open entries are in date order");
  const active = index.split("## Active")[1];
  assert.ok(active.indexOf("D-20260801-main-1") < active.indexOf(NEW), "active records are in date order");

  const missing = tree({
    decisions: { [`${NEW}.md`]: record(NEW) },
    answers: "# ANSWERS\n\n- D-20260801-main-1: A\n",
  });
  const r = run(missing, "check");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, new RegExp(`decisions/${NEW}\\.md: status=answered だが comm/decisions/ANSWERS\\.md に行がない`));
});

test("supersede links are checked in both directions across both forms", () => {
  const docLocation = '"2026-05-04-cross-platform-migration.md § 3. 制約"';
  const linked = tree({
    decisions: {
      "D-20260801-main-1.md": record("D-20260801-main-1", { status: "superseded", supersededBy: `["${NEW}"]` }),
      [`${NEW}.md`]: record(NEW, { status: "recorded", supersedes: `["D-20260801-main-1", ${docLocation}]` }),
    },
    answers: "# ANSWERS\n\n- D-20260801-main-1: A\n",
  });
  const ok = run(linked, "check");
  assert.equal(ok.code, 0, ok.out);
  assert.equal(run(linked, "index").code, 0);
  const index = decisionsIndex(linked);
  assert.ok(index.includes(`- D-20260801-main-1 → ${NEW}`), index);
  assert.ok(index.includes(`| [D-20260801-main-1](./D-20260801-main-1.md) | superseded | ${NEW} |`), index);

  const oneWay = tree({
    decisions: {
      "D-20260801-main-1.md": record("D-20260801-main-1", { status: "recorded" }),
      [`${NEW}.md`]: record(NEW, { status: "recorded", supersedes: '["D-20260801-main-1"]' }),
      "2026-11-16-keep-queue-for-unattended-runs.md": record("2026-11-16-keep-queue-for-unattended-runs", {
        status: "recorded",
        supersedes: '["2026-11-01-not-there"]',
      }),
    },
  });
  const bad = run(oneWay, "check");
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, new RegExp(`decisions/D-20260801-main-1\\.md: superseded-by に ${NEW} がない`));
  assert.match(bad.out, /supersedes の 2026-11-01-not-there が台帳に存在しない/);
});
