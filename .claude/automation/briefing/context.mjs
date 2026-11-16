// MCP の stdio サーバーを直接起動し、今日の材料を取り、朝刊を書き込む。
// 起動の形は claude-dotfiles の le-note.mjs と同じ（MCP が未登録でも、無人の実行から動く）。
// 必要な環境変数: LIFE_EDITOR_MCP_ENTRY と LIFE_EDITOR_SUPABASE_*（User 環境変数に置いてある）。

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const REQUIRED_ENV = [
  "LIFE_EDITOR_MCP_ENTRY",
  "LIFE_EDITOR_SUPABASE_URL",
  "LIFE_EDITOR_SUPABASE_ANON_KEY",
  "LIFE_EDITOR_SUPABASE_EMAIL",
  "LIFE_EDITOR_SUPABASE_PASSWORD",
];

export function checkMcpEnv(env = process.env) {
  for (const k of REQUIRED_ENV) {
    if (!env[k]) throw new Error(`環境変数 ${k} が未設定です`);
  }
  if (!existsSync(env.LIFE_EDITOR_MCP_ENTRY)) {
    throw new Error(`LIFE_EDITOR_MCP_ENTRY が指すファイルがありません: ${env.LIFE_EDITOR_MCP_ENTRY}`);
  }
}

/** 子のプロセスには、Anthropic の鍵を渡さない（MCP サーバーに要らないため）。 */
function childEnv(env) {
  // Windows の環境変数は大文字小文字を区別しないので、名前は大文字小文字を問わず外す
  return Object.fromEntries(Object.entries(env).filter(([k]) => !/^ANTHROPIC_/i.test(k)));
}

export function openMcp(entry = process.env.LIFE_EDITOR_MCP_ENTRY, env = process.env) {
  return new Promise((resolveClient, reject) => {
    const child = spawn(process.execPath, [entry], { stdio: ["pipe", "pipe", "inherit"], env: childEnv(env) });
    let buf = "";
    let nextId = 1;
    const pending = new Map();
    const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
    const request = (method, params) =>
      new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        send({ jsonrpc: "2.0", id, method, params });
      });
    child.stdout.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        const p = pending.get(msg.id);
        if (!p) continue;
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message ?? JSON.stringify(msg.error))) : p.res(msg.result);
      }
    });
    child.on("error", reject);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MCP initialize timeout"));
    }, 60000);
    request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "life-briefing", version: "1" } })
      .then(() => {
        clearTimeout(timer);
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        resolveClient({
          async call(name, params) {
            const r = await request("tools/call", { name, arguments: params });
            if (r.isError) throw new Error(`${name}: ${r.content?.[0]?.text ?? "error"}`);
            const text = r.content?.[0]?.text ?? "{}";
            try {
              return JSON.parse(text);
            } catch {
              return { text };
            }
          },
          close() {
            child.kill();
          },
        });
      })
      .catch((e) => {
        clearTimeout(timer);
        child.kill();
        reject(e);
      });
  });
}

/** 今日の材料。`mcp` は openMcp の戻り値（テストでは同じ形のにせもの）。 */
export function readContext(mcp, date) {
  return mcp.call("get_today_context", { date });
}

/**
 * 書かない理由を返す。書いてよいときは null。
 * hasBriefing = 今日の朝刊のコメントがすでにある（こうだいさん自身が書いた朝刊も含む）。
 */
export function skipReason(ctx) {
  const d = ctx?.todayDaily;
  if (!d) return "no-context";
  if (d.locked) return "locked";
  if (d.hasBriefing) return "already-written";
  return null;
}

export function writeBriefing(mcp, { date, focus, paragraphs }) {
  return mcp.call("write_briefing", { date, focus, paragraphs });
}
