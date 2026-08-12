# MEMORY (chat-work-refine)

## 進行中

（なし）

## 直近の完了

- #781 残り 3 箇所の window.confirm / alert を ConfirmDialog へ ✅（2026-08-13）: **PR #810 open**（Closes #781・merge = 人手 P-001）。Kanban の変換確認 + 子持ち拒否（acknowledge 形）と Settings のリセット確認。同期 → 非同期化の罠（開いた瞬間に走る）を両方テストで固定。コメント文言も言い換えて `grep window.confirm|window.alert` が shared/src + web/src で 0 件
- #590 Layout Standard v2 adoption（work）✅（2026-08-10）: **PR #641 open**（merge = 人手 P-001）。ヘッダー自体は変更不要だった — `MainScreen.tsx:312` の既定分岐が work にも標準 SectionHeader を渡している。実作業はカードスタック `gap-4`→`gap-6`（Settings/Trash と同リズム）+ stale コメント修正 + `web/tests/workScreenLayout.test.tsx` 新規 3 件
- #550 work nav 行のタイマー表示 ✅（2026-08-02 merged・commit 58f1eac6）— 記録が漏れていた分の後追い追記

## 予定

- life-tags adoption（兄弟計画 `2026-07-11-life-tags-unification.md`・着手は合図待ち・work は影響小）
