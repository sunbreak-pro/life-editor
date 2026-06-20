# HISTORY (chat-main)

### 2026-06-20 - W8: Schedule カレンダー（週/日タイムグリッド）コア実装

#### 概要

親ロードマップ W8（セクション内部深化 第3弾）の子計画書 `2026-06-19-web-parity-w8-schedule-calendar.md` の Steps 1–6 を実装。2層モデルの「複雑画面」代表 = Schedule を web+shared に新規実装。広幅=マウス操作の週タイムグリッド / 狭幅=タップ前提の日アジェンダ + BottomSheet 編集に割り切って分割。`schedule_items` は既に `date` + `HH:MM` を持つため **DDL ゼロ**で可視化。DnD（Step 7）は計画通り W8+ へ送り。worktree `feat/w8-schedule-calendar`・commit `92112cae`。PR/目視はユーザーゲート。

#### 変更点

- **純関数エンジン（shared/src/utils/scheduleGridLayout.ts・新設）**: `minutesFromMidnight` / `layoutDayItems`（時刻→分→%ベース top/height・終日除外・入力順保持・**素朴な横カラム詰め**=左→右スイープでクラスタ単位に最小列数を割当）/ ローカル日付演算（`addDaysKey` 月年跨ぎ・`startOfWeekKey`・`weekDayKeys`）。**UTC 持込禁止**（`new Date(y,m-1,d)` のみ・`new Date("YYYY-MM-DD")` 不使用）。overnight/inverted（end≤start）は窓末尾まで延伸しスライバー回避
- **WeekTimeGrid（shared/src/components/schedule/・新設 + サブバレル）**: 時刻軸 + 曜日ヘッダ + 終日レーン + 絶対配置イベント。純粋表示（§3.1/§6.4・DataService/useTranslation 非依存・ラベル/書式は props 注入）・`notion-*` のみ・不透明背景・`days={1}` で日ビューに縮退可。`components/index.ts` に `export * from "./schedule"` 追記
- **i18n**: `scheduleCalendar` namespace（曜日略称7 + 終日/今日/前後ナビ/空/編集ラベル = 21キー）を en/ja **両 catalog** に追加
- **web 採用（web/src/schedule/ScheduleCalendarView.tsx・新設）**: `useMediaQuery("(min-width:768px)")` で出し分け。広幅=`WeekTimeGrid` + 右ペイン編集（未選択は selectHint）/ 狭幅=日アジェンダ（時刻順・終日先頭）+ `BottomSheet` 編集。週/日ナビ + 今日。可視週は既存 `loadDateRange` で**読取**、編集は既存 `updateScheduleItem`/`toggleComplete` + 楽観 patch（**CRUD ロジック改変なし**）。i18n は web 側で `t()`/`Intl.DateTimeFormat` 解決し props 注入。`MainScreen` schedule セクションに配線（Provider 順序不変）
- **無改変**: `RoutineScheduleSync`（生成ロジック）/ `ScheduleView`（routine CRUD）/ `CalendarView` / `frontend/`(FROZEN)。新規依存なし（@dnd-kit/useMediaQuery/BottomSheet 全て既存）
- **test**: `scheduleGridLayout.test.ts`（純関数 unit・overlap 2-3列/clamp/ゼロ長/終日除外/overnight/日付境界）+ `weekTimeGrid.test.tsx`（描画/クリック/終日/`days={1}`）= 20件。shared 全 **462 passed**
- **検証**: shared `tsc -b` 0 / web `tsc -b --force && vite build` 0 / frontend `npm run build` 0（非破壊）/ web eslint 0 error（残 1 warning は既存 DebouncedTextInput・W8 非関与）。`git diff` は Scope 宣言パス内のみ
- **レビュー**: 独立3レンズ（正当性 / 規約・a11y / スコープ）+ 各指摘の敵対的検証ワークフロー。blocker/major **0**、confirmed minor **2件を即修正**（① handleToggle 楽観 patch に `completedAt` 欠落→provider と同じ field set へ ② overnight イベントが start 日スライバー化→窓末尾延伸 + contract コメント + test 追加）
- **diff 規模**: ~1107 行。当初 AC「±600 行」を超過 → 複雑画面本体（週グリッド+日アジェンダ+編集+純関数+20test+二言語 i18n）として妥当と判断し AC を「~1100 行」へ上方修正（scope creep なし・ユーザー承認で 1 PR 継続）
- **計画書**: `.claude/docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md`（Status: In Progress・Owner を main へ引取）

### 2026-06-14 - W4: Analytics + Connect を web/shared へ lean 移植

#### 概要

親ロードマップ最終 Phase W4 を実装。Analytics（4タブ・recharts）と Connect（ノードグラフ + backlink）を `frontend/`(FROZEN) から `shared/` + `web/` へ移植し、1 PR にまとめる方針。重ティアチェーン（recon 2本並列 → 計画書 → Phase A グルー → role-engineer 2本並列 → 中央検証 → role-qa）で実施。機械検証緑・role-qa PASS（Blocker 0）。worktree `feat/w4-analytics-connect`。PR は D2（ユーザー判断）。

#### 変更点

- **設計判断（最重要）**: Connect は frontend の legacy `useNoteConnections`（note_links/note_connections 依存）を移植せず、**DU 完了済の unified item-link モデル**（`listNotesUnified` / `listAllTagConnections` / `listAllTagAssignments` / `listAllWikiTagsUnified`）でグラフを再構築。理由 = SupabaseDataService の note-link/connection サービスは全てスタブ（`return []`）で web ではグラフが空になるため。backlink は fetch 済 connections の client 側フィルタ（`listLinksToItem` と同テーブル・同条件で等価を role-qa が実証）
- **Analytics**: `analyticsAggregation.ts`(879行・純粋関数)を import 修正のみで shared へコピー（テスト込み）。`AnalyticsFilterContext`(period/dateRange のみ・feature 内部・barrel 非公開) + 17 チャート + 4 タブ(Overview/Tasks/Work/Schedule)。Materials/analytics-Connect タブ + chart-visibility サイドバーは lean で drop。§6.4 厳守（shared 内 `useTranslation`/`getDataService` 0・host が labels/data を props 注入）
- **Connect**: PointGraph の描画層(Canvas 2D + d3-force + interaction/simulation/filters/primitives)を移植 + `buildGraphModel`(unified→{nodes,edges} 純関数) + `BacklinkView`。Paper Boards / @xyflow / d3-transition(未宣言 transitive dep 回避・pan/reset は instant) は drop。unmount cleanup 完備
- **Phase A グルー(main)**: deps(recharts + d3 5点 + @types)を web/shared に追加 / web MainScreen に `connect`・`analytics` section 結線(Section 型・SECTIONS・SECTION_ICON・render) / shared components barrel に `export * from "./Analytics" / "./Connect"` / host stub + sub-barrel で並列編集の衝突回避
- **deps 修正**: `recharts: ^3.7.0` が新 minor 3.8.1 を引き込み Tooltip `Formatter` 型が厳格化→型エラー7件。frontend と同じ **3.7.0 に pin** で解消（コード変更ゼロ）。テスト fixture の TimerSession に必須 `label: null` 追加
- **検証**: shared `tsc -b` 0 / shared vitest **426 passed**(新規 analyticsAggregation + connectGraphModel/Filters テスト含む) / web `tsc -b --force` 0 errors / web eslint 0 errors(既存 DebouncedTextInput の警告1のみ=fresh install のプラグイン版差・W4 非関与) / `git diff` で frontend/ 変更 0(FROZEN 担保)
- **インシデント**: 実装中にディスク満杯(ENOSPC)で Bash の出力ファイル生成すら不可に。worktree は node_modules 非共有(§7.4)で web+shared 2 ツリー新規 install した分が逼迫要因。npm cache 削除(ユーザー実施)で復旧 → 以後は vite バンドルを省いた軽い検証(tsc -b + vitest + eslint)で完走
- **計画書**: `.claude/docs/vision/plans/2026-06-14-web-parity-w4-analytics-connect.md`

### 2026-06-11 - PR #70/#71 merge 後処理（main 同期・build 全数・w3-b prune・W3-C 前提調査）

#### 概要

PR #70（W3-B）/#71（CLAUDE.md スリム化）/#72（tracker）の squash merge を受けた後処理一式。ローカル main の分岐を rebase で解消、4 workspace の build 全数検証 + テスト全 PASS、w3-b worktree prune、計画書 archive 化。W3-C の 🛑 前提を Supabase 実測し「残る前提は Storage バケット + 音源のみ（thunder.mp3 欠品）」と確定。

#### 変更点

- **main 同期**: ローカル main（2 ahead / 3 behind）を rebase — 79aecccd は PR #72 squash と patch 等価で自動 drop、dfe4c07b（PR #71 tracker 記録）は温存し **PR #73** 起票（chore/tracker-claude-md-slimming・一時 worktree 経由 push）。dirty 3 ファイル（CLAUDE.md / rules/frontend.md / three-axis 計画書）は origin/main と byte 一致を diff 検証してから整理（損失ゼロ）
- **build 全数検証**: shared / mcp-server / frontend / web の 4 build 全 PASS + shared / frontend テストスイート PASS（background 直列実行・main worktree = env あり）
- **w3-b prune**: w3-b-timer-work worktree 削除（残骸 shared/node_modules のみ確認の上 --force）。feat/w3b-timer-work の branch 削除は deny ルール → ユーザー実行リストへ追加
- **計画書 archive**: 2026-06-11-claude-md-three-axis-slimming.md を COMPLETED 化し .claude/archive/ へ移動（4aa93482）
- **W3-C 前提実測**: storage.buckets 空（= `sounds` バケット未作成）/ 0018 の 6 テーブル + realtime publication は適用済み（timer_sessions・timer_settings・pomodoro_presets・sound_settings・playlists・playlist_items 全て publication 登録済 = DDL 前提充足）/ supabase_migrations 記録は 0014 止まり（0015-0018 は SQL Editor 適用の既知パターン・テーブル実体ありで実害なし）/ 音源 6 種（Rain/Thunder/Wind/Ocean/Birds/Fire = tier-2-supporting.md §Audio）に対しローカル frontend/public/sounds/ は 5 種のみ — **thunder.mp3 欠品・ユーザー調達必要**

#### 設計判断 / 申し送り

- **音源オブジェクト名は UI enum id ベース推奨**（rain.mp3 / thunder.mp3 / wind.mp3 / ocean.mp3 / birds.mp3 / fire.mp3）。frontend 旧 enum（5 種・thunder 無し）は sea_wave.mp3 / bird_sea.mp3 等のレガシー名 — W3-C の shared 新 enum で id とファイル名を揃えると Storage URL 構築が単純化
- **frontend enum は 5 種 / Tier-2 要件は 6 種**: W3-C で shared 側に 6 種 enum を新設する際、Thunder アイコン（lucide CloudLightning 等）込みで定義
- migration 記録 0015-0018 の補正（schema_migrations への insert）は任意・低優先

### 2026-06-11 - CLAUDE.md 三軸スリム化（PR #71）

#### 概要

公式ガイダンス（CLAUDE.md 200 行以下目標 / over-specified アンチパターン / Fable 5「過剰規定は品質低下」）に基づき CLAUDE.md を 253→112 行へ再構成。編集基準 = 3 軸（①推測できない事実 ②委譲ポインタ ③安全境界）で、各行に「消したら Claude が間違うか」テストを適用。

#### 変更点

- **CLAUDE.md (253→112 行)**: 章番号 §0-§9 維持（coding-principles.md §6-7 / 移行 SSOT §8 の章参照を保護）。MCP 32 ツール列挙・命名規則表・機能差分表など「コードが正」の情報を削除。`.mcp.json` 警告は pre-commit-mcp-check.sh が機械強制済みのため 1 行化
- **`.claude/rules/frontend.md` 新規 (63 行)**: `paths:` frontmatter（`frontend/src/**` / `shared/src/**`）で該当ファイル read 時のみ自動ロード。Provider 順序 / Pattern A / 配置表 / デザイン規約（notion-\* / 透明度禁止 / i18n props / DataService 注入）/ IME・DnD gotcha を §6 から移管。棲み分け: rules = 不変式と表、skills = 手順
- **計画書**: `2026-06-11-claude-md-three-axis-slimming.md`（\_TEMPLATE 準拠・Scope/Gate/AC）。PR merge 後に COMPLETED 化 + archive 予定
- **検証**: 不変式 18 項目 grep + 参照パス 20 件 ls 全 OK・`wc -l` 112 ≤ 160
- **commit/PR**: 0aad9c6b（3 files, +179/−201・一時 worktree claude-md-slim 経由 pathspec stage・push 後 worktree 削除）→ PR #71

#### 設計判断 / 申し送り

- 旧モデル向けスキル群の de-prescribe（Fable 5 最適化・公式推奨の A/B）は別タスク候補
- agents-lib の Tauri 時代 §参照（life-editor-ipc-validator 等）は legacy のため未修正

### 2026-06-11 - W3-B Pomodoro Timer + Work タブ（PR #70）

#### 概要

ユーザーゲート（#67/#68/#69 merge + 0018 db push）の完了を実測確認（6テーブル・RLS 24 policy・publication 6/6・新テーブル initplan WARN 0）後、W3-B を実装。TimerContext/Reducer の shared 共有層化（開始時刻ベース）+ Pomodoro UI + Work タブ + W3-A QA 申し送り 2 件解消 + REALTIME_TABLES 結線。ultracode モードで監査 3 本（role-qa / security-reviewer / sync-auditor）を並列実行し全パス → PR #70。

#### 変更点

- **TimerContext 共有層化（Pattern A 3ファイル + barrel）**: timerReducer は `now` を action 引数で受ける純粋 reducer。開始時刻ベース計測 = `startedAt` + pause 累積 `accumulatedMs` から残りを毎レンダー算出・setInterval(1000) は再レンダー駆動のみ（throttle 耐性をテストで証明）。WORK→BREAK→LONG_BREAK cadence（sessions_before_long_break）・auto_start_breaks（advancedRef once-guard + phaseKey 単調進行 — QA が論理追跡で正しさ確証）・target_sessions・完了時 timer_sessions 保存（task_id 紐付け）。UI/context から FREE 排除（DB CHECK/domain union には温存）
- **Work タブ**: PomodoroTimer / PomodoroTaskSelector / PomodoroSettings（props i18n・notion-\* トークン・透明度なし）+ `web/src/work/WorkScreen.tsx` host。History/Music/FREE 削除・TaskSelector 維持・preset CRUD。i18n en/ja 追加
- **QA 申し送り解消**: (a) fetchTimerSettings singleton race → `upsert({id:1}, onConflict, ignoreDuplicates)` + 再 select（user_id 非送信維持） (b) activeInInput 二重管理 → hasAccelerator 推論ガード廃止・定義フラグ駆動の SSOT 一本化
- **executor**: new-task → setSection("tasks")（navigate のみの正直な受け口）/ undo/redo は web に UndoRedo 不在のため W4 送り
- **REALTIME_TABLES**: 0018 の 6 テーブル追加 = publication lockstep 20/20（0017×14 + 0018×6）。lockstep テストは migration SQL を実 parse + ハードカウントの 2 段で tautology でない（sync-auditor 確証）。self-echo ループなし（timer_sessions は書くだけで読み直さない・閉路なし）
- **検証**: 4 ゲート緑（engineer 実測 + main background 再実測一致）・shared test 374→402 (+28, 34 files)。監査: role-qa PASS with concerns（C/H 0・M2 は W4/W3-C 申し送り）/ security-reviewer approve（C/H/M 0）/ sync-auditor 整合 OK（C/H 0）
- **commit/PR**: 32220eb5（23 files, +2088/−51・pathspec stage・node_modules 非混入）→ PR #70

#### 設計判断 / 申し送り

- (W4) undo/redo 結線時: activeInInput:false により input 内 ⌘Z が抑制される挙動の意図確認（OS 標準編集 undo に委ねるなら現状が正）
- (W4) Skip は SET_PHASE で cadence 非対称（LONG_BREAK へ飛べない・completedSessions 不増）— skip() 追加 or 現仕様正式化を裁定
- (W3-C) onSessionComplete に音/通知結線（onSessionCompleteRef で optional hook 化済み）・sound 3 テーブルの realtime consumer 追加（REALTIME_TABLES 再追加禁止 = 登録済）・self-echo 回避は TimerContext と同構造で・同一 migration ファイルに publication array 2 ブロック禁止
- **既存テーブルの initplan WARN 48 件を advisor で発見**（calendars/items*meta/payload/wiki*\_/routine\_\_ — 0018 無関係の既存負債・別タスク候補として予定に登録）

### 2026-06-10 - W3 前半2レーン完了（W3-0 executor PR #68 + W3-A foundation PR #69）

#### 概要

web-desktop parity W3 に着手。role-pm 調査で**ロードマップの前提誤りを発見**（timer/sound 系テーブルは Supabase に不在・DataService の該当メソッドは throw stub）し、W3 を 4 レーンに再分割（W3-0 executor / W3-A DB+DataService 土台 / W3-B Timer+Work UI / W3-C Audio）。設計4点をユーザー確認で確定し、依存ゼロの W3-0 と W3-A を並列実装 → 両 QA PASS → 独立 PR 化。

#### 変更点

- **設計確定（ユーザー回答）**: (1) DB=独立テーブル+自前 updated_at（items_meta 非依存）(2) プリセット環境音6種のみ（カスタム音源スコープ外）(3) 音源配布=Supabase Storage 公開バケット (4) Pomodoro 計測=開始時刻ベース
- **W3-0（PR #68・feat/w3-shortcut-executor @ 90103fe5）**: eventToBinding 純関数（matchBinding と round-trip）+ useGlobalShortcuts フック（純粋ヘルパー isEditableTarget/hasAccelerator/resolveShortcut・IME ガード・input 中 bare-key 抑制・マッチ時のみ preventDefault・config null=inert）+ headless GlobalShortcuts を ShortcutConfigProvider 内側にマウント。W2 の直書き Cmd+K リスナを設定駆動に置換（⌘K/⌘1-5/⌘,）。rebind 即反映（snapshot なし・QA がコード経路で確証）。new-task/undo/redo は受け口のみ（W3-B/W4 結線）。shared test 357 緑(+18) / web build・lint 緑。QA PASS with concerns（C/H 0・M2=activeInInput 二重管理→W3-B / palette 表示中 nav 透過→目視評価）
- **W3-A（PR #69・feat/w3a-timer-audio-foundation @ 91f35b0e）**: migration 0018（6テーブル: timer_settings per-user singleton / pomodoro_presets / timer_sessions started_at+ended_at / sound_settings UNIQUE(user_id,sound_type) / playlists / playlist_items。RLS 24 policy 全数 initplan 形式・idempotent・realtime publication 追加・カスタム音源系全落とし・POST-APPLY VERIFICATION A-D 同梱・**未適用=ユーザー db push 待ち**）+ DataService 既存 interface 22 メソッド実装（**シグネチャ変更ゼロ**・PHASE2_TIMER/AUDIO_METHODS Proxy 登録）+ mapper（ALWAYS updated_at bump）+ roundtrip テスト 17。shared test 356 緑 / web build 無影響。QA PASS with concerns（C/H 0・singleton race / sort_order race は N=1 で実害極小→W3-B 検討）
- **計画書**: `2026-06-10-web-parity-w3-work-timer-audio.md` 新規（W3-A ブランチが運搬・Scope/Gate/Acceptance/DB Migration Notes・engineer が DDL 設計を Worklog 追記）

#### 設計判断 / 申し送り

- **prototype-mobile 境界調整は不要と確認**（PR #45/#46/#48 取込済・worktree 退役済・進行中なし）— ロードマップの「要調整」懸念は解消済み
- **W3-B 着手条件**: W3-A merge + ユーザー db push 完了後。QA 申し送り（timer_settings singleton race の upsert 化 / activeInInput フラグ駆動化 / REALTIME_TABLES 結線 + sync-auditor）を W3-B スコープに含める
- **W3-C 着手条件**: 上記 + Storage 公開バケット `sounds` + 音源6種アップロード
- **検証手順の定着**: engineer 実測 → main が background 再実測 → QA はコード読解専念（hang 回避・W2 で確立したパターンを両レーンで踏襲）

### 2026-06-10 - W1/W2 merge 後検証 + 統合修復（PR #66）+ merged worktree 一括 prune

#### 概要

PR #62/#63/#64 の連続 squash merge で競合解決時に W1 hunks が脱落し、main の web build が破損していたことを merge 後の全数検証で検出。fix worktree で統合修復し PR #66 として merge 済み（f652a542）。後処理として merged worktree 7 個を prune し、W1/W2 子計画書を archive 化。

#### 変更点

- **検出**: ローカル main と origin/main の分岐（squash merge 由来 3 ahead / 4 behind）を tree 差分で安全確認後にユーザーが reset --hard で同期 → main 全数検証で web build 失敗（TS2305×4 / TS2304 / TS2322 / TS6133 + lint 1 error）。shared build/test は緑 = 被害は components barrel と MainScreen に限定。i18n キー・shared/index.ts・main.tsx(ThemeProvider)・W2 実装は無傷
- **修復（PR #66 @ f652a542）**: (1) shared components barrel に W1 Settings 系 export（SettingsAppearance/Language/Shortcuts + ShortcutRow）復元 (2) MainScreen に settings セクション一式（Section 型 / nav / SECTION_ICON / 描画 + ShortcutConfigProvider ラップ）復元・旧ローカル getDataService を削除し #62 shared factory に一本化 (3) `section.settings` i18n キー追加（en/ja）= CommandPalette に「Go to 設定」コマンドが正しいラベルで統合
- **検証**: shared build / web build (tsc -b --force + vite) / shared test 339 passed (29 files) / web lint 0 errors すべて緑。merge 後 main の tree が fix branch と完全一致確認（= worktree 検証が main にそのまま適用）
- **後処理**: merged worktree 7 個 prune（batch-a / batch-a-rest / docs-cleanup / w0-shared-ui / w1-ux-settings / w2-trash-palette / w1w2-merge-fix）。ローカル branch 削除は deny ルール（`git branch -D`）でブロック → ユーザー実行依頼。history ローリングアーカイブ実施（13→5 エントリ・2026-05×8 / 2026-06×1 を archive へ）

#### 設計判断 / 申し送り

- **再発防止**: 同一ファイル（barrel / i18n locales / MainScreen）を触る複数 PR の連続 squash merge は、競合解決で片側 hunks が落ちても GitHub 上 green に見える。**連続 merge 後は main で build 全数検証を必須**とする（今回それで検出）
- **fix worktree の node_modules**: 新規 worktree は node_modules 非共有で tsc/eslint が 127 で落ちる。本体への symlink（`ln -s <main>/shared/node_modules` 等）で解消。`shared/node_modules` は gitignore 漏れのため pathspec stage 必須（W1/W2 と同じ注意）
- **W1/W2 子計画書はこの END で COMPLETED 化し archive へ移動**（merge 完了につき）

> 古いエントリは [`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
