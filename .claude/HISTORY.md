# HISTORY.md - 変更履歴

### 2026-04-18 - Mobile Schedule & Work リデザイン（claude.ai/design バンドル準拠）（計画書: archive/2026-04-18-mobile-schedule-work-redesign.md）

#### 概要

Claude Design で作成された HTML/JSX プロトタイプ（`gysUUHAKNxXSabDTE32e1Q`）を基に、モバイル版 Schedule（旧 Calendar）と Work 画面を全面刷新。ユーザーがチャットで挙げた要件（DayCell 内アイテム chip + 下スワイプボトムシート、chip ellipsis truncation、Dayflow timegrid、タブ 4 統合）をコードに移植。全 200 テスト pass / tsc / lint / build clean。

#### 変更点

- **タブ構造刷新**: `MobileTab` を `"calendar"` → `"schedule"` に改名、順序を **Schedule / Work / Materials / Settings** に並び替え（`MobileLayout.tsx` / `MobileApp.tsx`）。初期 activeTab も `schedule` に変更。

- **Schedule Monthly 全面書き換え**: `MobileMonthlyCalendar`（`MobileCalendarView.tsx` 内）で各 DayCell に最大 3 件の inline event chip を表示、+4 件目は `+N件` overflow。均等 grid 保持のため `min-width:0` / `max-width:100%` / `overflow:hidden` を cell と chip container に適用し、長いタイトルでも列幅が崩れない。今日 = accent 丸塗り、選択日 = accent リング + tint bg、土日色分け（red-400/500）。月ヘッダーに search/today/prev/next ボタン追加。

- **Bottom sheet 新規**: `schedule/MobileDaySheet.tsx` を追加。drag handle（touch+mouse 両対応）、`38dvh ↔ 80dvh` 切替、±40px しきい値、`cubic-bezier(.2,.8,.2,1)` 280ms アニメ。タイムライン行は `{start}/{end}` カラム + 左 rail + card（check + icon + title + kind ラベル）構成。Strict Mode 対策として drag-end の副作用を state updater 外へ。

- **Dayflow timegrid 新規**: `schedule/MobileDayflowGrid.tsx` を追加。5:00–24:00 の 1 カラム時刻グリッド（54px/hour）、30 分ごと破線、イベントブロックを start/end から絶対配置、左 3px rail（kind 色）、title ellipsis。今日のみ赤い now ライン + 丸（30 秒ごと位置更新）。マウント時・日付切替時に current hour（today）または 8:00 へ auto-scroll。Dayflow ヘッダー（月日 + 曜日 + TODAY バッジ + prev/today/next）を `MobileCalendarView` 内に追加。

- **Work 画面全面書き換え**: `MobileWorkView.tsx` を以下で再構成 —— `WorkSessionTabs`（集中/休憩/長休憩 + duration 分数、active 時 pill 内白背景 + shadow）、`WorkActiveTaskChip`（4px 左 rail + `取り組み中` ラベル + タスク名 ellipsis + chevron）、`TimerRing`（280px SVG、二重 stroke + gradient + blur(8px) halo、running で opacity 1）、`SessionDots`（done = 18px rounded rect、未完 = 6px dot）、`ControlDock`（Reset 52px / Play-Pause 76px / Skip 52px、session color で shadow）。ambient 音楽カードはスコープ外として未実装（AudioProvider がモバイル非対応）。

- **データ層純関数追加**: `schedule/dayItem.ts` で `DayItem` discriminated union（`routine` / `event` / `task`）と `buildDayItems` / `buildMonthItemMap`。判定ルール: `ScheduleItem.routineId` → routine / 他の ScheduleItem → event / `TaskNode.scheduledAt` → task。`dayItem.test.ts` に 10 ケース（kind 判定、all-day、filter、sort、soft-delete、month grouping）。

- **Chip kind 用 CSS vars**: `index.css` の `:root` と `[data-theme="dark"]` に `--color-chip-{routine,event,task}-{bg,fg,dot}` を合計 9 個追加。Light/dark 両テーマで可読性を担保。

- **Tailwind token 誤用修正**: 新規コードで `bg-notion-bg-primary` / `text-notion-text-primary`（CSS var 未定義で no-op）を正しい `bg-notion-bg` / `text-notion-text` に統一。既存モバイルコードの誤用は変更範囲外として保留。

- **i18n キー追加（en/ja 両方）**: `mobile.tabs.schedule`, `mobile.schedule.subTab.*`, `mobile.schedule.daySheet.*`, `mobile.schedule.dayflow.*`, `mobile.work.focusTitle`, `mobile.work.activeTaskLabel`, `mobile.work.sessionLabel.*`, `mobile.work.session.*`, `mobile.work.sessionSub.*`, `mobile.work.remaining`, `mobile.work.dotsProgress`, `mobile.work.controls.*`。旧 `mobile.tabs.calendar` は削除（参照残存なし確認済）。

- **react-hooks/set-state-in-effect 違反修正**: `MobileMonthlyCalendar` の `useEffect(setViewDate)` を render-time 補正パターンに変更（React 公式の「props から state を調整」パターン、収束判定により無限ループなし）。

- **react-refresh/only-export-components 違反修正**: `kindPalette` ユーティリティを `MobileEventChip.tsx` から `schedule/chipPalette.ts` に分離。`MobileDaySheet` / `MobileDayflowGrid` の import 先も更新。

- **自動検証全通過**: `npx tsc --noEmit` 0 エラー / `npx eslint` 0 エラー（変更ファイル）/ `npx vitest run` 24 files 200 tests pass / `npm run build` 13.1s 成功。

### 2026-04-18 - .claude/ 構造モダナイゼーション（CLAUDE.md 軽量化 + ADR 廃止 + グローバルスキル整合）

#### 概要

life-editor の `.claude/` を全面再編し、同時にグローバルスキル（/project-setter / task-tracker / session-verifier / session-loader）を新構造に整合させた。CLAUDE.md を 805 → 345 行に圧縮しコンテキスト効率を改善。ADR 方式を廃止し、設計原則を `docs/vision/` に一元化する運用に切替。全プロジェクト共通の運用ルールを `~/.claude/CLAUDE.md` に明文化。

#### 変更点

- **life-editor CLAUDE.md 軽量化**: 805 行 → 345 行（-56%）。ビジョン系 §1-5 / AI 詳細 §8.3-8.4 / デバッグ詳細 §10.5 / Review Checklist §10.6 / 実装済み機能リスト §11 補足 / Roadmap 完了履歴を削除、抽象構想は `docs/vision/` に分離

- **docs/vision/ 新設**: `README.md` / `core.md`（Core Identity / Target User / Value Props / Non-Goals / Platform Strategy 詳細）/ `ai-integration.md`（Cognitive Architecture 要旨 + 利用シナリオ）/ `coding-principles.md`（旧 ADR-0002/0003/0004/0006/0007 の要旨統合）

- **ADR 廃止**: `docs/adr/` (ADR-0005/0006/0007) と `archive/adr/` (0001-0004) を全削除。設計原則は vision/coding-principles.md に集約し、時点判断ではなく「現在から未来に向けた継続更新される指針」として運用

- **feature_plans/ 廃止**: `2026-04-18-app-redefinition-roadmap.md` → `archive/`、`2026-04-17-daily-life-hub-requirements.md` / `application-definition-template.md` → `docs/vision/`、ディレクトリ自体を削除。実装プラン命名規則は `.claude/YYYY-MM-DD-<slug>.md`（直下配置）に統一

- **/project-setter 全面更新**: SKILL.md に新構造マッピング表と設計思想（400 行上限 / ADR 不使用 / vision 一元化）を追記。Software / Novel / Research 全 3 タイプで `vision/` + `known-issues/` + `requirements/` (Software のみ) のテンプレート追加、旧 `adr-template.md.tmpl` / `operations.md.tmpl` / `coding.md.tmpl` / `writing.md.tmpl` / `methodology.md.tmpl` を削除。`~/.claude/skills/project-setter` にシンボリックリンク作成

- **グローバル `~/.claude/CLAUDE.md` 拡張**: 13 行 → 54 行。Project Documentation Structure セクション追加（ファイル階層 / 運用原則 / CLAUDE.md 標準 9 章構成）。全プロジェクト共通のルール（400 行上限、ADR 不使用、実装プラン命名規則、known-issues 運用）を明文化

- **task-tracker 更新**: 計画書パスを `.claude/docs/feature_plans/` → `.claude/` 直下に、アーカイブ先を `.claude/docs/archive/` → `.claude/archive/` に変更。ヘッダーコメントから廃止済み `rules/operations.md` 参照を削除

- **session-verifier 汎用化**: Gate 0 のプロジェクト固有 electron パス分類を汎用カテゴリ（Frontend / Backend / Database / IPC / Tests / Config）に変更。Gate 5 の参照先を `.claude/rules/` → `.claude/docs/vision/coding-principles.md` に更新、known-issues/INDEX.md 参照を追記

- **session-loader グローバル化**: `~/.claude/skills/session-loader` を新設（標準構造前提の Step 1-5）。life-editor プロジェクト固有版は Step 6-7 で追加読込を担う構成に更新、旧 `docs/life-editor-v2/00-vision.md` / `docs/adr/0001-tech-stack.md` 参照を削除

- **skill-catalog.md 更新**: Software 推奨スキルに session-loader / session-verifier を追加、Novel / Research 推奨にも session-loader 追加

### 2026-04-18 - iOS 実機ビルド + Cloud Sync 有効化 + Known Issues ディレクトリ新設

#### 概要

1 セッションで 3 つの関連作業を完遂:
(1) Life Editor を実機 iPhone にデプロイできる環境を構築（Xcode 署名、Tauri CLI、Life Editor Note に手順保存）、
(2) Cloudflare Workers + D1 ベースの Cloud Sync を実アクティベート（Workers/Rust 側の複数バグを発見・修正し、Mac ↔ iPhone 双方向同期まで動作確認）、
(3) 本セッションで得た Root Cause 知見と未解決 Structural 問題を記録する新設ディレクトリ `.claude/docs/known-issues/` を立ち上げ、CLAUDE.md §0/§12 に参照を明記。計画書: `~/.claude/plans/xcode-xcode-life-editor-note-rosy-yeti.md`（2 回書き換え）。

#### 変更点

- **iOS 実機ビルド環境構築**: Xcode Personal Team での署名設定、iPhone 側デベロッパモード ON + 信頼設定、Vite dev server LAN 公開（`frontend/vite.config.ts` に `host: true` 追加）。Bundle ID を `com.lifeEditor.app` → `com.lifeEditor.app.newlife` に変更（ユニーク性確保）。Life Editor に「iOS 実機ビルド手順（Xcode + Tauri）」Note を MCP `create_note` 経由で保存（note-1776486115347）

- **`project.yml` 恒久修正**: `src-tauri/gen/apple/project.yml` の `settingGroups.app.base` に `PRODUCT_BUNDLE_IDENTIFIER: com.lifeEditor.app.newlife` / `DEVELOPMENT_TEAM: 542QHWHN37` / `CODE_SIGN_STYLE: Automatic` を追加。`cargo tauri ios dev` の XcodeGen 再生成で Xcode UI の手動設定が飛ぶ問題を解消（Known Issue 007）

- **Cloud Sync Workers バグ修正**（`cloud/src/routes/sync.ts`）:
  - SQL 予約語 `order` を `"order"` でエスケープする `quoteCol()` ヘルパー追加（Known Issue 001）
  - `VERSIONED_TABLES` を FK 依存順に並び替え: `routines, tasks, memos, notes, wiki_tags, time_memos, templates, routine_groups, schedule_items, calendars`（Known Issue 002）
  - `tasks.parent_id` 自己参照用の `topoSortByParent()` 関数追加
  - `PRAGMA defer_foreign_keys = ON` を batch 先頭に挿入（belt-and-suspenders）
  - `life-editor-sync` を 2 回デプロイ（version `9387c11f...` → `f118169f...`）

- **Cloud Sync Rust 側修正**（`src-tauri/src/sync/sync_engine.rs`）: `table_columns()` ヘルパー追加。`upsert_versioned` / `insert_or_replace` で `PRAGMA table_info` の結果から payload キーをフィルタし、ローカルに存在しないカラムは silently 捨てる。これで新機能追加時の schema drift に対して sync が壊れなくなる（Known Issue 003）

- **初期スキーマ + 防御的 ALTER**（`src-tauri/src/db/migrations.rs`）: fresh DB 用 `CREATE TABLE schedule_items`（line 293）に抜けていた `template_id TEXT` カラムを追加。既存 DB 用に `has_column` ガード付きの `ALTER TABLE schedule_items ADD COLUMN template_id TEXT` を migration 末尾に追加（Known Issue 003）

- **tasks.updated_at バックフィル**: Mac の DB で 120/120 件が NULL だったため、`UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')` で暫定対応。根本原因（task 作成パスが updated_at を set していない）は未解決 → Known Issue 005 として追跡

- **`tauri.conf.json` identifier 更新**: `com.lifeEditor.app` → `com.lifeEditor.app.newlife`

- **Cloud Sync 動作確認**: D1 に `tasks 120 / notes 34 / memos 29 / schedule_items 757 / routines 12 / wiki_tags 19 / templates 1` が同期完了。iPhone 側 Full Download で Mac のデータが反映されることを確認

- **Known Issues ディレクトリ新設**（`.claude/docs/known-issues/`）: `_TEMPLATE.md` + `INDEX.md` + 7 件の Issue ファイル作成
  - Fixed (4 件): 001 SQL 予約語 / 002 FK 順序 / 003 schema drift / 007 XcodeGen 再生成
  - Active (2 件): 004 sync_last_synced_at 未保存 / 005 tasks.updated_at NULL
  - Monitoring (1 件): 006 Desktop app_data_dir bundle ID 分裂

- **CLAUDE.md 更新**: §0 Meta 関連ドキュメントテーブルに `known-issues/` 行（INDEX 直リンク付き）追加。§12 Document System 詳細テーブルに同行追加 + 「Known Issue ライフサイクル」節を新設し、発見 / 着手 / 解決 / Monitoring の運用フローを明記

---

### 2026-04-18 - Phase C Execution 完遂（S-5 / S-6 実装 + I-1 / S-4 計測 → Drop）

#### 概要

MEMORY.md 優先順位に沿って Phase C の 4 件を一括実行。実装系 2 件 (S-5 / S-6) を完遂し、計測系 2 件 (I-1 / S-4) を計測結果で Drop 判定 → `archive/dropped/` へ移動。計画書: `/Users/newlife/.claude/plans/memory-md-mossy-micali.md`

#### 変更点

##### S-5: Service Error Handler Hook（実装完了）

- 新規: `frontend/src/hooks/useServiceErrorHandler.ts` + `.test.ts` (6/6 pass)
  - シグネチャ: `() => { handle(err, i18nKey, { silent?, rateLimitMs? }) }`
  - 既定: toast + DEV 時 console.error + 5s 同一 key dedup
- i18n: `errors.timer.*` / `errors.sync.*` / `errors.schedule.*` を en/ja 両方に追加
- 移行: `TimerContext.tsx` (10 catch → hook 経由) / `SyncContext.tsx` (reportError を hook 経由に統一) / `MobileCalendarView.tsx` (7 console.error → hook 経由)
- `tier-2-supporting.md` §Toast Known Issues S-5 を「解消」に更新
- archive: `.claude/archive/2026-04-18-service-error-handler-hook.md`

##### S-6: Optional Context Hook インフラ（実装完了）

- 新規: `frontend/src/hooks/createOptionalContextHook.ts` + `.test.tsx` (2/2 pass)
- 新規: 6 Optional hook (`useAudioContextOptional` / `useScreenLockContextOptional` / `useFileExplorerContextOptional` / `useCalendarTagsContextOptional` / `useWikiTagsOptional` / `useShortcutConfigOptional`)
- 現状 Mobile から 6 hook への到達経路はゼロのため既存 hook 書換は不要、将来の共有コンポーネント向け安全装置として配備
- `CLAUDE.md` §9.2 Pattern A に「Mobile 省略 Provider は Optional バリアントを用意」ルール追記
- archive: `.claude/archive/2026-04-18-context-hook-optional.md`

##### I-1: Tasks Fetch by Range（計測 → Drop）

- Rust bench 追加: `src-tauri/src/db/task_repository.rs` の `fetch_tree_benchmark` (`#[ignore]`、`cargo test --release --lib db::task_repository::fetch_tree_benchmark -- --ignored --nocapture`)
- 計測結果（M1 Mac, in-memory SQLite, release build, 10 runs/size）:
  - n=500: avg 3.17ms / max 3.65ms
  - n=1000: avg 6.11ms / max 6.35ms
  - n=3000: avg 19.42ms / max 25.03ms
- iOS 5x 補正 + IPC/JS parse 込みでも 500ms しきい値未達 → **Drop**
- `tier-1-core.md` §Tasks Known Issues I-1 を「Drop」に更新
- archive: `.claude/archive/dropped/2026-04-18-tasks-fetch-by-range.md`

##### S-4: Folder Progress Batch Memo（計測 → Drop）

- Vitest bench 追加: `frontend/src/utils/folderProgress.bench.test.ts`
- 計測結果（M1 Mac, Node 20, 20 runs/size, 全フォルダ 1 サイクル再計算 = 最悪ケース）:
  - F=50 × T=10 (550 nodes): avg 0.27ms / max 0.85ms
  - F=100 × T=20 (2100 nodes): avg 1.87ms / max 1.94ms
  - F=200 × T=10 (2200 nodes): avg 3.33ms / max 3.35ms
  - F=100 × T=50 (5100 nodes): avg 4.31ms / max 4.58ms
  - F=50 × T=100 (5050 nodes): avg 2.08ms / max 2.12ms
- 全サイズで 50ms しきい値の 1/10 未満 → **Drop**（Compiler 有効化も不要と判断、別プラン送り）
- `tier-1-core.md` §Tasks Known Issues S-4 を「Drop」に更新
- archive: `.claude/archive/dropped/2026-04-18-folder-progress-batch-memo.md`

##### ドキュメント同期

- `CLAUDE.md` §13 Roadmap: 現在進行中を空に、保留中から I-1 / S-4 / S-5 / S-6 を除去（S-2 のみ残）
- `MEMORY.md`: 進行中を空に、直近の完了に Phase C 成果を追記、予定から 4 件 plan を除去

#### 計測・テスト結果

- フロントエンド: `npx vitest run` — 22 files / 190 tests pass（S-5 で +6、S-6 で +2、S-4 bench で +1）
- Rust: `cargo test --release` — 問題なし
- TypeScript: `tsc --noEmit` クリーン

---

### 2026-04-18 - iOS Safe Area + TitleBar ドラッグ修復 完了（進行中 2 件 archive 移動）

#### 概要

MEMORY.md 進行中の 2 件をユーザー動作確認（両件 OK）経由で完了 → archive 移動。Phase C 新規 plan 4 件（S-5 / S-6 / I-1 / S-4）の実行前クリーンアップ。

#### 変更点

- `.claude/feature_plans/2026-04-17-ios-safe-area.md` → Status: COMPLETED + `archive/` 移動（Step 1-3 実装済、Step 4 は不要判断で Skip）
- TitleBar ドラッグ修復は plan 書類なし、MEMORY.md「進行中」除去のみ（実装は `TitleBar.tsx` / `platform.ts` / `capabilities/default.json` のコミット済）
- `.claude/MEMORY.md`: 進行中 2 件を除去、直近の完了に追記、進行中に Phase C 実行を追加

<!-- older entries archived to HISTORY-archive.md -->
