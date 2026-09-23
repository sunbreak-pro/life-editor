
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

<!-- run: night-safe / 2026-09-06 22:37 / log: night-safe-2026-09-06_2233.log -->
監査に必要な材料は揃いました。docs-lint と Supabase の migration 一覧は無人用の許可で拒否されたので、その 2 点は未検証として報告に載せます。

## 2026-09-06 22:37 Night Safe Run

- Elapsed: 4 min / 45 min（スキップなし。ただし `scripts/docs-lint.sh` の実走と Supabase `list_migrations` は無人用 permissions で拒否され未検証）
- docs 整合: 検出 3 件
  1. `.claude/automation/routine-night-safe.md:3` と `routine-digest.md:3` / 矛盾 = 両ヘッダーが「Task Scheduler への登録はまだ」のままだが、`automation/routine-ids.md:12-13` は 2026-09-02 に ACTIVE 登録済み（#1335 コメントでも実測確認済み） / 修正案 = 2 ファイルの注記を「登録済み（2026-09-02・台帳 = routine-ids.md）」へ差し替える 1 行 PR（09-02 走の起票依頼が未処理のまま 4 日経過）
  2. `.claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md` / 矛盾 = Status: Draft の計画書が main の working tree で git 未追跡（`??`）のまま 4 日経過。plans/ の派生 INDEX にも乗らず、他チャットから見えない / 修正案 = chat-main が commit するか、不要なら削除を裁定する（09-02 走の起票依頼が未処理）
  3. `.claude/memory/chat-main.md:13` / 矛盾 = 「PR #1348 open」と書かれているが #1348 は 2026-08-31 に MERGED、後続 #1360 / #1506 も merge 済み。計画書 `2026-08-30-desktop-app-packaging.md` の Status 行は最新なので、memory 側だけが遅れている / 修正案 = chat-main の次回 task-tracker で「#1348 / #1360 / #1506 merged・残 = Step 6 tag Release / Step 7 最終 1 項目 / Step 8 Mac」に更新
  - 参考: CLAUDE.md からの参照先ファイルはプロジェクト内 50 本すべて存在。`~/.claude/rules/bash-tool-stability.md` だけはリポジトリ外で読み取り許可が無く未確認（ユーザーグローバル CLAUDE.md は同じ知見を `docs/bash-tool-stability.md` と書いており、パス表記が 2 通りある）。plans の Status enum 違反はゼロ、archive 済み計画書（#1408 / #1409 / ai-integration / schedule-todo-tab）は plans/ に残っていない
- Issue 台帳: 検出 4 件
  1. **#1408 close 漏れ候補**: 2026-09-05 コメントで「実行完了・findings 20 件起票・レポート PR」と宣言し、レポート PR #1487 と計画書 archive も merge 済み。open のまま
  2. **#1409 close 漏れ候補**: 同じく 2026-09-05 に実行完了・#1512〜#1527 起票・PR #1529 merge 済み。open のまま（memory では「close = ユーザー手番」と記載）
  3. **Epic #716 の DoD 行「`mobile-scope.md` と実装が食い違っていない」**: #1409 が mobile-scope 照合を実施し PR #1545 で mobile-scope の notes/daily 行も更新済み。チェックを付けてよい状態。残りは実機目視 1 行のみ
  4. **#1512 の残件に宛先が無い**: PR #1556（merged）は本文で「共有部品ぶんだけ直し、画面ごとの行は各セクションレーンへ残す・Issue は close しない」と宣言しているが、残件は `shared-fix` ラベルの #1512 本体にぶら下がったままで、`section:<id>` 付きの子 Issue が無い → 各レーンの `/goal` に乗らない。修正案 = 画面ごとの子 Issue 起票（起票依頼）
  - 参考: Epic #1121 は子 4 件（#1122〜#1125）すべて CLOSED・チェック済み。Epic DoD（ツアー完走・中断再開）の実機確認が未消化なので close はまだ。#1335 は「night レーン未登録のため意図的に open」と本人コメントあり。ラベル欠落の実装 Issue はゼロ（section / shared-fix のどちらも無い open 3 件 = #1408 / #1409 / #1335 は全部 `[main]` の task）
- PR conflict: 0 件（open PR そのものが 0 本。閉じられた PR に未 merge の close も 0）
- 検証準備: 変化 3 件
  1. **実行可能になった実ブラウザ確認が大量に溜まっている**（open PR 0 = 各レーンが「merge 後に chat-main へ」と依頼した分が全部着地）: Analytics #1520 / #1524 / #1476〜#1480、Briefing #1467 / #1486、shared-fix #1468 / #1474（タイマー稼働中 × ダークのリング）/ #1481、Mobile #1400 / #1402 / #1039 の 44px オーバーレイ、Settings #1210 カード / #1243 / #1253、Schedule #1343 / #1242、Materials #1470 / #1471、Work #1475、web-public #1281。2026-09-05 の #1408 / #1409 点検で見た分は除外してよいが、09-06 merge の 20 本超は未点検
  2. **前提が変わって消せる項目**: chat-main.md:116 の W4「Connect グラフ表示・ノードクリック遷移」と :102 の #524 は、力学グラフ退役（#1152）と #524 close で対象が存在しない。:110 の #512 も close 済み
  3. **#1375（PR #1456 merged）の確認は migration 0029 の `supabase db push` が前提**。適用済みかは `list_migrations` が拒否され未確認。09-05 の #1409 点検時点では未適用（分析の集計が全 0）だったので、確認前に push の有無を先に見る
- 修正が必要なもの → 起票依頼（chat-main 向け）
  - routine-night-safe.md / routine-digest.md の「登録はまだ」注記を訂正する docs PR
  - 未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` の commit or 削除の裁定
  - #1408 / #1409 の close（実行完了・レポート merge 済み）
  - Epic #716 DoD 3 行目のチェック更新
  - #1512 残件の画面別子 Issue 起票（`section:<id>` 付き）
  - chat-main memory の desktop 配布ブロック更新（#1348 / #1360 / #1506 merged）と 👀 リストの Connect グラフ / #524 / #512 行の除去

置いた仮定: 「実装 Issue」は `type:bug` / `type:feature` を指し、`[main]` の `type:task` はラベル欠落の対象外としました。ファイルは 1 つも書いていません。

<!-- run: night-safe / 2026-09-12 22:38 / log: night-safe-2026-09-12_2233.log -->
## 2026-09-12 22:37 Night Safe Run

- Elapsed: 4 min / 45 min（スキップなし。Supabase `list_migrations` は無人用 permissions で拒否され未検証。`git status` の再取得も拒否されたため、追跡状態は起動時スナップショットで判定）
- docs 整合: 検出 4 件
  1. `.claude/automation/routine-night-safe.md:3` と `routine-digest.md:3` / 矛盾 = 両ヘッダーが「Task Scheduler への登録はまだ」のままだが、`routine-ids.md:12-13` は 2026-09-02 に ACTIVE 登録済みで、この報告自体が無人発火の実績 / 修正案 = 2 ファイルの注記を「登録済み（2026-09-02・台帳 = routine-ids.md）」へ差し替える 1 行 PR（09-02 走から 10 日間未処理）
  2. `.claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md` / 矛盾 = Status: Draft の計画書が main の working tree で git 未追跡（`??`）のまま 10 日経過。派生 INDEX に乗らず他チャットから見えない / 修正案 = chat-main が commit するか削除を裁定する（09-02 走から未処理）
  3. `.claude/memory/chat-main.md:24` / 矛盾 = Loop Engineering ブロックの「現在」が 2026-09-02 時点の「残りは全部ユーザー手番 = 手動 1 回 / `schtasks` 登録 / ACTIVE 化」のまま。`routine-ids.md` は同日に登録完了・#1335 の 09-09 コメントは「night の登録は 09-16 以降に判断」 / 修正案 = 次回 task-tracker で「Phase 1 の 2 本は稼働中・残 = night レーン（09-16 以降）」に更新
  4. `.claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md:2` / 矛盾ではなく追随漏れ候補 = Step 6（PR #1589）は 2026-09-12 に MERGED だが Status は IN PROGRESS のまま、Worklog は 09-09 で止まり、AC の Step 4（`/health`）/ Step 5（スマホから 1 本成功）が未チェック / 修正案 = Step 3〜5 の人手ゲートが済んでいれば Worklog + AC を埋めて COMPLETED → archive、未了なら Status 行に「残 = Step 3〜5（🛑 人手）」を明記する
  - 参考: CLAUDE.md からの参照先ファイル（プロジェクト内 42 本 + known-issues 027 / 030）はすべて存在。plans の Status enum 違反はゼロ。移行 SSOT の Remote MCP 行（:81）は D-20260909 で更新済みで整合。起動時スナップショットに未追跡の `decisions/D-20260912-main-1.md` / `docs/design/briefs/connect-relations.md` / `docs/reports/2026-09-12-*.html` 2 本があるが、chat-main の当日作業中と見て検出には数えていない
- Issue 台帳: 検出 4 件
  1. **#1512 close 漏れ（確定）**: 09-09 のユーザー裁定は「#1578 が着地したら close」。#1578 は CLOSED・PR #1585 は 09-12 MERGED・子 Issue #1557〜#1562 も全部 CLOSED。shared-fix の memory によれば `gh issue close` が auto mode の分類器に止められて未実行 → chat-main の手番
  2. **#1301 close 漏れ候補**: 09-09 の chat-main コメントが「DoD 全項目が埋まりました」と宣言（arm64 dmg / macos ジョブ / docs-lint / Mac 実機 / README / $0）。本文の DoD チェックボックス 6 個は全部未チェックのまま open。修正案 = チェックを付けて close（draft Release の公開判断は #1300 側か計画書で追う）
  3. **#1300 の DoD チェックボックスが未追随**: 7 項目中 6 項目は 09-09 コメントで ✅ 済みだが本文は全部未チェック。open 自体は正しい（残 = Windows 実機の実アカウントログイン + Todo CRUD）。修正案 = 6 個にチェックを付け、残 1 項目が一目で分かる状態にする
  4. **Epic #716 の DoD 行「`mobile-scope.md` と実装が食い違っていない」が未チェック**（09-06 走の再掲・未処理）。#1409 の照合と PR #1545 で埋まっている。残りは実機目視 1 行のみ
  - 参考: Epic #1121 は子 4 件すべて CLOSED・チェック済み。DoD の「スキップ・中断・再開」は #1583（PR #1594・09-12 MERGED）でスキップの挙動が変わったので、Epic の実機確認は #1594 後の main で行う。#1335 は「night 登録は 09-16 以降」と本人コメントがあり意図的 open。新規 #1592 / #1593 は `shared-fix` 付きで routing 済み。ラベル欠落の実装 Issue はゼロ（section / shared-fix のどちらも無い open は #1335 の `[main]` task 1 件のみ）
- PR conflict: 0 件（open PR そのものが 0 本。09-12 に 12 本が merge され全部着地）
- 検証準備: 変化 4 件
  1. **🛑 migration 0030 の適用確認が最優先**: PR #1603（#1580）が 09-12 08:57 に MERGED。`0030_wiki_tag_assignment_display_color.sql` の `created_at` / `is_display_color` は `wikiTagAssignmentMapper.ts:44` の SELECT 一覧に入っており、未 push のまま main を動かすと `listAllTagAssignments` が PostgREST 42703 で落ちて**タグを使う画面が全部**（Schedule レンズ / Connect / Notes 絞り込み）巻き添えになる（migration ファイル冒頭の MERGE ORDER 注記どおり）。`list_migrations` が拒否され適用済みかは未確認 → 翌朝の最初に `supabase migration list` か Schedule の表示で確かめる。0029（#1456・09-05 時点で未適用）も同じく未確認
  2. **実行可能になった実ブラウザ確認（09-12 merge 分）**: Connect #1578（390 幅で絞り込み枠の上端 4px 下をタップして input にフォーカスが入るか）/ Schedule #1582（月ビューでパネルを開いても grid が再描画されない体感）/ #1584（+ ボタン 28px の押しやすさ・Issue の「44px 未満にしない」から外した判断の追認）/ #1581（375px で月セル 88px + 4 行）/ #1580（タグ色の塗り分けと表示色タグの選択）/ shared-fix #1583（ツアーの「スキップ」が 1 歩だけ進み、「ツアーを終了」が別ボタンで出る）/ Materials #1579（表入りノートが MCP 経由で開く）
  3. **Mac 実機が要る新規項目**: #1590（PR #1595）の traffic light ドラッグ帯は Windows 機からは `desktop/tests/macTitleBar.test.ts` でしか検証できない。次に Mac を開くときの目視リストへ追加
  4. **前提が変わって消せる項目**（09-06 走の再掲・未処理）: `chat-main.md:116` の W4「Connect グラフ表示・ノードクリック遷移」と `:102` の #524 は力学グラフ退役（#1152）で対象が無い。`:110` の #512 も close 済み
- 修正が必要なもの → 起票依頼（chat-main が翌朝裁く）
  - migration 0029 / 0030 の `supabase db push` 適用状況の確認（未適用なら即 push。タグ画面全滅の回避）
  - #1512 / #1301 の close（どちらも本人コメントで完了宣言済み）
  - #1300 / #1301 / Epic #716 の DoD チェックボックス更新
  - routine-night-safe.md / routine-digest.md の「登録はまだ」注記を訂正する docs PR（3 走連続で未処理）
  - 未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` の commit or 削除の裁定（3 走連続で未処理）
  - `2026-09-09-remote-mcp-mobile.md` の Worklog / AC / Status 追随（Step 3〜5 の人手ゲートの実施有無を記録）
  - chat-main memory の Loop Engineering ブロック更新と 👀 リストの Connect グラフ / #524 / #512 行の除去

置いた仮定: 「実装 Issue」は `type:bug` / `type:feature` を指し、`[main]` の `type:task` はラベル欠落の対象外としました。ファイルは 1 つも書いていません。

<!-- run: night-safe / 2026-09-13 22:37 / log: night-safe-2026-09-13_2233.log -->
監査 4 タスクが完了しました（経過 3 分）。Supabase の migration 一覧は今回も無人用の許可で拒否されたので未検証として載せます。ファイルは 1 つも書いていません。以下が最終報告です。

## 2026-09-13 22:36 Night Safe Run

- Elapsed: 3 min / 45 min（スキップなし。Supabase `list_migrations` と `gh api` は無人用 permissions で拒否され未検証。`gh pr view` / `gh issue view` 形式で代替した）
- docs 整合: 検出 5 件
  1. `.claude/automation/routine-night-safe.md:3` と `routine-digest.md:3` / 矛盾 = 両ヘッダーが「Task Scheduler への登録はまだ」のままだが、`routine-ids.md:12-13` は 2026-09-02 に ACTIVE 登録済みで、この報告自体が無人発火の実績 / 修正案 = 注記を「登録済み（2026-09-02・台帳 = routine-ids.md）」へ差し替える 1 行 PR（**4 走連続で未処理**）
  2. `.claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md` / 矛盾 = Status: Draft の計画書が git 未追跡（`??`）のまま 11 日経過。派生 INDEX に乗らず他チャットから見えない / 修正案 = chat-main が commit するか削除を裁定する（**4 走連続で未処理**）
  3. `.claude/memory/chat-main.md:13` / 矛盾 = Desktop 配布ブロックが「docs 追随 = PR #1565 open」だが #1565 は 2026-09-07 に MERGED。`:24` の Loop Engineering ブロックも「残りは全部ユーザー手番 = schtasks 登録 / ACTIVE 化」のまま（09-12 走の再掲） / 修正案 = 次回 task-tracker で 2 ブロックを実態へ更新
  4. `.claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md:2` / 矛盾 = Step 6（PR #1589）は 09-12 MERGED だが Status は IN PROGRESS のまま、AC の Step 4（`/health`）/ Step 5（スマホから 1 本成功）が未チェック、Worklog は 09-09 で停止（09-12 走の再掲） / 修正案 = Step 3〜5 の人手ゲートが済んでいれば AC を埋めて COMPLETED → archive、未了なら Status 行に「残 = Step 3〜5（🛑 人手）」を明記
  5. `.claude/docs/requirements/mobile-scope.md:58`（#16 行） / 矛盾 = 「header=wide 専用の `HeaderUndoRedo`」のままだが #1035 以降は狭幅ヘッダーにも同じ部品が出る（09-02 走から未処理・**Epic #716 close の最後の docs ゲート**） / 修正案 = 「その他シート + 狭幅ヘッダーの両方（#1035）」へ書き換え
  - 参考: CLAUDE.md からの参照先ファイルはプロジェクト内 52 本すべて存在（`lead-pipeline` は repo 内に無いが、グローバル skill として読み込まれているので dead path ではない）。plans 14 本の Status enum 違反はゼロ。`2026-07-28-loop-engineering-harness.md` と `2026-08-30-desktop-app-packaging.md` の Status 行は実態と一致。起動時スナップショットに chat-main の未追跡 5 本 + 修正 2 本（`decisions/D-20260912-main-1.md` / `briefs/connect-relations.md` / `reports/2026-09-12-*.html` 2 本 / briefs 2 本の修正）が 09-12 から残っている。D ファイルが未追跡だと台帳の派生 INDEX にも他チャットにも見えないので、作業中でなければ commit 対象
- Issue 台帳: 検出 1 件
  1. **Epic #716 の DoD 行「`mobile-scope.md` と実装が食い違っていない」が未チェック**（4 走連続の再掲）。上の docs 5 を直せば残りは狭幅の実機目視 1 行だけ
  - 参考: 前回までの起票依頼のうち **#1512 / #1301 / #1300 / #1408 / #1409 の close は処理済み**（open 一覧 7 件に不在）。close 漏れ 0 件（本日 merge 9 本の対象 #1592 / #1593 / #1606 / #1608 はすべて CLOSED）。Epic #1121 は子 4 件 `[x]`・DoD の実機通しツアーが未消化のため open は正しい。新規 #1615（remoteRegistry テストが Windows で落ちる）は `shared-fix` で routing 済みで、PR #1617 本文が指す同じ失敗の受け皿になっている。ラベル欠落の実装 Issue はゼロ（`section:` / `shared-fix` どちらも無い open は #1335 の `[main]` task 1 件で、night 登録を 09-16 以降に再判断する意図的 open）
- PR conflict: 1 件
  - **PR #1617**（materials / #1607 リンクブロック）= `CONFLICTING`（mergeStateStatus DIRTY）。base `a8b2edb4`（= #1611 の merge commit）以降に入った **PR #1612（添付チップの全幅化 + 削除ボタン）と 5 ファイルが重複**: `shared/src/i18n/locales/en.json` / `ja.json` / `web/src/index.css` / `web/src/notes/RichTextEditor.tsx` / `web/tests/taskListCheckboxSize.test.ts`。#1616（Settings の Claude カテゴリ）も en / ja.json に 1 行ずつ足している。**確実に手作業になるのは `index.css`** — 両 PR が 114〜117 行を同じ場所に足し、#1617 本文が「chip の CSS を意図的に複製した・両方着地したら 1 本に畳む」と宣言しているので、rebase 時にそのまま畳むのが筋。`RichTextEditor.tsx` は登録 1 行ずつ、テストは同型の +9/-2 変更で自動解決の可能性がある。**rebase 要・担当 = materials-refine レーン**（本レーンでは未実行）。#1618（materials の tracker PR）は MERGEABLE
- 検証準備: 変化 4 件
  1. **🛑 migration 0029 / 0030 の適用確認は依然として未検証**（09-12 走の再掲）。0030 未適用のまま main を動かすとタグを使う画面が全滅するので、翌朝の最初に `supabase migration list` で確認
  2. **本日 merge で実ブラウザ確認が可能になった 5 件**: #1606（添付チップが本文列と同じ幅で、削除ボタンが 44px。390 / 1280 の両方）/ #1608（予定のバブルがクリック直後に開き 350ms 待たない）/ #1616（Settings に Claude の独立カテゴリが出る）/ #1593（同じタグを外して付け直しても `wiki_tag_assignments` に dead 行が積まれない = DB 側で行数を数える）/ #1592（平文の旧 daily を MCP が読み書きできる = `get_daily` / `upsert_daily` の 1 往復）
  3. **#1617 は merge 後に #1606 との見た目比較が要る**: PR 本文の採寸表は #1612 を再生した harness 上の値で、両方が main に乗った状態では未計測
  4. **前提が変わって消せる項目**（09-06 走から再掲・未処理）: `chat-main.md:116` の W4「Connect グラフ表示・ノードクリック遷移」と `:102` の #524 は力学グラフ退役（#1152）で対象が無い。`:110` の #512 も close 済み
- 修正が必要なもの → 起票依頼（chat-main が翌朝裁く）
  - PR #1617 の rebase 指示を materials-refine レーンへ（`index.css` の重複 CSS を 1 本に畳む方針込み）
  - migration 0029 / 0030 の `supabase db push` 適用状況の確認（未適用なら即 push）
  - `mobile-scope.md` #16 行を #1035 の実装へ追随する docs PR（Epic #716 close の最後の docs ゲート）→ 続けて Epic #716 の DoD チェック更新
  - routine-night-safe.md / routine-digest.md の「登録はまだ」注記を訂正する docs PR（4 走連続）
  - 未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` と 09-12 の未追跡 5 本（D-20260912-main-1 ほか）の commit or 削除の裁定
  - `2026-09-09-remote-mcp-mobile.md` の AC / Worklog / Status 追随（Step 3〜5 の人手ゲートの実施有無を記録）
  - chat-main memory の Desktop 配布ブロック（#1565 merged）と Loop Engineering ブロックの更新、👀 リストの Connect グラフ / #524 / #512 行の除去

置いた仮定: 「実装 Issue」は `type:bug` / `type:feature` を指し、`[main]` の `type:task` はラベル欠落の対象外としました。Epic #1121 の子 4 件の CLOSED は open 一覧に不在であることを根拠にしました（`gh api` 拒否のため個別照会は未実施）。禁止事項（commit / push / PR / rebase / merge・Issue への書き込み・コード / docs の修正・他チャットの記録への書き込み・`.session-name` の書き換え）はすべて未実施で、ファイル書き込みも 0 件です。

<!-- run: night-safe / 2026-09-17 22:35 / log: night-safe-2026-09-17_2233.log -->
## 2026-09-17 22:33 Night Safe Run

- **Elapsed:** 2 min / 45 min。スキップしたタスクはありません。

- **docs 整合: 4 件**（CLAUDE.md からリンクされた主要ファイル約 40 本はすべて存在します。退役済みの `shared/src/components/tagEdit/` と `web/src/tags/TagEditorHost.tsx` も、記述どおり消えています）
  1. `docs/vision/plans/2026-09-16-schedule-refactor.md:2` の Status が `Draft` のままです。工程 1 の PR #1653 と工程 2 の PR 5 本（#1655 / #1656 / #1658 / #1660 / #1661）は 2026-09-16 に merge 済みです。修正案は、Status を `IN PROGRESS` にして残り（W3 以降と工程 3）を併記することです。
  2. `automation/routine-night-safe.md:3` に「Task Scheduler への登録はまだ」と書かれています。一方 `automation/routine-ids.md:13` では、night-safe は 2026-09-02 から `ACTIVE` です。修正案は、3 行目を「2026-09-02 登録済み（台帳 = routine-ids.md）」に書き換えることです。
  3. `docs/vision/plans/2026-09-02-fable-51-harness-retune.md`（Status: Draft）が、メインの作業ツリーで未追跡のまま置かれています。PR もありません。修正案は、docs PR で main に入れるか、不要なら退けるかを chat-main が決めることです。
  4. `memory/chat-main.md` の Loop Engineering 行（INDEX:12 に反映）は、残りを「手動 1 回 / schtasks 登録 / ACTIVE 化 = ユーザー手番」としています。3 つとも 2026-09-02 に済んでいます。修正案は、次の tracker 更新で「残 = night レーン登録の再判断」に置き換えることです。

- **Issue 台帳: 2 件**
  1. Epic #1121 は、子 Issue 4 件（#1122〜#1125）のチェックがすべて付いたまま open です。修正案は、Epic の DoD（完走・スキップ・再開・ja/en）の確認記録を残して close することです。
  2. #1335 は、digest と night-safe の 2 本が 2026-09-02 に登録済みなのに open のままです。残っているのは night レーンの登録で、再判断の期日（2026-09-16 以降）はもう来ています。修正案は、close するか、night レーン分へ切り直すかを chat-main が決めることです。
  - 非該当の確認: ラベル欠落の候補だった #1671 と #1335 は `[main]` 宛の作業 Issue です。実装 Issue ではないので、指摘から外しました。Epic #716 の残り 2 項目はユーザーの手番で、変化はありません。

- **PR conflict: 0 件**（open の PR が 0 本です）

- **検証準備: 変化 6 件**
  1. `chat-main.md:112` の #512 は close 済みです。行ごと消せます。
  2. `chat-main.md:102-104` の #524 は close 済みです。Connect グラフ自体も #1152 で退役したので、節ごと消せます。
  3. `chat-main.md:118` の W4「Connect グラフ表示・ノードクリック遷移」は、#1152 の退役で確認する前提が無くなりました。テーマとチャートの確認だけを残せます。
  4. `chat-main.md:119` の Phase 3 Electron「`build:mac` で DMG」は、packaging 計画 Step 8 で 2026-09-07 に実機受け入れを通っています。済みとして消せます。
  5. `chat-main.md:123` の W1/W2「Trash 5 カテゴリ」は、#1293 で入口が Settings 配下に移りました。確認手順の入口を書き換える必要があります。
  6. 新しく実行できるようになった確認があります。PR #1657（#1643）が merge されたので、Connect の 1440×900 light/dark 確認ができます。#1642 工程 2 の 5 本も merge されたので、Schedule の実ブラウザ検証（工程 3 の一部）と #1671 にも着手できます。

- **起票依頼:** 新しい起票はありません。上の docs 4 件と Issue 2 件は、chat-main が翌朝に裁く対象です（修正・close ともこのレーンでは実行していません）。

<!-- run: night-safe / 2026-09-20 22:41 / log: night-safe-2026-09-20_2234.log -->
## 2026-09-20 22:41 Night Safe Run

- Elapsed: 6 min / 45 min（スキップなし。タスク 1〜4 すべて実施）
- docs 整合: 検出 8 件
- Issue 台帳: 検出 2 件
- PR conflict: 0 件（open PR が 0 本。最新は #1789 で全部 merged のため CONFLICTING は存在しない）
- 検証準備: 変化 3 件

### docs 整合（8 件）

1. `automation/routine-night-safe.md:3` — 「**Task Scheduler への登録はまだ**」と書いたまま。実態は `automation/routine-ids.md:13` が ACTIVE / Registered 2026-09-02 で、本走が 22:33 枠で発火している。修正案: 当該文を「2026-09-02 に `LifeEditor-NightSafe` として登録済み（台帳 = `routine-ids.md`）」へ置換。
2. `docs/vision/plans/2026-09-16-schedule-refactor.md:472-474` — §5-2 の state 列が #1747 / #1663 / #1678 を **OPEN** と表示。3 件とも CLOSED（`gh issue list --state all` で実測）。修正案: state 列を CLOSED に引き直し、引き直し日を 2026-09-20 に更新。
3. 同ファイル `:555` — References 行が「#1663 / #1678（どちらも open）」。同じく CLOSED。修正案: 括弧を「どちらも close 済み」に。
4. 同ファイル `:487` — AC「PR が #1642 を参照して open になっている」が未チェック。工程 1 の PR #1653 は merge 済み（open PR 0 本）。修正案: `[x]` にして「PR #1653 merged」を添える。
5. `docs/vision/plans/2026-08-10-core-refactor.md:36-38` — 見出し「#587 は実装着地済み（close 待ち）」と本文「Issue だけが open のまま残っている」。#587 は 2026-08-12 に CLOSED。修正案: 見出しを「#587 は close 済み（2026-08-12）」に変え、本文の「open のまま」を削る。
6. `CLAUDE.md` §6 — 「Web/Mobile UI デザインの追跡正本 = Epic #321 + mobile-scope.md + Issue 群」。#321 は 2026-08-12 に CLOSED で、閉じた Epic を正本として指している。修正案: #321 を履歴注記（2026-08-12 close）に落とし、生きている正本を `mobile-scope.md` + Issue 群に絞る。
7. `docs/vision/plans/2026-09-02-fable-51-harness-retune.md` が git 未追跡（`Status: Draft`）。`plans/` に置いてあるので他チャットの視界に入らない。修正案: chat-main が docs PR で追加する。意図的な下書きなら非追跡の置き場へ移す。
8. `.gitignore:12-13` が「Claude HTML report views（derived, not tracked）」として `.claude/reports/` だけを無視しているが、実際のレポートは `.claude/docs/reports/` にあり、そこは tracked 4 本 + untracked 4 本で割れている。修正案: 追跡するなら宣言文を直す。しないなら `.claude/docs/reports/*.html` を ignore に足す。どちらにするかは判断が要る。

### Issue 台帳（2 件）

1. **#1335 は DoD 3 項目すべて達成済みで close 候補**。(a) 夜間発火の実走 = 本走そのもの (b) `routine-ids.md` の PENDING は ACTIVE へ解消済み (c) plans 3 本の Status に登録済みの記載あり。残っている `night` レーン登録は DoD に無く「やること」1 にしか書かれていないので、続けるなら別 Issue に切る。
2. **Epic #1121 は子 Issue 4 件すべて `[x]` + CLOSED**。残条件は DoD の実機完走 1 回だけで、本文からその 1 行が読み取れない。修正案: 本文に「残 = 実機完走 1 回（👀）」を足すか、確認後に close。

ラベル欠落は 0 件です。open 6 件のうち `section:<id>` も `shared-fix` も持たないのは #1335 だけで、これは Task Scheduler 登録 = 環境タスクなので実装 Issue の対象外です。Epic #1121 の `[all]` prefix も違反ではありません（`docs-workflow` SKILL.md:44 が Epic を明示的に許可）。

### 検証準備（3 件）

1. **実行可能になった項目 = Epic #1121 の通しツアー完走 1 回**。2026-09-20 に #1748（PR #1757）が merge され、Todo の 3 ステップが飛ばされる原因が消えました。これまで完走できなかった経路が通るので、狭幅の実機目視と同時にやれます。
2. **前提が変わった項目 = `memory/chat-main.md:13-14`**。行 13 の「docs 追随 = PR #1565 open」は 2026-09-07 に merged。行 14 の「ユーザー手番 2 つ」の ① tag push は 2026-09-09 に消化済みで #1300 / #1301 とも CLOSED です。残るのは Windows 実機での実アカウントログイン + Todo CRUD と、draft Release の公開判断の 2 つ。
3. **全レーン共通の滞留**。open PR が 0 本になったのに、複数レーンの memory が「PR #xxxx open」と書いたままです（connect-refine の #1751 / #1743 / #1735、materials-refine の #1754 / #1724 / #1713 ほか、shared-fix の #1757 / #1697 / #1702 / #1704、schedule-refine の #1655 系）。`rules/docs-consistency.md` §4 の「merge 済み PR を open と主張し続けない」に当たります。単一書込者原則で他チャットの memory は触れないため、各レーンの task-tracker 更新が必要です。

### 起票依頼（chat-main が翌朝裁く）

- **A**: #1335 の close（DoD 3 項目の実測つき）と、`night` レーン登録を別 Issue に切るかの判断
- **B**: docs 整合 1〜5 を 1 本の docs PR で直す
- **C**: CLAUDE.md §6 の Epic #321 参照更新（docs 整合 6）
- **D**: HTML レポートを追跡するかの裁定と `.gitignore` 追随（docs 整合 8）
- **E**: Epic #1121 の残条件を本文へ明記、または実機完走 → close
- **F**: 未追跡の計画書 `2026-09-02-fable-51-harness-retune.md` の扱い（docs 整合 7）

ファイルは 1 つも書いていません。scope drift はありません。

<!-- run: night-safe / 2026-09-21 22:35 / log: night-safe-2026-09-21_2233.log -->
## 2026-09-21 22:33 Night Safe Run

- **Elapsed**: 約 2 min / 45 min（スキップしたタスクはありません。ファイルは 1 つも書いていません）

- **docs 整合**: 検出 3 件
  - `.claude/automation/routine-night-safe.md:3` / 冒頭に「Task Scheduler への登録はまだ」とありますが、`routine-ids.md:13` は night-safe を 2026-09-02 から ACTIVE としていて、`2026-07-28-loop-engineering-harness.md` の Status 行も登録済みと書いています / 修正案 = 冒頭の注記を「2026-09-02 登録済み・残るのは `night` レーンの登録判断（#1335）」に差し替える
  - `.claude/CLAUDE.md` §6 / 「Web/Mobile UI デザインの追跡正本 = Epic #321」とありますが、#321 は CLOSED です / 修正案 = 「Epic #321（完了）」と注記するか、現行の追跡先（`mobile-scope.md` + `section:*` の Issue 群）だけに絞る
  - 各レーンの `memory/chat-*.md` / 「PR #xxxx open」の記述が 15 本以上残っていますが、open PR は 0 件です。実測で #1416 / #1420 / #1443 / #1456 / #1539 / #1565 / #1569 / #1609 / #1610 / #1653 / #1655 / #1656 / #1658 / #1660 / #1661 はすべて MERGED でした / 修正案 = 各レーンが次回の tracker 更新で「merged」へ書き換える（単一書込者のため chat-main からは触らない）
  - plans 16 本の Status 行と、CLAUDE.md が参照するファイル 41 本の存在確認は異常なしです。`tagEdit/` と `TagEditorHost.tsx` が無いのは #1643 の削除どおりです

- **Issue 台帳**: 検出 3 件
  - Epic #1121（チュートリアル）/ 子 Issue 4 本が全部 [x] で、最後に残っていた判断（Escape 再開で 4/10 に戻る）も #1773 = PR #1777 が 2026-09-20 に merge 済みです / close 候補として chat-main の判断を依頼します
  - #1335 / タイトルが「登録が未実施」のままですが、digest と night-safe は登録済みで、残りは `night` レーンの再判断（2026-09-26 以降）だけです / タイトルを実態に合わせる改名を提案します
  - #1335 / `section:<id>` も `shared-fix` も付いていません。`area:tooling` の chat-main 宛てなので実害はなく、規約上の例外として扱うかだけ確認をお願いします
  - 2026-09-21 起票の #1820〜#1877 は 58 件ともラベルが揃っていました

- **PR conflict**: 0 件（open PR が 0 件のため対象なし）

- **検証準備**: 変化 5 件（`memory/chat-main.md` の「ユーザー実機目視待ち」節）
  - #512 コマンドパレットの上余白 / リストは「open」と書いていますが、Issue は CLOSED（COMPLETED）です。項目を消せます
  - W4「Connect グラフが実データで空でない」/ 力学グラフは 2026-08-29 に退役（#1152）したので確認対象が存在しません。同じ節の上にある #524（グラフの選択解除）のメモも、Issue が CLOSED でグラフも無いため不要です
  - Phase 3 Electron「`build:mac` で DMG」/ 2026-09-07 の macOS 実機受け入れ（Step 8）で消化済みです
  - 宣言 AC6 / 記録 Issue #374 が CLOSED です。確認が済んでいるなら項目を消せます
  - W3-0「⌘1-5 section」/ 今日起票の #1849（Ctrl+5 が何も起きない）と重なります。目視するなら #1849 の修正後がよいです

- **起票依頼**（chat-main が翌朝に裁く分）
  1. Epic #1121 の close 判断
  2. #1335 のタイトル改名（`night` レーン登録の再判断へ）
  3. `routine-night-safe.md` 冒頭注記と CLAUDE.md §6 の Epic #321 参照の docs 修正（小 PR 1 本で足ります）
  4. `memory/chat-main.md` の実機目視待ち節から上の 4 項目を整理

**補足**: Gmail / Linear / plugin:engineering の各 MCP（asana / atlassian / datadog / github / pagerduty / slack）は未認証です。今回の監査では使っていませんが、使うなら対話セッションの `/mcp` か claude.ai のコネクタ設定で認可が要ります。

<!-- run: night-safe / 2026-09-22 22:38 / log: night-safe-2026-09-22_2233.log -->
## 2026-09-22 22:38 Night Safe Run

- Elapsed: 5 min / 45 min（スキップしたタスクなし）
- docs 整合: 検出 6 件
- Issue 台帳: 検出 2 件
- PR conflict: 0 件（open 6 本すべて `MERGEABLE` かつ CI SUCCESS = #1949 / #1948 / #1947 / #1946 / #1941 / #1935）
- 検証準備: 変化 3 件

### docs 整合（6 件）

1. **夜間レーンの手順書 `automation/routine-night-safe.md:3`** / 「Task Scheduler への登録はまだ」と書いてあるが、登録台帳 `automation/routine-ids.md:13` は 2026-09-02 から ACTIVE で、この報告自体が 22:33 の自動発火で走っている / **修正案**: 冒頭の注記を「2026-09-02 に `LifeEditor-NightSafe` として登録済み（ACTIVE）」に書き換える。**3 週間前から 3 走連続で同じ指摘が出ている**（`history/chat-main.md:106` に起票依頼のまま未処理と記録あり）
2. **朝の采配ダイジェストの手順書 `automation/routine-digest.md:3`** / 同じく「Task Scheduler への登録はまだ」だが台帳は ACTIVE（06:03 枠）/ **修正案**: 1 と同じ文面に揃える
3. **モバイル対応範囲の正本 `docs/requirements/mobile-scope.md:59`** / 「header = wide 専用の `HeaderUndoRedo`」と書いてあるが、`web/src/MainScreen.tsx:298-304` が狭幅の shell にも同じ部品を `actions` として渡しており、狭幅ヘッダーにも元に戻すボタンが出る / **修正案**: #16 行の備考を「狭幅ヘッダーにも同じ `HeaderUndoRedo` が出る（`MainScreen.tsx:304`）。『その他』シートの行と 2 系統ある」に直す
4. **Desktop 配布の計画書 `plans/2026-08-30-desktop-app-packaging.md:183`** / 受け入れ条件「Release に arm64 `.dmg` と `.exe` が載る」が未チェックのまま。同じファイルの Status 行は 2026-09-09 に両方が draft Release に乗ったと実測を書いている / **修正案**: 183 行を `- [x]` にする。追跡していた #1300 / #1301 は 2026-09-13 に close 済みなので、残り 2 点（Windows 実機ログイン・draft 公開判断）だけを残す形に Status を整理する
5. **スマホから MCP を叩く計画書 `plans/2026-09-09-remote-mcp-mobile.md:2`** / Status が理由なしの IN PROGRESS。実装の PR #1589 は 2026-09-12 に merge 済みで、残る未チェックは実機確認 2 件（`/health` の応答・スマホの Claude からツール 1 本成功）だけ / **修正案**: Status 行に「残 = Step 4 / 5 の実機確認（こうだいさんの手番）」を書き足す
6. **未追跡のファイルが 7 つ残っている** / 作業ツリーの `.claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md`（Draft の計画書）と `.claude/docs/reports/` の HTML 5 本、リポジトリ直下の `shots/`（スクリーンショット 17 枚・約 2 MB）。`.gitignore` はどれも対象にしていないので、`git add -A` を打つと画像が commit に入る（CLAUDE.md §9 の「バイナリは repo に置かない」に触れる）/ **修正案**: `shots/` と `.claude/docs/reports/*.html` を `.gitignore` に足し、計画書は commit するか削除するかを決める。**計画書の件は 3 走連続の指摘**

なお CLAUDE.md が参照するファイル 42 本はすべて実在した（docs 23 本・コードと設定 19 本）。リンク切れはゼロです。

### Issue 台帳（2 件）

1. **#1121「[all] Epic: 初回ユーザー向け操作誘導チュートリアル」が close 候補** / 子 Issue 4 本（#1122 / #1123 / #1124 / #1125）は 2026-08-27〜08-29 にすべて close 済み。Epic の完了条件 4 つは実装済みに見える / **修正案**: 本文が「Briefing / work / connect / analytics は初回スコープ外（後続 Issue で追加）」と書いているので、後続分を別 Epic に切り出してから close する。`[all]` の使用は Epic なので規約違反ではない（`docs-workflow` SKILL.md:44）
2. **#1335「夜間ルーチンの Task Scheduler 登録が未実施」の完了条件 3 つが全部埋まっている** / 夜間発火の実走（この run）・台帳の PENDING 解消・計画書 3 本の Status 追随（`2026-07-28-loop-engineering-harness.md` / `2026-08-06-autonomous-operation-endpoint.md` / archive の `2026-05-26-autonomous-dev-routine.md` とも実態を反映済み）/ **修正案**: 残っているのは実装レーン（`night`）の登録だけなので、それを別 Issue に切り出してから #1335 を close する。あわせて #1335 は宛先ラベル（`section:` も `shared-fix` も）を持たない唯一の open Issue で、どのレーンの配布にも乗らない

close 漏れの誤検出を 2 件つぶしました。#1793（環境音の雑音）と #1858（作業画面の小さな 3 点）はどちらも対応 PR が merge 済みですが、PR 本文が `Refs` 止まりで「音源の差し替えが済むまで閉じない」「3 点目は判断キュー行き」と明記しています。open のままが正しいです。

### 検証準備（3 件）

1. **画面で見て確かめる作業が 84 本ぶん溜まっている** / 2026-09-20 以降に記録用を除いて 84 本の PR が merge された（画面監査由来の #1820〜#1876 / #1902 / #1903 系がほぼ全部）。`memory/chat-main.md` の「ユーザー実機目視待ち」節はこの波を 1 件も取り込んでいない / **次のアクション**: chat-main が merge 済み分を目視リストへ流し込む
2. **目視待ちリストの 1 項目は前提が消えている** / 「W4: つながり画面のグラフが実データで空でないこと」（`memory/chat-main.md:118`）を挙げているが、力学グラフは 2026-08-29 に #1152 で退役済み / **次のアクション**: この行を削除する
3. **同じ節が参照する #524 は 2026-08-02 に close 済み** / `memory/chat-main.md:102` が「起票済み・実ブラウザ確認が完了条件の先頭」と書いたまま。中身もグラフのノード選択なので 2 と同じく無効 / **次のアクション**: 取り消し線を引く

### 起票依頼（chat-main が翌朝裁くもの）

- 夜間レーンと朝の采配ダイジェストの手順書 2 本の「登録はまだ」注記を実態に合わせる（3 走連続の指摘・上記 1 / 2）
- モバイル対応範囲の正本の #16 行をコードに合わせる（上記 3）
- 未追跡ファイル 7 つの始末と `.gitignore` の追加（3 走連続の指摘・上記 6）
- Desktop 配布とスマホ MCP の計画書 2 本の Status を実態へ（上記 4 / 5）
- #1121 と #1335 の close 判断（後続分の切り出しが前提）
- #1335 に宛先ラベルを付ける

main 自体は健全です。09-22 に「main が赤い」修理 PR が 4 本（#1905 / #1906 / #1942 / #1945）入りましたが、open PR 6 本の CI がすべて SUCCESS なので復旧しています。

ファイルは 1 つも書いていません。
