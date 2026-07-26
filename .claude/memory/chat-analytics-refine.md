# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- #360 mcp-server の DROP 済み legacy テーブル参照を解消（PR #396・merge 待ち）✅（2026-07-26）— 0007 で消えた tasks/notes/dailies/schedule_items を見ていた 18 ツールを `items_meta` + `<role>_payload` へ移行（tasks 6 / dailies 2 / notes 3 / search 1 / content 2 / wikiTag 4）。作法は #256 の scheduleHandlers に準拠（orphan recovery / §10.2 updated_at bump / ソフトデリート）。共通 utils 3 本新規（`items` / `pagination` / `content`）— pagination は PostgREST の 1000 行無言打ち切り対策で shared の postgrestFetchAll と同じ思想。better-sqlite3 + db.ts 削除、`.mcp.json` を Supabase 資格情報参照に差し替え。仕様変更 = schedule ターゲット退役 / tag の source・text_color 廃止 / status は小文字語彙を維持し DB の大文字と双方向変換。残り = merge → Issue close → chat-main が実データで疎通確認
- #362 MCP ファイル系 7 ツールの退役（PR #397・merge 待ち）✅（2026-07-26）— こうだいさん判断で選択肢 1（退役）。fileHandlers.ts 削除 + tools.ts 登録解除 + `.mcp.json` の FILES_ROOT_PATH 撤去 + docs 追随（tier-1 §MCP Boundary / tier-2 §File Explorer）。**stacked PR**（base = `claude/mcp-server-360`）— main の mcp-server は better-sqlite3 のネイティブビルドが Windows で失敗して型検証すら通らず、それを外すのが #396 のため単独検証不可だった
- #356 analytics「今日」境界の要否判断 — 暦日固定で確定（PR #378・merge 待ち）✅（2026-07-26）— day-start hour 追随は見送り（根拠 = 全バケツが暦日キー / 片側だけ変えると深夜セッションが「今日」から外れる。実測込みで Issue #356 にコメント記録済み）。判断をコードに残すため 6 箇所を `todayCalendarKey()` へ統一（挙動不変）+ 決定 pin テスト新規

## 予定

- PR #396 → #397 の順で merge 後: Issue #360 / #362 を close（**順序厳守** — #397 は #396 の上に積んだ stacked PR。#396 merge で #397 の base が自動的に main へ切り替わる）
- #396 merge 後: chat-main が実 Supabase でツール疎通確認（`list_tasks` / `get_task_tree` / `search_all`）。この worktree に資格情報が無く未検証。併せて `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` をシェル環境に export する必要あり（`.mcp.json` は参照のみ持つ）
- PR #359 / #378 の merge 後: Issue #334 / #356 を close（merge はこうだいさん操作）
- chat-main へ起票依頼済みの別件フォロー: 完了 Todo の「今日」が UTC 日基準（`completedAt.substring(0,10)` vs ローカル暦日キーの非対称。JST では朝 8 時までの完了が前日カウント）— 起票されたら analytics レーンで対応
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）
