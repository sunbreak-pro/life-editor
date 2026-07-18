# HISTORY (chat-briefing-section)

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
