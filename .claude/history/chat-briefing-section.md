# HISTORY (chat-briefing-section)

### 2026-07-26 - materials レーン: Issue #365 / #366 / #371 / #370

#### 概要

briefing-section worktree が materials レーンを担当し、バグ 3 件（#365 / #366 / #371）+ 機能 1 件（#370）を 1 Issue = 1 ブランチ = 1 PR で処理。#365 / #366 / #371 は PR #388 / #390 / #392 が merge 済み・Issue closed、#370 は PR #394 が merge 待ち。全件で shared vitest / shared tsc -b / web build を通過（DDL 変更ゼロ）。

#### 変更点

- **#365 タグ使用数がゴミ箱を過大計上（PR #388）**: ソフトデリートは `items_meta.is_deleted` だけを立て `wiki_tag_assignments` へ波及しない（波及させると復元時に「ゴミ箱が外した」と「ユーザーが外した」を区別できない）ため、`listAllTagAssignments` が trash 済みアイテム宛の割当を返し続けていた。読み取り側で生存を両側条件化（`items_meta!inner(is_deleted)` の埋め込み + `.eq(false)`）し、join を PostgREST 側に寄せて往復 1 回を維持。Issue の DoD 案（hook に active item id 集合を持たせる）を採らなかったのは、`syncVersion` が上がるたび（入力停止のたび）に items_meta 全 id フェッチが増えるため。使用数だけでなく Analytics のタグ集計 / Connect の辺の過大計上も同時に解消
- **#366 編集中 Note が最上位へ跳ねる（PR #390）**: `sortNotesForList` に固定ソートキー（`FrozenNoteSortKey`）を optional 引数で追加。選択時点のキーで比較するのでその行だけ動かず、返る配列は生きた Note オブジェクトのまま（タイトル編集は位置を変えずに反映）。`isPinned` は固定しない（ピン留めは意図的操作なので即移動すべき）。スナップショットは render 中に取る新規 hook `useFrozenNoteSortKey`（effect だと固定前の 1 フレーム = 跳ねるフレームが通る）。選択を移すと解除され本来の位置へ = 抑止ではなく延期
- **#371 新規 Daily の初回 `[[link]]` が Connect に載らない（PR #392）**: `wiki_tag_connections.from_item_id` は items_meta への FK で、初回保存前の日には辺を張れず DailyView が辺を捨てていた。`selectedDaily` の有無も判定に使えない（optimistic ノードは書き込み前に現れる）。挿入を日付キーで預ける純粋ユーティリティ `pendingItemLinks`（shared）を新設し、行を作った保存の完了後に辺を書く方式へ。`upsertDaily` は保存済みノード（失敗時 null）を返すよう変更 — 既存の投げっぱなし呼び出しは非破壊
- **#370 `[[link]]` 候補に tasks 追加（PR #394・merge 待ち）**: v1 で見送った理由は候補側ではなく行き先（他タブから特定タスクを開けなかった）。KanbanView に `pendingSelectTaskId` を追加し `pendingNewTask` と同じ作法で 1 回だけ消費 → 選択 + 広い画面は詳細パネルを開く（カードクリックと同一動作。狭い画面は選択のみ）。候補プールに `fetchTaskTree()`、MainScreen の role→tab 振り分けをマップ化、role ラベルを en/ja に追加。Connect グラフは task ノードを持たないため note→task の辺は `buildGraphModel` の端点チェックで落ちる（スコープ外として PR に明記）
- **テスト**: shared 側に 20 件追加（#365 クエリ形状 1 / #366 固定挙動 5 + hook 4 / #371 預かり所 4 + `upsertDaily` 返り値契約 3。#370 は web 層のみのため追加なし）。実ブラウザ検証は全件 merge 後に chat-main（§7.4）
- **運用**: Issue ごとに `claude/materials-<番号>` を `origin/main` から切り直し、`.claude/comm/.session-branch` も都度更新（#327 の新ポリシー準拠）

### 2026-07-26 - Issue #318: Mobile 幅で朝刊/夕刊タブが切替不能

#### 概要

狭幅（<768px）では AppShell が header スロットを wide ブランチでしか描画せず、Briefing のタブ帯（唯一の切替 UI）が消えて夕刊へ到達できなかったバグを修正（PR #357・merge 待ち）。両紙面ビューに optional な `tabSwitcher` スロットを設け、MainScreen が狭幅のときだけ shared の SegmentedControl を流し込む形にして、wide の SectionHeader 挙動は完全に据え置いた。

#### 変更点

- **BriefingView / EveningView (shared)**: optional `tabSwitcher?: ReactNode` を追加し masthead 直下に描画。loading スケルトン側にも同じスロットを出して、フェッチ待ちで片方のタブに閉じ込められないようにした。ガードは `!= null`（ホストが `cond ? <X/> : null` を渡しても空の罫線帯が残らない）
- **MainScreen (web)**: 朝刊/夕刊のタブ定義を `briefingTabDefs` に一本化し、wide の HeaderTabs と narrow の SegmentedControl が同じ配列を読むようにした。狭幅判定は既存の `isWide`（`(min-width: 768px)`）で、wide では `undefined` を渡すため in-body 帯は出ない = tablist の二重存在なし
- **BriefingScreen (web)**: `tabSwitcher` を両ビューへパススルー（データ取得ロジックは無変更）
- **i18n**: 新規キーなし。既存の `briefing.tabs.morning` / `briefing.tabs.evening` / `briefing.tabsLabel`（en/ja 両方に実在）を再利用
- **テスト**: shared/tests/briefingView.test.tsx に 7 件追加（10 → 17 件。朝刊・夕刊 × 通常/loading で帯が出る 4 / 未指定で出ない 2 / null で出ない 1）。shared vitest 1087 / shared tsc -b / web build / web eslint 全 green
- **監査**: role-qa 独立監査を 2 回（実装後・commit 後）とも PASS（BLOCKING 0）。指摘の null ガードは本 PR に取り込み済み。残課題として「帯が紙面と一緒にスクロールする（Materials は固定ヘッダー方式）」「`(min-width: 768px)` リテラルが 11 ファイル 12 箇所に散在（`web/src/work/WorkScreen.tsx:47` に `WIDE_QUERY` の局所定義が既存）」を PR 本文に明記
- **既知の穴（実測）**: スロットのガードは `!= null` のため `false` / `0` / `""` は素通しする（`cond && node` を渡すと空の罫線帯が残る）。現行ホストは三項で `undefined` を渡すため実害なし。JSDoc に注意書きを追記して回避

### 2026-07-18 - Issue #263: F-6 夕刊専用ページ（Briefing 朝刊/夕刊タブ）

#### 概要

Briefing セクションに夕刊タブを追加（F-6・PR #274）。保存先は DailyNode content の「夕刊」見出しセクション（DDL ゼロ）で、書き込みは「全体読み出し → 夕刊範囲だけ差し替え → 書き戻し」のセクション単位マージにして Daily 側・朝刊セクションとの編集競合を構造的に回避。

#### 変更点

- **eveningSection.ts (shared・新規・純関数)**: 夕刊セクションの extract（気分行「気分: n/5」+ 本文分離）/ mergeEveningSection（セクションマージ書き込み・空なら除去・平文レガシーは F-1 規則で TipTap 化）/ defaultBriefingTab（17 時しきい値 + day-start-hour pref の深夜尾部）/ isEmptyDocJson
- **EveningView.tsx (shared・新規)**: 夕刊の純表示（masthead・★ 五段階気分タップ・TipTap エディタスロット・残り Todo / 今後の予定の表示専用ブロック）。lumen-\* トークンのみ
- **BriefingScreen (web)**: tab prop 受け取り。夕刊集約（未完了 Todo + 未消化持ち越し / 今日の残り + 明日の予定）・promise チェーン直列の read-merge-write 保存・DailyView 流のエディタ remount / echo 管理
- **MainScreen (web)**: briefingTab state + 朝刊/夕刊 HeaderTabs（tabs-as-title・初期タブは時刻で自動選択）
- **i18n**: briefing.tabs / briefing.evening.\* を en/ja 両カタログに追加
- **テスト**: shared/tests/eveningSection.test.ts 新規 20 件（マージ保全・round-trip・初期タブ判定）。shared vitest 948 / shared tsc -b / web build 全 green

### 2026-07-18 - Issue #256: 朝刊ループ Step 2 — MCP schedule handler Supabase 化 + get_today_context / write_briefing

#### 概要

MCP server の schedule handler 全 7 関数を旧 SQLite 単一表から Supabase `items_meta` + `events_payload` の 2 行分割モデルへ載せ替え、朝刊執筆用の `get_today_context` と `write_briefing` を新設。briefing-loop Step 2（分析の配管）のクリティカルパスを開通（手動 1 周の実測は chat-main 担当）。

#### 変更点

- **supabase.ts (新規)**: anon key + 本人 email/password（env 供給）で signInWithPassword する接続モジュール。RLS 維持・service_role 不使用
- **scheduleHandlers**: 2 行分割モデルへ全面書き換え。§10.2 updated_at bump / §10.5 orphan recovery / delete はソフトデリート化。0008 で消えた content / note_id / template_id はツールスキーマからも除去し memo / date(移動) を追加
- **briefingHandlers (新規)**: get_today_context（今日の約束・スケジュール済み/持ち越し/進行中タスク・直近 3 日 Daily・当日 Daily の朝刊有無）+ write_briefing（「朝刊」見出しセクションを DailyNode content へ upsert・Daily 不在時は daily-\<date\> ペア新規作成）
- **briefingSection.ts / localDate.ts (新規・純関数)**: 朝刊セクションの upsert（既存セクション置換・夕刊等は保全）と JST 安全な日付ヘルパー
- **index.ts / tools.ts**: callTool async 化（`return await` で rejection を捕捉）・SQLite DB path をオプション化（Supabase ツールのみなら不要）
- **テスト**: mcp-server に vitest 導入・14 件新設（shared extractBriefing との往復検証 = DoD の紙面表示チェックを含む）。shared vitest 917 / shared tsc -b / web build / mcp-server tsc 全 green
- **docs**: briefing-loop 計画書 Step 2 チェック + Worklog 追記・README に MCP の Supabase env var 説明を追加

### 2026-07-16 - Issue #259: F-2 朝刊の行操作

#### 概要

朝刊（Briefing）の全行タイプ（約束・タスク・持ち越し）に、名称横の移動ボタンと名称タップ = 完了トグルを実装。role-pm / role-qa / security-reviewer の監査を通過（BLOCKING ゼロ）。

#### 変更点

- **BriefingView (shared)**: 名称 span を button 化（約束は既存丸トグルと併存・タスクと持ち越しは checkbox + 名称の単一 button）。全行に ArrowUpRight 移動ボタン追加（約束 → Schedule / タスク・持ち越し → Materials > Tasks）。BriefingCarryoverEntry に completed 追加
- **BriefingScreen (web)**: handleToggleTask 新設（ds.updateTask の二値トグル・解除時 completedAt: undefined をキー明示で DB クリア）。持ち越しフィルタを「完了当日は取り消し線で残す」に変更。onNavigate prop 受け取り
- **MainScreen (web)**: handleBriefingNavigate 追加（schedule ジャンプ時に calendar タブ強制・既存 handleNavigate は不変）
- **i18n**: briefing.jumpToSchedule / jumpToTasks を en/ja 両カタログ末尾に追加（F-4 #261 の表示ラベル値には非接触）
- **テスト**: shared/tests/briefingView.test.tsx 新規 9 件（クリック分離・入れ子ボタン非存在ガード）。shared vitest 911 件 / tsc -b / web build / eslint 全 green
- **申し送り**: host 側 D1/D2 ロジックの直接テストは follow-up 候補（role-qa MINOR）
