# MEMORY (chat-work-refine)

## 進行中

（なし）

## 直近の完了

- #882 Todo 未選択でタイマー開始したら「無題のTodo」を自動作成 ✅（2026-08-15）: **PR #907 open**（Closes #882・merge = 人手 P-001）。WORK を Todo 未選択で開始したら本物の Todo を 1 件作って紐付け、activeTodo にも据える。休憩では作らない / 作成失敗でもセッション行は残す、の 2 つを意図的な境界としてテストで固定
- #881 Mobile のスタート / 停止アイコンが上下と被る ✅（2026-08-15）: **PR #904 open**（Closes #881・merge = 人手 P-001）。fullscreen の操作列を Desktop 相当へ（メイン 72→56px・左右 52→44px）。縮小幅はユーザー確定（選択肢提示で「Desktop 相当まで落とす」）
- #781 残り 3 箇所の window.confirm / alert を ConfirmDialog へ ✅（2026-08-13）: **PR #810 merged**。Kanban の変換確認 + 子持ち拒否（acknowledge 形）と Settings のリセット確認。同期 → 非同期化の罠（開いた瞬間に走る）を両方テストで固定。コメント文言も言い換えて `grep window.confirm|window.alert` が shared/src + web/src で 0 件
- #590 Layout Standard v2 adoption（work）✅（2026-08-10）: **PR #641 open**（merge = 人手 P-001）。ヘッダー自体は変更不要だった — `MainScreen.tsx:312` の既定分岐が work にも標準 SectionHeader を渡している。実作業はカードスタック `gap-4`→`gap-6`（Settings/Trash と同リズム）+ stale コメント修正 + `web/tests/workScreenLayout.test.tsx` 新規 3 件

## 予定

- life-tags adoption（兄弟計画 `2026-07-11-life-tags-unification.md`・着手は合図待ち・work は影響小）
