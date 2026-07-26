# MEMORY (chat-schedule-refine)

## 進行中

- 今スプリントのキュー（1 Issue = 1 ブランチ = 1 PR・順に）: **#352 ✅ → #353（生成オーバーレイに対象日を表示）→ #354（生成後に新規アイテムを開く導線・プロダクト判断は outbox で chat-main へ）→ #355（ダブルクリック時の吹き出しフラッシュ抑制・低優先）**。2 件目以降は着手時に `git checkout -b claude/schedule-refine-<Issue番号> origin/main` → `.claude/comm/.session-branch` 更新の 2 ステップ 1 セット

## 直近の完了

- #352 Epic #290 Step 4 = Routine 頻度編集の未来伝播（reconcile 配線）+ 未配線 dead code / RoutineGroup 削除 ✅（2026-07-26 — **PR #381** 提出・`Closes #352`・merge は 🛑 ユーザーゲート・実ブラウザ確認は merge 後 chat-main。**確認の勘所 = 繰り返しを「曜日」に切り替えた直後に予定が消えないこと**）
- #299 アイテム操作 UI 刷新（吹き出し / 詳細オーバーレイ / 生成パネル化）✅（2026-07-25 — PR 提出・`Closes #299`・merge は 🛑 ユーザーゲート・実ブラウザ確認は merge 後 chat-main）
- #298 Step 3 rightSidebar 本日の Todo tray ✅（2026-07-23 — PR #323 merge 済み・main `5f9abf48`・実ブラウザ確認は merge 後 chat-main）
- #296 消失バグ + #297 A-2 双方向書き込み ✅（2026-07-20 — PR #309 merge 済み・main `d56852c0`）

## 予定

- Epic #290 の残 Step（Step 5 構成再編 / Step 6 カレンダー台帳配線 / Step 7 エディタ拡充）は section:schedule の open Issue として残る想定。キュー消化後に `gh issue list --label section:schedule --state open` + `--label shared-fix` を再確認
- #299 follow-up は chat-main が #355 / #353 / #354 として起票済み（= 上記キュー）

## 引き継ぎメモ（この worktree で効く事実）

- **この PC には skill-lib の実体が無い**（`.claude/skills/` はシンボリックリンクが Mac パスのテキストとして checkout されている）。`session-loader` / `task-tracker` 等のプロジェクトスキルは Skill ツールから起動できないため、セッション開始・進捗記録は手動で行う（memory/ + history/ を直接編集）
- **`web` の lint は緑ではない**: `web/src/notes/NotesView.tsx:291` の 1 error は main 由来の既存問題（#352 で chat-main へ起票依頼済み）。セクションの標準ゲートは shared test / shared build / web build で lint は含まれないため、lint の赤を自分の変更のせいと誤認しないこと
- **`REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）は publication と完全一致が不変式**（`shared/tests/syncRealtimeTables.test.ts` がハードカウント込みで検証）。DDL を伴わないコード削除でテーブルを購読リストから外すとテストが落ちる — #352 で一度踏んだ
