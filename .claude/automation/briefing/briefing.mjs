#!/usr/bin/env node
// 朝刊を書く。材料を取る → API で文にする → 検査する → write_briefing で書く、の順。
//
//   node briefing.mjs [--date YYYY-MM-DD] [--dry-run]
//
// --dry-run は書き込まない。JSON・書き込む段落・費用を出す。朝刊が既にある日でも、書かない理由を
// 表示したうえで最後まで試す（過去の日付で文面を確かめるため）。
// 鍵は環境変数 ANTHROPIC_API_KEY で受ける。起動役 run-briefing.ps1 が復号して、このプロセスにだけ渡す。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkMcpEnv, openMcp, readContext, skipReason, writeBriefing } from "./context.mjs";
import { composeBriefing, costOf } from "./compose.mjs";
import { ValidationError, validateBriefing } from "./validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_ATTEMPTS = 2;

export function homeDir(env = process.env) {
  return env.LIFE_BRIEFING_HOME || join(env.LOCALAPPDATA || join(process.env.HOME || ".", ".local"), "life-briefing");
}

export function localDateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ログと標準出力に鍵が混ざらないよう、鍵の値を伏せる。 */
export function scrub(text, env = process.env) {
  const key = env.ANTHROPIC_API_KEY;
  let out = String(text);
  if (key) out = out.split(key).join("[redacted]");
  return out.replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "[redacted]");
}

function appendLog(home, fields) {
  const dir = join(home, "logs");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...fields });
  appendFileSync(join(dir, "briefing.log"), scrub(line) + "\n", "utf8");
}

/**
 * @param {object} opts
 * @param {string} opts.date YYYY-MM-DD
 * @param {boolean} [opts.dryRun]
 * @param {object} opts.config
 * @param {string} opts.home 印とログを置く場所
 * @param {object} [opts.deps] テストで差し替える部品
 */
export async function runBriefing({ date, dryRun = false, config, home, deps = {} }) {
  const open = deps.openMcp ?? openMcp;
  const compose = deps.compose ?? composeBriefing;
  const marker = join(home, "done", date);
  const log = (fields) => appendLog(home, { date, dryRun, ...fields });

  const mcp = await open();
  try {
    const ctx = await readContext(mcp, date);
    const reason = skipReason(ctx) ?? (!dryRun && existsSync(marker) ? "marker" : null);
    if (reason && !dryRun) {
      log({ result: "skipped", reason });
      return { result: "skipped", reason };
    }

    let total = { input: 0, output: 0, searches: 0 };
    let lastError;
    let feedback;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // 1 回の実行の費用と検索の回数は、作り直しを含めて 1 つの上限で見る
      const budgetUsd = config.maxCostUsdPerRun - costOf(total, config);
      if (attempt > 1 && budgetUsd < 0.1) break;
      const attemptConfig = { ...config, maxCostUsdPerRun: budgetUsd, maxSearches: Math.max(config.maxSearches - total.searches, 1) };
      let composed;
      try {
        composed = await compose({ ctx, config: attemptConfig, feedback });
      } catch (e) {
        // API の失敗（認証・上限・拒否）は、同じ依頼を繰り返しても直らないので、その場で止める
        log({ result: "failed", stage: "compose", attempt, error: e.message });
        throw e;
      }
      for (const k of Object.keys(total)) total[k] += composed.usage[k];
      try {
        const { focus, paragraphs } = validateBriefing(composed.briefing, config, { allowedUrls: composed.searchUrls });
        const costUsd = costOf(total, config);
        if (dryRun) {
          log({ result: "dry-run", wouldSkip: reason, attempt, usage: total, costUsd });
          return { result: "dry-run", wouldSkip: reason, focus, paragraphs, briefing: composed.briefing, usage: total, costUsd, attempt };
        }
        // API を待つあいだに、こうだいさんが朝刊を書いたかもしれない。書く直前にもう一度読む
        const fresh = skipReason(await readContext(mcp, date));
        if (fresh) {
          log({ result: "skipped", reason: fresh, afterCompose: true, usage: total, costUsd });
          return { result: "skipped", reason: fresh };
        }
        const written = await writeBriefing(mcp, { date, focus, paragraphs });
        const back = await readContext(mcp, date);
        if (!back?.todayDaily?.hasBriefing) throw new Error("書き込んだのに hasBriefing が true になりません");
        mkdirSync(dirname(marker), { recursive: true });
        writeFileSync(marker, new Date().toISOString(), "utf8");
        log({ result: "written", attempt, usage: total, costUsd, written });
        return { result: "written", focus, paragraphs, usage: total, costUsd, attempt };
      } catch (e) {
        if (!(e instanceof ValidationError)) {
          log({ result: "failed", stage: "write", attempt, error: e.message });
          throw e;
        }
        lastError = e;
        feedback = e.problems;
        log({ result: "invalid", attempt, problems: e.problems, usage: total, costUsd: costOf(total, config) });
      }
    }
    throw lastError ?? new Error("費用の上限に達しました");
  } finally {
    mcp.close();
  }
}

function parseArgs(argv) {
  const out = { dryRun: false, date: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--date") out.date = argv[++i];
    else throw new Error(`不明な引数: ${argv[i]}`);
  }
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error("--date は YYYY-MM-DD で指定します");
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY が渡されていません（run-briefing.ps1 から起動します）");
  checkMcpEnv();
  const res = await runBriefing({ date: args.date ?? localDateKey(), dryRun: args.dryRun, config, home: homeDir() });
  if (res.result === "skipped") {
    console.log(`skipped: ${res.reason}`);
    return;
  }
  if (args.dryRun) {
    console.log(JSON.stringify(res.briefing, null, 2));
    console.log("\n--- 書き込む段落 ---");
    console.log(`focus: ${res.focus}`);
    res.paragraphs.forEach((p, i) => console.log(`[${i + 1}] ${p}\n`));
    if (res.wouldSkip) console.log(`(本番なら書かない日: ${res.wouldSkip})`);
    console.log(`費用: $${res.costUsd.toFixed(4)} / 入力 ${res.usage.input} 出力 ${res.usage.output} 検索 ${res.usage.searches} 回 / 試行 ${res.attempt} 回`);
    return;
  }
  console.log(`written: ${res.focus} ($${res.costUsd.toFixed(4)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`briefing: ${scrub(e.message)}`);
    process.exit(1);
  });
}
