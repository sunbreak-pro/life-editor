# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #896 KanbanView / TagEditModal の分割 ✅（2026-08-16 — **PR #953 open**（Closes #896・merge = こうだいさん）。挙動変更ゼロ。`TagEditModal.tsx` 1,050 → `shared/src/components/tagEdit/` 8 ファイル（最大 394・公開名は barrel で 4 つに固定）、`web/src/todos/KanbanView.tsx` 946 → 384（`useKanbanColumns` / `KanbanBoardSurface` / `TodoDetailContent` / `useTodoDetailActions` / `useTodoAddDialog` / `TodoBodyDraft` へ）。4 出口が同じ ConfirmDialog と dirty ref を共有するため actions は 1 hook に集約。既存テスト**無改変**で緑 + `t()` キー 46 件・class 文字列 40 件の前後一致で挙動不変を機械照合。shared 2232 / web 485 + 両 lint / build すべて exit 0）
- #873 Todo ステータスの 2 値化（保存値ごと）✅（2026-08-16 — **PR #926 open**（Closes #873・merge = こうだいさん）。裁定 D-20260815-materials-1 = B。`TodoStatus` を `NOT_STARTED | DONE` へ縮め、リスト行は `TodoStatusCheckbox`（`role="checkbox"`）に置換（旧 `TodoStatusCycleButton` は削除）。Kanban 2 列 / Mobile フィルタ 2 チップ / タッチ選択行 2 択はすべて `STATUS_ORDER` 由来で自動追随。**DDL なし** — CHECK は 3 値のままで、レガシー行は `todoMapper.toStatus` と MCP `toToolStatus` が `NOT_STARTED` / `not_started` へ畳む。MCP は裁定どおり破壊的変更（enum から `in_progress` 撤去・briefing の IN_PROGRESS クエリ撤去で open todo = carry-over のみ）。shared 2201 / web 408 / mcp 283 テスト + 両 `typecheck:tests` + docs-lint すべて exit 0）
- materials 7 件連続処理（#886 / #883 / #884 / #885 / #875 を PR 化・#873 / #876 はキュー）✅（2026-08-15 — **PR #888 / #899 / #908 / #911 / #912 すべて open**（merge = こうだいさん）。1 Issue = 1 ブランチ = 1 PR。#886 = `MenuItem` の `focus:` → `focus-visible:`（開いた瞬間に先頭行へフォーカスが乗る WAI-ARIA 仕様のせいで Pin/Unpin だけ常時ホバー色だった）/ #883 = taskList ラベルを 1 行分の行ボックス + 同じ上マージンにして中心を一致 / #884 = Links を rightSidebar から詳細ヘッダーの [+Tag] 右へ移し方向マージ / #885 = kebab の左にピンマーカー / #875 = `SectionDescriptor.narrowWidth` で狭幅 Materials を fluid 化し FAB を画面端へ。未決 = D-20260815-materials-1（#873 の 2 値化の深さ）/ D-20260815-materials-2（#876 でモバイル詳細シートを畳むか））

## 予定

- #876（モバイルの一覧をサイドバーへ / メインは本文 — 裁定 D-20260815-materials-2 = A でボトムシートを畳む）
