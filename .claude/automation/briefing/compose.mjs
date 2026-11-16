// 依頼文を組み、Claude API を 1 回（pause_turn のときだけ続き）呼んで、決まった形の JSON を受け取る。
// エージェントではない。道具はサーバー側の Web 検索だけで、ファイルにもコマンドにも触らない。

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const PROMPT = readFileSync(new URL("./prompt.md", import.meta.url), "utf8");
const MAX_CONTINUES = 3;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function briefingSchema() {
  return {
    type: "object",
    properties: {
      focus: { type: "string" },
      today: { type: "string" },
      news: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, summary: { type: "string" }, url: { type: "string" } },
          required: ["title", "summary", "url"],
          additionalProperties: false,
        },
      },
      learning: { type: "string" },
    },
    required: ["focus", "today", "news", "learning"],
    additionalProperties: false,
  };
}

function weekdayOf(date) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 材料を、長さを抑えて依頼文にする。夕刊の本文は 1 日 800 字まで。 */
export function buildUserMessage(ctx, config, feedback) {
  const date = ctx.date;
  const weekday = weekdayOf(date);
  const cut = (s, n) => (typeof s === "string" && [...s].length > n ? [...s].slice(0, n).join("") + "…" : s);
  const materials = {
    date,
    weekday,
    events: ctx.events,
    scheduledTodos: ctx.scheduledTodos,
    openTodos: (ctx.openTodos ?? []).slice(0, 20),
    recentDailies: (ctx.recentDailies ?? []).map((d) => ({ date: d.date, locked: d.locked, text: cut(d.text, 800) })),
    goals: ctx.goals,
    records: ctx.records,
  };
  const topics = [
    `ニュースの題材: ${config.newsTopic || "（なし）"}（${config.newsCount} 件まで）`,
    `学びの題材: ${config.learningTopic || "（なし）"}`,
  ].join("\n");
  // `<` を escape して、資料の文字列が </materials> で区切りを破れないようにする
  const body = JSON.stringify(materials, null, 1).replace(/</g, "\\u003c");
  const retry = feedback?.length
    ? `\n\n前回の出力は、次の理由で受け付けられませんでした。直して、全体を作り直してください。\n${feedback.map((p) => `- ${p}`).join("\n")}`
    : "";
  return `${date}（${weekday}）の朝刊を書いてください。\n\n${topics}\n\n<materials>\n${body}\n</materials>${retry}`;
}

export function costOf(usage, config) {
  const p = config.pricingUsdPerMTok;
  return (usage.input * p.input + usage.output * p.output) / 1e6 + ((usage.searches ?? 0) * config.searchUsdPer1000) / 1000;
}

/**
 * @param {{ ctx: object, config: object, client?: Anthropic }} args
 * @returns {Promise<{ briefing: object, usage: object, costUsd: number, searchUrls: Set<string> }>}
 */
export async function composeBriefing({
  ctx,
  config,
  feedback,
  // 送り先は固定する。環境変数 ANTHROPIC_BASE_URL で、鍵と生活の記録が別の宛先へ向かわないようにするため
  client = new Anthropic({ baseURL: "https://api.anthropic.com", maxRetries: 2, timeout: 5 * 60 * 1000 }),
}) {
  const messages = [{ role: "user", content: buildUserMessage(ctx, config, feedback) }];
  const usage = { input: 0, output: 0, searches: 0 };
  const searchUrls = new Set();
  // allowed_callers: ["direct"] は、動的フィルタリング（コード実行を挟む検索）を切る指定。費用を抑えるため
  for (let turn = 0; turn <= MAX_CONTINUES; turn++) {
    // pause_turn で続きを呼ぶたびに max_uses が数え直されるので、使った分を引いて渡す
    const left = Math.max(config.maxSearches - usage.searches, 0);
    if (config.newsTopic && turn > 0 && left === 0) throw new Error("検索の回数の上限に達しました");
    const tools = config.newsTopic
      ? [{ type: "web_search_20260209", name: "web_search", max_uses: Math.max(left, 1), allowed_callers: ["direct"] }]
      : [];
    const res = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: PROMPT,
      tools,
      output_config: { effort: config.effort, format: { type: "json_schema", schema: briefingSchema() } },
      messages,
    });
    usage.input += res.usage.input_tokens ?? 0;
    usage.output += res.usage.output_tokens ?? 0;
    usage.searches += res.usage.server_tool_use?.web_search_requests ?? 0;

    for (const block of res.content) {
      // 検索の失敗は 200 で返り、content が配列ではなくオブジェクトになる
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result" && r.url) searchUrls.add(r.url);
      }
    }

    const costUsd = costOf(usage, config);
    if (costUsd > config.maxCostUsdPerRun) throw new Error(`費用の上限を超えました: $${costUsd.toFixed(3)}`);

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error(`API が応答を断りました (${res.stop_details?.category ?? "unknown"})`);
    if (res.stop_reason === "max_tokens") throw new Error("max_tokens に達して応答が途中で切れました");

    const textBlock = [...res.content].reverse().find((b) => b.type === "text");
    if (!textBlock) throw new Error("応答に text ブロックがありません");
    let briefing;
    try {
      briefing = JSON.parse(textBlock.text);
    } catch {
      throw new Error("応答が JSON として読めません");
    }
    return { briefing, usage, costUsd, searchUrls };
  }
  throw new Error("pause_turn が続いて終わりませんでした");
}
