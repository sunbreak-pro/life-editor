// node --test で動く。API と MCP は、同じ形のにせものに差し替える（鍵も外部通信も要らない）。

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { buildUserMessage, composeBriefing, costOf } from "./compose.mjs";
import { skipReason } from "./context.mjs";
import { runBriefing, scrub } from "./briefing.mjs";
import { ValidationError, validateBriefing } from "./validate.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const DATE = "2026-11-16";
const URL_A = "https://example.com/a";

const goodBriefing = () => ({
  focus: "今日は秘書検定の勉強を 15 分だけ始めます。",
  today: "今日は持ち越しの Todo から 1 つだけ選んで進めます。",
  news: [{ title: "見出し", summary: "1 文の要約です。", url: URL_A }],
  learning: "問い：報告の順序は。答え：結論から話します。",
});

const ctxOf = (daily = {}) => ({
  date: DATE,
  events: [],
  scheduledTodos: [],
  openTodos: [],
  recentDailies: [],
  goals: [],
  records: [],
  todayDaily: { exists: false, locked: false, hasBriefing: false, morningComment: null, text: null, ...daily },
});

describe("validateBriefing", () => {
  const ok = () => validateBriefing(goodBriefing(), config, { allowedUrls: new Set([URL_A]) });

  test("通る例は、focus と段落（今日・ニュース・学び）を返す", () => {
    const { focus, paragraphs } = ok();
    assert.equal(focus, "今日は秘書検定の勉強を 15 分だけ始めます。");
    assert.equal(paragraphs.length, 3);
    assert.match(paragraphs[1], /^ニュース: 見出し。1 文の要約です。 https:\/\/example\.com\/a$/);
    assert.match(paragraphs[2], /^学びの 1 問: /);
  });

  const fails = (mutate, pattern, allowed = new Set([URL_A])) => {
    const b = goodBriefing();
    mutate(b);
    assert.throws(
      () => validateBriefing(b, config, { allowedUrls: allowed }),
      (e) => e instanceof ValidationError && pattern.test(e.problems.join("\n")),
    );
  };

  test("focus が 60 字を超えると落ちる", () => fails((b) => (b.focus = "あ".repeat(61)), /focus: 60 字/));
  test("focus が 2 文だと落ちる", () => fails((b) => (b.focus = "一つ目です。二つ目です。"), /1 文ではありません/));
  test("focus が空だと落ちる", () => fails((b) => (b.focus = "  "), /focus: 空/));
  test("今日の段落が 400 字を超えると落ちる", () => fails((b) => (b.today = "あ".repeat(401)), /400 字/));
  test("ニュースが件数を超えると落ちる", () =>
    fails((b) => (b.news = Array.from({ length: 4 }, () => ({ title: "t", summary: "s。", url: URL_A }))), /3 件を超えて/));
  test("URL が http:// だと落ちる", () => {
    const allowed = new Set(["http://example.com/a"]);
    fails((b) => (b.news[0].url = "http://example.com/a"), /https:\/\//, allowed);
  });
  test("検索の結果に出ていない URL は落ちる（作り話の URL を書かせない）", () =>
    fails((b) => (b.news[0].url = "https://evil.example/x"), /検索の結果に出ていません/));
  test("制御文字を含むと落ちる", () => fails((b) => (b.today = "ふつうの文\u0007です"), /制御文字/));
  test("news の url 以外に URL やリンクがあると落ちる", () => {
    fails((b) => (b.today = "詳しくは https://evil.example を見てください"), /URL やリンク/);
    fails((b) => (b.news[0].summary = "evil-site.com を開いてください。"), /URL やリンク/);
    fails((b) => (b.learning = "答え [ここ](https://x.example)"), /URL やリンク/);
  });
  test("表示を偽装する不可視の文字（ゼロ幅・双方向制御）があると落ちる", () => {
    fails((b) => (b.today = "ふつうの" + String.fromCodePoint(0x200b) + "文です"), /制御文字/);
    fails((b) => (b.today = "ふつうの" + String.fromCodePoint(0x202e) + "文です"), /制御文字/);
  });
  test("題材が空なら、学びが出ていると落ちる", () => {
    const c = { ...config, learningTopic: "" };
    assert.throws(() => validateBriefing(goodBriefing(), c, { allowedUrls: new Set([URL_A]) }), /題材が空なのに出ています/);
  });
});

describe("skipReason（書かない日）", () => {
  test("朝刊がある日は書かない", () => assert.equal(skipReason(ctxOf({ hasBriefing: true })), "already-written"));
  test("鍵のかかった日は書かない", () => assert.equal(skipReason(ctxOf({ locked: true })), "locked"));
  test("何も無い日は書く", () => assert.equal(skipReason(ctxOf()), null));
});

describe("composeBriefing", () => {
  const response = (over = {}) => ({
    stop_reason: "end_turn",
    usage: { input_tokens: 1000, output_tokens: 500, server_tool_use: { web_search_requests: 2 } },
    content: [
      { type: "web_search_tool_result", content: [{ type: "web_search_result", url: URL_A, title: "a" }] },
      { type: "text", text: JSON.stringify(goodBriefing()) },
    ],
    ...over,
  });
  const clientOf = (...responses) => {
    const calls = [];
    return { calls, messages: { create: async (p) => (calls.push(p), responses.shift()) } };
  };

  test("費用は、トークンと検索の回数から計算する", () => {
    assert.equal(costOf({ input: 1_000_000, output: 100_000, searches: 5 }, config), 2 + 1 + 0.05);
  });

  test("検索の結果の URL を集め、出力の上限・検索の上限・effort を渡す", async () => {
    const client = clientOf(response());
    const r = await composeBriefing({ ctx: ctxOf(), config, client });
    assert.deepEqual([...r.searchUrls], [URL_A]);
    assert.equal(r.briefing.focus, goodBriefing().focus);
    const p = client.calls[0];
    assert.equal(p.max_tokens, config.maxTokens);
    assert.equal(p.tools[0].max_uses, config.maxSearches);
    assert.equal(p.output_config.effort, config.effort);
    assert.equal(p.model, "claude-sonnet-5-5");
  });

  test("API の拒否と途中切れは例外にする", async () => {
    await assert.rejects(composeBriefing({ ctx: ctxOf(), config, client: clientOf(response({ stop_reason: "refusal" })) }), /断りました/);
    await assert.rejects(composeBriefing({ ctx: ctxOf(), config, client: clientOf(response({ stop_reason: "max_tokens" })) }), /max_tokens/);
  });

  test("pause_turn は続きを呼び、費用を足していく", async () => {
    const client = clientOf(response({ stop_reason: "pause_turn", content: [{ type: "text", text: "..." }] }), response());
    const r = await composeBriefing({ ctx: ctxOf(), config, client });
    assert.equal(client.calls.length, 2);
    assert.equal(r.usage.input, 2000);
  });

  test("1 回の費用の上限を超えたら止める", async () => {
    const big = response({ usage: { input_tokens: 5_000_000, output_tokens: 0 } });
    await assert.rejects(composeBriefing({ ctx: ctxOf(), config, client: clientOf(big) }), /費用の上限/);
  });

  test("依頼文に、材料と題材が入り、夕刊の本文は 800 字で切る", () => {
    const ctx = ctxOf();
    ctx.recentDailies = [{ date: "2026-11-15", locked: false, text: "あ".repeat(900), morningComment: ["古い朝刊"] }];
    const msg = buildUserMessage(ctx, config);
    assert.match(msg, /<materials>/);
    assert.match(msg, /秘書検定 2 級/);
    assert.ok(!msg.includes("古い朝刊"), "過去の朝刊のコメントは材料に入れない");
    assert.ok(!msg.includes("あ".repeat(801)));
  });
});

describe("runBriefing（つなぐ部分）", () => {
  let home;
  beforeEach(() => (home = mkdtempSync(join(tmpdir(), "briefing-test-"))));
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  // 1 回目の読み = ctx、書く前の読み = lateCtx（人が先に書いた日を作る）、書いたあとの読み = afterCtx
  const fakeMcp = (ctx, afterCtx, lateCtx) => {
    const calls = [];
    let reads = 0;
    let wrote = false;
    return {
      calls,
      call: async (name, args) => {
        calls.push([name, args]);
        if (name === "get_today_context") return wrote ? (afterCtx ?? ctx) : ++reads === 1 ? ctx : (lateCtx ?? ctx);
        if (name === "write_briefing") wrote = true;
        if (name === "write_briefing") return { date: args.date, focus: args.focus };
        throw new Error(`unexpected ${name}`);
      },
      close() {},
    };
  };
  const composed = (briefing = goodBriefing()) => ({
    briefing,
    usage: { input: 100, output: 50, searches: 1 },
    costUsd: 0.01,
    searchUrls: new Set([URL_A]),
  });
  const logLines = () => readFileSync(join(home, "logs", "briefing.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

  test("書けた日は write_briefing を 1 回呼び、印を残し、2 回目は何もしない", async () => {
    const mcp = fakeMcp(ctxOf(), ctxOf({ hasBriefing: true }));
    let composeCalls = 0;
    const deps = { openMcp: async () => mcp, compose: async () => (composeCalls++, composed()) };
    const first = await runBriefing({ date: DATE, config, home, deps });
    assert.equal(first.result, "written");
    assert.deepEqual(mcp.calls.map((c) => c[0]), ["get_today_context", "get_today_context", "write_briefing", "get_today_context"]);
    assert.equal(mcp.calls[2][1].paragraphs.length, 3);
    assert.ok(existsSync(join(home, "done", DATE)));

    const second = await runBriefing({ date: DATE, config, home, deps: { openMcp: async () => fakeMcp(ctxOf()), compose: async () => (composeCalls++, composed()) } });
    assert.deepEqual([second.result, second.reason], ["skipped", "marker"]);
    assert.equal(composeCalls, 1, "2 回目は API を呼ばない");
  });

  test("朝刊がある日・鍵のかかった日は、API も書き込みも呼ばない", async () => {
    for (const [daily, reason] of [[{ hasBriefing: true }, "already-written"], [{ locked: true }, "locked"]]) {
      const mcp = fakeMcp(ctxOf(daily));
      const r = await runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => assert.fail("API を呼んだ") } });
      assert.deepEqual([r.result, r.reason], ["skipped", reason]);
      assert.ok(!mcp.calls.some((c) => c[0] === "write_briefing"));
    }
  });

  test("API が失敗したら、書き込まない", async () => {
    const mcp = fakeMcp(ctxOf());
    await assert.rejects(
      runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => { throw new Error("401"); } } }),
      /401/,
    );
    assert.ok(!mcp.calls.some((c) => c[0] === "write_briefing"));
    assert.ok(!existsSync(join(home, "done", DATE)));
    assert.equal(logLines().at(-1).result, "failed");
  });

  test("検査に落ちたら 1 回だけやり直し、2 回とも落ちたら書かない", async () => {
    const mcp = fakeMcp(ctxOf());
    let n = 0;
    const bad = { ...goodBriefing(), focus: "あ".repeat(80) };
    await assert.rejects(
      runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => (n++, composed(bad)) } }),
      ValidationError,
    );
    assert.equal(n, 2);
    assert.ok(!mcp.calls.some((c) => c[0] === "write_briefing"));
  });

  test("1 回目が落ち、2 回目が通れば書く", async () => {
    const mcp = fakeMcp(ctxOf(), ctxOf({ hasBriefing: true }));
    const answers = [composed({ ...goodBriefing(), focus: "あ".repeat(80) }), composed()];
    const r = await runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => answers.shift() } });
    assert.equal(r.result, "written");
    assert.equal(r.attempt, 2);
    assert.equal(r.usage.input, 200, "費用は 2 回分を足す");
  });

  test("API を待つあいだに人が朝刊を書いた日は、上書きしない", async () => {
    const mcp = fakeMcp(ctxOf(), undefined, ctxOf({ hasBriefing: true }));
    const r = await runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => composed() } });
    assert.deepEqual([r.result, r.reason], ["skipped", "already-written"]);
    assert.ok(!mcp.calls.some((c) => c[0] === "write_briefing"));
  });

  test("作り直しの依頼には、前回落ちた理由を渡し、検索の上限は使った分を引く", async () => {
    const mcp = fakeMcp(ctxOf(), ctxOf({ hasBriefing: true }));
    const seen = [];
    const answers = [composed({ ...goodBriefing(), focus: "あ".repeat(80) }), composed()];
    await runBriefing({
      date: DATE,
      config,
      home,
      deps: { openMcp: async () => mcp, compose: async (a) => (seen.push(a), answers.shift()) },
    });
    assert.equal(seen[0].feedback, undefined);
    assert.match(seen[1].feedback.join("\n"), /focus: 60 字/);
    assert.equal(seen[1].config.maxSearches, config.maxSearches - 1);
    assert.ok(seen[1].config.maxCostUsdPerRun < config.maxCostUsdPerRun);
  });

  test("--dry-run は書き込まず、印も残さない。朝刊がある日でも文面を出す", async () => {
    const mcp = fakeMcp(ctxOf({ hasBriefing: true }));
    const r = await runBriefing({ date: DATE, dryRun: true, config, home, deps: { openMcp: async () => mcp, compose: async () => composed() } });
    assert.equal(r.result, "dry-run");
    assert.equal(r.wouldSkip, "already-written");
    assert.ok(!mcp.calls.some((c) => c[0] === "write_briefing"));
    assert.ok(!existsSync(join(home, "done", DATE)));
  });

  test("書いたのに hasBriefing が true にならなければ、印を残さず失敗にする", async () => {
    const mcp = fakeMcp(ctxOf(), ctxOf());
    await assert.rejects(
      runBriefing({ date: DATE, config, home, deps: { openMcp: async () => mcp, compose: async () => composed() } }),
      /hasBriefing/,
    );
    assert.ok(!existsSync(join(home, "done", DATE)));
  });
});

describe("scrub（鍵を伏せる）", () => {
  test("環境変数の鍵の値と sk-ant- の形を伏せる", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-api03-SECRETSECRET" };
    assert.equal(scrub("failed with sk-ant-api03-SECRETSECRET here", env), "failed with [redacted] here");
    assert.equal(scrub("other sk-ant-api03-ZZZZZZZZZZ", {}), "other [redacted]");
  });
});
