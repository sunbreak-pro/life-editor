# HISTORY.md - 変更履歴

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

---

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase C 完了（feature_plan 棚卸し + 保留 5 件 Verdict 確定）（計画書: archive/2026-04-18-integrated-design-roadmap.md）

#### 概要

Phase B に続いて Phase C を完遂。事前データ表（calendar plan §Phase C）をベースに既存 feature_plan 9 件を Merge / Drop 判定で archive へ移動し、保留 5 件（I-1 / S-2 / S-4 / S-5 / S-6）の Verdict を確定。Keep 判定の 4 件を新規 plan、Modify / Option A 決定の 2 件を新規 ADR として起票。これで Life Editor プロジェクトの SSOT（CLAUDE.md 13 章 + requirements/ 26 機能）と、アクティブ plan 群（4 件の具体的な実装候補）が一貫した状態で整った。

#### 変更点

- **feature_plan 9 件の archive 移動**:
  - Drop 5 件 → `.claude/archive/dropped/`:
    - `019-phase1-security-critical-fixes.md`（Electron 前提、2026-02-22 作成 3 ヶ月放置）
    - `020-phase2-data-integrity.md` / `021-phase3-architecture-improvement.md` / `022-phase4-quality-optimization.md`（同上、Tauri 2.0 migration で対象コード消失）
    - `2026-04-14-capacitor-ios-standalone.md`（Tauri Mobile 採用で不要）
  - Merge 4 件 → `.claude/archive/`:
    - `023-cmux-terminal-features.md` → Terminal Future Enhancements（分割ペインのみ採用、Socket API は Boundary と矛盾で不採用）
    - `025-life-editor-ui-ux-refactor.md` → CLAUDE.md §1-5 + tier-2-supporting の Theme / Shortcuts に吸収済
    - `2026-03-16-mobile-phase2-realtime-sync.md` → Cloud Sync Future Enhancements（WebSocket / SSE リアルタイム push）
    - `2026-03-16-mobile-phase3-offline-standalone.md` → Cloud Sync Known Issues + Future（オフラインキュー / conflict resolution / claude\_\* テーブル対応）
  - 各ファイルに `Status: DROPPED (reason)` または `Status: MERGED (target + reason)` マークを追記

- **保留 5 件の Verdict 確定と後続ファイル起票**:
  - **I-1 (Rust `db_tasks_fetch_by_scheduled_range`)**: Keep (measurement-first) → `.claude/feature_plans/2026-04-18-tasks-fetch-by-range.md` 起票（iOS で 500 / 1000 / 3000 件計測 → しきい値 500ms 以上なら実装）
  - **S-2 (Tauri IPC naming policy)**: Modify (ADR-only) → `.claude/docs/adr/ADR-0006-tauri-ipc-naming-policy.md` 起票。規約明文化のみ、150 コマンド全件 typed struct 化は不採用
  - **S-4 (computeFolderProgress batch memo)**: Keep (measurement-first) → `.claude/feature_plans/2026-04-18-folder-progress-batch-memo.md` 起票（React Compiler 有効化後再計測、Profiler で 150ms 超なら一括 Map 計算に切替）
  - **S-5 (useServiceErrorHandler)**: Keep (immediate) → `.claude/feature_plans/2026-04-18-service-error-handler-hook.md` 起票。V2「信頼できるデータ」を silent failure が直接損なうため即時実装可
  - **S-6 (Mobile Provider strategy)**: Keep Option A → `.claude/docs/adr/ADR-0007-mobile-provider-strategy.md` で Optional hook 採用決定 + `.claude/feature_plans/2026-04-18-context-hook-optional.md` 実装 plan 起票。Stub Provider（Option B）は Mobile バンドル膨張のため不採用

- **deferred-items-reevaluation.md**: Status: Consumed (Phase C 完了) に更新 + 冒頭に Verdict 集約表を追加 → `.claude/archive/` に移動

- **requirements/ の Related Plans 更新**:
  - §Tasks Related Plans: I-1 / S-4 の新規 plan リンク追加
  - §Schedule Related Plans: Schedule 3 Provider ADR のリンクは archive 維持（変更なし）
  - §Cloud Sync Related Plans: MERGED 2 件を archive リンクに書換 + 吸収済 note 追記
  - §Terminal Related Plans: MERGED 023 を archive リンクに書換 + Boundary 矛盾 note 追記
  - §Toast Known Issues: S-5 の新規 plan リンク追加 + Related Plans セクション新設

- **計画書更新**: §Phase C-1（Steps 5 件 + Verification 3 件）と §Phase C-2（Steps 6 件 + Verification 4 件）を全て `[x]` に

- **MEMORY.md 更新**: 直近完了に Phase C 追加、予定を「Phase C 起票の新規 plan 4 件（優先度順）」に書換。1. S-5 即時実装可 / 2. S-6 Option A 実装 / 3. I-1 計測 first / 4. S-4 計測 first の順

- **最終状態サマリー**:
  - `.claude/feature_plans/` PLANNED: 4 件（Phase C 起票、他は Consumed/Superseded/IN_PROGRESS）
  - `.claude/docs/adr/` Active: 3 件（ADR-0005 PROPOSED / ADR-0006 Accepted / ADR-0007 Accepted）
  - `.claude/archive/dropped/` 新設: 5 件（Electron 前提 Plan + Capacitor）
  - `.claude/archive/` Merge 4 件追加

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase B 完了（Tier 1-3 全 26 機能要件定義）

#### 概要

同日 B-1 完了に続けて Phase B-2 / B-3 を連続実施し、全 Tier の要件定義を完遂。Tier 2（12 機能 / AC 各 3-6 件）と Tier 3（6 機能 / Verdict 付き）を記入し、CLAUDE.md §11 に相互リンク（markdown link）+ Verdict 反映を行った。CLAUDE.md §11 機能数 = requirements/ 機能数 = 26 で差分ゼロを確認。Phase C（実装プラン群の整理 + 保留 5 件再評価）は次セッション以降。

#### 変更点

- **tier-2-supporting.md（364 → 495 行）**: 全 12 機能の Purpose / Boundary / AC 3-6 件 / Dependencies を記入。プレースホルダ残存ゼロを grep 確認
- **Audio Mixer**: AC 5 件（on/off + ボリューム、magic bytes 検証、プリセット、タグ、AudioContext resume）
- **Playlist**: AC 5 件（DnD reorder、タイマー連動自動開始、シャッフル / リピート、Pause 追従）
- **Pomodoro Timer**: AC 6 件（プリセット、完了フロー、3 箇所残り時間同期、±5m 調整、timer_sessions 記録、sessionsBeforeLongBreak）
- **WikiTags**: AC 5 件（横断付与、sync_inline_tags、CRUD + 色ピッカー、接続の有向グラフ、MCP tag_entity）+ IPC 21 件列挙
- **File Explorer**: AC 5 件（ルート選択、パストラバーサル検証、FileEditor 永続化、attachment_save、Mobile 省略）+ IPC 17 件列挙
- **Templates**: AC 4 件（JSON 保存、新規 ID 展開、ソフトデリート、rename）+ `task_templates` レガシーテーブル残留を Known Issues に記録（実コード調査発見）
- **UndoRedo / Theme / i18n / Shortcuts / Toast / Trash**: AC 3-5 件ずつ記入（ドメイン別スタック / 10 段階フォント / en/ja / 29 shortcuts / 4 種トースト / 7 ドメイン復元）
- **tier-3-experimental.md（173 行）**: 6 機能に Verdict ラベル付与
  - **Paper Boards**: 凍結継続（13 commits、2026-04-12 で機能追加停止、Notes / WikiTag Connections で代替可）
  - **Analytics**: 凍結継続 + ADR-0005 Phase 4 統合予定（17 commits、2026-02-25 で機能追加停止）
  - **NotebookLM / Google Calendar / Google Drive**: 未着手（Claude 経由代替 / ICS 購読 Phase 1 / google-drive MCP で各対応）
  - **Cognitive Architecture (ADR-0005)**: PROPOSED 維持（Phase 1 から段階着手）
- **CLAUDE.md §11 更新**: tier-1/2/3 リンクを markdown link 化、各 Tier 冒頭の「（Phase B-X で作成予定）」を「（N 機能、各 AC X-Y 件、Phase B-X 完了）」に変更、Tier 3 の Paper Boards / Analytics 等に Verdict ラベルを反映
- **計画書更新**: §Phase B-2（Steps 3 件 + Verification 3 件）と §Phase B-3（Steps 6 件 + Verification 2 件）を全て `[x]` に
- **MEMORY.md 更新**: 直近完了を「Phase B 完了」に集約、予定を Phase C に書換（起点ファイル / 準備済みデータ / 最初のアクションを具体化）
- **実コード整合の発見と記録**:
  - Templates の `task_templates` はレガシー残留（migrations.rs で CREATE するが CRUD コマンドなし、data_io_commands リセット時のみ DELETE 対象）→ Known Issues 記録
  - Paper Boards の Owner Provider パスは `frontend/src/components/Ideas/Connect/Paper/`（骨格の `PaperBoards/` は誤り）→ 正しいパスに修正
- **機能数サマリー**: Tier 1: 8 / Tier 2: 12 / Tier 3: 6 = 合計 **26 機能**（CLAUDE.md §11 と差分ゼロ）

<!-- older entries archived to HISTORY-archive.md -->
