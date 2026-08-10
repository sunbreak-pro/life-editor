# MEMORY (chat-mobile-refine)

## 進行中

- **#589 mobile-scope 現状維持 9 行のコード実測** → **PR #651 open（CI green・merge 待ち）**。コード変更ゼロで `mobile-scope.md` の追随のみ。9 行のうち 6 行は表どおり、#1 / #4 / #9 がズレ（#9 は #329 / #409 / #551 / #566 で構造ごと入れ替わり）。Epic #321 の最終行はチェック済みだが **Epic の close 判断と狭幅の実機目視は chat-main に残る**
- **#632 mobile FAB の位置統一** → **着手前**。前提の **#631（PR #635・CI green・merge 待ち）** が main に入るまで待ち。ドキュメントスクロールが残っていると `fixed` の見かけの位置が動いて直ったか判定できないため（Issue #632 の「依存」節）

## 判断待ち（回答が付いたら消化 → 台帳へ昇格）

- `D-20260810-mobile-1` — narrow から書き換えられる「タグの色」を残すか塞ぐか（推奨 A = 残す）
- `D-20260810-mobile-2` — 「Consumption = 編集不可」の語を実態に寄せるか実装を絞るか（#1 / #4 共通・推奨 A = 語を寄せる）
- どちらも B を選ぶ場合の実装は `web/src/schedule/**` = **schedule-refine の担当**。outbox でハンドオフ予告済み

## 直近の完了

- #499 再取得をドメイン単位に分割 ✅（2026-07-31・PR #501 merged。**残: リクエスト数の実測は実ブラウザが要るため chat-main 側**）
- #473 コマンドパレットのモバイルタッチ導線 ✅（2026-07-31・PR #498 + レビュー回収 #500 いずれも merged）
- #507 タスク本文の `[[` リンク配線 ✅（2026-08-02・PR #542 merged）

## 予定

- #635 が merge されたら `origin/main` へ rebase して **#632 に着手**（`shared/src/components/` に FAB の配置定義を 1 本化 → Schedule / Notes の呼び出し側を差し替え。#509 のクリアランス回帰を作らないこと）
- 判断キュー 2 件に回答が付いたら、A なら `mobile-scope.md` の目標列を 1 行直す / B なら schedule-refine へ Issue 化を依頼
