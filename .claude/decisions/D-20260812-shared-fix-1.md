---
id: D-20260812-shared-fix-1
type: decision
status: answered
asked: 2026-08-12
answered: 2026-08-12
chat: shared-fix
answer: A
topics: [mcp-server, dx, ordering]
refs: ["#702", "#700"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260812-shared-fix-1: #702 Step 2 の着手順をどれにするか

## 背景

（キュー原文 = `comm/decisions/chat-shared-fix.md`）

#702 Step 1 の棚卸しコメント（issue 702 の comment 5255391164）。既存 MCP ツールの不便を実測したところ、直す価値のある塊が 3 つに割れた — ①**一覧・取得の戻り値**（`list_tasks` / `list_notes` が全件・全文の TipTap JSON を返す・`get_note` が無い・読みは JSON / 書きは Markdown で往復できない = `mcp-server/src/handlers/taskHandlers.ts:102` ↔ `:386`）、②**無言の取りこぼし**（`list_schedule` が `start_date` 単独で今日にフォールバック = `scheduleHandlers.ts:195-211` / `list_tasks` の `.eq("task_type","task")` が NULL 行を落として `get_task_tree` と食い違う = `taskHandlers.ts:173` / schema に無い引数を validator が黙って捨てる = `utils/toolSchema.ts:18-26`）、③**書き込みの往復と非対称**（`create_task` に content / status が無く必ず 2 回呼ぶ・`update_task` の `time_memo` が schema に出ていない・`is_all_day` 切替で時刻が古いまま残る）。

どれも「あったら便利」ではなく既に毎回踏んでいる不便なので、**やるかどうかではなく順番**の判断。

## 選択肢と裁定

- A: **① → ② → ③**（**採用** — ユーザー回答 2026-08-12）。① は毎回のコンテキスト消費と「読めない本文」が同時に消えて効果が最大、かつ破壊的改名を含まない。慣らしてから正しさの ② に入れる
- B: ② → ① → ③（却下 — ②「間違った成功」を返す経路は正しさの問題で実害が大きいという読みも立つが、A の「効果が最大かつ非破壊から入る」を優先）
- C: ① と ② を 1 本の PR にまとめ、③ を別 Issue へ切り出す（却下 — 触るファイルが重なる利点はあるが、まとめると 1 PR が大きくなる。③ の破壊的改名は D-20260812-shared-fix-2 で解決済みなので待ちは生じない）
