# MEMORY (chat-analytics-refine)

## 進行中

### 🔧 #362 の再着地（着手日: 2026-07-26）

**対象**: `mcp-server/src/tools.ts` / `mcp-server/src/handlers/fileHandlers.ts` / `.mcp.json` / `.claude/docs/requirements/`

- 前回: PR #397 を出して merge されたが、**state = MERGED のまま main に 1 行も届いていなかった**（base が `claude/mcp-server-360` の stacked PR で、base 側 #396 と 10 秒差 merge のため GitHub の base 自動張り替えが間に合わず、既に main 取り込み済みの中間ブランチへ merge された）
- 現在: `claude/mcp-server-362-relanded`（origin/main から cherry-pick・コンフリクトなし）で **PR #401** を作成済み。検証は tsc 緑 / vitest 39 件緑 / build 緑 / stdio スモーク 27 ツール・ファイル系 0 件。Issue #362 は未着地のため open 維持（#401 merge で close）
- 次: #401 merge（こうだいさん操作）→ 着地を内容で実測（`git ls-tree origin/main -- mcp-server/src/handlers/fileHandlers.ts` が空・tools.ts の file 系 grep が 0）→ Issue #362 close

## 直近の完了

- #360 mcp-server の DROP 済み legacy テーブル参照を解消（PR #396 merge 済み・Issue close 済み）✅（2026-07-26）— 0007 で消えた tasks/notes/dailies/schedule_items を見ていた 18 ツールを `items_meta` + `<role>_payload` へ移行（tasks 6 / dailies 2 / notes 3 / search 1 / content 2 / wikiTag 4）。作法は #256 の scheduleHandlers に準拠（orphan recovery / §10.2 updated_at bump / ソフトデリート）。共通 utils 3 本新規（`items` / `pagination` / `content`）— pagination は PostgREST の 1000 行無言打ち切り対策で shared の postgrestFetchAll と同じ思想。better-sqlite3 + db.ts 削除、`.mcp.json` を Supabase 資格情報参照に差し替え。仕様変更 = schedule ターゲット退役 / tag の source・text_color 廃止 / status は小文字語彙を維持し DB の大文字と双方向変換。残り = merge → Issue close → chat-main が実データで疎通確認
- #360 は着地確認済み → Issue close 済み（2026-07-26）。#362 は未着地のため「進行中」へ差し戻し（上記参照）
- #356 analytics「今日」境界の要否判断 — 暦日固定で確定（PR #378・merge 待ち）✅（2026-07-26）— day-start hour 追随は見送り（根拠 = 全バケツが暦日キー / 片側だけ変えると深夜セッションが「今日」から外れる。実測込みで Issue #356 にコメント記録済み）。判断をコードに残すため 6 箇所を `todayCalendarKey()` へ統一（挙動不変）+ 決定 pin テスト新規

## 予定

- chat-main が実 Supabase で MCP ツール疎通確認（`list_tasks` / `get_task_tree` / `search_all` = tier-1-core AC2 / AC9）。この worktree に資格情報が無く未検証。実行には `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` のシェル環境 export が必要（`.mcp.json` は `${VAR}` 参照のみ持つ。#256 時点から未配線だった）
- **stacked PR を今後出すときの教訓**: base 側 merge → GitHub の base 張り替えを待つ → 後続 merge の順。同時 merge で後続が迷子になる（本件 #397）。着地確認は PR state ではなく内容の実測で行う（memory `stacked-pr-base-retarget-race`）
- PR #359 / #378 の merge 後: Issue #334 / #356 を close（merge はこうだいさん操作）
- chat-main へ起票依頼済みの別件フォロー: 完了 Todo の「今日」が UTC 日基準（`completedAt.substring(0,10)` vs ローカル暦日キーの非対称。JST では朝 8 時までの完了が前日カウント）— 起票されたら analytics レーンで対応
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）
