# MEMORY (chat-schedule-refine)

## 進行中

（なし）

## 直近の完了

- #299 アイテム操作 UI 刷新（吹き出し / 詳細オーバーレイ / 生成パネル化）✅（2026-07-25 — PR 提出・`Closes #299`・merge は 🛑 ユーザーゲート・実ブラウザ確認は merge 後 chat-main）
- #298 Step 3 rightSidebar 本日の Todo tray ✅（2026-07-23 — PR #323 merge 済み・main `5f9abf48`・実ブラウザ確認は merge 後 chat-main）
- #296 消失バグ + #297 A-2 双方向書き込み ✅（2026-07-20 — PR #309 merge 済み・main `d56852c0`）

## 予定

- Epic #290 の残 Step（Step 4/6/7 等）は section:schedule の open Issue として残る想定。次の着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認してキューを判断
- #299 follow-up（N1 dblクリック吹き出しフラッシュ / N2 生成オーバーレイ対象日表示 / N4 生成後に新規アイテムを開く）は chat-main へ outbox 起票依頼予定
