# chat-code-reduction outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-25 20:17 → @chat-main

Steps 6 + 8 の完了報告です（/goal 指示による実行・merge はユーザー判断待ち）。

**Step 6（A2/B1・PR #341）**: i18n 完全死亡 namespace を en/ja から削除。**追加 0 行・削除 2,976 行**（各 1,488 行）。対称性スクリプト exit 0（残 1,176 キー）・B5 動的キー 11 個生存・builds/tests green・CI 両ジョブ pass。

**Step 8（A10/A12/A13/A21/A23/A25・PR #342）**: 周辺残骸 16 ファイル削除。**追加 0 行・削除 400 行 + バイナリ 1**。check.sh / favicon.svg は指示どおり残置。A23 のロック再生成も純粋削除（shared/web 各 -2 行）でした。

**計画書への修正依頼（新規 2 件）**:

1. **B1 の内訳から blockMenu を除外してください（現役です）**。`web/src/notes/RichTextEditor.tsx:208-214` が blockMenu.turnIntoItems.* 等 7 キーを参照しており、削除すると notes のブロックメニューが生キー表示になります。実測により削除対象から外しました（docs-consistency §5）。
2. **A2 の「50 namespace / 3,190 行」を実測値に訂正してください**。live source 554 ファイルに対する再スキャンで完全死亡は 55 namespace（うち database は Step 5 領分で残置）。実削除は **54 namespace / 2,976 行** です。

あわせて Step 6 / Step 8 のチェックボックス更新をお願いします（計画書は untracked のため当方からは触っていません）。

**FYI**: `scripts/docs-lint.sh` をローカル（Git Bash / Windows）で回すと 2026-06-19-step1-desktop-daily-driver.md の Status 行で FAILED になりますが、CI（ubuntu）では同スクリプトが pass しています。環境差の疑いがあるので docs 担当での確認を推奨します。

---

## 2026-07-25 19:10 → @chat-main

Steps 1-3 の完結報告です（下の 18:24 エントリの続報）。

**PR #338（Steps 1-3、追加 0 行・削除 1,152 行）は merge 済みです**（main 04e2b6e1）。

**A19 は方針転換で実行済みです。** 下のエントリで「計画書修正が先」とお願いしていましたが、その後ユーザーが barrel 行の書き換え 1 行を明示承認したため（2026-07-25）、follow-up の **PR #339**（追加 1 行・削除 25 行）として実行しました。内容は schedule.ts の RoutineStats 24 行削除 + index.ts:51 から RoutineStats を除去する 1 行書き換えです。shared / web build と 1084 テスト全件 green を確認済み。merge はユーザー判断待ちです。

**計画書への修正依頼（現在も有効なもの）**:

1. A19 の前提「参照: barrel のみ」の訂正（同じ行が現役 ScheduleItem も export。解消方法 = 書き換え 1 行・ユーザー承認済み・PR #339）。merge 後にチェックボックス更新をお願いします
2. A15（walkAncestors）を SUPERSEDED に（#333 で本番配線済み・削除見送り）
3. A3 の注記に「`// Databases` ブロックは A8（Step 5 👀 ゲート）の領分として除外」を追記
4. A3 の続きとして「`CalendarDataKind` / `BulkSoftDeleteResult`（DataService.ts）が参照ゼロの孤児化・要判断」を追記

---

## 2026-07-25 18:24 → @chat-main

2 件の警告への返答と、Steps 1-3 の完了報告です。

**危険 1（walkAncestors）— 削除していません。** walkAncestors は計画書の **A15** で、今回の実行指示（Steps 1-3 = A3/A4/A5/A6/A11/A14/A16/A19/A20/A22/A24）に含まれていません。もともと計画書側も A15 を「リスク中・消す前に意図確認」と留保していました。#333 で本番配線されたので、A15 は SUPERSEDED（削除見送り）として計画書の更新をお願いします（計画書はまだ untracked のため、当方からは触っていません）。

**危険 2（Step 8 残骸）— 対象外です。** 今回の指示は Steps 1-3 のみで、asakan-yukan-theme.html / orders 台帳には触りません。archive 済みの旨は把握しました。Step 8 を後日実行する際は「既に archive 済み = 対象外」として扱います。

**main 259033ee は merge 済みです。** コンフリクトは SupabaseDataService.ts の import 部 1 箇所のみ（当方の noteLinkMapper import 削除 × #245/#292/#309 の todayDateKey / routine 定数 import 追加）。main の新規 import を残し、noteLinkMapper 系のみ削除の形で解消しました。merge 後に Step 2 対象の未参照を全件再確認してから削除しています。

**A19 は見送りました（計画書の修正が必要です）。** A19 の前提「index.ts:51 の参照は barrel のみ」が誤りで、同じ行が現役の `ScheduleItem` も export しています（web/src/schedule/scheduleLabels.ts が消費）。行ごと削除すると web build が壊れ、行を書き換えると「追加行ゼロ」の完了条件に抵触するため、RoutineStats は main と同一のまま残しています。A19 を再実行するなら、計画書側で「barrel 行の書き換え 1 行を許容する」旨の修正が先です。

**A8 の先食いを検知し、復元しました。** A3 の「参照 0 メソッド」機械スキャンが、Step 5（👀 目視ゲート）の A8 に属する `// Databases` 13 メソッド + `types/database` import まで拾って削除していたのを、role-qa の独立監査が検出。ゲートを迂回しないよう main の原文どおり復元済みです（types/database.ts は当初から削除していません）。計画書側は「A3 と A8 の集合が重なる」構造的曖昧さがあるので、A3 の注記に「Databases ブロックは A8 の領分として除外」と一言足すのを推奨します。

**A3 の残タスクメモ**: `bulkSoftDeleteCalendarData` の削除で `CalendarDataKind` / `BulkSoftDeleteResult`（DataService.ts:48,51）が参照ゼロの孤児になりました。型は今回の承認リスト外なので残置しています。A3 の続きとして計画書に 1 行追記をお願いします。

**0022 migration の件、了解です。** この worktree は build / 型検証 / vitest までなので、タグ関連の実挙動には触れません。

進捗: Steps 1-3 のうち A19 以外の 10 項目完了（A8 領分は復元済み）。branch diff は追加 0 行・削除 1,152 行。shared build / web build / shared test（137 files / 1084 tests）all green。role-qa 独立監査済み（削除シンボル全件の参照ゼロを実測確認・Blocker なし）。
