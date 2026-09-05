
<!-- run: night-safe / 2026-09-01 23:01 / log: night-safe-2026-09-01_2252.log (recovered by launcher afterwards) -->
報告先ファイルへの書き込みが権限で弾かれました。監査自体は 4 タスクすべて完了しているので、報告本文をここに出します。

**書き込みブロッカー**: `.claude/comm/outbox/chat-night-safe/night-safe-report.md` は routine が宣言した唯一の書き込み先ですが、`settings-unattended-readonly.json` の権限プロファイル下では書けませんでした（scope 逸脱ではなく、レーンの設定側の穴です）。他のパスへ迂回はしていません。#1335 の登録作業に、このプロファイルへ当該パスの Write 許可を足す修正が要ります。

---

## 2026-09-01 22:59 Night Safe Run

- Elapsed: 6 min / 45 min（スキップ無し）
- docs 整合: 検出 3 件 / Issue 台帳: 検出 2 件 / PR conflict: 2 件 / 検証準備: 変化 4 件

### 最優先 — main が赤い

`shared — build` が `TS2307: Cannot find module './EmptyState'`（`shared/src/components/Analytics/TagUsageCard.tsx:13`）で落ちています。PR #1422 の `EmptyState` → `AnalyticsEmptyState` 改名と PR #1419 のタグ使用状況カードが擦れ違った結果です。下流の全レーンの CI が赤くなるので、翌朝いちばんに。

### 1. docs 整合（3 件）

| 対象 | 矛盾 | 修正案 |
| --- | --- | --- |
| `docs/vision/plans/2026-08-30-desktop-app-packaging.md:2` | Status が「Step 1-4 / 9-10 = #1300 の PR、Step 5 = #1301 の PR」で PR 待ちに読めるが、実態は #1348（Windows）と #1350 + #1360（mac）が全部 MERGED | Status を「Step 1-5 / 9-10 は PR #1348 / #1350 / #1360 merged。残 = Step 6（tag → Release）と Step 7-8（実機受け入れ）」へ |
| `.claude/memory/chat-main.md:98-100` | #524 は 2026-08-02 に COMPLETED で CLOSED。対象の Connect 力学グラフ自体も #1152 で退役済みでバグの実体が無い | 当該ブロックを削除（tracker 経由） |
| `.claude/memory/chat-main.md:114` | §👀 W4 の「最重要 = Connect グラフが実データで空でない」「backlink」は前提消滅（#1152 退役 / #1239 削除） | 該当 2 項目を落とし「テーマ追従 / 4 タブのチャート描画」だけ残す |

異常なし: CLAUDE.md の相対参照 26 パスは全部実在（dead path ゼロ）。plans の Status 12 本すべて enum 準拠で、上表 1 件以外は実態と一致。移行 SSOT も #1300 / #1301 反映済み。

### 2. Issue 台帳整合（2 件）

**Epic #1121 のチェックボックスが 4 つとも未チェック** — 子 4 件（#1122 = 08-27 / #1123・#1125・#1124 = 08-29）は全部 CLOSED。`[x]` に更新し、残タスクは Epic DoD の実ブラウザ完走だけと本文に明記するのが修正案です。

**宛先ラベルが無い open Issue が 3 件** — #1408 / #1409（Playwright 全画面点検）と #1335（Task Scheduler 登録）が `section:<id>` も `shared-fix` も持ちません。3 件とも `[main]` 宛で chat-main 専任なので意図的な可能性が高いものの、このままだと `issue-prompter` のレーン束ねから静かに漏れます。**ユーザー裁定案件**です。

異常なし: Epic #716 は整合（未チェック 2 box は実際に未達）。本日 merge の 12 本に close 漏れゼロ。

### 3. open PR conflict（2 件）

**(a) PR #1424（Event から完了概念を廃止）= CONFLICTING**。base `70a45aeb`（12:45）以降の merge と重なるのは `shared/src/i18n/locales/en.json` / `ja.json`（#1419）・`shared/src/styles/tokens.css`（#1418）・`web/tests/useScheduleGridFilters.test.tsx`（#1426）の 4 ファイル。**rebase 要**・担当は schedule レーン。本レーンでは実行していません。

**(b) 三重起票 — #1430 / #1431 / #1432 が同じ `TagUsageCard.tsx` を直している**。#1430 は import 名の 1 件だけ、#1431 / #1432 はテスト fixture の `version: 1` 除去も含む 2 件版です。今は 3 本とも MERGEABLE ですが、1 本 merge した瞬間に残り 2 本が衝突します。**2 件版を 1 本だけ merge して残り 2 本を close** が修正案 — #1430 だけ取り込むと今度は `typecheck:tests` が TS2353 で落ちます（`verify` が `build` で止まるので CI は 1 件目しか報告していません）。

### 4. 検証準備（変化 4 件）

実ブラウザ確認待ちが本日一気に増えました（#1379 / #1400 / #1402 / #1407 / #1369 / #1366 / #1372 / #1363 / #1364 / #1365 / #1368 / #1359 / #1362 / #1367 / #1370 の 15 件相当）が、chat-main の §👀 節は 08-31 で止まっていて未反映です。ただし **main が赤い間は dev server を立てての目視ができない**ので、検証の前段にブロッカーが 1 個増えた形になります。

**Epic #1121 の DoD 通し確認は今すぐ実行可能になりました** — 子 4 件が 08-29 までに全着地し、ツアーの中断位置バグ（#1359）も 9/1 に PR #1376 で merge 済みです。§👀 節に未記載なので追加が要ります。

**#1335 の前提が動きました** — 今夜このレーンが headless で実走しているので「登録前に手動実走で 1 回確認」のゲートは満たせる状態です。Task Scheduler へ登録済みかは OS 側の実測が要り、読み取り専用の本レーンでは未確認。`.claude/automation/` に未コミット変更 6 本 + 新規 2 本があり、登録作業が進行中に見えます。

### 起票依頼（chat-main が翌朝裁く）

1. **#1430 / #1431 / #1432 を 1 本に集約**（PR の merge / close 判断のみ・最優先）
2. `2026-08-30-desktop-app-packaging.md` の Status 更新（小 PR）
3. chat-main memory の後始末 2 件（#524 ブロック / §👀 W4 の Connect 部分）— tracker 専用ブランチで
4. Epic #1121 のチェックボックス 4 件を `[x]` へ
5. `[main]` 宛 Issue のラベル運用の裁定（ユーザー判断）
6. §👀 節へ 9/1 merge 分と Epic #1121 の DoD 通し確認を追記
7. night-safe レーンの権限プロファイルに outbox の Write 許可を追加（今回の報告が保存できなかった件）

### 禁止事項

git commit / push / PR / rebase / merge・Issue への書き込み・実装コードと docs の修正・他チャットの memory / outbox / decisions への書き込み・`.session-name` の書き換えは**すべて未実施**です。ファイルへの書き込みも 0 件（宣言先が権限で弾かれたため）。

<!-- run: night-safe / 2026-09-02 21:04 / log: night-safe-2026-09-02_2100.log -->
## 2026-09-02 21:01 Night Safe Run

- Elapsed: 3 min / 45 min（スキップなし。ただし `docs-lint.sh` / `records.mjs check` / supabase MCP は無人 permissions で実行不可のため未検証）
- docs 整合: 検出 3 件
  - `.claude/docs/vision/plans/2026-09-02-desktop-screen-audit.md:262` / 「#1374（PR #1433 open）」だが #1433 は本日 09:36 に merged / 修正案: 「merged」に直し、除外リストから検証対象へ移す
  - `.claude/automation/README.md:14` / night-safe の状態列が「発火は裁定待ち」だが D-20260804-main-1 は 2026-08-11 に A で決着済み / 修正案: 「裁定済み・Task Scheduler 登録待ち（#1335）」へ
  - `.claude/automation/routine-ids.md:12-16` / Status enum の PENDING は「裁定待ち」定義のまま、実態は裁定済み・未登録 / 修正案: #1335 の登録時に ACTIVE 化と合わせて備考へ「裁定済み」を明記
  - 補足: plans 14 本の Status 行に「merge 済みなのに IN PROGRESS」型の矛盾なし。`2026-09-02-desktop-screen-audit.md` の Draft は「実行セッション開始時に IN PROGRESS 化」の想定どおり。CLAUDE.md からの参照先 46 本はすべて実在
- Issue 台帳: 検出 2 件
  - Epic #716 の DoD「`mobile-scope.md` と実装が食い違っていない」が未チェック。PR #1358（2026-08-31 merged）で突き合わせ済みなのでチェックを入れる。残 DoD は狭幅の実機目視のみ
  - `section:` / `shared-fix` どちらも無い open Issue = #1408 / #1409 / #1335（3 件とも `[main]` 接頭辞で chat-main 手番）。`docs-workflow` の routing 規約に `[main]` 宛の扱いが書かれていないため、規約側に 1 行足すか現状維持かの確認だけ。実装レーンの取りこぼしではない
  - close 漏れ 0 件（直近 merge 60 本の対象 Issue はすべて open 一覧に不在）。Epic #1121 の子 4 件は close とチェックが一致
- PR conflict: 0 件（open PR 0 本）
- 検証準備: 変化 3 群
  - 実行可能になった: #1408 Desktop 全画面点検 — 計画書 PR #1441 が merged。本日 merge の UI 変更（#1424 / #1433 / #1425 / #1417 / #1416 / #1420 / #1419 / #1414 / #1413 / #1411 / #1410 / #1397 / #1394 / #1384 / #1383 / #1382 / #1380 / #1376 / #1357 / #1355 / #1347）は除外リストではなく検証対象に入る
  - 🛑 前提確認が要る: #1433（0028 reminder_offset）と #1425（0027 attachments）が merge 済み。memory は「`db push` が merge より先」を前提にしていたが、適用有無はこのレーンから確認できなかった。未適用なら Schedule の SELECT が PostgREST 42703 で全落ちするので、翌朝最初に `supabase migration list` で確認
  - 前提が変わった（`chat-main.md` 👀 リストの整理候補）: #512 は「open」記載だが 2026-08-12 CLOSED / 📝 #524 節は CLOSED かつ Connect グラフ自体が #1152 で退役 / W4 の「Connect グラフ・backlink」も同様に検証不能 / W1/W2 の Trash 導線は Settings 配下（#1293）+ 一括削除（#1294）に変更 / Phase 3 の「build:mac で DMG」は #1300 / #1301 のリリース workflow が後継 / #631 / #633 / #470 の実機分は #1409（Mobile 点検）の実行セッションへ畳める
- 修正が必要なもの → 起票依頼: なし。上記はすべて docs 3 箇所の 1 行修正と chat-main の tracker 整理で済む範囲

ファイル書き込みは 0 件で、scope drift はありません。

<!-- run: night-safe / 2026-09-02 22:50 / log: night-safe-2026-09-02_2233.log -->
## 2026-09-02 22:48 Night Safe Run

- Elapsed: 12 min / 45 min（スキップしたタスクなし）
- docs 整合: 検出 4 件
- Issue 台帳: 検出 2 件（close 漏れは 0）
- PR conflict: 0 件
- 検証準備: 変化 3 件

### docs 整合（4 件）

1. **`automation/routine-night-safe.md:3` + `automation/routine-digest.md:3`** / 冒頭注記が「**Task Scheduler への登録はまだ**」のままですが、PR #1446 で `LifeEditor-NightSafe`（22:33）と `LifeEditor-Digest`（06:03）が登録済みで、本走もその枠から発火しています。#1446 の変更ファイルにこの 2 本は入っていないため、merge しても drift が残ります / **修正案**: 両行を「Task Scheduler 登録済み（2026-09-02・台帳 = `routine-ids.md`）」へ差し替える。
2. **`docs/vision/plans/2026-09-02-desktop-screen-audit.md`** / main 上の Status は `Draft` のままです。`IN PROGRESS` への 1 行変更が working tree に未 commit で残り、repo 直下の未追跡 `pwv1408-materials-focus-viewport.png` から実行セッションが既に動いたことが読めます / **修正案**: Status 変更を commit し、PNG は repo 外へ退避する（§9「バイナリは repo に置かない」）。
3. **`docs/requirements/mobile-scope.md:57`（#16 行）** / 「その他シートの Quick actions に Undo/Redo」「header=wide 専用の `HeaderUndoRedo`」と書いてありますが、#1035（CLOSED）以降は狭幅ヘッダーにも同じ部品が出ます（`web/src/MainScreen.tsx:293`。シート側 `web/src/MobileShellActions.tsx:82` も併存）。PR #1358 は file:line の張り替えだけで本文は直していません / **修正案**: 「その他シート + 狭幅ヘッダーの両方（#1035）」に書き換え、「wide 専用」を削る。
4. **`docs/vision/plans/2026-09-02-fable-51-harness-retune.md`** / Draft の計画書が git 未追跡で、CI からも INDEX からも見えない状態です / **修正案**: chat-main が commit するか、着手レーンへ渡す。

CLAUDE.md と `rules/` から張られた参照先 32 本は全て実在しました（dead path 0 件）。

### Issue 台帳（2 件）

- **close 漏れ 0 件**: merged PR 45 本の closing issue 22 件と open Issue 23 件を突き合わせて、交差はありませんでした。
- **Epic #1121**（チュートリアル）: 子 4 件（#1122〜#1125）が全 CLOSED、本文チェックも全て `[x]`。残りは DoD の通しツアー 1 回だけなので、**#1408 / #1409 の巡回チェックリストに 1 項目として足せば close 判定まで行けます**。
- **Epic #716**（Mobile v2）: 子 2 件 CLOSED・裁定 3 件も `[x]`。残り 2 項のうち「`mobile-scope.md` と実装が食い違っていない」を塞いでいるのが上の docs 3 です。**docs 3 を直せば残りは狭幅の実機目視 1 つになります**。
- ラベル欠落: #1408 / #1409 / #1335 が `section:*` も `shared-fix` も持ちません。3 件とも `[main]` 直轄なので意図的と読みましたが、レーンのクエリに乗せる気がないならこのままで問題ありません。

### PR conflict（0 件）

open 7 本（#1446〜#1452）は全て `MERGEABLE` です。7 本の変更ファイルを総当たりしても重複が 0 だったので、**merge 順による後発コンフリクトも起きません**。migration を含む PR は 0 で、0027 の版番号衝突は #1445 merge で解消済みです。

### 検証準備（3 件）

- **実行可能になった**: #1408 の実行セッション。gate だった PR #1441 が merge 済みで、`memory/chat-main.md:23` の条件は外れています。
- **前提が変わった**: `memory/chat-main.md:64` の「claude-launcher の docs が追随していない」は解消済みです（#1377 / PR #1381。計画書は `archive/2026-08-29-claude-launcher-desktop.md` へ移動し、CLAUDE.md §5 も「着地済み」の記述に変わっています）。memory の記述だけが古い状態です。
- **目視待ちに追加**: #1400 / #1402（2026-09-01 merged）は #1409 へ畳む方針ですが、**#1409 の計画書がまだありません**（#1408 は PR #1441 で作成済み）。

### 修正が必要なもの → 起票依頼（chat-main が裁いてください）

1. `routine-night-safe.md` / `routine-digest.md` の「登録はまだ」注記を実態へ更新（docs のみ・小）
2. `mobile-scope.md` #16 行を #1035 の実装へ追随（docs のみ・**Epic #716 close の最後のゲート**）
3. main の working tree 整理 — `pwv1408-materials-focus-viewport.png` の退避、`2026-09-02-desktop-screen-audit.md` の Status commit、未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` の始末

置いた仮定: Task Scheduler の登録有無は PR #1446 の本文を根拠にしました（`schtasks /Query` は無人プロファイルの permissions で拒否されたため直接確認できていません）。ファイルは 1 つも書いていません。
