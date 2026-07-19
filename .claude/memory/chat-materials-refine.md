# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #282 選択アイテムのタブ/セクション跨ぎ保持 + #283 rightSidebar ソート・フィルタ ✅（2026-07-19 — **PR #289 提出済み**（Closes #282/#283）。in-memory 選択ストア + hydrate-first 復元 / SidebarListControls（Notes ソート・Daily ソート+絞り込み・Tasks は N/A）。role-qa + 敵対的レビューの指摘 4 件修正済み・998 tests green。merge = こうだいさん → 実ブラウザ確認 = chat-main。#283 スコープ外の follow-up 起票依頼 3 件は outbox 2026-07-19 (2)）
- #258 F-1 Daily エディタ TipTap 化（平文後方互換 = 読み込み時変換・編集時のみ JSON 保存）✅（2026-07-18 — PR #270 提出済み。残ゲート = merge（こうだいさん）→ Issue 自動 close → 実ブラウザ確認は chat-main。F-6 夕刊専用ページは本 Issue close 待ち）
- #260 F-3 Note Links rightSidebar パネル化 + #261 F-4 表示ラベル改名（タスク→Todo・約束→予定）✅（2026-07-16 — **PR #264 は 2026-07-16 merge 済み**・実ブラウザ確認は chat-main）

## 予定

- （なし）
