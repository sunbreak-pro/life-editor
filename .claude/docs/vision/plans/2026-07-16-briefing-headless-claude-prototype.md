---
Status: REFERENCE
Created: 2026-07-16
Branch: docs/briefing-headless-claude-prototype
Owner-chat: windows-main (Windows PC / chat-main 相当)
---

# Reference: 朝刊ボタン → `claude -p` ヘッドレス起動 + MCP プロトタイプ

> **本書の役割**: [`2026-07-15-briefing-loop.md`](./2026-07-15-briefing-loop.md)（briefing テーマ正本）の「分析 = Claude（MCP）」動詞を、**アプリ内ボタンから起動する**導線の技術検証記録。2026-07-16 に Windows PC 上で scratchpad（git 管理外・使い捨て）に構築し、E2E で動作確認済み。scratchpad は消えるため、再現に必要なソース全文・実測値・QA 知見を本書に凍結する。
> **性格**: 実装計画ではなく参考資料。本実装（Electron 組み込み）の際の出発点として読む。

---

## 1. 検証した問い

「アプリ（朝刊セクション）のボタンを押すと、Claude が MCP 経由でデータを読んで朝刊を生成し、結果が画面に出る」は成立するか。

**結論: 成立する。** 構成は次の一方向パイプライン:

```
[ブラウザの朝刊ページ]
  └─ POST /generate → [ホストアプリ (Node http server ≒ 将来の Electron main process)]
       └─ child_process.spawn → [claude -p (ヘッドレス・サブスク認証)]
            └─ stdio MCP → [ミニ MCP サーバー (get_morning_data ツール)]
```

- MCP は常に Claude 側がクライアント。**アプリから Claude を押す部分は MCP ではなく、ホストアプリによる `claude -p` の子プロセス起動**が担う（`claude` 起動時に MCP サーバーは stdio 子プロセスとして自動接続される）
- `claude -p`（print モード）は対話画面なしの 1 リクエスト実行。ログイン済みサブスクリプション認証で動くため **API 直課金なし = briefing-loop の $0 制約と両立**
- プロセスを spawn できる環境が必須 = **Desktop（Electron main process）専用**。ブラウザ / Mobile からは不可（既存方針「MCP は Desktop 専用」と一致）

## 2. 起動コマンド（要点）

```bash
claude -p "<朝刊生成プロンプト>" \
  --mcp-config mcp-config.json \      # このプロトタイプ専用の MCP 接続定義
  --strict-mcp-config \               # プロジェクト側 .mcp.json 等を読まない（隔離・高速化）
  --allowedTools "mcp__morning__get_morning_data" \  # 許可ツールをホワイトリスト
  --output-format json                # result / total_cost_usd / duration_ms / num_turns が取れる
```

- cwd はプロトタイプディレクトリに固定（プロジェクトの hooks / settings を拾わせない）
- ツール名は `mcp__<server名>__<tool名>` 形式

## 3. 実測値（2026-07-16・Windows 11・claude CLI 2.1.211）

| 経路 | 所要時間 | turns | 参考コスト表示 |
| --- | --- | --- | --- |
| CLI 直接（件数報告のみ） | 17.8 秒 | 3 | $0.86 |
| ボタン経由 `/generate`（朝刊全文生成） | 25.4 秒 | 3 | $0.48 |

- 体感は「ボタン → 20〜30 秒待ち → 朝刊表示」。UI に待ち演出は必須
- コストはレポート上の参考値で、サブスク認証のため API 課金は発生しない（利用枠は消費）
- 生成品質: サンプルデータ（タスク 4・予定 2・昨日メモ 1）から、見出し / 予定 / 期限切れを指摘する優先順位提案 / 昨日メモへのコメント、という紙面構成を安定して出力

## 4. サンプルデータの出自（重要）

MCP ツールが返すデータは **`mcp-server.mjs` にハードコードした架空データ**（実行時のローカル日付のみ本物）。Supabase / Mac ローカル DB / GCal には一切接続していない。実データ接続は life-editor MCP サーバーの Supabase 対応版書き換え（移行 SSOT に未着手タスクあり）が前提。この Windows PC では同サーバーは Mac ローカル SQLite 前提のため `settings.local.json` で disable 中。

## 5. QA 知見（role-qa アドバーサリアルレビューで検出 → 修正済み）

本実装でも同じ罠を踏みやすいものを列挙する。

1. **`listen(PORT)` は全インターフェースにバインドされる** — LAN 内の他端末から無認証で `claude` 起動（= 利用枠消費）を押せる状態だった。`listen(PORT, "127.0.0.1")` 必須
2. **CSRF**: `POST /generate` はプリフライトなしの単純リクエストで、悪意ある Web サイトから localhost へ副作用だけ撃てる。Origin ヘッダ検査で 403（Electron 化しても renderer→main の IPC に置き換えるまでは同種の注意が要る）
3. **子プロセス stdout の `out += chunk` は日本語がチャンク境界で文字化けし得る** — Buffer を配列に貯めて `Buffer.concat().toString("utf8")` で一括デコード
4. **`claude -p` ハング時の復帰手段** — 120 秒でタイムアウト → `child.kill()`
5. **`toISOString().slice(0,10)` は UTC 日付** — JST の朝 9 時前は前日になる。朝刊用途では致命的。ローカル日付で組む
6. 安全確認済み: `spawn(cmd, argsArray)`（shell なし）はコマンドインジェクション不可 / `--strict-mcp-config` + `--allowedTools` の絞り込みは有効 / 画面側の簡易 Markdown レンダラは先行エスケープ + 要素内容のみ挿入で XSS 不成立

## 6. 本実装への含意

- ホストアプリ部分は Electron main process にそのまま移せる（renderer のボタン → IPC → main が spawn → 結果を renderer へ）。HTTP サーバー・CSRF 対策は不要になる
- briefing-loop の「分析」動詞は、(a) アプリ内ボタンの都度実行（本プロトタイプ型）と (b) スケジューラによる毎朝の自動実行（同じ `claude -p` を時刻起動）を同一の配管で実現できる。MCP サーバー側から会話を開始する手段は無いため、push 型は必ずホスト側スケジューラが担う
- 最小の実装単位: 朝刊生成用プロンプト（または MCP Prompt）1 本 + 既存データを読む MCP ツール。dailies_payload への書き込みツールを許可すれば「翌朝の Daily に朝刊セクションを書き込む」（briefing-loop §1 の分析行）まで一気通貫にできる

## 7. プロトタイプ全ソース（凍結・4 ファイル）

再現手順: 任意のディレクトリに以下 4 ファイルを置き、`npm init -y && npm install @modelcontextprotocol/sdk` → `node app.mjs` → `http://localhost:4321`。

### mcp-server.mjs

```javascript
// Minimal MCP server for the morning-briefing prototype.
// Exposes one tool: get_morning_data (returns sample tasks/events/yesterday note).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "morning", version: "0.1.0" });

const SAMPLE_DATA = {
  date: new Date().toLocaleDateString("sv-SE"), // local date as YYYY-MM-DD (not UTC)
  tasks: [
    { title: "PR #248 のレビューコメントに返信する", priority: "high", overdue: false },
    { title: "schedule セクションの繰り返し設定バグを直す", priority: "high", overdue: true },
    { title: "牛乳と卵を買う", priority: "low", overdue: false },
    { title: "確定申告の資料を集める", priority: "mid", overdue: true },
  ],
  events: [
    { title: "歯医者", start: "10:00", end: "11:00" },
    { title: "チーム定例", start: "14:00", end: "14:30" },
  ],
  yesterdayNote:
    "Supabase の RLS まわりを調査。items_meta の policy は role ごとに分ける必要がありそう。夜は疲れて 23 時に就寝。",
};

server.tool(
  "get_morning_data",
  "今日のタスク一覧・予定・昨日の daily ノートをまとめて返す（プロトタイプ用のサンプルデータ）",
  async () => ({
    content: [{ type: "text", text: JSON.stringify(SAMPLE_DATA, null, 2) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### mcp-config.json

```json
{
  "mcpServers": {
    "morning": {
      "command": "node",
      "args": ["mcp-server.mjs"]
    }
  }
}
```

### app.mjs

```javascript
// Morning-briefing prototype host app.
// Serves a page with a button; the button spawns `claude -p` headless,
// which connects to mcp-server.mjs (stdio MCP) and generates the briefing.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const CLAUDE = "C:\\Users\\user\\.local\\bin\\claude.exe"; // machine-specific
const PORT = 4321;

const PROMPT = [
  "あなたはパーソナルOS「Life Editor」の朝刊記者です。",
  "get_morning_data ツールを呼んで今日のデータを取得し、日本語で朝刊を書いてください。",
  "構成: 一言の見出し / 今日の予定 / タスクの優先順位の提案(期限切れは正直に指摘) / 昨日のメモへの一言コメント。",
  "Markdown で簡潔に。出力は朝刊本文のみとし、前置きや説明は書かないこと。",
].join("\n");

function generateBriefing() {
  return new Promise((resolve) => {
    const args = [
      "-p", PROMPT,
      "--mcp-config", join(DIR, "mcp-config.json"),
      "--strict-mcp-config",
      "--allowedTools", "mcp__morning__get_morning_data",
      "--output-format", "json",
    ];
    const child = spawn(CLAUDE, args, { cwd: DIR, windowsHide: true });
    const outChunks = [], errChunks = [];
    child.stdout.on("data", (d) => outChunks.push(d));
    child.stderr.on("data", (d) => errChunks.push(d));
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "timeout (120s) — claude -p を強制終了しました" });
    }, 120_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(outChunks).toString("utf8");
      const err = Buffer.concat(errChunks).toString("utf8");
      if (code !== 0) return resolve({ ok: false, error: err || `exit code ${code}` });
      try {
        const j = JSON.parse(out);
        if (typeof j.result !== "string") throw new Error("no result field");
        resolve({
          ok: true,
          text: j.result,
          costUsd: j.total_cost_usd,
          durationMs: j.duration_ms,
          turns: j.num_turns,
        });
      } catch {
        resolve({ ok: false, error: "unexpected output: " + out.slice(0, 500) });
      }
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: String(e) });
    });
  });
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(join(DIR, "index.html")));
  } else if (req.method === "POST" && req.url === "/generate") {
    // reject cross-site requests (browser CSRF): same-origin fetch sends our own Origin
    const origin = req.headers.origin;
    const allowed = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
    if (origin && !allowed.includes(origin)) {
      res.writeHead(403, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "forbidden origin" }));
    }
    const result = await generateBriefing();
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
  } else {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`asakan-proto: http://localhost:${PORT}`);
});
```

### index.html

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>朝刊プロトタイプ</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: "Segoe UI", "Yu Gothic UI", sans-serif;
    max-width: 640px; margin: 40px auto; padding: 0 16px;
    background: #f5f2ea; color: #2a2a2a;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1c18; color: #e8e4da; }
    .card { background: #2a2723 !important; border-color: #444 !important; }
  }
  h1 { font-size: 1.3rem; letter-spacing: 0.1em; border-bottom: 3px double currentColor; padding-bottom: 8px; }
  .card {
    background: #fffdf7; border: 1px solid #d8d2c2; border-radius: 8px;
    padding: 20px 24px; margin-top: 16px; min-height: 120px;
    white-space: normal; line-height: 1.7;
  }
  button {
    font-size: 1rem; padding: 10px 28px; border-radius: 6px; border: none;
    background: #b5543b; color: #fff; cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: wait; }
  .meta { font-size: 0.8rem; opacity: 0.6; margin-top: 12px; }
  .spin { display: inline-block; animation: r 1s linear infinite; }
  @keyframes r { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <h1>Life Editor 朝刊 — プロトタイプ</h1>
  <p>ボタンを押すと、裏で <code>claude -p</code> が起動し、MCP ツール経由で今日のデータ（サンプル）を読んで朝刊を生成します。生成には 20〜60 秒ほどかかります。</p>
  <button id="btn">今日の朝刊を生成する</button>
  <div class="card" id="out">（ここに朝刊が表示されます）</div>
  <div class="meta" id="meta"></div>
<script>
const btn = document.getElementById("btn");
const out = document.getElementById("out");
const meta = document.getElementById("meta");

// tiny markdown-ish renderer (headers, bold, lists) — prototype quality
function md(t) {
  const esc = t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return esc.split("\n").map(l => {
    if (/^### /.test(l)) return "<h4>" + l.slice(4) + "</h4>";
    if (/^## /.test(l))  return "<h3>" + l.slice(3) + "</h3>";
    if (/^# /.test(l))   return "<h2>" + l.slice(2) + "</h2>";
    if (/^[-*] /.test(l)) return "<li>" + l.slice(2) + "</li>";
    return l ? "<p>" + l + "</p>" : "";
  }).join("").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

btn.onclick = async () => {
  btn.disabled = true;
  out.innerHTML = '<span class="spin">☕</span> Claude が朝刊を書いています…';
  meta.textContent = "";
  try {
    const r = await fetch("/generate", { method: "POST" });
    const j = await r.json();
    if (j.ok) {
      out.innerHTML = md(j.text);
      meta.textContent = `生成 ${(j.durationMs/1000).toFixed(1)} 秒 / ${j.turns} ターン / $${(j.costUsd ?? 0).toFixed(4)}`;
    } else {
      out.textContent = "エラー: " + j.error;
    }
  } catch (e) {
    out.textContent = "通信エラー: " + e;
  } finally {
    btn.disabled = false;
  }
};
</script>
</body>
</html>
```
