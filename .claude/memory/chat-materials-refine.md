# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: S3 実装完了・PR #244（Closes #225）提出後、main #243（PostgREST ページ分割 = fetchAllPages が .order().range() を必ず呼ぶ）とのマージ後ツリーで CI 2 件失敗 → origin/main merge（コンフリクトなし）+ legacyFolderFilter.test.ts モックに .order/.range 追随（457237c8）で解消
- 現在: PR #244 CI green（typecheck+test+build / docs-lint 両 pass・vitest 879/879・role-qa PASS Blocking 0）。merge = こうだいさん操作・merge 後の実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = PR #244 merge → 実データ変換（ユーザー `supabase db push` 0020 + 0021 + verify.sql・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #260 F-3 Note Links rightSidebar パネル化 + #261 F-4 表示ラベル改名（タスク→Todo・約束→予定）✅（2026-07-16 — PR #264 提出済み。残ゲート = merge（こうだいさん）→ Issue 自動 close → 実ブラウザ確認は chat-main）
- Layout Standard v2 adoption（materials・#207）✅（2026-07-11 — #207 は COMPLETED で close 済み・#203 全幅化と併せて解消。materials 各サブタブの全幅表示の実確認だけ次セッション冒頭に実施）
- #118 Notes/Daily パスワードハッシュ化 + #181 materials 行消化（PR #195 merge 済み・plan archive 済み）✅（2026-07-11）

## 予定

- （なし）
