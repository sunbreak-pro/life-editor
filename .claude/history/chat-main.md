# HISTORY (chat-main)

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

> 古いエントリは [`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
