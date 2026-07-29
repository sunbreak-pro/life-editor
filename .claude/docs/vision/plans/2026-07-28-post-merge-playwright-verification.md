---
Status: IN PROGRESS # 対象 PR が merge され次第 IN PROGRESS へ。全項目消化で COMPLETED → archive
Created: 2026-07-28
Branch: main # 検証のみ。コード変更なし
Owner-chat: main # chat-main とは別の「検証専用セッション」が実行する
Parent: 2026-07-28-open-issue-fanout.md
---

# Plan: fan-out merge 後の実ブラウザ検証（playwright MCP）

> fan-out 計画（Parent）で消化した Issue のうち **UI に出るもの**を、merge 後に main の検証専用セッションが playwright MCP で実測する。
> 実行のたびに本書のチェックボックスへ結果を記入する（pass = チェック / fail・スキップは行末に 1 行メモ）。

---

## 前提（検証セッションの約束事）

- 場所は **メインリポジトリ `C:\Users\user\orca\life-editor`・ブランチ `main`**（worktree ではない。playwright MCP + dev server は main のみ — CLAUDE.md §7.4）
- 開始前に `git pull --ff-only` → `gh pr list -R sunbreak-pro/life-editor --state merged --limit 20` で**対象 Issue の PR が merge 済みかを確認し、merge 済みの項目だけ検証する**（未 merge はスキップと記録。ブランチ差分での判定は禁止 — squash merge は未マージに見える）
- `cd web && npm run dev` をバックグラウンド起動し、起動ログに出た localhost URL（vite 既定 5173）を playwright MCP で開く
- このセッションは**コード変更をしない**。書き込みは本書への結果記入と、fail の Issue 起票（`issue-dispatch`）だけ
- アプリ内で作った検証用データ（タスク・宣言など）は検証後に片づける

---

## 検証項目（V1〜V10。各項目の仕様正本 = Issue body）

### V1. #427 未宣言の日に「保存済み」が出ない（briefing）

- 前提: 今日の宣言（intention）が未保存であること（保存済みなら翌日に回すか、この項目だけ持ち越す）
- 手順: Briefing を開き朝刊・夕刊を切り替える → 宣言を保存する → 再確認
- [x] 未宣言の間は朝刊・夕刊とも「保存済み」キャプションが出ない — 2026-07-28 実測 pass（朝刊 = 見出しのみ / 夕刊 = 宣言セクション自体が非表示。夕刊の「保存済み」表示は reflection 欄のもので対象外）
- [x] 宣言を保存した後は従来どおりキャプションが出る — 2026-07-28 実測 pass（保存後「保存済み」出現・空に戻すと再び消える）

### V2. #410 編集ボタンの形と右端揃え（briefing）

- 手順: Briefing の「予定」「今日のやること」にタイトル長の違う行を 2 本以上用意して見比べる（夕刊側の同型行も）
- [x] ボタンが「アイコン＋編集」の形になっている — 2026-07-28 二巡目 pass（PR #439 merge 後に実測。svg アイコン + 可視「編集」+ title ツールチップ「スケジュールで開く」）
- [x] タイトルの長さに関わらずボタンが右端で揃っている（x 座標が一致）— 2026-07-28 二巡目 pass（長短 2 行で右端 x=1821px が完全一致・`ml-auto` 適用・ルーチンタグはタイトル隣に残置）

### V3. #408 Routines タブ廃止と繰り返し一覧パネル（schedule)

- 手順: Schedule を開く → rightSidebar のボタンから繰り返し一覧パネルを開く → Calendar の編集パネルで繰り返しの新規作成・編集・解除を 1 周
- [x] ヘッダーに Routines タブが無い — 2026-07-28 三巡目 pass（PR #452 merge 後に実測。ヘッダーは Day / Week / Month のみ）
- [x] rightSidebar から繰り返し一覧パネルが開き、既存の繰り返しが並ぶ — 2026-07-28 三巡目 pass（Details パネルに Today's flow / Today's Todo / Repeats の 3 タブ。Repeats に既存 4 件 + Today's flow 側にも My routines 要約と「Open the Repeats tab →」導線）
- [x] Calendar 編集パネルだけで繰り返しの新規・編集・解除が完結する — 2026-07-28 三巡目 pass（V6検証テスト イベントで None→Daily→Weekdays（曜日チップ編集）→None を 1 周。Repeats 一覧も即追随・検証イベントは削除済み）

### V4. #411 Todo タブの移設と導線の追随（schedule / materials）

- 手順: 両セクションのタブ構成を確認 → ノート本文の `[[タスク名]]` リンクをクリック → nav ショートカット / コマンドパレットで「タスクへ」を実行
- [ ] Materials のタブが Notes / Daily の 2 つになっている — スキップ（#411 open・PR 未作成。実測時点では Materials = Todo / ノート / デイリーの 3 タブ）
- [ ] Schedule のタブが Calendar / Todo の 2 つで、Todo タブに従来の Kanban が出る — スキップ（同上）
- [ ] `[[` リンク（task role）の着地先が Schedule の Todo になっている — スキップ（同上）
- [ ] nav ショートカット・コマンドパレット経由のタスク導線も Schedule に着地する — スキップ（同上）

### V5. #412 タスクへのタグ付け外し（tags）

- 手順: タスクの詳細編集面でタグを付ける → 外す → リロードして保持を確認。ノート詳細の既存 TagPicker も 1 回操作
- [x] タスク詳細からタグの付け外しができ、リロード後も保持される — 2026-07-28 実測 pass（test2 に Hello を付与→リロード保持→除去→リロード保持。カンバンのタグ列にも即反映）
- [x] ノート側の TagPicker が従来どおり動く — 2026-07-28 実測 pass（ノート「テスト2」で newTag 付け外し・サイドバーのタググループ即追随）
- [x] タグ表示にアイテムの種類が分かる手掛かりがある — 2026-07-28 実測 pass（タスク詳細に「タスク」・ノート詳細に「ノート」のロールバッジ）

### V6. #434 変換中の pending 表示（schedule）

- 手順: Calendar でイベントを繰り返しに変換し、変換中に頻度セグメントを連打する
- [x] 変換中はセグメントが pending / disabled と分かる見た目になり、連打しても二重変換されない — 2026-07-28 三巡目 pass（PR #450 merge 後に実測。Daily クリック直後に「Turning on repeat…」キャプション + 他セグメント disabled を確認。Weekdays を 2 連打しても Daily のまま・Repeats 一覧にも 1 件のみ）
- [x] attach 失敗時の toast はユニットテスト担保とし、実ブラウザでの失敗再現はスキップ可（スキップ時はその旨記入）— 2026-07-28 三巡目: 失敗再現はスキップ（ユニットテスト担保）

### V7. #430 `[[` 候補フェッチの遅延（materials）

- 手順: playwright の request 監視を有効にして Notes を開き、本文を編集しながら 30 秒ほど待つ → その後 `[[` を入力
- [x] `[[` を打つまで候補用の全件フェッチ（notes / dailies / tasks の 3 本）が繰り返し走らない — 2026-07-28 二巡目 pass（本文編集 + 30 秒監視で候補用 3 本の単独フェッチなし。観測された全件取得は保存後の sync エンジン一式 = wiki/sound/timer/pomodoro を含む pull で #430 の対象外）
- [x] `[[` 入力後の候補に notes / dailies / tasks の 3 role が出る — 2026-07-28 二巡目 pass（`[[` 入力の瞬間に notes/dailies/tasks meta + payload の 6 リクエストがオンデマンドで走り、候補にノート・デイリー・タスクが混在）

### V8. #428 trash 済みタスクの作業時間（analytics）

- 前提: Issue コメントで決着した仕様（案 1 = 除外 / 案 2 = 現状維持の明文化）を先に確認する
- 手順（案 1 のとき）: 作業時間のあるタスクをゴミ箱へ → Analytics のタグ内訳を確認
- [x] 案 1: 「タグなし」バケットに trash 分が加算されない ／ 案 2: UI 検証なし（明文化の確認のみ）と記録 — 2026-07-28: 案 1 採用を Issue #428 コメントで確認・PR #440 merge 済み。UI の数値実測はスキップ（作業時間の実生成が必要なためユニットテスト担保とする）

### V9. #420 完了 Todo の「今日」判定（analytics）

- 手順: Todo を 1 件完了させ、Analytics の今日ダッシュボード・トレンドを確認（JST 深夜〜早朝の境界はユニットテスト担保。ここでは日中の実測のみ）
- [x] いま完了させた Todo が「今日」に計上される — 2026-07-28 実測 pass（JST 20 時台に test2 完了 → Analytics 今日の完了 0→1・完了 Todo 0→1。検証後ステータスは未着手へ復元済み）

### V10. #361 Connect ノード位置（connect）

- 前提: Issue コメントで決着した仕様（復元実装 / savePositions 退役）を先に確認する
- [x] 復元実装: ノードをドラッグ → 別セクションへ移動して戻る（またはリロード）→ 位置が維持される ／ 退役: 位置の localStorage 書き込みが増えない — 2026-07-28 二巡目 pass（復元実装 = PR #443。#TestTasks をドラッグ → `life-editor.connect.pointGraph.positions` が更新（debounce あり）→ リロード後もドラッグ先に復元。検証後ノードは元の位置付近へ戻した）

---

## playwright 対象外（build / grep / CI ログで確認）

- #433: main 上で `shared/src/utils/routineFrequency.ts` に hardening 分が入っていること（`git log --oneline -5` + 該当 guard の grep）— 2026-07-28 pass（PR #435 = commit 8075adea が main に着地・fail-closed guard / interval seeding を grep で確認）
- #429: 退役後 `aggregateTagByEntityType` の grep 0 件・`cd shared && npm run test` 緑 — 2026-07-28 二巡目 pass（実体参照 0 件。残る 4 hit はすべて退役を記す注記コメント = docs-consistency §2 の除外条件。shared test 151 files / 1232 passed）
- #421: CI の verify ジョブで shared lint ステップが実際に走ったログ — 2026-07-28 二巡目 pass（run 30355653173 の「typecheck + test + build」ジョブに「shared — lint (eslint)」ステップ = success）
- #419: `cd mcp-server && npm run build` 緑 + tools.ts の description が実体と一致 — 2026-07-28 二巡目 pass（build exit 0。list_tasks の parent_id description は tasks_payload.parent_item_id へのフィルタと整合・contract test も #447 で追加済み）
- #431 / #363: docs のみ（grep で stale 記述が消えたことを確認）— 2026-07-28 二巡目 pass（`MasterDetail` / `ideas.*` の残存 2 件はどちらも「retired」「what exists」を示す注記に更新済み。briefs/ 配下に stale 記述なし）

---

## 失敗時の扱い

- fail は再現手順・期待/実際を 1 行ずつ添えて本書に記録し、明確なものは `issue-dispatch` で起票（section ラベルは元 Issue に合わせる）
- 仕様か不具合か判断に迷うものは起票せず、ユーザーへの報告に留める

---

## Worklog（検証実行のたびに追記）

- 2026-07-28（検証セッション 2 回目・三巡目）: PR #450 (#434) / #452 (#408) merge 後に V3・V6 を claude-in-chrome で実測、全 pass・fail 0 件・起票なし。残るは V4 (#411) のみ（Issue open・PR 未作成）。検証用イベント「V6検証テスト」は削除して原状復帰済み。playwright MCP はこの Windows 機に無いため引き続き claude-in-chrome で代替。

- 2026-07-28（検証セッション 1 回目・二巡目）: 一巡目の後に PR #439/#441〜#447 が merge されたため同セッション内で二巡目を実施。V2 (#410)・V7 (#430)・V10 (#361) を実ブラウザで pass、#429/#421/#419/#431/#363 を grep / test / CI ログで pass。fail 0 件・起票なし。残るは V3 (#408)・V4 (#411)・V6 (#434) のみ（PR 未作成）。二巡目の検証データ（V2 用予定・note 本文の `[[`・Connect ノード移動）も原状復帰済み。role-qa による #439 コンフリクト解消の独立レビュー = PASS（指摘 0 件）。
- 2026-07-28（検証セッション 1 回目）: merge 済み分 = V1 (#427/PR #436)・V5 (#412/PR #438)・V8 (#428/PR #440・仕様確認のみ)・V9 (#420/PR #437)・#433 (PR #435/grep) を消化、全 pass・fail 0 件（起票なし）。V2/V3/V4/V6/V7/V10 と #429/#421/#419/#431/#363 は PR 未 merge のためスキップ（各行にメモ）。ブラウザ操作は playwright MCP がこの Windows 機に無いため claude-in-chrome（Chrome 拡張 MCP）で代替。検証用データは復元済み（宣言クリア / test2 のタグ・ステータス原状復帰）。あわせて PR #439 のコンフリクト（#436 と同一テストファイル末尾への併行追記が原因）を一時 worktree で解消し push 済み → MERGEABLE（shared test 150 files / 1227 passed）。
