# MEMORY (chat-code-reduction)

## 進行中

（なし）

## 直近の完了

- code-reduction plan Steps 6+8（A2/B1 + A10/A12/A13/A21/A23/A25）✅（2026-07-25 — PR #341（i18n 54 namespace・追加 0 / 削除 2,976 行）+ PR #342（周辺残骸 16 ファイル・追加 0 / 削除 400 行 + バイナリ 1）。merge はユーザー待ち。blockMenu は現役と実測判明のため残置・database は Step 5 領分で残置）
- code-reduction plan Steps 1-3（A3/A4/A5/A6/A11/A14/A16/A20/A22/A24）✅（2026-07-25 — PR #338 merge 済み・main `04e2b6e1`・追加 0 行 / 削除 1,152 行・role-qa 独立監査 PASS）
- A19 follow-up（RoutineStats 削除）✅（2026-07-25 — PR #339 merge 済み・main `cbac4976`・追加 1 行 / 削除 25 行。barrel 書き換え 1 行はユーザー明示承認）

## 予定

- 計画書 `2026-07-25-code-reduction.md` への修正依頼は outbox で chat-main へ送付済み（既存 4 件 + Steps 6/8 分 2 件: B1 から blockMenu 除外 / A2 実測値 54 namespace・2,976 行に訂正）— chat-main の反映待ち
- Step 5（A8 Databases ブロック・👀 目視ゲート「凍結解除予定なし」のユーザー確認）/ Step 7（孤児キー・目視）以降は chat-main の采配待ち
- 次着手前に `gh issue list --label shared-fix --state open` で自分宛を確認
