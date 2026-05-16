# HISTORY.md - 変更履歴

### 2026-05-16 - Connect/Node タブを Point Graph (Canvas2D + d3-force) へ全面置換

#### 概要

別チャットで、Connect タブの Node サブタブを React Flow ベース `TagGraphView`（1438 行）から Canvas2D + d3-force の Point Graph に全面置換。添付の `PointGraphView.jsx` デモと `point-view-implementation-plan.md` を基に、life-editor 実コードへ適合させた専用計画書 `2026-05-13-point-graph-connect-node.md`（12 ステップ）を作成→実装。汎用計画の前提（新規 Memo ビュー / Rust `graph_load_snapshot` 新設）は本タスクでは不要と判断し、既存 props からフロントで `GraphSnapshot` を合成（Rust/DB/MCP 完全不変・読取のみ）。実装後、ユーザー追加要望で「フィルタパネルの閉じる手段追加 / Connect モード廃止 / 左 perf HUD 削除」を追補。各ステップ個別コミット、計画書は archive へ。ブランチ refactor/web-first-v2（別セッションのクロスプラットフォーム移行と同居、パス指定ステージで相互非干渉）。

#### 変更点

- **データ合成（S2）**: `usePointGraphModel` が `notes/dailies/tags/assignments/noteConnections/noteLinks` から GraphSnapshot を生成。folder→project / note→note / daily→daily / tag→独立ノード（`tag:` prefix）。エッジ 5 種（hierarchy=parentId / wikilink=noteLinks / manual=noteConnections / tag=assignments / temporal=daily 連鎖）。`sourceMemoDate`→`daily-<date>` で daily id 整合（旧 `memo-` 不整合を是正）、両端非存在エッジ破棄、deleted 除外
- **テーマ（S3）**: `graph-theme.ts` が `--color-*` CSS 変数を `getComputedStyle` で解決し Canvas 描画色化。`MutationObserver`(data-theme/class) でライト/ダーク + テーマ切替に追従。Catppuccin ハードコード全廃（§6.4 準拠、不透明背景）
- **Canvas/Sim（S4-S5）**: `usePointGraphSimulation`（d3-force ライフサイクル / 位置キャッシュ / forceX-Y センタリング / リサイズ時リセンタリング / 4s 永続化）+ `usePointGraphInteraction`（d3-zoom / window pointer drag で指が外れても切れない / quadtree hit-test / 選択スムーズパン=interrupt+authoritative zoomTransform+no offsets / ホバー隣接強調 / ズームゲートラベル k≥0.85）。React 19 `react-hooks/refs` 厳格 lint に合わせ ref アクセスを effect 内へ移動、位置キャッシュ復元も sim effect 内へ
- **UI（S6-S7）**: notion トークン化 primitives（Slider/Toggle/IconButton/Section）、`GraphControlPanel`（キャンバス内フローティング・折りたたみ Section 6）、`SelectedNodeCard`、`GraphTopBar`。`graph-filters.ts` 純粋パイプライン（type/tag/search-1hop/local-graph/orphan）+ `useGraphFilters`。i18n `connect.graph.*`（en/ja）。`set-state-in-effect` 回避のため外部選択同期は「レンダー時 prev 比較で state 調整」公式パターンに
- **連動・既存機能保全（S8-S9）**: `sidebarSelectedItemId`/`selectedTagId`/`focusedNoteId` ↔ 選択+パン双方向、グラフ tag ノード選択→`onSelectTag`。ダブルクリック遷移 / `UnifiedColorPicker`（onUpdateNoteColor）/ manual エッジ click 削除（線分 hit-test）/ Delete soft-delete / 位置・ビューポート永続化（d3 座標系のため `POINT_GRAPH_*` 専用キー新設、React Flow ストレージと非衝突）
- **スワップ・整理（S10-S11）**: `ConnectView.tsx::renderContent` の `case "node"` を `<PointGraphView/>` に（ReactFlowProvider ラッパ除去、Board は不変）。props 同一 I/F で無改修。旧 Node 系 9 ファイル削除（`TagGraphView`/Note・DailyNodeComponent/CurvedEdge/forceLayout/layoutTemplates/TagGraphSelectionContext/tagGraphStorage+test、ユーザー確認後）。`reactFlowMerge`/`CanvasControls` は Paper で継続使用のため保持
- **追補（ユーザー要望）**: `GraphControlPanel` にヘッダ X 閉じるボタン + 外側 `pointerdown` 検知で閉じる（トップバーのトグルは `data-marker="panel-toggle"` で除外し再オープン防止）、`useGraphFilters.closePanel` 追加。Connect モード一式廃止（ボタン/クリック接続フロー/ConnectPanel/pending state/Esc 分岐/onConnectViaTag 配線）。左 perf HUD（稼働ドット/α/fps/Cpu）削除（node/edge 数・clear-filters・zoom% は保持）。連鎖で孤立化した `ConnectPanel.tsx` を削除（session-verifier 検出 + ユーザー指示）
- **Verification**: `tsc -b` 0 / eslint（PointGraph + ConnectView スコープ）0 / `vite` 本番ビルド成功（7.11s、d3 import エラーなし、チャンク警告は既存大バンドル由来） / 新規 `graph-filters.test.ts` 8 件 + `reactFlowMerge.test.ts` 17 件 pass / session-verifier 2 回 PASS。コードベース他所の eslint 36 件は既存負債（本変更非該当・未修正）

#### 残課題

- **手動 UI 検証未実施**: ライト/ダーク配色・FPS（ノード ~1000）・ドラッグ/ピンチ体感・パネル外クリック閉じ・ConnectSidebar 連動・ノード→エディタ遷移はヘッドレスのため未確認。`cargo tauri dev` で Connect→Node タブ要確認
- **[INFO] keydown effect が `filters` 全体依存**: 毎レンダー再購読（機能影響なし・性能微）
- **並行セッション同居**: refactor/web-first-v2 に別セッションのクロスプラットフォーム移行 WIP（Mobile/migration/generateTaskId 等の未コミット変更）が同居。本タスクはパス指定ステージで分離コミット、`git add -A` 不使用

### 2026-05-16 - クロスプラットフォーム移行 Phase 1 — 土台スキャフォールド + Supabase Auth/RLS 配線（runtime 検証はユーザー操作待ち）

#### 概要

Tauri+D1 → Electron+Capacitor+Web+Supabase 移行の Phase 1 に実着手。サブエージェント分担（管理=multi-session-coordinator / 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer、メイン=統括）。2 ラウンド: (R1) Supabase 不要の自走部スキャフォールド commit `d1abd8a`、(R2) ユーザー Supabase 作成後の Auth/RLS/CRUD 配線 commit `ce6a5cb`。両ラウンドとも role-qa=PASS / security=Critical/High0。**コードは Phase 1 着手順序 1-9 完了、migration リモート適用 + RLS runtime 実証のみユーザー操作 2 ブロッカーで保留**。

#### 変更点

- **web/ 新規**: `npm create vite@latest -- --template react-ts` 雛形 + Tailwind 4（`@tailwindcss/vite`）。notion-\* トークンは frontend/src/index.css から最小限 9 トークンのみ移植（1490 行丸ごとコピーしない）。`npm run dev`/`npm run build` 通過確認
- **shared/ 新規**: `@life-editor/shared`。`frontend/src/services/DataService.ts`（約200メソッド）+ 依存型23ファイルを **byte 一致 verbatim コピー**（`diff -q` 確認）。`SupabaseDataService.ts` は tasks 系4メソッドのみ実装、他は Proxy で `not implemented in phase 1` throw（`value.bind(target)` で this.client 解決バグを実装中に自己検出・修正）
- **supabase/migrations/0001_initial.sql 新規**: `tasks` テーブル + **RLS enable（policy 無し = deny-all fail-safe）**。security-reviewer の Medium 指摘（anon key 公開前提で RLS が唯一の防御、警告不在）を受け WARNING コメント + 先行 RLS 有効化で安全側に倒した。policy + `user_id default auth.uid()` は Phase 1 step 7（Supabase 作成後）
- **.gitignore**: `.env*.local` 全変種を root で除外（`git check-ignore` で web/.env.local まで実検証クリーン）。秘密情報非追跡を commit 前に担保
- **不可侵維持**: `frontend/` `src-tauri/` `cloud/` `desktop/` `mobile/` は一切作成・変更なし（Phase 2/3/4 前借りゼロ、role-qa スコープ監査 PASS）
- **R2 supabase/migrations/0002_rls_tasks.sql 新規**: `user_id set default auth.uid()`（クライアントは user_id 非送信＝サーバ導出で詐称不能）+ owner-only CRUD 4 policy。security Low 指摘を受け全 policy に `to authenticated` を追加（式評価 + ロール層の二重防御）。idempotent（drop if exists→create）
- **R2 shared/services 追加**: `supabaseClient.ts`（モジュール単一インスタンス＝Auth と DataService が同一 JWT/セッション共有、RLS 空振りアンチパターン回避、`detectSessionInUrl:false`）/ `SupabaseAuth.ts`（signUp/signIn/signOut/getSession/onAuthStateChange、Email+PW、Confirm email オフ前提）。`SupabaseDataService.ts` を共有クライアント利用に変更
- **R2 web/ 配線**: `App.tsx` を session ゲート（loading→Auth/Tasks）に rewrite、`AuthScreen.tsx`/`TasksScreen.tsx` 新規（notion-\* 最小 UI、TasksScreen 初回 fetch は active-guard 付き inline effect で StrictMode/unmount stale 回避）。`@supabase/supabase-js` 追加、`@life-editor/shared` alias、`.gitignore` に `supabase/.temp .branches .env`
- **監査**: 両ラウンド role-qa=PASS（スコープ違反0、frontend `tsc -b`=0 で非破壊実測）/ security=Critical0 High0。Phase2 申し送り＝①新テーブル RLS 漏れの CI 機械検証 ②`tsconfig` project references 化 ③`signOut` scope 堅牢化
- **並行作業**: 別チャットが Point Graph を並行コミット（f996339 / 7bef5f8 他）。Phase 1 は web/ shared/ supabase/ .gitignore のみパス指定ステージで完全分離（`git add -A` 不使用、別チャット frontend WIP / SSOT doc を巻き込まず）。commit `d1abd8a`（R1）/ `ce6a5cb`（R2）
- **ブロッカー（ユーザー操作待ち）**: ①`web/.env.local` の `VITE_SUPABASE_URL` がダッシュボードリンク形式 → `https://<ref>.supabase.co` へ要修正（credential ファイル改変は classifier ブロックのため自動修正不可）②supabase CLI 未認証 → `npx supabase login`→`link --project-ref <ref>`→`db push` をユーザーが `!` 実行。解消後 `node supabase/.temp/probe.mjs` で RLS 3点（認証=自分のみ/未認証 deny/他人不可視）実証 → probe 削除 → Phase 1 完了判定クローズ

### 2026-05-16 - Schedule/ゴミ箱 削除 UX 刷新 + 危険な全消去ボタン撤去 + エラーマスキング / V69 migration ドリフト修正 + 移行プラン再整理

#### 概要

ユーザーの「Schedule データ削除」一連の要望を起点に、(1) 移行プラン 2026-05-14 改訂、(2) 「リセット失敗: 不明のエラー」の根本原因調査、(3) 削除 UX の全面刷新、を 1 セッションで実施。調査の結果「不明のエラー」は **Tauri `invoke()` が文字列で reject するため `e instanceof Error ? e.message : unknownError` が常に fallback に落ちる二次バグ**が真因隠蔽していたと判明。修正後に表出した本当のエラー `no such table: routine_group_tag_assignments` から、**`data_reset`/`data_import`/`data_export` が V69 で DROP 済の routine_tag 系 3 テーブルを参照し続ける migration ドリフト**を特定・修正。さらにユーザー指摘で「ゴミ箱タブ右サイドバーの『すべてのデータをリセット』ボタンが実は `data_reset`（全テーブル完全ハード削除）でゴミ箱限定ではない」危険な誤配置を確認し完全撤去、代わりに per-category 削除導線（Schedule の Events/Routine 個別ソフト削除ボタン + TrashView の per-category「ゴミ箱をからにする」）を新設。i18n 用語も統一（Routine→ルーティン、Schedule items→生成された予定）。コミットは `567190d`（移行プラン）/ `463b28f`（エラーマスキング+migration ドリフト）/ 本コミット（削除 UX 刷新）の 3 本。ブランチ refactor/web-first-v2、未 push。

#### 変更点

- **移行プラン再整理（commit `567190d`）**: `.claude/2026-05-04-cross-platform-migration.md` を三原則（学習スパイク廃止＝やりながら学ぶ / 学習用 Markdown ログ廃止 / Phase 5 完了=完成までコスト $0 厳守）で全面改訂。旧 Phase 0（学習スパイク 2.5 週）削除し Phase 1-5 再構成、「完成後の判断」表追加。Tauri 前提で失効した vision/ 4 ファイル（mobile-porting / mobile-data-parity / ios-everywhere-sync / realtime-sync）を `archive/vision-tauri/` へ git mv（理由 README 付）、旧 iOS プラン 2 件を `archive/` へ。`core.md`/`db-conventions.md` に失効警告、CLAUDE.md 冒頭警告を新方針化。memory に `feedback_no_learning_logs` / `feedback_cost_zero_until_complete` 追加。セッション途中で並行 worktree により branch が `feat/calendar-soft-delete-integrity` に切替→stash 経由で refactor/web-first-v2 に正着地
- **エラーマスキング修正（commit `463b28f`）**: `frontend/src/utils/logError.ts` に `getErrorMessage(error, fallback)` 追加（Tauri は文字列 reject する旨を doc 明記）。`CalendarDataResetDialog` / `DataManagement`（2 箇所）/ `Settings`(後に削除) / `MobileSettingsView`（2 箇所）の計 6 catch を `getErrorMessage` 化。クリップボード系（DOMException=Error）はスコープ外
- **V69 migration ドリフト修正（commit `463b28f`）**: `data_io_commands.rs` の `data_reset` から DROP 済 `routine_group_tag_assignments`/`routine_tag_assignments`/`routine_tag_definitions` の DELETE を除去 + 取りこぼし 5 テーブル（`routine_group_assignments`/`note_aliases`/`note_links`/`sidebar_links`/`timer_settings`）を FK 安全順で追加。`data_import` の clear batch から `routine_tag_assignments` 除去 + 旧テーブル import ブロック 2 件 + validation list 2 件除去、未使用化した `import_array_or_ignore` 削除。`data_export` の旧テーブル SELECT 2 件除去。`full_schema.rs` は V60 歴史スナップショットとして意図的に旧テーブル CREATE（V69 が drop、`fresh_db_reaches_latest_without_orphan_tables` が保証）と判明したためコード不変・設計意図コメントのみ追加（コメント内二重引用符が Rust 文字列を閉じる初期ミスを修正）
- **削除 UX 刷新（本コミット）**: 新規 `frontend/src/components/ScheduleList/BulkCategoryDeleteButton.tsx` — kind 別表記（`schedule.bulkDelete.{events,routines,tasks}`）/ 2 段階クリック確認 / 既存 `bulkSoftDeleteCalendarData([kind])` を単一 kind で再利用 / 成功時 0.8s reload / `getErrorMessage` でエラー表出。Events タブヘッダ（`ScheduleEventsContent.tsx`、+作成ボタン隣）と Routine 管理オーバーレイヘッダ（`RoutineManagementOverlay.tsx`、×閉じる隣）に配置。新規テスト `BulkCategoryDeleteButton.test.tsx` 4 件
- **TrashView per-category 空化（本コミット）**: `TrashView.tsx` に `categoryLabel`/`categoryCount`/`handleEmptyCategory`/`renderEmptyHeader` 追加。各カテゴリ表示上部に「{カテゴリ}のゴミ箱をからにする」ボタン（件数 0 で disabled）、`ConfirmDialog` で件数+不可逆警告を提示後、検索フィルタ無視でそのカテゴリの全ゴミ箱項目を既存 per-item `permanentDelete*` ループで完全削除（新規 IPC 不要）。5 カテゴリ＝TrashView の tasks/routine/events/materials/sounds と一致
- **危険ボタン撤去（本コミット）**: `Settings.tsx` のゴミ箱サイドバーから「すべてのデータをリセット」（実体 `data_reset`＝全テーブル完全ハード削除、ゴミ箱限定ではない誤配置）を完全撤去。連動 dead code（`handleReset` / reset 系 state 3 個 / `ConfirmDialog` ブロック）+ 未使用化 import 3 件（`getDataService`/`getErrorMessage`/`ConfirmDialog`）除去（49 行削除・追加 0）。`data_reset` Rust コマンド自体は残存だが UI 導線は消滅
- **i18n 用語統一（本コミット）**: `settings.calendarReset.*` を ja/en で平易化（Routine→「ルーティン」、Schedule Items→「（ルーティンから）生成された予定」、tasks/events/dailies/notes→タスク/イベント/デイリー/ノート、title/description/success/kinds/footnote）。新規 `schedule.bulkDelete.*` / `trash.emptyCategory*` を ja/en 両方に追加、parity 確認済
- **Verification**: `tsc -b` 0 / eslint は `Settings.tsx:225` `react-hooks/set-state-in-effect` の既存問題 1 件のみ（git diff は 49 行削除のみ・当該 effect は hunk 外、行番号 252→225 にずれただけ＝リグレッション非該当）/ 全 45 files 398 tests pass + 新規 4 件 pass / i18n ja-en parity OK / data_io Rust テスト 5 件 pass / cargo check 警告 0

#### 残課題

- **手動 UI 検証未実施**: (a) Events タブ「全Eventを削除」2 段階確認→ソフト削除→ゴミ箱復元可 / (b) Routine 管理オーバーレイ「全Routineを削除」で派生 schedule_items も cascade / (c) TrashView 各カテゴリ「〜のゴミ箱をからにする」で当該カテゴリのみ完全削除・他カテゴリ不変 / (d) Calendar 一括削除ダイアログの新用語表示。`cargo tauri dev` 起動が必要
- **[IMPORTANT・既存] `Settings.tsx:225` set-state-in-effect**: 変更前から存在（本セッション中 stash 検証済）。`initialTab` effect は今回未編集。別タスクで cleanup 推奨
- **[MINOR] `TrashView.handleEmptyCategory` の部分失敗**: per-item try/catch なし、1 件 reject でループ中断・残り未削除（UI 状態は finally で復帰）。既存 per-item 削除と同挙動のため非ブロッキング、任意で堅牢化余地
- **`data_reset` UI 導線消滅**: 全消去 Rust コマンドは残るがどこからも呼べない。将来「工場出荷リセット」が必要なら明示的に再配置要
- **push 判断**: refactor/web-first-v2 にローカル 5 コミット（含本セッション 3 本）未 push。PR / push 方針は別途
- **並行セッション干渉**: 本セッション中に worktree-agent による branch 切替が発生。`.claude/docs/vision/PointGraphView.jsx` 等 untracked は別セッション由来でコミット対象外

---

### 2026-05-16 - statusline 縦並び化（横一行 → 3 行グループ化レイアウト）

#### 概要

ユーザー要望「/statusline スキルで設定した UI が全て横並び、これを縦並びにできないか」を受けて `~/.claude/statusline-command.sh` を横一行 → 3 行グループ化レイアウトに改修。AskUserQuestion で粒度 3 択（3 行グループ化 / 完全縦並び / 2 行）を preview 付きで提示しユーザーが「3 行グループ化」を選択。取得ロジック（cwd / git branch+dirty / ctx / cost / MEMORY.md アクティブタスク抽出）は一切変更せず、最終 `printf` の組み立てのみ変更。Claude Code の statusLine が改行入り出力で複数行レンダリングする仕様を利用。本変更は life-editor の git repo 外（`~/.claude/` global config）のため commit 対象は `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみ。

#### 変更点

- **`~/.claude/statusline-command.sh` 改修**: 各セグメント変数（`git_part` / `ctx_part` / `cost_part` / `task_part`）から行頭 `" | "` プレフィックスを除去し純粋な値のみ保持に変更。末尾の単一 `printf` を 3 行組み立てに置換 — line1=`user@host  cwd` / line2=branch・ctx・cost を存在するものだけ `" | "` で連結 / line3=`▶ active-task`。各行を個別に `\033[2m … \033[0m` で dim 化（行をまたぐ ANSI は一部端末でリセットされるため per-line 適用）。line2 / line3 は中身が空なら行ごとスキップ（git 管理外 / タスク未設定でも空行を出さない）
- **動作確認**: dummy JSON（cwd + ctx 42% + cost $1.23）で 3 行出力 + 行頭に余計な区切りが出ないこと + dim ANSI が per-line で付くことを確認。git 管理外 / MEMORY.md 不在時の空行スキップも graceful 省略を維持
- **`.claude/MEMORY.md`**: 直近の完了の先頭に本タスクを追加、3 件保持ルールで最古「Global git skill / agent 整備 ✅（2026-05-12）」を drop。進行中（クロスプラットフォーム移行 Phase 0 Day 1-3）は不変
- **`.claude/HISTORY.md`**: 本エントリを先頭追記。5 件保持ルールで最古 2 件「2026-05-04 - Schedule > Task フォルダ残タスク…」「2026-04-29 - Web ファースト大規模移行…」を `HISTORY-archive.md` 先頭へロール
- **`.claude/HISTORY-archive.md`**: 上記 2 エントリを既存先頭「2026-04-29 - Routine Tag 廃止…」の前に prepend（新しい順 = 2026-05-04 → 2026-04-29）

#### 残課題

- **次回プロンプト送信時に反映**: statusLine は次の Claude Code 描画タイミングで再読み込みされる。3 行表示の見た目（特に 40 文字切り詰めしたタスク名の折り返し挙動）はユーザー実機で目視確認推奨
- **アンステージ変更（無関係、別セッション由来）**: working tree に `frontend/src/components/{Mobile,Settings}/*` / `frontend/src/utils/logError.ts` の変更 + `.claude/docs/vision/PointGraphView.jsx` / `.claude/docs/vision/plans/` / `.claude/docs/vision/point-view-implementation-plan.md` の untracked が残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルに限定

---

### 2026-05-13 - Calendar 表示整合性 A+B+C 完成（useCalendar isDeleted filter + Progress 月単位集計 + Routine 含む一括削除導線）

#### 概要

ユーザー報告「DB から消したのに Task / Event / Routine が Calendar に残る + Task が見えているのに RightSidebar の進捗フィルタが 0/0 表示」の根因 3 軸を順次解消。**(A)** `useCalendar.ts::tasksByDate` の filter に `!n.isDeleted` 追加で soft-delete 後の残留バグ解消 + テスト 2 件追加。**(B)** `ScheduleSection.calendarCategoryProgress` を月単位集計に再設計し Calendar 月表示と Progress 日次集計の temporal scope ズレを解消、`ProgressSection` / `DayFlowSidebarContent` に `scope?: "day" | "month"` prop 追加 (Calendar=month / DayFlow=day)。A+B は `ae365bb fix(calendar): exclude soft-deleted tasks + switch Calendar progress to month-wide aggregation` で commit 済 (refactor/web-first-v2)。**(C)** Settings Danger Zone に「Calendar データ一括削除」Dialog (`CalendarDataResetDialog.tsx` + Vitest 7 件) を追加、Rust 側 `db_bulk_soft_delete_calendar_data(kinds: Vec<String>)` コマンド + frontend `bulkSoftDeleteCalendarData(kinds[])` で IPC 4 点同期完備。Routine 削除は既存 `routine_repository::soft_delete` の cascade を再利用、その他 (tasks scheduled / events / dailies / notes) は 1 transaction で UPDATE、全行 `version+1` / `updated_at=datetime('now')` で Cloud Sync delta path 対応。**並行作業の経緯**: C は role-engineer サブエージェントを `isolation: worktree` で背景起動して並行実装したが、cargo test 完了待ちで 600s 無進捗となり watchdog kill (failed)。ただし worktree (`.claude/worktrees/agent-a4355e07a4a31d835`) の working tree に成果物 9 ファイル分の未コミット変更が残っており、本セッションで `cp` 経由で本ワークツリーに取り込み完成させた。**並行チャットの影響**: A+B コミット直後に並行チャットが HEAD を `feat/richeditor-events-ui-batch` に switch、`refactor/web-first-v2` に戻して C を着手。HEAD 切替で working tree の C 変更が見えなくなる罠を回避するため、ユーザー判断で「refactor/web-first-v2 に戻して C 統合」方針を選択した。`Verification`: `cd frontend && npx tsc -b` exit 0 / `npx eslint <C 5 files>` exit 0 / `npx vitest run` 44 files 394 tests pass (うち CalendarDataResetDialog 7 件 + useCalendar 18 件) / `cd src-tauri && cargo test --lib bulk_soft_delete` 5 件 pass / `cargo test --lib` 全 30 件 pass。**ブランチ**: `refactor/web-first-v2`。push はユーザー指示で次の確認後。

#### 変更点

- **`frontend/src/hooks/useCalendar.ts` (Gate A の本命修正)**: `tasksByDate` の useMemo 内 filter を `nodes.filter((n) => n.type === "task" && n.status === "DONE")` → `nodes.filter((n) => n.type === "task" && n.status === "DONE" && !n.isDeleted)` に拡張、incomplete 分岐も同様。これにより `softDelete` で in-memory `isDeleted=true` になった task が `tasksByDate` (および派生する `itemsByDate`) に出続けるバグを解消。Rust 側 `task_repository::fetch_tree` は元から `WHERE is_deleted = 0` で正しく fetch していたが、frontend の in-memory mutation 経路 (`useTaskTreeDeletion::softDelete`) が `nodes` を再 fetch せず `{ ...n, isDeleted: true }` でローカル変更していたため、Calendar 側 hook がそれを拾えていなかった
- **`frontend/src/hooks/useCalendar.test.ts`**: 「soft-deleted task は `tasksByDate` に出ない」テストを incomplete / completed 両 filter で 2 ケース追加 (16→18 tests pass)。`isDeleted: true` + `deletedAt: ...` を持つ task を入力して `dateTasks.length === 1` (alive のみ) を assertion
- **`frontend/src/components/Tasks/Schedule/shared/ProgressSection.tsx`**: `scope?: "day" | "month"` prop 追加 (デフォルト `"day"`)。`dateLabel` を `scope === "month" ? "${year}/${month + 1}" : "${month + 1}/${date}"` に分岐。Calendar 経由は月ラベル、DayFlow 経由は従来通り日ラベル
- **`frontend/src/components/Tasks/Schedule/DayFlow/DayFlowSidebarContent.tsx`**: `scope?: "day" | "month"` を `ProgressSection` に passthrough
- **`frontend/src/components/ScheduleList/ScheduleSection.tsx`**: (1) `useScheduleContext()` の destructure に `monthlyScheduleItems` + `loadScheduleItemsForMonth` を追加、不要になった `loadItemsForDate` を削除。(2) `calendarCategoryProgress` を月単位集計に書き換え — `monthStart` / `monthEnd` を `calendarProgressYear/Month` から計算、`dateInMonth(key)` 述語で `monthlyScheduleItems` から routine / events を、`allTasksByDate` から tasks を、`dailies` / `notes` から月内の各種データを抽出。完了数は `i.completed` / `t.status === "DONE"` で算出。(3) Calendar tab active 時の useEffect を `loadItemsForDate(calendarProgressDateKey)` → `void loadScheduleItemsForMonth(calendarProgressYear, calendarProgressMonth)` に変更し、月遷移で確実に該当月の schedule_items を fetch。(4) JSX で `<DayFlowSidebarContent scope="month">` を Calendar 側に明示、DayFlow 側は scope 指定なし (= デフォルト `"day"`)
- **C: `frontend/src/components/Settings/CalendarDataResetDialog.tsx` (新規)**: 2 段階確認 Dialog。対象 checkbox 5 種 (tasks / events / routines / dailies / notes) + 「全選択 / 全解除」+ 削除ボタンで confirmStage=true → 再度押下で `bulkSoftDeleteCalendarData(kinds)` 発火、結果を toast 経由 (実体は `onDeleted` 内で呼び元が反映) で表示。`createPortal` + escape キー対応 + `useEffect` で再 open 時の selection リセット
- **C: `frontend/src/components/Settings/CalendarDataResetDialog.test.tsx` (新規)**: Vitest 7 ケース — open 時に description 表示 / checkbox 切替 / 削除ボタン disabled 状態遷移 / 2 段階確認 / DataService 呼び出し / 成功時 onDeleted 通知 / error 表示
- **C: `frontend/src/components/Settings/DataManagement.tsx` (改修)**: Danger Zone セクションに「Calendar データ一括削除」エントリ追加、開閉トグルで上記 Dialog を mount
- **C: `frontend/src/services/DataService.ts` (interface 追加)**: `type CalendarDataKind = "tasks" | "events" | "routines" | "dailies" | "notes"`、`interface BulkSoftDeleteResult` (各 kind の件数 + `cascadedScheduleItems`)、`bulkSoftDeleteCalendarData(kinds: CalendarDataKind[]): Promise<BulkSoftDeleteResult>` 追加
- **C: `frontend/src/services/data/misc.ts` (実装)**: `bulkSoftDeleteCalendarData(kinds)` → `tauriInvoke("db_bulk_soft_delete_calendar_data", { kinds })`
- **C: `frontend/src/i18n/locales/{en,ja}.json`**: `settings.calendarReset.*` キー (title / description / kinds.{tasks,events,routines,dailies,notes} / selectAll / deselectAll / confirm / cancel / success / error) を両言語で追加
- **C: `src-tauri/src/commands/data_io_commands.rs` (新規コマンド)**: `db_bulk_soft_delete_calendar_data(kinds: Vec<String>) -> Result<Value, String>` を実装。Phase 1: wants_routines なら active routine id を全件取得し `routine_repository::soft_delete` を順次呼ぶ (各呼出が自前 transaction + 派生 schedule_items を cascade soft-delete)。Phase 2: `conn.transaction()?` の中で tasks (`WHERE type='task' AND scheduled_at IS NOT NULL AND is_deleted = 0`) / events (`schedule_items WHERE routine_id IS NULL AND is_deleted = 0`) / dailies / notes を順に UPDATE、いずれも `is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now')`。戻り値は `{ tasks, events, routines, cascadedScheduleItems, dailies, notes }` の JSON。同ファイルに `bulk_soft_delete_tests` モジュールを追加し 5 件の unit test (空 kinds / tasks 単独 / events 単独 / routines cascade / version bump 確認) を整備、全 pass
- **C: `src-tauri/src/lib.rs`**: `generate_handler![]` に `commands::data_io_commands::db_bulk_soft_delete_calendar_data` を登録 (CLAUDE.md §7.2 4 点同期完備)
- **計画書 archive**: `.claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md` → `.claude/archive/2026-05-12-calendar-display-integrity.md` に移動 (Status: COMPLETED、Completed: 2026-05-13)。`git mv` 経由

#### 残課題

- **手動 UI 検証**: (a) Calendar で task を右クリック → 削除 → Calendar から即座に消える / (b) DayFlow の Progress 表示が日次のまま / (c) Calendar の Progress 表示が月次 / (d) Settings から Calendar データ一括削除 Dialog を開き、kind 選択 + 2 段階確認 + Trash 経由で復元可能 / (e) Routine 削除時に派生 schedule_items も同時消失。いずれも `cargo tauri dev` 起動が必要で未実施
- **push 判断**: A+B (ae365bb) + 本 C コミットを `refactor/web-first-v2` に push するか、PR 作成して main に統合するか。git-orchestrator agent / git-branch-flow skill 経由で判定予定
- **並行チャットとの再同期**: 本セッション中に並行チャットが HEAD を `feat/richeditor-events-ui-batch` に switch していた経緯あり。並行チャット側の作業が refactor/web-first-v2 側を巻き戻すリスクは継続課題、`.claude/comm/` 経由の事前通知運用が未開始
