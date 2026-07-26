# HISTORY (chat-briefing-section)

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
