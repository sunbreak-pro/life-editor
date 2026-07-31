# MEMORY (chat-mobile-refine)

## 進行中

### ⏸️ #499 ノート保存でアプリ全体を再取得している（着手日: 2026-07-31）

**対象**: `shared/src/context/syncDomains.ts`（新規）, `SyncContext.tsx`, `shared/src/hooks/useSyncDomains.ts`（新規）, `SupabaseTimerService.ts`, 消費側 15 箇所
**ブランチ**: `claude/mobile-refine-499`

- 前回: #473 が PR #498 + 追撃 #500 の 2 本で main に着地。`section:materials` は open ゼロのままなので `shared-fix` `[all]` の #499 を引き受けた
- 現在: 実装 + テスト（新規 3 ファイル 22 件・既存スタブ 8 ファイル追随）+ `rules/frontend.md` 追記まで完了し **PR #501 open**。ローカル 6 ゲート + docs-lint すべて green（shared 1363 件 / web 75 件）、CI は `typecheck + test + build` が pending
- 次: CI green を確認（赤なら直して push）。merge は chat-main。**DoD の「リクエスト数の実測」は実ブラウザが要るため merge 後に chat-main 側で計測**（PR 本文に明記済み）

## 直近の完了

- #473 コマンドパレットのモバイルタッチ導線 ✅（2026-07-31・PR #498 + レビュー回収 #500 いずれも merged。Epic #321 Phase 2 / mobile-scope #17 も更新済み）
- #471 の QA 追撃（独立レビュー 2 本の指摘）✅（2026-07-31・PR #497 merged）
- #471 mobile notes のフル編集 ✅（2026-07-30・PR #496 merged）

## 予定

- （なし。`section:materials` は open ゼロ・`shared-fix` の残りは Epic #321 のみ）
