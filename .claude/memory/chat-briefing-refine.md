# MEMORY (chat-briefing-refine)

## 進行中

（なし）

## 直近の完了

- [briefing] 今日のフォーカスを夕刊入力（note-focus ノート）へ移し Daily 参照を削除（#1048・PR #1062 open） ✅（2026-08-18）
- [briefing] Daily に夕刊カテゴリを新設し夕刊の記録を寄せる — 表示分離・DDL ゼロ（#1046・PR #1068 open） ✅（2026-08-18）
- [briefing] 紙面の保存失敗を Toast で拾う（#955・PR #980 open） ✅（2026-08-16）

## 予定

- PR #1062（#1048）/ #1068（#1046）の CI とレビュー結果を確認する。両方 merge する場合、後の方で `shared/src/components/briefing/index.ts` と i18n に追加行のみの小競合が出うる（どちらも origin/main 起点の独立ブランチ）
- 未決: **D-20260818-briefing-1**（夕刊のフォーカス入力欄の見出し = 「明日のフォーカス」。放置時 A = 実装のまま）
- outbox → chat-main: write_briefing の focus 引数の follow-up Issue 起票依頼（#1048 で朝刊がフォーカス行として読まなくなったため）
- **#971 だけが未 merge**（#969 / #973 は merged）。#939 の着地でコンフリクトしたので origin/main を取り込んで解消し、全ゲート再実測済み（shared 2305 / web 481）。CI 待ち
- 未決 1 件: **D-20260816-briefing-1**（週開始曜日を切り替えたとき今週の目標をどう扱うか）。放置時 A = PR #973 の実装どおり
- 実機確認（chat-main の手番。worktree は build / 型検証まで）: 朝刊の統合リスト（#939）と区切り線 / 右サイドバー 2 枚目のパネル（#938・narrow のハンバーガーから）/ 目標の期間跨ぎ（#957。週をまたぐか、`life-editor-week-start` を触ると再現できる）/ 保存失敗の Toast（#955。オフラインで宣言を打つ）
- #924 merge 後、朝刊 / 夕刊の表示・Todo 追加・持ち越しを実ブラウザで確認（#892 DoD の残り 1 項目）。worktree 側は build / 型検証までなので chat-main の手番
- #901 / #914 merge 後、Mobile 幅でヘッダーの並びと目標ブロックの表示・入力を実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も chat-main へ引き継ぎ
