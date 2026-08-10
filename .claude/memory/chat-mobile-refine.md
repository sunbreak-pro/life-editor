# MEMORY (chat-mobile-refine)

## 進行中

- **#632 mobile FAB の位置統一** → **PR #660 open（非 draft・merge 待ち）**。配置定義を `shared/src/components/MobileFab.tsx` に 1 本化し、Schedule（`CalendarTab.tsx`）と Notes（`NotesMobileList.tsx`）を差し替え。**Schedule の実害（`fixed` がモバイル Chrome のレイアウトビューポート基準で URL バーの伸縮に付いて動く）は解消。Notes の「セクションの箱に貼り付く」は未達**で判断キュー `D-20260810-mobile-3` 行き（P-008）
- **#660 は main を取り込み済み**: #588（PR #646）で `NotesView` のモバイル本体が `NotesMobileList.tsx` へ分割されたため衝突。`NotesView` は main を丸ごと採り、FAB の差し替えを `NotesMobileList` 側へ移した

## 判断待ち（回答が付いたら消化 → 台帳へ昇格）

- `D-20260810-mobile-1` — narrow から書き換えられる「タグの色」を残すか塞ぐか（推奨 A = 残す）
- `D-20260810-mobile-2` — 「Consumption = 編集不可」の語を実態に寄せるか実装を絞るか（#1 / #4 共通・推奨 A = 語を寄せる）
- `D-20260810-mobile-3` — Notes の FAB を本当に貼り付けるため narrow の Materials を fluid 変種へ動かすか（推奨は保留 = B。A は `MainScreen.tsx` が対象で #632 のスコープ外・Daily のスクロール所有権も動くので実機確認が要る）
- mobile-1 / mobile-2 で B を選ぶ場合の実装は `web/src/schedule/**` = **schedule-refine の担当**。outbox でハンドオフ予告済み

## 直近の完了

- **#589 mobile-scope 現状維持 9 行のコード実測 ✅**（2026-08-10・PR #651 merged）。6 行は表どおり・#1 / #4 / #9 がズレ。**残: Epic #321 の close 判断と狭幅の実機目視は chat-main 側**
- #473 コマンドパレットのモバイルタッチ導線 ✅（2026-07-31・PR #498 + レビュー回収 #500 いずれも merged）
- #507 タスク本文の `[[` リンク配線 ✅（2026-08-02・PR #542 merged）

## 予定

- 判断キュー 3 件に回答が付いたら消化 → `.claude/decisions/` へ昇格（mobile-1 / mobile-2 は A なら `mobile-scope.md` の目標列を 1 行直す・B なら schedule-refine へ Issue 化を依頼／mobile-3 は A なら chat-main に「narrow の Materials を fluid 変種へ」の起票を依頼）
- **PR #660 merge 後に chat-main へ実ブラウザ確認を依頼済み**（outbox 2026-08-10 (2)）: Schedule で長いリストをスクロールしても「+」が動かないこと / Notes は現状どおり末尾に付いてくること
