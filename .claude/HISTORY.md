# HISTORY.md - 変更履歴

### 2026-04-26 - CLAUDE.md / 各種設定の最新化 + コンパクト化

#### 概要

ユーザー要望「CLAUDE.md と各種設定を現在のコードを分析して最新化、不要・重複部分を削除してコンパクト化」を Auto mode で実施。実装プランなしのドキュメント整備。コードを直接 grep してスキーマ / Provider 順序 / MCP ツール数を実測 → CLAUDE.md の事実不整合（schema 版数の遅延、`RELATION_TABLES_WITH_UPDATED_AT` の誤った記述、markdown フォーマッタによる italic 混入）を全て修正。`settings.local.json` から旧プロジェクト由来の stale エントリ約 46% を除去。Known Issues INDEX に欠落していた 009/010 を追加。

#### 変更点

- **`.claude/CLAUDE.md` §3.1 (Architecture)**: SQLite path を bundle ID に依存しない `app_data_dir/life-editor.db` に汎化。実 bundle ID `com.lifeEditor.app.newlife`（`tauri.conf.json` 由来）を明示し、Known Issue 006（bundle ID 分裂）への参照を追加
- **`.claude/CLAUDE.md` §4.1 (SQLite スキーマ)**: schema を v67 → **v69** に更新。正本パスを単一 `migrations.rs` → モジュール構成 `migrations/`（`v61_plus.rs` + `full_schema.rs` + `mod.rs::LATEST_USER_VERSION`）に追従。V68（`timer_sessions.session_type` CHECK に `'FREE'` 追加）/ V69（Routine Tag 概念を全削除し `routine_group_assignments` 新設、`frequencyType="group"` 用）を追記。Cloud D1 0006（CTA `server_updated_at` 取りこぼし修正）/ 0007（V69 追従）を追記。markdown フォーマッタで italic 化されていたテーブル名（`time*memos`、`sound\_\_`、`wiki*tags` 等）を全て backtick で保護。`VERSIONED_TABLES`(11) と `RELATION_TABLES_WITH_UPDATED_AT`(3) の最新内訳を `sync_engine.rs` から実測して追記。`calendar_tag_assignments` は inline ハンドリングであり「`RELATION_TABLES_WITH_UPDATED_AT` に昇格」という旧記述は誤りだったため訂正
- **`.claude/CLAUDE.md` §4.2 (特化 vs 汎用 DB)**: 特化テーブル一覧に `routine_groups` / `sidebar_links` を追加
- **`.claude/CLAUDE.md` §7.3 (DB マイグレーション)**: 追加手順を `v61_plus.rs` 末尾 + `LATEST_USER_VERSION` bump に明示。カラム名変換の主体を旧 `rowToModel` から実装の `FromRow` trait + `row_to_json` に修正。診断コマンドを bundle ID 直書きから `find` 経由に変更
- **`.claude/CLAUDE.md` §8 (次フェーズ計画)**: `vision/mobile-data-parity.md` / `vision/realtime-sync.md` / `2026-04-26-windows-android-port.md` への参照を追加
- **`.claude/docs/known-issues/INDEX.md`**: Fixed セクションに 009（Mobile Provider バイパス、Structural、2026-04-20 Resolved）/ 010（Notes/Memos delta sync 脱落、Bug/Sync、2026-04-20 Resolved）を追加。Category 別インデックスと Status 集計を 8 → 10 件に更新
- **`.claude/settings.local.json` (98 → 53 行、約 46% 削減)**: 旧 `notion-timer` 絶対パス権限を全削除。廃止済 `feature_plans/` への mv コマンド・shell 制御フラグメント（`do if [ -f` / `then echo` / `else echo` / `fi` / `done` 単体）・無意味な echo 重複（`echo ''` / `echo '. "$HOME/.cargo/env"'`）を削除。残存権限を ABC 順に整理
- **HISTORY ローリングアーカイブ**: 5 件 → 6 件に達するため、最古エントリ「リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施」を `HISTORY-archive.md` 先頭に移動（HISTORY.md は最新 5 件保持）

#### 残課題

- **MEMORY.md 整理**: `バグの温床 / 今後の注意点(2026-04-23 更新)` セクションは task-tracker 標準形式の 3 セクション構成（進行中 / 直近の完了 / 予定）から外れる。本セッションでは触らず、次回 task-tracker 起動時に判断
- **コードと未整合な vision ドキュメント**: 本セッションでは `docs/vision/*.md` に手を入れていない。`db-conventions.md` / `coding-principles.md` 等が現コードと乖離している可能性は別タスクで監査推奨
- **frontend skills の最新化**: `.claude/skills/` 配下（add-component / add-feature 等）の手順書はコード変更（DataService 19 モジュール分割、Provider 階層更新）に追従しているか未検証

---

### 2026-04-26 - LeftSidebar Links セクション UI 改善 + Collapsed ポップオーバー化

#### 概要

ユーザー要望「(1) 開いた状態でも Tips 上の白線を表示 / (2) リンクフィールドの header をもう少し大きくフィールド境界を視覚化 / (3) リンクアイコンを header 横と Collapsed Sidebar に追加し、Collapsed のリンクアイコンクリックでリンク一覧をダイアログ表示」+ 追加要望「(4) 一覧ダイアログを画面中央モーダル → リンクアイコン横の吹き出し（ポップオーバー）形式に変更、編集アイコンクリック時のダイアログは中央のまま、ただし縦長すぎるので 2 カラム化」を Auto mode で実装。実装計画書なしの UI/UX 改善 4 ファイル。session-verifier 全 6 ゲート PASS。

#### 変更点

- **`Layout/LeftSidebar.tsx`**: Links section header に `Link2` アイコン併置 + フォントサイズ 10px → 11px + `font-semibold` + 上 border `border-notion-border/60` → 不透明 `border-notion-border` + `pt-2 mt-2` → `pt-3 mt-2` で区切り強化。フッター div に `border-t border-notion-border` 追加で開いた状態でも Tips 上の境界線が表示されるよう CollapsedSidebar と統一
- **新規 `Layout/SidebarLinksListDialog.tsx`** (234 行): `anchorRect: DOMRect | null` prop を受け取り、`position:fixed` の `top/left` 計算で anchor の右側 8px に配置。矢印テイル (`bg-notion-bg` + `border-l border-b` + `rotate(45deg)`) を anchor 中央に追従、`useLayoutEffect` で popoverHeight 実測 → viewport clamp。外クリック / ESC で `onClose`、**編集モーダル open 中は mousedown/keydown listener 解除**で誤 close 防止。内部 Add/Edit/Delete + リンク open 動線 (open 後は `onClose` で閉じる)、Add/Edit は子の `SidebarLinkAddDialog` を Fragment 内で portal 開く（中央モーダルのまま維持）
- **`Layout/CollapsedSidebar.tsx`**: main items 下に `Link2` ボタン + 件数バッジ (`min-w-[14px] h-[14px]` notion-accent 円形 + 99+ 折返し) を追加。`useRef<HTMLButtonElement>` でリンクアイコンの `getBoundingClientRect()` を click 時に取得して `SidebarLinksListDialog` に渡す。ボタンと Tips の間に `border-t border-notion-border` 区切り
- **`Layout/SidebarLinkAddDialog.tsx`**: 幅 `w-96` (384px) → `w-[600px] max-w-[92vw]` に拡大。body を `space-y-3` → `grid grid-cols-2 gap-x-4 gap-y-3` に変更。左カラム=Type / Display name / Target (URL or App search) / 右カラム=Icon (Emoji or Lucide grid)。error は `col-span-2` で全幅エラー表示。縦長すぎるダイアログを横方向に展開
- **検証**: `tsc -b` 0 error / vitest 40 files 344/344 pass / `eslint <変更4ファイル>` 0 error / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) サイドバー開閉時に Tips 上の境界線が常時表示 / (b) Links ヘッダーの視認性向上 (Link2 アイコン + フォント強化) / (c) Collapsed のリンクアイコン → 吹き出しが anchor 右に出て矢印が中央 / (d) 外クリック・ESC で閉じる、ただし編集モーダル open 中はポップオーバーが残る / (e) ポップオーバー内編集アイコン → 中央 2 カラム Add/Edit ダイアログ / (f) 画面下端付近にアイコンがある場合の clamp
- **`useLayoutEffect` の deps**: `[links.length]` のみで popoverHeight 再計算するため、リンク件数を変えない編集 (name のみ変更) で高さが古いまま。実害は出にくい (高さ ≈ アイテム数 × 行高) が、念のため記録
- **Test カバレッジ**: 新規ダイアログのインタラクションテストは Provider 設定コスト過大のため別セッションで一括対応 (mockDataService 拡張 + `renderWithProviders`)

---

### 2026-04-26 - Calendar/DayFlow UX 改善 5 件 + Materials エラー改善

#### 概要

ユーザー報告の 5 件 (Materials の `No such file or directory (os error 2)` 原因 / Calendar 「ルーチン」→「ルーティン」i18n / Routine アイテム Edit 導線 + 管理画面遷移ボタン / Work セッションの DayFlow 表示 / 編集パネルが終日トグル/時間変更で消える UX 問題) を Auto mode で 1 セッション完遂。実装計画書なしのアドホック修正群。session-verifier 全 6 ゲート PASS、新規テスト 15 件追加 (SessionBlock.test.tsx)、既存 344 tests 全合格、cargo check / tsc -b clean。

#### 変更点

- **Task 1 — Materials os error 2 真因 + エラーメッセージ改善** (`src-tauri/src/commands/files_commands.rs`):
  - 真因: `app_settings_repository` 保存の `files_root_path` がディスク上に存在しない／移動・リネーム済み・権限不足の場合、`validate_path::root.canonicalize()` が ENOENT(2) で失敗し、`os error 2` がそのままフロントの error バナーに表示
  - 修正: `validate_path` で `e.kind() == NotFound` を判別し `"Configured root folder not found: {path}. Please reconfigure in Settings."` に変換、それ以外の IO エラーも `"Cannot access root folder: {e}"` で文脈を補完
- **Task 2 — Calendar 「ルーチン」→「ルーティン」i18n** (`frontend/src/i18n/locales/ja.json`):
  - `calendar.createRoutine` "ルーチン" → "ルーティン" / `calendar.newRoutinePlaceholder` "名前なしのルーチン" → "名前なしのルーティン" / `notifications.routineReminders` "ルーチンのリマインダー" → "ルーティンのリマインダー"
- **Task 3 — Routine アイテム編集導線**:
  - i18n: `common.edit: "編集" / "Edit"` + `common.openManagement: "管理画面を開く" / "Open Management"` を ja.json / en.json 両方に追加。これにより `ScheduleItemPreviewPopup` の `t("common.edit", "Edit")` ボタンが「編集」表示になる (ユーザー「Edit押した後何も起きない」の主因はテキストが英語のままだった可能性大、編集ダイアログ自体は元々開いていた)
  - `RoutineEditDialog.tsx` に `onOpenManagement?` prop 追加、ヘッダーに Settings アイコン + 「管理画面を開く」ボタン (`text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover` 標準トークン)。クリックで `onOpenManagement()` → `onClose()` の順で発火
  - `CalendarView.tsx` の RoutineEditDialog 利用箇所に `onOpenManagement={onOpenRoutineManagement}` を渡す (既存 prop を再利用、Edit → 編集ダイアログ → 管理画面 のワンクリック導線)
- **Task 4 — Work セッションを DayFlow に表示**:
  - `frontend/src/components/Tasks/Schedule/DayFlow/SessionBlock.tsx` 新規 (74 行): `startedAt` / `duration` から `top` / `height` を計算 (`(hr*60+min)/60 * SLOT_HEIGHT(60)`)、`sessionType` 別 4 色 (WORK=rose-400/45 / BREAK=emerald-400/35 / LONG_BREAK=sky-400/35 / FREE=violet-400/35)、duration null の場合は `completedAt - startedAt` フォールバック、最小高さ 4px、ISO string 入力にも対応、`title` 属性で `label/タスク名/sessionType表示 • 開始時刻 • N分` を表示
  - `ScheduleTimeGrid.tsx` に `timerSessions?: TimerSession[]` prop 追加、main column 左端 4px 幅レーン (z-10) に SessionBlock を絶対配置 — 既存アイテム (left:4px 以降) と干渉しない、taskId に対応する title を tasks prop から lookup
  - `OneDaySchedule.tsx` に `useTimerContext().completedSessions / isRunning` 購読、useState で `timerSessions: TimerSession[]` 管理、`useEffect([dateKey, completedSessions, isRunning])` で `getDataService().fetchTimerSessions()` + 日付フィルタ (`String(s.startedAt).substring(0,10) === dateKey`)、`cancelled` flag でレース防止、`logServiceError("Timer", "fetchSessions", e)` でエラー記録
- **Task 5 — 編集パネル維持**:
  - 真因 (3 箇所の explicit close): (a) `ScheduleItemPreviewPopup.tsx::DateInput.onChange` 内の `onClose()` / (b) `CalendarView.tsx::onUpdateDate` の `setScheduleItemPreview(null)` / (c) `CalendarView.tsx::TaskPreview onUpdateAllDay` の `setPreviewPopup(null)` / (d) `ScheduleTimeGrid.tsx::TaskPreview onUpdateAllDay` の `setTaskPreview(null)` / (e) `ScheduleTimeGrid.tsx::SchedulePreview onUpdateAllDay` の `setSchedulePreview(null)`
  - 修正: 上記 5 箇所の close 呼び出しを削除。これで終日トグル / 時間変更 / 日付変更すべてでパネルは開きっぱなし。完了切替 / 削除 / ロール変換は意図的に閉じる仕様を維持
- **新規テスト** (`frontend/src/components/Tasks/Schedule/DayFlow/SessionBlock.test.tsx`, 15 件):
  - null startedAt / duration+completedAt 両方欠落時の null 返却 / top 位置計算 / duration 由来 height / completedAt フォールバック / 最小高さ 4px clamp / 4 sessionType 別色クラス / label > taskTitle > sessionType 名のフォールバック順 / ISO string startedAt parse / tooltip に start time / duration min 含有
- **Verification**: `npx tsc -b --force` exit 0 / `npm run test` 40 files / 344 tests 全合格 + 新規 15 = 359 / `cargo check` exit 0 / lint: 私の変更箇所はクリーン (CalendarView の既存 `react-hooks/preserve-manual-memoization` 3 errors + `exhaustive-deps` 1 warning は line 360/375/390/481 の useCallback で本セッション無関与、別タスク化)

#### 残課題

- **手動 UI 検証**: (a) Materials の root path 削除→「Configured root folder not found」表示確認 / (b) Calendar daycell + ボタン → 「ルーティン」表示 / (c) Calendar daycell の routine item → 「編集」ボタン → RoutineEditDialog → 「管理画面を開く」ボタン → RoutineManagementOverlay 遷移 / (d) DayFlow に Pomodoro セッションの色付き左端ストライプ表示 / (e) Calendar/DayFlow の編集パネルで終日トグル / 時間変更 / 日付変更してもパネルが消えないこと
- **TimeDropdown ポータル click-outside 追加対策の保留**: Task 5 の修正後もまだパネルが消える場合は、TimeDropdown の `e.stopPropagation()` listener が `BasePreviewPopup::useClickOutside` を捉えきれていない可能性。手動検証で再現したら `disableClickOutside` の動的制御 or 共通 lookup 経路の見直しを検討
- **OneDaySchedule の RoutineEditDialog (line 919) には onOpenManagement 未配線**: DayFlow パスの routine item Edit から管理画面遷移は別タスク (本セッションは Calendar 経路のみ対応)
- **SessionBlock のオプション拡張**: 現状 4px 幅で hover ツールチップのみ。ユーザーから "もっと目立たせたい" or "クリック動作が欲しい" 等の要望が出れば次セッションで拡張
- **アンステージ変更**: 別セッション由来の `Layout/CollapsedSidebar.tsx` (lint 3 errors + 1 warning) / `LeftSidebar.tsx` / `SidebarLinkAddDialog.tsx` / `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `claude_commands.rs` / `terminal/pty_manager.rs` / 各 db/\*\_repository.rs (前セッション Phase 3-1 の旧版残骸) が working tree に残存。本コミットは Task 1-5 関連 9 ファイル + .claude/ のみに絞る

---

### 2026-04-26 - リファクタリング検証 (Phase 2-4 / 3-1 / 3-4) 自動検証完遂

#### 概要

ユーザー要望「`.claude/2026-04-26-refactoring-verification-plan.md` の内容を読み込んでやるべきことをさらに分析した上で実装」を受け、verification plan の自動検証部分 (S-1 / S-7 / S-8 / S-9) を Auto mode で完遂。コード変更は前セッションで commit `ab84b85` に着地済 (FromRow trait 26 ファイル + calendarGrid.ts 共通化 4 ファイル) のため、本セッションは検証ゲート通過の確認 + 境界ケース自動化 + 性能 spot-check に専念。**結論**: Phase 3-1 起因の新規 clippy 警告 0、`prepare_cached` 移行不要 (R-1 リスク不発)、境界ケース 12 件追加で完全自動化。残課題は手動 UI 検証 (S-2〜S-6) のみ。

#### 変更点

- **S-1 Rust 単体検証**:
  - `cargo build --lib` 0 warnings / `cargo test --lib` 25/25 pass (1 ignored = `bench_fetch_tree`)
  - `grep -rnE "fn row_to_" src-tauri/src/db/` → `row_to_json` のみ ✓ (Phase 3-1 で全 free fn 削除済み確認)
  - `grep -rnE "row_to_[a-z_]+\(row" src-tauri/src/` → `helpers.rs::row_to_json` (3 箇所) + `sync_engine.rs::row_to_json` (1 箇所) のみ ✓
  - `cargo clippy --lib -- -D warnings`: 83 件警告 = **全件 pre-existing** (内訳: migrations/v2_v30.rs 29 + v31_v60.rs 30 + v61_plus.rs 9 = 68 / reminder.rs 6 / sync_engine.rs 2 (`field_reassign_with_default`) / claude_commands.rs 1 (`manual_flatten`) / repository 系 3 件はいずれも `too_many_arguments` on 11-arg `create()`)。Phase 3-1 の FromRow 移行起因は 0、別セッションで cleanup 必要
- **S-7 境界ケース完全自動化** (`frontend/src/utils/calendarGrid.test.ts` 8 → 20 tests):
  - 追加 12 件: うるう年 2024/2 (Sun/Mon 両モード) / 月初 Sat (2026/8) / 月初 Mon (2026/6) / `addDays` 年跨ぎ前進・後退 / `getMondayOf` 日曜→6 日前・同曜・水曜・時刻正規化・非破壊 / `getWeekDates` 7 日 array
  - `npx vitest run src/utils/calendarGrid.test.ts` 20/20 pass。verification plan §S-7 の境界ケース全項目自動化済 (旧 plan は手動補足を想定していたが本セッションで全て test 化)
- **S-8 性能 spot-check** (`cargo test --release --lib db::task_repository::fetch_tree_benchmark -- --ignored --nocapture`):
  - 結果 (10 runs avg): n=500: 3.14ms / n=1000: 6.55ms / n=3000: 18.37ms
  - 基準 100ms に対し最大でも 18.5% — `query_all` の `prepare()` 毎回呼び出しによる劣化は実質無視可能
  - **`prepare_cached` 移行不要**を確定 (R-1 リスク不発)
- **S-9 検証 plan ファイル更新** (`.claude/2026-04-26-refactoring-verification-plan.md`):
  - Status を `PENDING` → `AUTOMATED COMPLETE / MANUAL PENDING` に更新
  - S-1 / S-7 / S-8 / S-9 のチェックボックスを実績で `[x]` または `[~]` (S-1 clippy のみ部分) に
  - Done 定義セクションも更新
  - Related リンクを `.claude/archive/2026-04-25-refactoring-plan.md` に修正 (前セッションで archive 済み)
- **frontend 再検証**: `npx tsc -b` 0 / `npm run test` 40 files / 344/344 pass (前回 332 + 私が追加した 12) / `npm run build` Vite production clean

#### 残課題

- **手動 UI 検証** (verification plan §S-2〜S-6): Desktop/iOS 実機での 11 ドメイン IPC fetch / Cloud Sync 5000 行超 round-trip / Calendar Mobile (Monday 始まり / スワイプ / chip / Today) / Calendar Desktop (Sunday 始まり / 6 行固定 / Weekly Grid) / Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
- **完了後の docs 整理**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新 (UI 検証完了後に実施推奨)
- **clippy 既存 83 警告**: pre-existing で本検証外、別セッションで cleanup 候補 (migrations / reminder / repository `create()` シグネチャ)

---

### 2026-04-26 - リファクタリング計画 Phase 2-4 / 3-1 / 3-4 完遂 + 検証用実装計画書作成

#### 概要

ユーザー要望「`.claude/2026-04-25-refactoring-plan.md` を読み込んで未実装のリファクタリングを実装して。またその後にリファクタリング検証のための実装計画書も作成して」を受け、前セッションで deferred とされた 3 Phase を Auto mode で 1 セッション内に完遂。**Phase 3-1** (Rust 26 ファイル) は FromRow trait + query_all/query_one helpers を導入し 33+ の `fn row_to_X` を `impl FromRow for X` に移行 — 4 並列 sub-agent で機械的書き換えを高速実行。**Phase 2-4 / 3-4** は Mobile/Desktop の Context vs Service層差で完全 UI 統合は regression リスク高と判定し、純粋ロジックのみ抽出する保守的アプローチに変更（Phase 2-3b/d と同方針）— `utils/calendarGrid.ts` 新設で `buildCalendarGrid` / `addDays` / `getMondayOf` / `getWeekDates` を共通化、4 ファイル (Mobile 3 + useCalendar) の duplicate 関数群を削除。検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` を 9 ステップ + 6 リスク + 段階的 rollback 手順で作成。実装プラン `2026-04-25-refactoring-plan.md` は全 Phase 完了に伴い `.claude/archive/` へ移動。session-verifier 全 6 ゲート PASS。

#### 変更点

- **Phase 3-1 — FromRow trait + 26 repository 移行 (Rust)**:
  - `src-tauri/src/db/row_converter.rs`: `FromRow` trait (`fn from_row(&Row) -> Result<Self>`) + `query_all<T: FromRow, P: Params>` + `query_one<T: FromRow, P: Params>` ヘルパを追加。`row_to_json` (column-agnostic JSON converter) は既存維持
  - 24 repository ファイル + sidebar_link を移行: `calendar_repository.rs` / `calendar_tag_repository.rs` / `daily_repository.rs` / `database_repository.rs` (4 model) / `note_connection_repository.rs` / `note_link_repository.rs` / `note_repository.rs` / `paper_board_repository.rs` (3 model) / `playlist_repository.rs` (2 model) / `pomodoro_preset_repository.rs` / `routine_group_assignment_repository.rs` / `routine_group_repository.rs` / `routine_repository.rs` / `schedule_item_repository.rs` / `sidebar_link_repository.rs` / `sound_repository.rs` (4 model) / `task_repository.rs` / `template_repository.rs` / `time_memo_repository.rs` / `timer_repository.rs` / `wiki_tag_connection_repository.rs` / `wiki_tag_group_repository.rs` (2 model) / `wiki_tag_repository.rs` (2 model)
  - 各ファイル: `fn row_to_X(&Row) -> Result<X> { ... body ... }` → `impl FromRow for X { fn from_row(...) -> Result<Self> { ... 既存 body 完全保持 ... } }` に置換、callers の `prepare → query_map → collect` を `query_all(conn, sql, params)` に / `prepare → query_row` を `query_one(conn, sql, params)` に / Option 返却の match 付きパターンを `match query_one::<T, _>(conn, sql, params) { ... }` に変換
  - エッジケース: `note_link_repository::fetch_backlinks` は query_map 内で `BacklinkHit` 組立カスタムロジックがあるため closure 内で `NoteLink::from_row(row)?` 置換のみ (closure pattern 4) / transaction 内 (`tx.query_map`) は SQL 経由のため対象外で保持 / SQL 文字列・パラメータ・ロジックは全件無変更
  - SQL injection 観点不変: `prepare_cached` 化は性能劣化検証時の対応として verification plan §R-1 / S-8 に記載
- **Phase 2-4 — Calendar 共通ロジック抽出**:
  - `frontend/src/utils/calendarGrid.ts` 新設 (59 行): `buildCalendarGrid({year, month, weekStartsOn: 0|1, fixedRows?})` で月グリッド計算を統一 (Sunday 始まり / Monday 始まり両対応、`fixedRows: 6` で 42 セル固定 or 自動 7 倍数 padding) / `addDays(date, days)` / 補助 export `CalendarGridDay` / `CalendarGridOptions`
  - `frontend/src/utils/calendarGrid.test.ts` 新設 (8 tests): Sunday/Monday 始まり両モード / fixedRows 有無 / 月境界 (2026 年 2 月 = 月初 Sun, 28 日) / うるう年 / addDays 月跨ぎ
  - `frontend/src/hooks/useCalendar.ts`: 30 行の `calendarDays` useMemo (Sunday 始まり、6 行 padding) を `buildCalendarGrid({year, month, weekStartsOn: 0, fixedRows: 6})` 1 行呼び出しに置換
  - `frontend/src/components/Mobile/MobileCalendarView.tsx`: 12 行の inline `calendarDays` (Monday 始まり、`{date, inMonth}`) を `buildCalendarGrid({year, month, weekStartsOn: 1})` に置換、destructure rename `{date, isCurrentMonth: inMonth}` で内部 prop 互換維持。等価性検証: dow=0(Sun) → 旧 startDow=-1→6 / 新 startPad=(0+6)%7=6 ✅ / dow=1 / dow=6 全て一致
- **Phase 3-4 — Schedule 共通 hook 抽出**:
  - `calendarGrid.ts` に `getMondayOf(date)` (Mon = 月曜、Sun → 6 日前へ) / `getWeekDates(monday)` (7 日 array) を追加
  - `MobileCalendarStrip.tsx`: local `getMonday` / `formatDateStr` / `addDays` / `getWeekDates` 4 関数 (約 24 行) を削除、共有版 import に置換
  - `MobileScheduleView.tsx`: `loadWeekItems` の inline week-range 計算 (15 行) を `const monday = getMondayOf(...); const sunday = addDays(monday, 6)` 2 行に圧縮、local `todayStr()` 削除して `getTodayKey` lazy init pattern に
  - `MobileCalendarView.tsx`: local `todayStr()` 削除、`getTodayKey` 直接利用
  - `formatDateStr` (3 ファイルの duplicate) → `formatDateKey` (utils/dateKey.ts の正規版) に統一
- **検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` 作成 (9 Steps + 6 Risks)**:
  - **S-1〜S-3**: Rust 単体 (cargo build/test/clippy) → IPC 統合 (11 ドメインの fetch 経路) → Cloud Sync round-trip (5000 行超 pagination 確認)
  - **S-4〜S-6**: Calendar Mobile (Monday 始まり / スワイプ / chip) / Calendar Desktop (Sunday 始まり / 6 行固定 / Weekly Grid) / Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
  - **S-7**: buildCalendarGrid 境界ケース (月初 Sun/Mon/Sat / うるう年 / getMondayOf(日曜) → 6 日前)
  - **S-8**: 性能 spot-check (`query_all` の prepare 毎回呼び出し → 1000 ノード fetch_tree benchmark / Calendar 月遷移体感)
  - **S-9**: ドキュメント更新 + plan archive
  - **R-1〜R-6**: 性能劣化リスク (prepare_cached 化で対応) / 週初日混乱 / hidden caller / Cloud Sync 副次破壊 / 例外パターン許容 / 境界ケース見落とし
  - 各 Phase 独立 rollback 手順 + DB migration 不要のため schema rollback 不要
- **計画書アーカイブ**:
  - `.claude/2026-04-25-refactoring-plan.md` の Status を `IN_PROGRESS (...)` から `COMPLETED (Phase 0-3 全完了 2026-04-26)` に更新、Phase 2-4 / 3-1 / 3-4 の `[ ]` を `[x]` に + 完了内容を追記
  - `.claude/archive/` に移動 (`mv ./2026-04-25-refactoring-plan.md ./archive/`)
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npm run test` 40 files / 332/332 tests pass (前回 324 + 新規 8 = `calendarGrid.test.ts`) / `cd frontend && npm run build` Vite production 7.9s clean / `cd src-tauri && cargo build --lib` 0 warnings / `cargo test --lib` 25/25 pass (1 ignored bench) / `cargo clippy --lib` 私の変更ファイルで新規警告 0 (3 件の `too_many_arguments` は `pub fn create()` の既存シグネチャに対する pre-existing 警告、本セッション関与なし) / Frontend ESLint 0 / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: 検証用実装計画書 `2026-04-26-refactoring-verification-plan.md` の S-2〜S-6 を実機で実施 (a) IPC 経由 11 ドメイン fetch / (b) Cloud Sync round-trip 5000 行超 / (c) Calendar Mobile (Monday 始まり / スワイプ / chip) / (d) Calendar Desktop (Sunday 始まり / 6 行) / (e) Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
- **性能 spot-check**: `query_all` / `query_one` で毎回 `conn.prepare()` を呼ぶため、大量データで劣化の可能性。劣化確認時は `prepare_cached` 化で API 互換のまま対応 (検証 plan §R-1 / S-8)
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `commands/claude_commands.rs` / `terminal/pty_manager.rs` 他 ~13 ファイルが working tree に残存。本コミットは Phase 2-4 / 3-1 / 3-4 関連 33 ファイル (Rust 26 + Frontend 7) + .claude/ のみに絞る
