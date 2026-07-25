# HISTORY ARCHIVE (chat-main, 2026-06)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

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

### 2026-06-09 - web-desktop パリティ W1（UX基盤）+ W2（Trash/CommandPalette）

#### 概要

親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md`（W0-W4・web を Desktop 同等へ）の W1・W2 を実装。各々独立 worktree/ブランチ/PR。role-pm 分解 → 子計画書 → role-engineer 実装（W1 は socket hang up 対策で2バッチ分割）→ role-qa 独立監査 → git-orchestrator で commit/PR。merge はユーザー判断（🛑 人手ゲート・未merge）。

#### 変更点

- **W1（PR #63・feat/w1-settings-theme @ 9277644）**: web に Theme 基盤を新設。役割判明=「設定画面移植」でなく「web に Theme/FontSize/Language/Shortcut を機能させる shared 基盤の新設」（web には dark/light も font-size 適用も Provider も無かった）。
  - shared 新規: useLocalStorage / ThemeContext(Value/Context/hook・Pattern A・theme/fontSize/language の3点・editor系は web 消費者ゼロで除外) / ShortcutConfig(Optional バリアント=Mobile省略Provider) / SettingsAppearance・SettingsLanguage・SettingsShortcuts(props注入の純粋部品) / shortcut 型・defaultShortcuts(web実在10件選別・nav は web section に再キー) / platform・shortcutBinding util + テスト11件。
  - web: main.tsx に ThemeProvider マウント(documentElement に data-theme/font-size 適用・localStorage 永続化) / MainScreen に settings section + nav + ShortcutConfigProvider(SyncProvider 内側)。
  - 検証: shared build/web build/shared test 332緑/web lint(0 err)。role-qa=PASS with concerns(C/H=0)。Low#1(`--notion-accent`→`--color-notion-accent` トークン名誤記)修正取込。
- **W2（PR #64・feat/w2-trash-command-palette @ ebd0d6d）**: web に Trash + CommandPalette。DB変更ゼロ(既存 soft-delete API 利用)。
  - shared 新規: CommandPalette(frontend 195行を i18n props 化コピー・useTranslation 撤去・Cmd+K/Ctrl+K・IMEガード・検索/↑↓Enter) / TrashView(純粋部品・書き直し=frontend版は DU-G で消えた legacy context 依存で流用不可・5カテゴリ tasks/notes/dailies/routines/events・Modal confirm) + テスト10件。
  - web: TrashScreen host(getDataService で5カテゴリ fetchDeleted\* 並列取得・restore/permanentDelete 配線・cancelled フラグ+busy ガード) / MainScreen に trash section + nav + Cmd+K window リスナ + コマンド配列。
  - 検証: shared build/web build/shared test 328緑(新規10)/web lint(0 err)。role-qa=PASS(C/H/M=0・5カテゴリ配線を DataService 実装本体まで遡り取り違えゼロ確認)。Low(untitled フォールバック未定義キー→`common.untitled` 新設)修正取込。

#### 設計判断 / 申し送り

- **2バッチ分割の経緯**: W1 初回 role-engineer が socket hang up(接続切断系・本体SSEバグ)で103分・実装0で落ちた。原因は worktree の node_modules リンク先(本体 shared/web)に W0 deps(i18next/react-i18next/lucide-react/jsdom/@testing-library)が未 install だったこと＋長時間SSE露出。本体で npm install 解消後、Theme コア(Step1-4)/Shortcut+Settings(Step5-8)に分割して稼働短縮。W2 の role-qa も hang したため検証4本を main が background 実測→QA はコード読解専念に切替。
- **shortcut executor 未配線(W1→W3 申し送り)**: W1 で shortcut の設定/rebind/conflict/reset は動くが、グローバル keydown executor が無く押下実行されない(Step7 でスコープ外と定義・要件違反でない)。W3 で `useGlobalShortcuts(matchEvent, setSection, undo, redo, openPalette)` を MainScreen に配線予定。`global:command-palette` は W2 で UI 実装済のため W3 で結線。
- **Trash の host 直叩き設計**: web は Provider をセクション別マウントするため、Trash の5カテゴリ横断には section context が使えない。host(TrashScreen)で DataService 直叩きが正解(host が getDataService を呼ぶのは規約OK・禁止はフック/部品内のみ)。
- **worktree node_modules 非混入**: `shared/node_modules` は検証用シンボリックリンクで gitignore 漏れ(`web/node_modules` は ignore 済)。両 PR とも `git add -A` 禁止・明示 pathspec で stage し非混入確認。
- **merge 順序**: W1→W2 推奨(両者 `shared/src/components/index.ts` + i18n locales を触る・i18n JSON 軽微競合回避)。

### 2026-06-08 - Batch A 残3レーン PR#62 + グローバル化 follow-up(#7)

#### 概要

前セッションで保留した #6(Batch A 残3レーン)と #7(グローバル化 follow-up)を順に完了。#6 は w0/docs が PR#58/#59 で main マージ済みを確認した上で残3レーンを実装→PR#62。#7 は novel への per-chat 機構 commit と life-editor hooks のリンク化(skip-worktree 方式)を実施。

#### 変更点

- **#6 Batch A 残3レーン → PR#62**: (1)factory= web の getDataService 重複を `shared/src/services/dataServiceFactory.ts` に集約(単一singleton+setDataServiceForTest, lazy init) (2)comment= S8 stale comment 更新 (3)docs= CLAUDE.md §3.3/§4.1 を items_meta.updated_at LWW モデル+db-conventions §10 参照に修正。role-engineer×3並列→role-qa独立監査。
- **QA P1 検出と修正(重要)**: comment Agent が「schedule_items は REALTIME_TABLES外→Realtime反映されない」と書いたが、QAが実装(SupabaseDataService.ts:1850-1868)を辿り schedule_items は role='event' で items_meta+events_payload に永続化され両テーブルは REALTIME_TABLES 内と判明。「loadDate は Realtime遅延を待たない即時反映の最適化(購読欠落の補償ではない)」へ訂正。stale comment 修正レーンが別の不正確comment生成になる事故をQAが防いだ。
- **#7(a) novel**: setup-per-chat.sh 適用分(per-chat memory/history/comm + hooks リンク + settings.json + .gitignore)を commit(d8f9299)。hooks は 120000(symlink)記録、INDEX.md は .gitignore 除外、既存 inbox-check.sh 無変更、settings.local.json の inbox SessionStart と共存。
- **#7(c) life-editor hooks リンク化**: 4 hook(regen-index/session-start-check/pre-commit-mcp-check/pre-commit-index-guard)を hooks-lib リンクに置換。共有リポで他環境リンク切れを避けるため **skip-worktree 方式**採用 = git checkout で index を実体に戻す→`git update-index --skip-worktree`→worktree のみ再リンク。結果「手元はリンク(hooks-lib SSOT で DRY)・git HEAD は実体blob維持(他クローンで切れない)」。stop-check.sh は life-editor固有のため対象外。
- **#7(b) card-battle**: `chore/claude-harness-and-battle-fixes`(dirty・別チャット作業疑い)のため適用保留継続。

#### 設計判断 / 申し送り

- **並列QAの価値の実証**: P1(schedule_items×Realtime因果)は実装Agentがテーブル名の表層だけ見て誤判断したもの。別コンテキストのQAが実装を辿って訂正。「stale comment を直すレーンが別の不正確comment を生む」皮肉をクロス検証で捕捉。
- **skip-worktree の運用注意**: life-editor の hooks 4つは skip-worktree フラグ付き。将来 hook 本体を更新したい時はこのフラグの存在を意識する(git で実体が更新されてもworktreeのリンクは無視され続ける)。novel は個人ローカルなので素直に symlink commit。
- **未了**: `.claude/hooks/.bak-pre-linkify/` がuntracked残存(rm権限制約でユーザー手動削除依頼)。project-setter の per-chat 統合は setup-per-chat.sh が当面兼任。card-battle 適用はブランチ clean 後。

### 2026-06-07 - Batch A PR#61 + supabase誤報決着 + コア機構グローバル化

#### 概要

Web移行整合監査(Dynamic Workflows 8エージェント並列)を起点に、非競合2レーンをBatch A=PR#61化、QAが見つけたsupabase消失疑いを誤報と決着、per-chat運用機構をグローバル化(hooks-lib新設+novel適用)した一連のセッション。

#### 変更点

- **監査(①)**: Dynamic Workflows 8エージェントで並列監査。重要発見=`frontend/`は破棄予定の旧Tauriツリー(磨かない)、現行は`web/`+`shared/`+`supabase/`、SSOTは`2026-06-07-web-desktop-parity-roadmap`(W0-W4)。型/ビルド緑・shared 307テスト緑。
- **Batch A=PR#61(②③)**: web manualChunks(react-vendor/dnd/editor/supabase+limit600、500KB超警告解消) + shared relation/group系6 Mapper roundtripテスト(+63、244→307緑)。role-engineer×2並列実装(worktree隔離)→role-qa独立PASS→worktreeからpush(main専有hook誤ブロック回避)。残3レーン(factory/docs-sync/comment)はw0/docs競合で保留。
- **supabase誤報決着(⑤)**: distにcreateClient 0ヒットを本番ログイン不動と疑ったが、原因はworktreeの.env.local欠落→VITE*SUPABASE*\* undefined→getSupabaseClient throw経路→rollupがcreateClient到達不能判定→tree-shake削除。main(env あり)でcreateClient/GoTrueClient/signInWithPassword残存確認=誤報。memory化(project_worktree_supabase_treeshake)。
- **グローバル化(④)**: `~/dev/Claude/hooks-lib`新設+4hook汎用化(ROOT検出CLAUDE_PROJECT_DIR基準・ハードコード除去)+`setup-per-chat.sh`(冪等/settings.json jqマージ、一時dirで空/マージ/冪等テスト、jq selectスコープバグ修正)。novelに適用し実動確認(regen-index/session-start-check動作・inbox-check無傷)。card-battleは`chore/claude-harness-and-battle-fixes`(dirty,別チャット疑い)で保留。

#### 設計判断 / 申し送り

- 並行worktree(w0-shared-ui/docs-cleanup)競合回避のため、監査の「5レーン並列OK」を実態(2 worktreeがshared/.claudeを押さえ)で2レーンに絞った。残3レーンはマージ後。
- session-start-checkはgit toplevel優先=CLAUDE_PROJECT_DIRを渡してもcwdのgit優先(テスト時注意・実運用は各プロジェクトで起動するので問題なし)。
- card-battle/novelは旧MEMORY.md/HISTORY.md方式。setup-per-chatは旧ファイル無変更で共存(凍結)。

### 2026-06-07 - web-desktop parity W0-4/5/6 完了 + role-qa/security 並列独立監査 PASS

#### 概要

web-desktop parity ロードマップ W0（共有 UI 基盤）のうち W0-4/5/6（i18n 基盤 + 共有 UI mount 検証 + 2層モデルのドキュメント記録）が worktree `w0-shared-ui`（branch `feat/w0-shared-design-system` @`e86819e`）で完了。メインからは実装せず、**role-qa と security-reviewer を別コンテキストで並列起動して独立監査**し PASS を確認した（コード変更はメイン working tree に無し）。

#### 変更点（監査対象 = `git diff c927b27..e86819e`）

- **W0-4/5（commit `c42f96d`）**: `shared/src/i18n/index.ts`（react-i18next idempotent init / fallback=en / 永続化）+ `locales/{en,ja}.json`（各 ~2650 行）+ 共有 i18n provider + web mount 検証（`web/src/main.tsx` 改修 / `web/src/_w0demo/W0Demo.tsx` デモ）+ `shared/tests/i18n.test.ts`。
- **W0-6（commit `e86819e`）**: `docs/vision/coding-principles.md` に §6「UI 2層モデル（部品共通/画面分岐）」新設（既存 §6→§7 繰り上げ・連番正常）+ §6.4 props 経由 i18n 不変式維持を明記。`.claude/CLAUDE.md` §6.4 と移行 SSOT §0 に Option A（共有 UI 集約）方針転換を記録。

#### 検証（並列監査の実機ログ）

- **role-qa**（91.6k tok / 22 tool / 186s）: Acceptance Criteria 全達成。`shared tsc -b` exit 0 / `shared vitest` 258 pass / `web vite build` exit 0。**en/ja key parity 完全一致（各 1778 key・欠落0）**＝当初疑った行数差（2651 vs 2649）は整形差で誤検知。`escapeValue:false` は危険シンク（dangerouslySetInnerHTML/Trans/innerHTML）ゼロで実害なし。判定 PASS（merge 可）。
- **security-reviewer**（73.5k tok / 16 tool / 157s）: Critical/High/Medium 0、Low 1（デモ残留）、Info 3。新規依存 `i18next@25.10.10`/`react-i18next@16.6.6` + transitive 4 件は正規エコシステム・`npm audit` 0 件・integrity 整合。秘密情報・prototype pollution 該当なし。
- **両者一致の唯一 follow-up（merge 非ブロック）**: `web/src/_w0demo/W0Demo.tsx` が `main.tsx` で静的 import され production バンドル混入・`?w0demo` で認証なし到達可能（ただしデータ/秘密に非接触）。**W0 sign-off 時に削除**（残すなら `import.meta.env.DEV` ガード）。

#### 設計判断 / 申し送り

- **並列監査のコスパ評価**: サブエージェントは各々独立コンテキストのため「並列で 1 本あたりの質が落ちる」は起きない。落ちるのは「追加トークンあたりの新規発見量」で、W0-4/5/6 は面が狭い（i18n/docs）ため 2 本目（security）は大半が再確認だった。独立 2 本の結論収束＝クロス検証で確信度は上昇。指針: 監査本数は固定でなく**差分の面の多様さに合わせる**。`life-editor-*`（IPC/migration/sync）は該当変更ゼロのため非起動（空振りノイズ回避）。
- **次アクション**: (1) `_w0demo` 削除を W0 sign-off follow-up として実施予定（本セッションで着手）。(2) W0 全体（W0-1〜6）の main への merge（PR）は別途 git-orchestrator 経由。(3) その後 W1（UX 基盤: Settings/Theme/FontSize/Shortcut）着手。
- focus-trap on Modal/BottomSheet は `e86819e` で「follow-up (QA)」と明示宣言済みで W0 スコープ外（今回監査範囲では越境・未達なし）。

### 2026-06-07 - セクション統一 Phase1確認 + Phase3 Materials完了 + Phase2/4調査 → FROZEN一本化把握

#### 概要

Mobile 基準セクション統一の master プラン（`2026-06-05-mobile-first-section-unification.md`）まわりで、Phase 1 の PR 確認・Phase 3 の実行・Phase 2/4 の構造調査を行い、最終的に別チャットの FROZEN 判断（web 移行一本化）を把握してセッションを区切った。コード変更はメイン working tree に無し（全て別 worktree でサブエージェントが PR 化 → main merged）。

#### 変更点

- **Phase 1 (Work)**: PR 新規作成を依頼されたが、確認すると既に PR #51 が MERGED（2026-06-06）と判明。新規作成は不要だった。ローカル main が一時 3 コミット遅れだったが後に origin と一致。
- **Phase 3 (Materials)**: 専用 worktree `feat/materials-section-cleanup` でサブエージェント実行。Materials は `Ideas/DailyView`/`NotesView` が既に Desktop/Mobile 共有済みのため統一作業不要と判明。未使用 Mobile dead code 6 ファイル（`MobileDailyView` / `MobileNoteView` / `materials/{MobileNoteTree,MobileNoteTreeItem,MobileNoteTagsBar,MobileTagPicker}`、いずれも外部 import 0 を grep 確認）を `git rm` 削除（`Mobile/materials/` ディレクトリも消滅）。Files タブ（Desktop FileExplorer）は維持。build exit 0 / lint は main baseline と同一 99 problems（増減なし）。→ PR #53 MERGED（merge commit `9349d12`）。
- **Phase 2 (Schedule) / Phase 4 (Settings) 構造調査**: Explore で両セクションをマッピング。両者とも Work 型（完全分離）。Schedule = Desktop 47 / Mobile 12 ファイル、データ取得が Desktop=useScheduleContext・Mobile=getDataService 直で非対称、CalendarTagsProvider が Mobile 不在。Settings = Desktop 27 / Mobile 6 ファイル、Desktop 専用設定（キーボードショートカット/システム/サウンド/開発者ツール/Claude/エディタ）は Provider・OS 連携前提で Mobile に物理的に存在不可 → 残す一択、共有可能は Theme/Language/Sync/Timer/Notifications/Trash/Data/FontSize の 8 項目のみ。
- **FROZEN 把握（重要な意思決定）**: 別チャットが master プランを PR #55 で更新し Status を FROZEN 化。理由は `frontend/`（Tauri 版 UI）が移行 Phase 5 で破棄予定で、frontend での統一成果が `web/`+`shared/` に伝播しないため。→ frontend での Phase 2/4 統一は着手しない。Phase 2 の設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は計画書に詳細化済みで「web 移植時の仕様参照元」として保全。新統合 SSOT は `2026-06-07-web-desktop-parity-roadmap.md`（W0-W4）。
- **このチャットの Phase 2/4 設計タスクは取り下げ**（FROZEN 方針に従う。competing 回避で master プランはこのチャットから未編集）。

#### 検証

- PR #51 / #53 / #55 すべて gh で MERGED 確認。main 最新は `0ef24b5`（#55）。
- `git status --short` 空（working tree クリーン）、`rev-list --left-right --count main...origin/main` = 0 0（origin 同期）。

#### 申し送り

- 無関係な孤立 worktree 残骸 `.claude/worktrees/du-g/`（git レジストリ未登録・参照先不在）+ マージ済みローカルブランチ複数 + stash 1 件の片付け漏れあり。プラン整合性には影響なし。掃除は別途。
- 次の主軸は web-desktop-parity-roadmap（W0-W4、web/+shared/ を旧 Desktop 同等へ）。各 Phase は着手時に `2026-06-XX-web-parity-w<N>-*.md` へ子分割予定（現状未生成）。
