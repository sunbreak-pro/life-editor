# HISTORY (chat-shared-fix)

### 2026-08-13 - #831 コード上の Task → Todo 統一を stacked 3 PR で実装

#### 概要

画面は既に Todo なのにコードが task のままだった語彙のねじれ（実測 約 3,470 箇所）を、機械置換 3 本で解消。着手条件（Issue コメント「open PR が 0 件になってから」）を `gh pr list --state open` = 0 件で実測してから開始した。PR #861 骨格 / #862 画面 + i18n キー / #863 MCP + docs（#863 に Closes #831）。3 本とも stacked（base は前段のブランチ）で、各 PR 単独で shared / web / mcp / desktop / docs-lint 全ゲート緑。merge はユーザー手番（P-001）。

#### 変更点

- **PR-A #861 骨格**: `types/taskTree.ts` → `todoTree.ts`、`TaskNode` / `NodeType` / `TaskStatus` → `TodoNode` / `TodoNodeType` / `TodoStatus`、context 2 本・`useTaskTree*` 6 本・`SupabaseTasksService` / `taskMapper` / `getDescendantTasks`、`TasksDataService` のメソッド名、SyncDomain `"tasks"` → `"todos"`。参照更新は 145 ファイル（1168 +/-）
- **PR-B #862 画面**: 36 ファイル改名（`web/src/tasks/` ディレクトリごと `todos/` へ）+ i18n キー名。252 ファイル（3035 +/-）
- **PR-C #863 MCP + docs**: 6 ツールを破壊的改名（`list_tasks` → `list_todos` ほか）+ `search_items` の domain 語彙と戻り値キー。docs は CLAUDE.md §3.2 / §4・rules/frontend.md・db-conventions.md、加えて tier-1-core の MCP Coverage 行（放置すると存在しないツール名が残るため）
- **据え置きの実測**: `generateId("task")` / `role: "task"` / DB 名（`tasks_payload` / `task_type` / `task_id` とその TS 名）は不変。各 PR 本文に grep 出力を貼付。加えて lumen デザイントークン・TipTap の `taskList` / `taskItem` / `toggleTaskList()`・localStorage に保存されるショートカット id（`nav:tasks` / `global:new-task`）も据え置き
- **表示文字列の不変を機械証明**: i18n の葉の値を改名前後で集合比較 → 差分は各 catalog 1 件のみで、それも補間変数名（`{{task}}` → `{{todo}}`、コード側と同時改名）。レンダリング結果は不変
- **型で捕まらない罠 2 種**: `Record<ItemRole, …>` 系のキーは `items_meta.role` そのものなので `task` 据え置き（`itemRole.task` の i18n キーも同様）。うち `itemLinkSuggestion` / `useShellNavigation` / mcp の `ROLE_PAYLOAD_TABLE` は `Record<string, …>` で **改名しても build が通ってしまう** — 手検査で発見（mcp 側の 1 件は verification suite が実行時に検出）
- **見送り**: CLAUDE.md §8 Tier マップと tier-1-core 本文の機能名「Tasks」（プロダクト語彙のため別判断）。archive / history / memory / decisions / comm は `rules/records.md` に従い書き換えない

### 2026-08-13 - #838 セッション永続の storage 差し替え + #827 ダークスクロールバー

#### 概要

shared-fix 2 連。#838 = 同じ端末で毎回ログインし直しになる問題を、Supabase auth の保存先をプラットフォーム別に差し替えて解消（PR #847・書いた時点で open）。#827 = ダークテーマでスクロールバーだけ白い問題を `color-scheme` + `scrollbar-color` で解消（PR #850・同 open）。どちらも Closes 付き・main から個別分岐・全ゲート緑（shared / web 各 lint+test+build、#838 は desktop typecheck+build も。desktop は本 worktree 初 install）。merge はユーザー手番（P-001）。

#### 変更点

- **#838 shared**: `services/supabaseAuthStorage.ts` 新設 = プラットフォーム判定の一元点（DoD）。Electron → preload の `window.desktop.authStorage` ブリッジ / native mobile → `window.Capacitor.Plugins.Preferences`（runtime global 経由 — shared に `@capacitor/*` import を入れない不変式を維持）/ web → localStorage 既定。ブリッジ不在時は従来挙動へフォールバック。resolver テスト 5 件
- **#838 desktop**: `authStorage:*` IPC 3 本 + electron-store 保存。`safeStorage` で OS キーチェーン暗号化（refresh token を平文 localStorage に置かない — file:// 起因の消失と保管場所の両方を解決。app:// 配信案との比較理由は `setupAuthStorageIpc` のコメントに記録 = DoD）。暗号化不可環境は `plain:` マーカーで劣化動作
- **#838 mobile**: `@capacitor/preferences@^8` を依存追加（lock 再生成は `--package-lock-only`）
- **#827**: `tokens.css` に `color-scheme: light/dark`（テーマ属性スコープ・ThemePreviewCard の入れ子 light も考慮）+ `:root` の `scrollbar-color: var(--color-border-strong) transparent`（継承でアプリ全域・トークン経由でハードコード無し）。jsdom はスクロールバーを描けないため宣言のピン留めテストで回帰を防止
- **申し送り**: 実測系 DoD（パッケージ版 Electron 再起動 / モバイル殻再起動 / ダークテーマ目視）は merge 後 chat-main 実測 — 両 PR 本文に記載済み

### 2026-08-13 - #782 MCP 棚卸しの残り 3 塊を 3 PR で実装

#### 概要

#702 Step 1 棚卸しで挙がったが Step 2 に入らなかった「追加」寄り 3 塊を、Issue の区切りどおり独立 3 PR（main から個別に分岐）で実装。① 欠けている操作 = PR #822（書いた時点で merged）/ ② 戻り値の穴 = PR #828 / ③ 文脈ツール横展開 = PR #832（どちらも open）。各塊とも role-engineer 実装 → role-qa 独立監査 → Blocking/Important を修正して commit の流れ。

#### 変更点

- **① 欠けている操作（#822）**: `restore_item`（task/note/event・live id は書き込みゼロの no-op）/ `delete_note` / `untag_entity`（tag_entity の revive と対になる soft delete）/ `update_note.is_pinned`。記録型スタブ `tests/supabaseStub.ts` 新設（書き込みは await 実行時にカウント — QA 指摘反映）。VALID_CALLS と公開ツール一覧の網羅テスト追加。docs は AC8 の「MCP 経由では削除できない」を反転、Notes/WikiTags の Coverage 列挙を参照化
- **② 戻り値の穴（#828）**: `get_daily` を exists/isTrashed/hasBriefing の 3 分岐に（trash の本文は返さない）。`search_all` を per-domain {results,total,hasMore} + offset に刷新、dailies に id。tasks は server 側 .limit 撤去 → in-app merge で total 正確化 + id タイブレーク（QA 指摘）。limit/offset の明示 null は未指定扱い（validator の寛容則と整合 — QA 指摘）
- **③ 文脈ツール（#832）**: `get_week_context`（範囲クエリ 4 本・宣言コメントと一致）/ `get_note_context`（note+tags+links/backlinks）。getTodayContext の整形を共有ヘルパ化（戻り値不変を characterization テストで初めて固定）。carriedOver の文字列比較 → instant 比較（PostgREST `+00:00` vs `.000Z` で週初日 0:00 が誤って持ち越し扱い — QA 検出の実バグ・get_today_context も同時修正）
- **合流事故 2 件の検出と収束**: main が 2 度赤くなっていた（#822 の網羅テスト × #700 の 3 ツール = mcp / #788 系 × 別 PR = web kanban）。前者は当レーンが検出し #829（chat-main）と両側から修復 → 重複行は #832 側で削除。後者も #829 が修復済みを確認し、最新 main を #832 に merge して統合ツリーで全ゲート再実測
- **見送り分の行き先**: QA Suggestion のうち別課題級 4 件は outbox（`comm/outbox/chat-shared-fix.md`）へ起票依頼として記載

### 2026-08-13 - #672 schedule hook の導出 loading 化と eslint baseline の退役

#### 概要

#672 の最終 PR。baseline 3 ファイルの最後だった `useScheduleItemsAPI` を `useDomainLoad`（#769 の共通 load effect）へ移植し、`shared/eslint.config.js` の BASELINE ブロックを削除のみの diff で全撤去した。PR #801（書いた時点で open）。calendars / routines（PR #769）・routine UndoRedo（PR #686）は merge 済みだったため、本セッションの残作業はこの 1 本のみ。

#### 変更点

- **useScheduleItemsAPI**: load effect を `useDomainLoad` へ移植。anchored date は `anchor` として渡し、日付切替は Realtime bump と同じ経路でロードを再開始する。loading は導出（同期 `setIsLoading(true)` の削除 = render 1 回分の実変更・lint ロンダリングではない）。trash 読みは独立 effect のまま deps から `date` を除去（trash は日付アンカー無し・TrashView は開時に命令的再取得）
- **eslint.config.js**: BASELINE ブロック 30 行を削除のみで撤去。`react-hooks/set-state-in-effect` が shared/ 全域で有効に
- **テスト**: `scheduleItemsLoadEffect.test.tsx` 新規 5 件（routinesLoadEffect と同契約 + date アンカー再開始）。DoD の grep 3 点（baseline 0 / 削除のみ / hooks 配下 `setIsLoading(true)` 0 件）を実測達成 — useDomainLoad のコメント文言も文字列一致しないよう書き換えた
- **申し送り**: merge 後の playwright（Schedule 初回描画 / 日付切替 / Realtime bump / Calendar 管理ビュー）は chat-main 宛てに PR 本文へ記載。完了で #672 を手動 close（PR に Closes を付けなかった理由）

### 2026-08-11 - #669 mcp-server の書き込み儀式を utils/items へ・tools.ts を宣言的レジストリ化

#### 概要

core-refactor C2（計画書 `docs/vision/plans/2026-08-10-core-refactor.md` §C2）。`utils/items.ts` に正解がありながら `scheduleHandlers` / `briefingHandlers` が手写ししていた items_meta 書き込みを置換し、`tools.ts` の手動レジストリ（import + 配列 + switch の 3 箇所同時編集）を宣言的な 1 箇所へ畳んで、引数の実行時検証を同じ PR で入れた。PR #694（書いた時点で open）。

#### 変更点

- **書き込みの集約**: schedule 5 経路 + briefing 2 経路を `insertItem` / `updatePayload` / `softDeleteItem` / `bumpMeta` へ置換。`grep -rn -A2 'from("items_meta")' mcp-server/src/handlers/ | grep -E '\.(insert|update|delete)\('` が 9 行ヒット → 0 行
- **レジストリ**: `TOOL_DEFINITIONS`（name / description / inputSchema / handler の 1 エントリ）から `TOOLS` と dispatch を導出。`switch` 削除・JSON→型のキャストは `defineTool` の 1 行に集約
- **validator**: `src/utils/toolSchema.ts` を新規追加し `callTool` が dispatch 前に公開スキーマで検証。未宣言プロパティの素通しと「任意プロパティの明示 null = 未指定」は現行の呼び出しを落とさないため意図的に緩めてある
- **テスト**: `tests/toolRegistry.test.ts` を追加（mcp-server 118 tests / 8 files 緑）。公開中の全ツールに型違いを投げて `Invalid arguments for <name>:` で止まる = レジストリ登録済 かつ ハンドラ未到達（メッセージに `Supabase` を含まない）を検証。逆方向に全 27 ツールの「正しい引数」テーブルも通す
- **挙動不変の実測**: main の build と本ブランチの build で `JSON.stringify(TOOLS, null, 2)` を生成して diff → 差分ゼロ（md5 一致）。wire に出る差分は DB エラー時のメッセージ接頭辞のみ
- **db-conventions §13**: migration 0013 は「一度も存在しなかった番号」と実測で確定（`git log --all --full-history -- '*0013*'` が 0 件・リモート台帳も 0012 → 0014）。0012 と 0014 は同一 commit `fe2c7d86` で、並行 2 計画が番号を先取りした結果。埋めない / 振り直さない を運用則として明記
