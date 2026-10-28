#!/usr/bin/env node
// local-ci — .github/workflows/ci.yml をその場で読み、全ジョブの全ステップを手元で回す（#2349）
//
// 使い方:
//   node scripts/local-ci.mjs                 # docs-lint + verify を上から順に実行し、終了コード表を出す
//   node scripts/local-ci.mjs --list          # 実行せず、読み取ったステップだけを出す
//   node scripts/local-ci.mjs --job verify    # 指定ジョブだけ
//   node scripts/local-ci.mjs --fail-fast     # 最初の失敗で止める（既定は最後まで回して表にする）
//   node scripts/local-ci.mjs --skip-install  # `npm ci` で始まるステップを飛ばす（node_modules を消さない再実行用）
//
// 手順の正本は ci.yml ただ 1 つ。ここにコマンドを写さない（CLAUDE.md §7.1 / D-20260816-main-2）。
// 写した表は CI から遅れ、PR #924 / #980 / #842 / #985 が「ローカル全緑・CI だけ赤」で落ちた。
//
// 前提: bash が PATH にあること（Windows は Git Bash から起動する。別の bash を使うときは
// LOCAL_CI_BASH に実行ファイルのパスを入れる）。ci.yml の run は GitHub の既定どおり bash -e で流す。
// `uses:` のステップ（checkout / setup-node）は手元では意味を持たないので SKIP と表示する。
// ci.yml に if / env / needs 等、このスクリプトが解釈しない構文が入ったら、黙って無視せず exit 2 で止まる。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');

const TOP_KEYS = new Set(['name', 'on', 'concurrency', 'jobs']);
const JOB_KEYS = new Set(['name', 'runs-on', 'steps']);
const STEP_KEYS = new Set(['name', 'run', 'uses', 'with', 'working-directory']);

// --- ci.yml パーサ（このファイルが使う範囲だけ。外れたら例外） -----------------

function unquote(v) {
  const s = v.trim();
  return /^(['"]).*\1$/.test(s) ? s.slice(1, -1) : s;
}

function parseWorkflow(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const jobs = [];
  let inJobs = false;
  let job = null;
  let inSteps = false;
  let step = null;

  const fail = (n, msg) => {
    throw new Error(`ci.yml:${n + 1}: ${msg}`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(#.*)?$/.test(line)) continue;
    const indent = line.match(/^ */)[0].length;
    const body = line.trim();

    if (indent === 0) {
      const m = body.match(/^([\w-]+):/);
      if (!m) fail(i, `解釈できない行: ${body}`);
      if (!TOP_KEYS.has(m[1])) fail(i, `未対応のトップレベルキー: ${m[1]}`);
      inJobs = m[1] === 'jobs';
      job = null;
      inSteps = false;
      continue;
    }
    if (!inJobs) continue;

    if (indent === 2) {
      const m = body.match(/^([\w-]+):\s*$/);
      if (!m) fail(i, `ジョブ名として解釈できない行: ${body}`);
      job = { id: m[1], label: m[1], steps: [] };
      jobs.push(job);
      inSteps = false;
      step = null;
      continue;
    }
    if (!job) fail(i, `ジョブの外にある行: ${body}`);

    if (indent === 4) {
      const m = body.match(/^([\w-]+):\s*(.*)$/);
      if (!m) fail(i, `解釈できない行: ${body}`);
      if (!JOB_KEYS.has(m[1])) fail(i, `未対応のジョブキー: ${m[1]}（${job.id}）`);
      inSteps = m[1] === 'steps';
      if (m[1] === 'name') job.label = unquote(m[2]);
      continue;
    }
    if (!inSteps) continue;

    // ステップの先頭行 `      - key: value`（indent 6）と続きのキー（indent 8）
    let key;
    let value;
    if (indent === 6 && body.startsWith('- ')) {
      step = { name: null, run: null, uses: null, cwd: '.' };
      job.steps.push(step);
      const m = body.slice(2).match(/^([\w-]+):\s*(.*)$/);
      if (!m) fail(i, `解釈できないステップ: ${body}`);
      [, key, value] = m;
    } else if (indent === 8) {
      const m = body.match(/^([\w-]+):\s*(.*)$/);
      if (!m) fail(i, `解釈できない行: ${body}`);
      [, key, value] = m;
    } else {
      continue; // `with:` の子など、より深い行
    }
    if (!STEP_KEYS.has(key)) fail(i, `未対応のステップキー: ${key}（${job.id}）`);

    if (/^[|>][+-]?$/.test(value.trim())) {
      // ブロックスカラー: indent 8 より深い行を集める
      const folded = value.trim().startsWith('>');
      const buf = [];
      while (i + 1 < lines.length && (/^\s*$/.test(lines[i + 1]) || lines[i + 1].match(/^ */)[0].length > 8)) {
        buf.push(lines[++i].trim());
      }
      value = buf.join(folded ? ' ' : '\n').trim();
    } else {
      value = unquote(value.replace(/\s+#.*$/, ''));
    }

    if (key === 'name') step.name = value;
    else if (key === 'run') step.run = value;
    else if (key === 'uses') step.uses = value;
    else if (key === 'working-directory') step.cwd = value;
  }

  for (const j of jobs) {
    for (const s of j.steps) {
      if (!s.run && !s.uses) throw new Error(`${j.id}: run も uses も無いステップ: ${s.name}`);
      s.name ??= s.run ?? s.uses;
    }
  }
  return jobs;
}

// --- 実行 ------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { list: false, failFast: false, skipInstall: false, job: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--fail-fast') opts.failFast = true;
    else if (a === '--skip-install') opts.skipInstall = true;
    else if (a === '--job') opts.job = argv[++i] ?? '';
    else throw new Error(`未知の引数: ${a}`);
  }
  return opts;
}

function runStep(step) {
  const cwd = path.resolve(ROOT, step.cwd);
  // docs-lint は UTF-8 locale の grep で日本語を含む行が偽陽性になる（CLAUDE.md §7.1）。bash 実行にだけ C locale を当てる
  const env = { ...process.env, LC_ALL: 'C' };
  const bash = process.env.LOCAL_CI_BASH || 'bash';
  const started = Date.now();
  const res = spawnSync(bash, ['-e', '-c', step.run], { cwd, env, stdio: 'inherit' });
  const seconds = Math.round((Date.now() - started) / 1000);
  // 起動できなかった（bash 無し等）は 127 扱いにして、緑と取り違えない
  const code = res.error ? 127 : (res.status ?? 1);
  if (res.error) console.error(`local-ci: ${bash} を起動できません: ${res.error.message}`);
  return { code, seconds };
}

function printTable(rows) {
  const cols = ['job', 'step', 'working-directory', 'result', 'exit', 'sec'];
  const data = rows.map((r) => [r.job, r.name, r.cwd, r.result, r.code === null ? '-' : String(r.code), r.seconds === null ? '-' : String(r.seconds)]);
  const width = cols.map((c, i) => Math.max(c.length, ...data.map((d) => [...d[i]].length)));
  const fmt = (cells) => cells.map((c, i) => c + ' '.repeat(width[i] - [...c].length)).join('  ').trimEnd();
  console.log(fmt(cols));
  console.log(width.map((w) => '-'.repeat(w)).join('  '));
  for (const d of data) console.log(fmt(d));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const jobs = parseWorkflow(fs.readFileSync(WORKFLOW, 'utf8')).filter((j) => !opts.job || j.id === opts.job);
  if (jobs.length === 0) throw new Error(`ジョブが見つかりません: ${opts.job}`);

  console.log(`local-ci: ${path.relative(ROOT, WORKFLOW)} / node ${process.version} / ${jobs.length} jobs`);

  const rows = [];
  let stopped = false;
  for (const job of jobs) {
    for (const step of job.steps) {
      const row = { job: job.id, name: step.name, cwd: step.cwd, result: 'SKIP', code: null, seconds: null };
      rows.push(row);
      if (!step.run) continue; // uses: は手元では何もしない
      if (opts.list) {
        row.result = 'LIST';
        continue;
      }
      if (stopped) {
        row.result = 'NOT RUN';
        continue;
      }
      if (opts.skipInstall && /^npm ci\b/.test(step.run)) continue;

      console.log(`\n=== [${job.id}] ${step.name}\n    $ ${step.run.split('\n')[0]}   (cwd: ${step.cwd})`);
      const { code, seconds } = runStep(step);
      Object.assign(row, { code, seconds, result: code === 0 ? 'PASS' : 'FAIL' });
      if (code !== 0 && opts.failFast) stopped = true;
    }
  }

  console.log('\n=== local-ci result');
  printTable(rows);
  const failed = rows.filter((r) => r.result === 'FAIL');
  const total = rows.filter((r) => r.code !== null).length;
  console.log(`\n${opts.list ? 'list only' : `${total - failed.length}/${total} steps passed`}${failed.length ? ` / FAILED: ${failed.map((r) => `[${r.job}] ${r.name}`).join(', ')}` : ''}`);
  process.exit(failed.length > 0 || rows.some((r) => r.result === 'NOT RUN') ? 1 : 0);
}

try {
  main();
} catch (e) {
  console.error(`local-ci: ${e.message}`);
  process.exit(2);
}
