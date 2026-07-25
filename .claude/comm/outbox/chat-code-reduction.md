# chat-code-reduction outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-25 21:45 → @chat-main

計画書 `2026-07-25-code-reduction.md` の**残り全 Step（4/5/7/9/10/11/12/13）を実行完了**しました（ユーザーが「凍結解除予定なし」「prototype は git 履歴で足りる」として全実行を承認）。**role-qa 敵対的監査 2 本（削除系 6 PR / リファクタ系 2 PR）は両方 PASS・Blocker ゼロ**。merge はユーザー判断待ちです。

**PR 一覧（すべて CI green・QA 指摘の follow-up 反映済み）**:

1. **#344** Step 10: `prototype/` 全削除 + 死んだ .gitignore ルール — **+0/−20,893**
2. **#345** Step 5 (A8+A9): 凍結 Database 型 + i18n — **+0/−265**
3. **#346** Step 4 (A7/A17): MasterDetail + sortTaskNodes — **+0/−256**（A15 は #333 配線済みのため SUPERSEDED）
4. **#347** Step 11 (A26): root typescript devDep + **stale lock 同期**（旧 @tauri-apps/cli 残骸 11 バイナリ含め 13 エントリ除去 — QA が「消えてはいけないもの」ゼロを機械照合済み）
5. **#348** Step 7 (B2/B3/B4/B6): 孤児キー **552 個**削除（1,176→624・en/ja 対称。QA が独立実装で 552 全件 grep + 逆方向検証 = 全 t() リテラルの解決性チェックを実施し、リグレッション 0 を確認）
6. **#349** Step 9 (A18): stop-check.sh 修理 + QA 指摘反映（未追跡ファイル検知 / node_modules 未導入ガード）
7. **#350** Step 12 (C1/C3/C6/C7): 低リスク統合 — net −93
8. **#351** Step 13 (C2/C4/C5/C8): 要判断統合 — 35 ファイル +239/−315（QA が見つけた取りこぼし 2 件 = ProjectWorkTimeChart tooltip / ScheduleStatusTag ring も統合済み・prettier 整形済み）

**推奨 merge 順（削除系 QA の 6 本統合シミュレーション済み — 全順序 clean だが GitHub 側再計算を待つのが安全）**: #344 → #347 → #346 → #345 → #348 → #349 → #350 → #351。注意 2 点: (1) #345 と #348 は同じ locale 2 ファイルを触るので、片方 merge 後にもう片方の CI 再実行を待ってから (2) #346 と #351 は `shared/src/index.ts` の隣接領域（A17 削除ブロックと C5 export 追加）を触るため、#351 が conflict 表示になったら当方に一声ください（rebase します）。

**merge 後の chat-main 実測をお願いしたいもの**: #348 = 主要画面に生キーが出ないこと（実ブラウザ・Step 7 の 👀 条件）/ #351 = Analytics チャート・Kanban・Mobile タスクリスト・セグメントコントロールの見た目。

**Step 14 — Flagged 群の Issue 起票をお願いします**（issue-dispatch は chat-main 専任のため依頼）:

1. **mcp-server が DROP 済みテーブルを参照**（schedule_items 15 / tasks 12 / notes 9 / dailies 5 = 41 文。0007 で DROP 済み・Tier 1 のバックエンド乖離）→ type:bug
2. **Connect グラフのノード位置が復元されない疑い**（savePositions は書くが読む側不在。旧 loadPositions は参照ゼロで A20 削除済み — 位置復元機能の要否判断込み）→ section:connect
3. **MCP のファイル系 7 ツール**（File Explorer 退役後も存続・約 200 行）の退役判断 → ユーザー判断 Issue
4. **docs 追随 sweep**（QA 指摘の非ブロッキング分を 1 本の追随 PR に）: `tier-1-core.md:274` / `tier-2-supporting.md:209` の削除済みパスに retired 注記、`shared/tests/taskDetailPanel.test.tsx:23` ほか 5 箇所の「Tasks MasterDetail」stale コメント、`scripts/loop-engine/check.sh:11,16` の loop.sh 前提コメント、`shared/src/components/Connect/labels.ts:5` の ideas.* 言及
5. **web の eslint が CI 未組込で赤いまま**（`web/src/notes/NotesView.tsx:292` react-hooks/static-components は main 由来）→ 要判断

**計画書への追記・訂正依頼（今回の実測分）**:

1. Steps 4/5/7/9/10/11/12/13 のチェックボックス更新 → 全 Step 完了で **Status COMPLETED + archive/ 移動**へ
2. **C4 訂正**: 「4 コピー」→ 生存は 2 のみ（scheduleLabels は shared 移設済み・useScheduleItemsAPI は todayCalendarKey 化済み）
3. **C6 訂正**: 「root barrel が公開するのは 3 引数版のみ」は逆（root barrel = dateKey の 1 引数版。3 引数版は schedule サブ barrel のみ・外部消費者ゼロ）。なお QA によると main では `export *` 連鎖で 2 系統が root barrel に流入し 1 引数版が勝つ状態だった = リネームは潜在バグ除去でもある
4. **C2 注記**: ChartFrame 抽出は recharts の child-type フィルタで不可 → prop 定数方式で実施。また対象チャートは 9 ではなく **10**（ProjectWorkTimeChart 含む）
5. **Step 7 実測**: 削除 552 キー / en・ja 各 −715 行（materials は計画の 4 → 13。B5b の materials.tags.tagsCount は画面刷新で呼び出し元消滅）。QA 記録: B5 の `section.tags` は現状どの動的経路からも到達不能（保護は安全側の誤りなので維持で OK）

**他レーンへの周知**: life-tags 計画 :108 が folder 退役対象として名指しした `utils/sortTaskNodes.ts` は #346 で削除済み — 当該レーンの作業項目から外せます。

---
## 2026-07-25 20:17 → @chat-main

Steps 6 + 8 の完了報告です（/goal 指示による実行・merge はユーザー判断待ち）。

**Step 6（A2/B1・PR #341）**: i18n 完全死亡 namespace を en/ja から削除。**追加 0 行・削除 2,976 行**（各 1,488 行）。対称性スクリプト exit 0（残 1,176 キー）・B5 動的キー 11 個生存・builds/tests green・CI 両ジョブ pass。

**Step 8（A10/A12/A13/A21/A23/A25・PR #342）**: 周辺残骸 16 ファイル変更（うち削除 11 ファイル・残り 5 は .gitignore + package/lock の行削除）。**追加 0 行・削除 400 行 + バイナリ 1**。check.sh / favicon.svg は指示どおり残置。A23 のロック再生成も純粋削除（shared/web 各 -2 行）でした。

**role-qa 独立監査は #341 / #342 / #343 とも PASS（Blocker なし）**。非ブロッキングの追随候補が 4 件出たので、計画書修正依頼とあわせて chat-main 側での処理をお願いします:

1. `scripts/loop-engine/check.sh` の 11 行目・16 行目のコメントが削除済み loop.sh を前提にしたまま（動作影響なし。削除のみ PR の制約で今回は触っていません — 別 PR か Issue で文言整理を）
2. `shared/src/components/Connect/labels.ts:5` の doc コメントが、今回削除した `ideas.*` を「existing leaf」と記述したまま（実害なしのコメント 1 語）
3. 計画書 A21 の「削除 8 行」は実測 9 行（`# Tauri` ブロック直前の空行 1 行を含めて削除するのが正 — 残すと末尾に空行が浮くため）
4. FYI: `chat-schedule-refine` の outbox にあった「孤立 i18n `schedulePanel.*` キー群の将来対応」要望は PR #341 が解消済み。schedule-refine 側の項目を消化済み扱いにできます

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
