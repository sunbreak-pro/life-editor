# MEMORY (chat-briefing-refine)

## 進行中

（なし）

## 直近の完了

- [briefing] 朝刊「今日のスケジュール」の Todo 行に HH:MM を出す（#1369・PR #1382 open） ✅（2026-09-01）
- [briefing] MCP write_briefing の focus を note-focus へ配線 — B 案（#1097・PR #1107 merged） ✅（2026-08-23）
- [briefing] 今日のフォーカスを夕刊入力（note-focus ノート）へ移し Daily 参照を削除（#1048・PR #1062 merged） ✅（2026-08-18）

## 予定

- PR #1382（#1369）の CI とレビュー結果を確認する（merge は P-001 でユーザー手番）
- 実機確認（chat-main の手番。worktree は build / 型検証まで）: 時刻付き Todo の HH:MM が予定行と揃うか（#1369）/ 朝刊の統合リスト（#939）と区切り線 / 右サイドバー 2 枚目のパネル（#938・narrow のハンバーガーから）/ 目標の期間跨ぎ（#957。週をまたぐか、`life-editor-week-start` を触ると再現できる）/ 保存失敗の Toast（#955。オフラインで宣言を打つ）
- #924 merge 後、朝刊 / 夕刊の表示・Todo 追加・持ち越しを実ブラウザで確認（#892 DoD の残り 1 項目）。worktree 側は build / 型検証までなので chat-main の手番
- #901 / #914 merge 後、Mobile 幅でヘッダーの並びと目標ブロックの表示・入力を実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も chat-main へ引き継ぎ
