# Decision Queue — chat-shared-fix

### D-20260812-shared-fix-1: #702 Step 2 の着手順をどれにするか

- 背景: #702 Step 1 の棚卸しコメント（https://github.com/sunbreak-pro/life-editor/issues/702#issuecomment-5255391164）。既存 MCP ツールの不便を実測したところ、直す価値のある塊が 3 つに割れた — ①**一覧・取得の戻り値**（`list_tasks` / `list_notes` が全件・全文の TipTap JSON を返す・`get_note` が無い・読みは JSON / 書きは Markdown で往復できない = `mcp-server/src/handlers/taskHandlers.ts:102` ↔ `:386`）、②**無言の取りこぼし**（`list_schedule` が `start_date` 単独で今日にフォールバック = `scheduleHandlers.ts:195-211` / `list_tasks` の `.eq("task_type","task")` が NULL 行を落として `get_task_tree` と食い違う = `taskHandlers.ts:173` / schema に無い引数を validator が黙って捨てる = `utils/toolSchema.ts:18-26`）、③**書き込みの往復と非対称**（`create_task` に content / status が無く必ず 2 回呼ぶ・`update_task` の `time_memo` が schema に出ていない・`is_all_day` 切替で時刻が古いまま残る）
- どれも「あったら便利」ではなく既に毎回踏んでいる不便なので、**やるかどうかではなく順番**の判断
- A: **① → ② → ③**（推奨 — ① は毎回のコンテキスト消費と「読めない本文」が同時に消えて効果が最大、かつ破壊的改名を含まない。慣らしてから正しさの ② に入れる）
- B: **② → ① → ③**（②「間違った成功」を返す経路は使い勝手というより正しさの問題。`list_schedule` は期間を出したつもりで今日が返り、`list_tasks` は存在するタスクが消える。実害の大きい順に潰す）
- C: **① と ② を 1 本の PR にまとめ、③ は別 Issue へ切り出す**（① と ② はどちらも読み取り側なので触るファイルが重なる。③ は破壊的改名（D-20260812-shared-fix-2）を含み判断待ちが挟まるため、切り離せば前半が止まらない）
- 放置時: **Step 2 に入らない**（#702 本文の「ユーザー確認を挟んでから Step 2 へ」に従う）。本レーンは #700 の Step 1（撒き先の判断）待ちも抱えているため、無回答なら両方保留のまま次の shared-fix ラベルの Issue を拾う
- 期限感: いつでも（#700 / #702 Step 2 のどちらもブロックされている状態なので急がない）

### D-20260812-shared-fix-2: `toggle_schedule_complete` / `dismiss_*` を `set_*(値)` へ破壊的に改名してよいか

- 背景: 同じく #702 Step 1。`toggle_schedule_complete` は**現在値を知らないと結果が予測できない**（冪等でない — 「完了にする」つもりで 2 回叩くと元に戻る）。`dismiss_schedule_item` / `undismiss_schedule_item` は中身が `setDismissed(id, boolean)` の薄いラッパ 2 本に割れているだけ（`mcp-server/src/handlers/scheduleHandlers.ts:290-` 付近）。呼び手は Claude Code で、**引数名と説明文がそのままドキュメントとして働く**ため、値を渡す形にすると「何が起きるか」が呼ぶ前に確定する
- 影響: `.mcp.json` 経由で接続する Claude Code はツール一覧を接続時に読み直すので、旧名を覚えた会話ログ以外に壊れる呼び出し元は無い（アプリ本体は MCP を経由しない）
- A: **`set_schedule_complete(id, completed)` / `set_schedule_dismissed(id, dismissed)` へ改名し、旧名は残さない**（推奨 — #419 の決着に倣う。別名が並ぶと呼び手はスキーマを読んで引数を選ぶため、直したはずのズレを 1 行隣に作り直すことになる）
- B: 新名を足し、旧名は description に「deprecated」と書いて残す（既存の会話ログのやり方が当分動く。ただし #419 で否定された形）
- C: 改名しない（`toggle_` のまま description に「現在値を反転する」と明記するだけ）
- 放置時: **改名しない**（C と同じ）。#702 Step 2 のうち改名を含まない項目だけを進める余地は残るが、それも D-20260812-shared-fix-1 の回答待ち
- 期限感: いつでも（D-20260812-shared-fix-1 で ③ に着手すると決まった時点までに欲しい）
