---
id: D-20260812-shared-fix-2
type: decision
status: answered
asked: 2026-08-12
answered: 2026-08-12
chat: shared-fix
answer: A
topics: [mcp-server, api-naming, breaking-change]
refs: ["#702", "#419"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260812-shared-fix-2: `toggle_schedule_complete` / `dismiss_*` を `set_*(値)` へ破壊的に改名してよいか

## 背景

（キュー原文 = `comm/decisions/chat-shared-fix.md`）

同じく #702 Step 1。`toggle_schedule_complete` は**現在値を知らないと結果が予測できない**（冪等でない — 「完了にする」つもりで 2 回叩くと元に戻る）。`dismiss_schedule_item` / `undismiss_schedule_item` は中身が `setDismissed(id, boolean)` の薄いラッパ 2 本に割れているだけ（`mcp-server/src/handlers/scheduleHandlers.ts:290-` 付近）。呼び手は Claude Code で、**引数名と説明文がそのままドキュメントとして働く**ため、値を渡す形にすると「何が起きるか」が呼ぶ前に確定する。

影響: `.mcp.json` 経由で接続する Claude Code はツール一覧を接続時に読み直すので、旧名を覚えた会話ログ以外に壊れる呼び出し元は無い（アプリ本体は MCP を経由しない）。

## 選択肢と裁定

- A: **`set_schedule_complete(id, completed)` / `set_schedule_dismissed(id, dismissed)` へ改名し、旧名は残さない**（**採用** — ユーザー回答 2026-08-12）。#419 の決着に倣う。別名が並ぶと呼び手はスキーマを読んで引数を選ぶため、直したはずのズレを 1 行隣に作り直すことになる
- B: 新名を足し、旧名は description に「deprecated」と書いて残す（却下 — 既存の会話ログのやり方が当分動くが、#419 で否定された形）
- C: 改名しない（`toggle_` のまま description に「現在値を反転する」と明記するだけ）（却下 — 冪等でない口が残り続ける）
