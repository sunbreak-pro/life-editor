# MEMORY (chat-briefing-refine)

## 進行中

（なし）

## 直近の完了

- [briefing] 「今日の Todo と、その目的」を廃止し Todo をスケジュールへ統合（#939・PR #969 open） ✅（2026-08-16）
- [briefing] D-20260815-briefing-1〜7 を台帳へ昇格（3 = B / 7 = B の 2 件は実装 Issue #957 / #955 へ） ✅（2026-08-16）
- [briefing] データ層 2 本をテストで固定 → useBriefingData を 3 分割（#892・PR #924 merged） ✅（2026-08-16）

## 予定

- #938（「きのうまでの自分」を右サイドバーへ）→ #957（目標を期間キー付き保存 + 履歴）→ #955（紙面の保存失敗を Toast で拾う）の順で着手
- #969 / #938 は同じ `BriefingView.tsx` の隣接ブロックを触る。先に merge した側の後で他方を rebase し直す（PR 本文に申し送り済み）
- #924 merge 後、朝刊 / 夕刊の表示・Todo 追加・持ち越しを実ブラウザで確認（#892 DoD の残り 1 項目）。worktree 側は build / 型検証までなので chat-main の手番
- #901 / #914 merge 後、Mobile 幅でヘッダーの並びと目標ブロックの表示・入力を実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も chat-main へ引き継ぎ
