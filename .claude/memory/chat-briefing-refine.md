# MEMORY (chat-briefing-refine)

## 進行中

（なし）

## 直近の完了

- [briefing] 週・月・年の目標を朝刊に常設表示（#872・PR #914 open） ✅（2026-08-15）
- [briefing] Mobile の朝刊 / 夕刊ヘッダーをハンバーガー行の下へ（#879・PR #901 open） ✅（2026-08-15）
- [analytics] 「今週」カードの週バーと Work タブ週次も暦週へ（#860・PR #868 merged） ✅（2026-08-14）

## 予定

- #901 / #914 merge 後、Mobile 幅でヘッダーの並びと目標ブロックの表示・入力を実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- `ANSWERS.md` に D-20260815-briefing-1〜7 の回答が付いたら `.claude/decisions/D-*.md` へ昇格させ、B に倒れた項目があれば追い実装する
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も chat-main へ引き継ぎ
