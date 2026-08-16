# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #876 Mobile の Note / Daily を「一覧はサイドバー・メインは本文」へ ✅（2026-08-16 — **PR #962 open**（Closes #876・merge = こうだいさん）。裁定 D-20260815-materials-2 = A。`RightSidebarPortal` の `isWide` ゲートを外し、一覧を両幅とも詳細パネル（narrow = ハンバーガーの `MobileDrawer`）へ。Notes は detail sheet（#471）と `NotesMobileList` を退役し、**シート固有のノート識別 `useNoteSheetTarget` と `onPendingSelected` seam も消えた**（`selectNote` が id 切替前に hydrate するため #475 の穴が構造的に無い）。Daily は過去エントリのパネルをドロワーへ移し 2 件テーザーを退役（40 日前のエントリがスマホから到達不能だった）。`DateStrip` は本文側に残置。narrow 固有は詰まった `variant` と QuickAddSheet の 2 点のみ。孤児 i18n キー 2 件を両 catalog から撤去・`mobile-scope.md` #7 / #8 を更新。shared 2232 / web 472 + 両 lint / build + docs-lint すべて exit 0。実機の狭幅目視 = こうだいさんの手番）
- #896 KanbanView / TagEditModal の分割 ✅（2026-08-16 — **PR #953 open**（Closes #896・merge = こうだいさん）。挙動変更ゼロ。`TagEditModal.tsx` 1,050 → `shared/src/components/tagEdit/` 8 ファイル（最大 394・公開名は barrel で 4 つに固定）、`web/src/todos/KanbanView.tsx` 946 → 384（`useKanbanColumns` / `KanbanBoardSurface` / `TodoDetailContent` / `useTodoDetailActions` / `useTodoAddDialog` / `TodoBodyDraft` へ）。4 出口が同じ ConfirmDialog と dirty ref を共有するため actions は 1 hook に集約。既存テスト**無改変**で緑 + `t()` キー 46 件・class 文字列 40 件の前後一致で挙動不変を機械照合。shared 2232 / web 485 + 両 lint / build すべて exit 0）
- #873 Todo ステータスの 2 値化（保存値ごと）✅（2026-08-16 — **PR #926 open**（Closes #873・merge = こうだいさん）。裁定 D-20260815-materials-1 = B。`TodoStatus` を `NOT_STARTED | DONE` へ縮め、リスト行は `TodoStatusCheckbox`（`role="checkbox"`）に置換（旧 `TodoStatusCycleButton` は削除）。Kanban 2 列 / Mobile フィルタ 2 チップ / タッチ選択行 2 択はすべて `STATUS_ORDER` 由来で自動追随。**DDL なし** — CHECK は 3 値のままで、レガシー行は `todoMapper.toStatus` と MCP `toToolStatus` が `NOT_STARTED` / `not_started` へ畳む。MCP は裁定どおり破壊的変更（enum から `in_progress` 撤去・briefing の IN_PROGRESS クエリ撤去で open todo = carry-over のみ）。shared 2201 / web 408 / mcp 283 テスト + 両 `typecheck:tests` + docs-lint すべて exit 0）

## 予定

（なし — section:materials の open Issue を消化。次は判断キュー D-20260816-materials-1 の回答待ち、および chat-main からの新規 dispatch 待ち）
