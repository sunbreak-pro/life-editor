# MEMORY (chat-briefing-refine)

## 進行中

（なし）

## 直近の完了

- [briefing] データ層 2 本をテストで固定 → useBriefingData を 3 分割（#892・PR #924 open） ✅（2026-08-16）
- [briefing] 週・月・年の目標を朝刊に常設表示（#872・PR #914 open） ✅（2026-08-15）
- [briefing] Mobile の朝刊 / 夕刊ヘッダーをハンバーガー行の下へ（#879・PR #901 open） ✅（2026-08-15）

## 予定

- #924 merge 後、朝刊 / 夕刊の表示・Todo 追加・持ち越しを実ブラウザで確認（#892 DoD の残り 1 項目）。worktree 側は build / 型検証までなので chat-main の手番
- #901 / #914 merge 後、Mobile 幅でヘッダーの並びと目標ブロックの表示・入力を実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- `ANSWERS.md` に D-20260815-briefing-1〜7 の回答が付いたら `.claude/decisions/D-*.md` へ昇格させ、B に倒れた項目があれば追い実装する
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も chat-main へ引き継ぎ
