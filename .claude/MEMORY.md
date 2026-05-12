# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ クロスプラットフォーム移行 Phase 0 Day 1-3 — Vite + React + TS + Tailwind 基礎（着手日: 2026-04-29）

**対象**: `~/dev/learning/applications/life-editor-web-first/day-01-03-vite-react-ts-tailwind/`（教材） + `~/dev/learning/applications/_spikes/web-first-spike-1/`（実プロジェクト、別 git repo）
**計画書**: `.claude/docs/vision/plans/2026-05-04-cross-platform-migration.md`（Phase 0 セクション、SSOT）。旧 `.claude/2026-04-29-web-first-migration.md` は archive 済（後継プランで Electron 章追加）

- 前回: —
- 現在: Day 1 ハンズオン途中。Vite + React + TS scaffolding は完了、Tailwind wiring が抜けていることを確認（`spike-1/package.json` に `tailwindcss` + `@tailwindcss/vite` 未登録 / `vite.config.ts` に `tailwindcss()` plugin 未追加 / `src/index.css` に `@import "tailwindcss";` 未追加）。原因は最初の `@teilwindcss` タイポ後、リカバリ時に親ディレクトリ `~/dev/learning/` で `npm install` 実行してしまい、Tailwind が `~/dev/learning/node_modules/` に入った（spike-1 ではない）。`~/dev/learning/.gitignore` で迷子の `package.json` / `package-lock.json` / `node_modules/` を除外済
- 次: spike-1 で正しく `npm install -D tailwindcss @tailwindcss/vite` → `vite.config.ts` 編集 → `index.css` 編集 → ブラウザで濃いグレー背景 + 白い太字 "Hello, Tailwind" 確認 → Q1/Q2 (dev vs build / TS の実行モデル) は正解済 → Day 2 教材 `day-02-counter-and-forms.md` 既作成（useState + controlled component + IME 対応）

## 直近の完了

- Code Explanation ディレクトリの Section 別再構成 ✅（2026-05-12）— 旧 `.claude/docs/code-explanation/` 配下 16 ファイル（00-index / 01-architecture-overview / 02-infrastructure / 10〜15 task / 20〜23 timer / 30〜31 sound）を全削除し、CLAUDE.md §3.3 の Section ID に沿った 5 ファイル（`00-index.md` / `10-schedule.md` / `11-materials.md` / `12-work.md` / `13-analytics.md`）に再構成。各 Section ドキュメントは feature-files スキル準拠の構成（概要 → ファイル表 → Context/Hook → データ層 → 主要関数 → 副作用）で統一、Mobile 省略 Provider・Web 移行影響・Cloud Sync 対象判定の注意点を併記。Connect ビューは Materials の延長として 11-materials.md に内包、Settings は個別 doc 未作成（直接読む方針）
- RichEditor / Events / TaskDetail UI 改修 5 件バッチ ✅（2026-05-12）— Phase A: Heading Custom 入力 UI バグ修正 (`CommandPanel.tsx` の `deleteSlashText` 呼び出しを Enter 時点まで遅延し CommandPanel の unmount を防止) + checkbox UI 統一 4 箇所（TipTap TaskItem を `CustomTaskItem` NodeView 化 + `RoundedCheckbox` を TaskTree 未完了タスク / DayFlow `ScheduleItemBlock` / Database checkbox property に展開、`RoundedCheckbox` に `disabled` / `ariaLabel` / `variant: "complete" | "accent"` / `stopPropagation` を追加、旧 `<input type="checkbox">` + `accent-color` CSS は完全削除）。Phase B: BubbleMenu に "Turn into" ボタン追加 → 既存 `CommandPanel` を **フル機能で** `mode="selection"` 展開可能に（`.bubble-toolbar-turn-into` CSS 追加）。Phase C: `useTaskTreeCRUD.expandToNode(id)` 新設（ancestor chain 全 expand）→ `useTaskTreeAPI` 経由で `TaskTreeContextValue` 自動公開 → `TaskSidebarContent` / `FolderSidebarContent` の breadcrumb 全 ancestor を左クリックで画面遷移 / **右クリックで IconPicker** 起動の代替動線を維持。Phase D: V70 migration（`timer_sessions.event_id TEXT` + `schedule_items.actual_time_minutes INTEGER NOT NULL DEFAULT 0` を per-version / full*schema / Cloud D1 `0008*\*.sql` の 3 系統に整合追加、`LATEST_USER_VERSION = 70` bump）+ IPC 4 点同期（`db_timer_start_session`の`event_id`引数追加 +`db_schedule_items_increment_actual_minutes`新規コマンド +`lib.rs::generate_handler!`登録 +`DataService`/`TauriDataService`拡張）+`TimerContext.startForEvent(id, title)`新設で`ActiveTask.kind: "task" | "event"`多態化 +`useSessionCompletionToast`が Event 完了時に`incrementScheduleItemActualMinutes`で`schedule_items.actual_time_minutes` を累積書き戻し + EventList を TaskTree 風 hover アクションに改修（`<Play>` で Pomodoro 起動、`<Trash2>`で`softDeleteScheduleItem`）。**Verification**: Rust 25 passed (1 ignored) / Frontend 44 files / 391 tests pass（新規 +10 テスト: `expandToNode` ×4、`useSessionCompletionToast`Event 経路 ×2、Task 経路含む 6 件 + EventList の Timer mock 追加 +`within`unused import 修正）/`tsc -b` 0 / session-verifier 全 6 ゲート PASS（lint findings は MEMORY 既記録の pre-existing のみ）。**手動 UI 検証**: 未実施。`cargo tauri dev`で A-1 Custom 入力 / A-3〜A-6 checkbox 統一 / B Bubble の Turn into / C breadcrumb 遷移 / D Event Work + actual_time_minutes 累積を要確認。**ブランチ**:`feat/richeditor-events-ui-batch`
- チャット間ファイル通信プロトコル (.claude/comm/) Phase 1 配置 + CLAUDE.md §9 更新 ✅（2026-05-10）

## 予定

> **注**: 以下の予定タスクの大半は旧 Tauri / Cloudflare アーキテクチャ前提で書かれており、Web ファースト移行（refactor/web-first-v2）の進行に伴って **deprecated** になる可能性が高い。各タスクの存続判断は移行 Phase 1-2 進行時に再評価する。

### ユーザー並行作業の TS エラー解消（別コミット）

**対象**: `App.tsx` / `CommandPalette.tsx` / `Schedule/ScheduleSection.tsx` / `Settings.tsx` / `Ideas/{Connect,Paper,Daily,Materials}Sidebar.tsx` / `useAppCommands.ts` / `useSectionCommands.ts` / 新規 `SearchTrigger.tsx` / `lucideIconRegistry.ts`
**背景**: 本セッションの Routine Tag→Group 移行とは独立して進行している検索トリガー refactor 由来の TS エラー: `sidebarSearchQuery is not defined` (ScheduleSection.tsx) / TS6133 unused vars 多数 / `searchPlaceholder` props 不整合
**手順**: 検索トリガーの refactor を一旦完成させ tsc -b clean に戻す → コミット

### Q2 機能パッチ Phase D / Phase A Cloud Sync の手動 UI 検証

**対象**: macOS app launch / 既定ブラウザ選択 / iOS Drawer 表示 / 双方向同期の動作確認
**前提**: D1 migration 0003/0004/0005/0006 全適用済 + Worker latest deploy 済 (2026-04-25 完了)
**手順**:

1. Desktop で Sync Now 実走 → `Last error` が消えて Connected 表示が維持されることを確認
2. Desktop V67 自動 apply 確認 → LeftSidebar に「Links」セクション表示 / `+` で URL/App リンク追加 / 既定ブラウザ切替で URL 起動先が変わる / `/Applications/*.app` 一覧から登録できる
3. iOS シミュレータ Drawer に `kind='app'` がグレーアウト + Toast 出ることを確認
4. Desktop ↔ iOS 双方向 sync で sidebar_links と calendar_tag_assignments が伝搬すること
5. **Known Issue 016 検討**: D1 0004 が transactional rollback 保証下にも関わらず `calendar_tag_assignments` rebuild 部分のみ未適用となった原因の調査・記録 (`docs/known-issues/_TEMPLATE.md` から起票)

### リファクタリング Phase 2-4 / 3-1 / 3-4 検証用実装計画の手動実施

**対象**: Desktop / iOS 実機での UI 回帰検証 + Cloud Sync round-trip
**計画書**: `.claude/docs/vision/plans/2026-04-26-refactoring-verification-plan.md` (Status: AUTOMATED COMPLETE / MANUAL PENDING)
**前提**: 自動検証 (S-1 Rust build/test / S-7 calendarGrid 境界ケース 20/20 / S-8 fetch_tree benchmark 100ms 基準内 / S-9 plan ファイル反映) は 2026-04-26 完遂済。残るは手動 UI / Cloud Sync / docs 整理のみ
**手順**:

1. **S-2 IPC 統合**: Desktop 起動 → Tasks / Notes / Dailies / Schedule / Routines / Database / Wiki Tags / Paper Boards / Sound / Templates / Sidebar Links 全 11 ドメインの fetch 経路でエラー無し
2. **S-3 Cloud Sync round-trip**: 5 ドメイン変更 → push → 別端末 pull → 完走 + 5000 行超で `nextSince` cursor 進行確認
3. **S-4 Calendar Mobile**: Monday 始まり / 月遷移スワイプ / chip 表示 / Today ハイライト / 月境界 item
4. **S-5 Calendar Desktop**: Sunday 始まり / 6 行固定 / WeeklyTimeGrid / DayCell 描画 / Routine ハイライト
5. **S-6 Schedule View**: MobileScheduleView 週 dots / 週遷移 (`getMondayOf` 基準) / 月跨ぎラベル / Desktop ScheduleSection 4 タブ / DualColumn toggle
6. **S-9 docs 整理 (UI 検証完了後)**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新

### Realtime Sync Phase 1 実装 — foreground 可変 polling + 変更イベント駆動 push

**対象**: `frontend/src/context/SyncContext.tsx` / DataService mutation 呼出層
**背景**: 現状 30 秒間隔 polling で往復 60 秒ラグ。「DB 共有の実感」が薄い
**手順**: Visibility API 観測 → フォアグラウンド 3-5s / 非アクティブ 60s、主要 mutation 後に debounced `triggerSync()`
**参照**: `.claude/docs/vision/realtime-sync.md` Phase 1

### Mobile Settings に Full Re-sync ボタン追加

**対象**: `frontend/src/components/Mobile/MobileSettingsView.tsx::MobileSyncSection` (line 159-183)
**背景**: Desktop `SyncSettings.tsx` には `fullDownload` ボタンがあるが Mobile 側は `triggerSync` + `disconnect` の 2 ボタンのみ。初回 pull が truncate した時に「Disconnect → Reconnect」の 3 手順が必要で UX が悪い

### Desktop パッケージ版の更新

**対象**: `/Applications/Life Editor.app`
**背景**: 現在の /Applications 配下は session 前の Rust バイナリ(V63 migration / create() guard / sync_engine 特別扱いを含まない)。V63 は DB に既適用済なので実害は限定的だが、新規 Routine 作成時の (routine_id, date) UNIQUE 違反を graceful に握りつぶす guard が無い
**手順**: `cargo tauri build` → `target/release/bundle/macos/Life Editor.app` を `/Applications/` 既存と置換

### 旧バンドル DB の orphan クリーンアップ

**対象**:

- `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59、旧 routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments を保持)
- `~/Library/Application Support/sonic-flow/life-editor.db` (user_version=0、空)

**背景**: bundle ID 変遷（旧 `sonic-flow` → `com.lifeEditor.app` → 現行 `com.lifeEditor.app.newlife`）の遺産。Known Issue 006 関連。現在の app は `~/Library/Application Support/life-editor/life-editor.db` (user_version=69) を使うため上記 2 つは orphan。実害はないが (a) ストレージを浪費 / (b) 検証時に grep で誤って旧 DB を引いて混乱する（実際 2026-04-29 の Routine Tag 廃止検証の際に発生）
**前提**: 削除前に rescue 価値のあるデータが無いことを確認。`sonic-flow/sonic-flow.db` は別プロジェクト(Sonic Flow アプリ本体)なので残す
**手順**:

1. `sqlite3 <旧 DB path> "SELECT COUNT(*) FROM routines WHERE is_deleted=0; SELECT COUNT(*) FROM tasks WHERE is_deleted=0; SELECT COUNT(*) FROM notes WHERE is_deleted=0"` で各テーブル行数を確認
2. 行があれば `~/Backups/orphan-life-editor-<bundle_id>-$(date +%Y%m%d).db` に退避（rsync ではなく `cp` で WAL 含めず単一ファイル退避）
3. `rm <旧 DB path>` （`life-editor.db-shm` / `life-editor.db-wal` も同時削除）
4. アプリ再起動して動作影響なし + `find ~/Library/Application\ Support -name 'life-editor.db'` の結果が `~/Library/Application Support/life-editor/life-editor.db` の 1 件のみになることを確認

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証

### iOS 追加機能要件の残タスク（Phase 4 M-1 / Phase 5 / Phase 6.2 / Mobile C-3）

**対象**: `NoteTreeNode` (行スワイプ) / `components/Notes/extensions/SlashCommand.ts` (新規) / `MobileCalendarView` の filter UI / `MobileScheduleItemForm` (5-role 対応)
**背景**: 2026-04-24 Phase 8 完了時点で以下を次セッションに繰越:

- **M-1 行スワイプ (edit / pin / delete)**: 既存 `NoteTreeNode` が DnD + hover UI を抱えるため touch-UX 再設計が必要
- **M-2 / M-3 TipTap slash command + empty line hint**: `@tiptap/suggestion` 依存追加 + ポップオーバー UI 新規実装
- **C-2 Calendar filter / sort**: role multi-select + sort UI 設計が必要（drawer 内 filter sheet として実装予定）
- **Mobile C-3**: `MobileScheduleItemForm` を event 専用から 5-role 選択対応にリファクタ

**参照**: `~/.claude/plans/life-editor-note-ios-calm-moth.md` Phase 4-6

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。暫定対応は sync query の `datetime()` 正規化、恒久対応は書き込み側を ISO 8601 に統一
- **delta sync が updated_at 単調性に依存（Known Issue 014）**: Mobile 11:50 編集 v=372 と Desktop 13:30 編集 v=228 のような高 version + 古 updated_at が Cloud に居座ると `WHERE updated_at > since` では永久に pull されない。Full Re-sync が緊急弁。本命は Cloud D1 に `server_updated_at` 列を追加して delta cursor をそちらへ切り替え
- **Cloud D1 migration が Desktop migration と同一テーブル前提になりがち**: 0002 を流用しようとしたら `note_links` / `paper_nodes` が D1 に無く失敗。Desktop schema は superset、Cloud は subset という認識を migration 作成時に徹底
- **Cloud deploy と D1 migration の tai-ming**: Worker を deploy すると新 schema を前提に push INSERT を試み、D1 が未 migration だと batch 全ロールバック → sync 全体が silent に停止。deploy と migration を必ずセットで運用
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **D1 の compound SELECT 制限**: `UNION ALL` は 5 本まで。診断 SQL で 6 本以上繋ぐと `too many terms` エラー。個別 `--command` で回す
- **wrangler d1 execute の引数**: 相対パスは CWD 基準 / 長いコマンドを `\` で改行するとシェルによっては `--file=` 以降が別コマンド扱いで Unknown argument。1 行で書くのが確実
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない。014 のような状況で詰む
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Desktop パッケージ版と HEAD 実装の乖離**: V64 migration は DB に適用される必要あり、`/Applications/Life Editor.app` の Rust バイナリは旧版のままだと Daily テーブル未対応で起動時 migration 走行 → dailies への rename を経験する。新規ビルドを置換推奨
- **iOS binary と Cloud schema の三者不整合**: Desktop / iOS / Cloud のどれか 1 つでも古いまま運用すると sync が silent に壊れる。V64 のような rename 系 migration は 3 端末同時更新が前提
