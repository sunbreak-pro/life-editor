# HISTORY.md - 変更履歴

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

---

### 2026-05-12 - ad-hoc メンテナンス: Calendar DB ワイプ + statusLine UI 拡張（Mobile 設計方針メモは CLAUDE.md 書き込み後に消失）

#### 概要

ユーザー要望「カレンダーの DB 全削除 + スマホ/デスクトップ方針を CLAUDE.md などに記録 + statusLine 改修」を本セッションで 3 件 ad-hoc 実施。Calendar DB ワイプと statusLine 改修は完了。Mobile vs Desktop 設計方針は CLAUDE.md §2 Platform への直接追記 Edit が成功したものの、セッション終盤の `git status` で working tree クリーン + grep でキーワード未検出となり**書き込み後にロールバックされた**と判定（並行チャットまたはリンターによる整理を推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記はそもそも不適切で、`docs/vision/` 配下の独立ファイル化が筋。MEMORY.md 予定タスクの先頭に「Mobile vs Desktop 設計方針の docs/vision/ への明文化」として再投入。本セッションのコード/設定変更はすべて life-editor の git repo 外（`~/.claude/statusline-command.sh` は global config、Calendar DB は SQLite ファイル）に集中したため、task-tracker による .claude/MEMORY.md + .claude/HISTORY.md + .claude/HISTORY-archive.md の更新のみが commit 対象。なお本セッションの task-tracker 実行中に並行チャットが「Global git skill / agent 整備」セッションを同時に終了させており、両者の HISTORY.md エントリが本コミットで隣接配置される。

#### 変更点

- **Calendar DB ワイプ（Tauri 起動停止下で実施）**: 現行 `~/Library/Application Support/life-editor/life-editor.db` (user_version=69、bundle ID 変遷後の正規 path) で `schedule_items` 全 1030 件 (active 342 / soft-deleted 688) + `calendar_tag_definitions` 1 件 (「仕事中」タグ) + `calendar_tag_assignments` 0 件 + `calendars` 0 件を `BEGIN; DELETE FROM ...; COMMIT; VACUUM;` で hard delete。事前バックアップ `~/Library/Application Support/life-editor/backups/life-editor-pre-calendar-wipe-20260512-214035.db` (1.4MB) を `sqlite3 .backup` で取得済。実行前後で件数 0 確認、VACUUM 後の DB ファイルサイズ 1.3MB。AskUserQuestion で hard / soft / partial の 3 択を提示しユーザーが完全リセット選択。pgrep で Tauri 未起動を確認してから実行
- **statusLine スクリプト改修（`~/.claude/statusline-command.sh`）**: 旧表示 `user@host  cwd | model | ctx:N%` を `user@host  cwd | branch[*] | ctx:N% | $cost | ▶ active-task` に再設計。model 表示はユーザー指示で削除。新規要素は (a) `git -C <cwd> rev-parse --git-dir` で git repo 判定、(b) `git symbolic-ref --short HEAD` または短縮 SHA、(c) `git status --porcelain | head -1` の early exit で dirty 判定 `*`、(d) `.cost.total_cost_usd` を `$%.2f` 整形、(e) `<cwd>/.claude/MEMORY.md` の `## 進行中` 直下の最初の `### ` 行を awk で抽出 → `perl -CSD substr` で 40 文字 multibyte 安全切り出し。非 git dir / MEMORY.md 不在 / cost/ctx の JSON 欠落いずれも graceful 省略。dummy JSON 3 ケース (フル / 最小 / 非 git) で動作確認済
- **Mobile vs Desktop 設計方針メモ（CLAUDE.md §2 Platform 追記、結果として working tree に残らず）**: 「Desktop vs Mobile 設計思想」セクションを `### 配布方針` の直前に挿入する Edit を発行し成功 (line 45-54 想定)。内容は Desktop=クリエイティブ重視 / Mobile=コンパクト重視 + Mobile 必須セクション 4 つ (Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings) + Mobile は Desktop の縮小コピーではなく専用再設計 + スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達。セッション終盤の `git status` で working tree クリーンを確認、`grep -rn 'コンパクト重視\|クリエイティブ重視\|Mobile 必須セクション' .claude/` で当該キーワード未検出のため**書き込み後にロールバックされた**と判定。Edit 直後の system-reminder で `.claude/CLAUDE.md` + `~/.claude/CLAUDE.md` の両方が「linter or another agent によって変更された」と連続発火していた経緯から、並行チャットまたは linter による整理が原因と推定
- **MEMORY.md 予定タスク先頭追加**: 「Mobile vs Desktop 設計方針の docs/vision/ への明文化」を登録。新規 `.claude/docs/vision/mobile-design.md` (仮名) として上記 4 点を記録 → CLAUDE.md §2 末尾に 1 行リンクで言及 → `2026-05-04-cross-platform-migration.md` と相互リンク、の手順を含む。並行チャットとの衝突回避のため `.claude/comm/outbox/` での予告または multi-session-coordinator でのロック取得を検討と注記
- **HISTORY.md ローリング**: 6 件目超過のため最古の `2026-04-29 - Routine Tag 廃止…` を `.claude/HISTORY-archive.md` 先頭に prepend（5 件保持ルール）

#### 残課題

- **Mobile 設計方針の再記録**: 次セッションで `docs/vision/mobile-design.md` (仮名) を新規作成し本セッションで決まった 4 点を記録、CLAUDE.md §2 末尾に 1 行リンクで言及。並行チャット衝突回避のため編集前に `.claude/comm/outbox/` で予告する運用を試行
- **Calendar DB ワイプ後の Cloud Sync 復活リスク**: hard delete のため Cloud D1 に残存していれば次回 Tauri 起動時の sync で復活する可能性。本セッションでは Cloud 側削除は未実施。再復活が発生したら (a) `wrangler d1 execute life-editor-sync --remote --command "DELETE FROM schedule_items;"` 等で Cloud 側もクリア、または (b) アプリ起動前に Sync を一時 disable のいずれかで対応
- **古い orphan DB**: `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59) と `sonic-flow/life-editor.db` (空) は本セッションでも未対応。MEMORY.md 予定の「旧バンドル DB の orphan クリーンアップ」タスクで一括対応予定
- **並行チャットの新規プラン untracked**: `.claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md` が本セッション中に並行チャットから新規作成され untracked のまま残置。本コミットには含めず、別チャットの task-tracker / commit に委ねる

---

### 2026-05-12 - Global git skill / agent 整備（git-orchestrator + git-workflow / git-branch-flow / git-conflict-resolver）

#### 概要

ユーザー要望「ブランチ管理（push / merge / conflict 対応）がめんどくさい。git 操作専用の agent + skills (task-tracker と連携) を global で作る。Web から git 操作・コード管理に関する情報を集め、保守性の高い方法で実行するための原則を集めて、それを元に skills / agents を作成」を受けて実施。deep-web-research エージェントで一次ソース 13 件（Conventional Commits 公式 v1.0.0 / Pro Git Book §3.6 + §7.9 / GitHub Docs 4 件 / DORA / Trunk Based Development 公式 / Atlassian / Claude Code Hooks Guide / Claude Code 破壊的コマンド対策実装例 / 2024 DORA Report）から原則抽出 → AskUserQuestion で 4 観点を確定（自動化レベル=標準 / tracker 連携=完了→commit+push+PR 一気通貫 / ブランチ戦略=GitHub Flow / conflict 対応=解析提案のみ）→ skill 3 + agent 1 を実装。本作業は `~/dev/Claude/` 配下（git 管理外）が主対象で、life-editor リポジトリ側は `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみに絞って commit。他の未コミット変更（CLAUDE.md / docs / frontend / src-tauri / cloud 等の別セッション置き土産）は巻き込まない方針。

#### 変更点

- **更新 `~/dev/Claude/skill-lib/global/git-workflow/SKILL.md`**: SSOT 専用に再設計。Conventional Commits 完全版 type 表（feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert + SemVer 影響）、Breaking Change 2 方式（`!` 記法 / `BREAKING CHANGE:` footer 記法）、Co-Authored-By trailer 必須、破壊的コマンドの 3 段階分類（完全ブロック=`git push --force` / 保護 ref への force-with-lease / filter-branch / 確認必須=hard reset / clean -f / branch -D / amend / rebase on shared / `--no-verify` / 自動可=status / diff / fetch / 特定ファイルの add）、推奨グローバル設定（`rerere.enabled=true` / `pull.rebase=true` / `merge.conflictstyle=zdiff3`）。手順は git-branch-flow / git-conflict-resolver に分離した旨を明記
- **新規 `~/dev/Claude/skill-lib/global/git-branch-flow/SKILL.md`**: GitHub Flow デフォルト（短命 feature branch、寿命 2 日以内目標、main は常にデプロイ可能）+ ブランチ命名規則（feat/fix/chore/docs/refactor/hotfix/test + kebab-case 30 文字以内）+ branch 作成手順 + main 取り込みの rebase vs merge 判断（自分専用かつ短命=rebase / 共有 or 長命 5 日以上=merge）+ PR 作成（タイトル 70 字以内 / 本文テンプレ / `gh pr create` heredoc 形式）+ merge / rebase / squash 判断フローチャート（個人開発デフォルト=squash / レビュー済粒度綺麗=rebase / 大型機能=merge commit）+ マージ後クリーンアップ（`git branch -d` / `fetch --prune`）+ AI は main 直接 commit しない原則
- **新規 `~/dev/Claude/skill-lib/global/git-conflict-resolver/SKILL.md`**: conflict 解析・提案専用（自動編集はしない、ユーザー確認後のみ）。種別判定 5 分類（logic / lockfile / generated / formatting / rename）+ 両側意図解析手順（`git log --merge` / `git diff :1: :2: :3:`）+ 提案フォーマット（ours/theirs の意図 + 推奨マージ + 理由）+ zdiff3 マーカー読み方（共通祖先表示）+ lockfile 安全解決（npm/yarn/pnpm/cargo の `--theirs` 採用 + 再生成、手動マージ禁止）+ generated file は再生成（`npm run build` / `cargo build`）+ 中断手順（`merge --abort` / `rebase --abort` / `cherry-pick --abort`）+ rerere 設定
- **新規 `~/dev/Claude/agents-lib/global/git-orchestrator.md`** (model:opus / effort:xhigh / tools:Read+Glob+Grep+Bash+Skill / permissionMode:default): 状況判断（branch / staged / unstaged / untracked / ahead/behind / 既存 PR）+ 戦略決定 + 既存 git skill 委譲。**標準モード**: commit + push 自動 / PR 作成・merge・rebase 確認 / `--force` 完全ブロック / `--force-with-lease` ユーザー確認後 / 保護 ref (main/master/production/release/\*) への force 完全ブロック / conflict 提案のみ。**task-tracker 連携モード**: 計画書アーカイブ後に PR 作成補完で「commit+push (tracker) + PR (orchestrator)」一気通貫。**branch 名提案**（kebab-case / 30 文字以内 / type プレフィックス自動推定）+ **commit メッセージ自動生成**（diff stat から type/scope 推定 + Co-Authored-By 必須）+ **main 直作業の自動 branch 切替提案** + multi-session-coordinator との役割分離明示
- **シンボリックリンク 3 件**: `~/.claude/skills/git-branch-flow` → `~/dev/Claude/skill-lib/global/git-branch-flow`、`~/.claude/skills/git-conflict-resolver` → `~/dev/Claude/skill-lib/global/git-conflict-resolver`、`~/.claude/agents/git-orchestrator.md` → `~/dev/Claude/agents-lib/global/git-orchestrator.md`（既存 `~/.claude/skills/git-workflow` は再リンク不要）
- **`~/dev/Claude/skill-lib/SKILL_INDEX.md`**: Global Skills 11 active → 13 active に更新。新 2 skill 追記 + git-workflow の説明を「SSOT 専用」に変更 + task-tracker 説明に「完了時は `.claude/` または全変更を commit + push」を補足。最終更新日を 2026-05-12 に更新
- **`~/dev/Claude/agents-lib/AGENT_INDEX.md`**: Global Agents 8 active → 9 active に更新。git-orchestrator 追記（model/effort/状態/説明）+ multi-session-coordinator の説明を「git は git-orchestrator に委譲」に変更。最終更新日を 2026-05-12 に更新

#### 残課題

- **task-tracker SKILL.md への明示連携追記**: 現状 task-tracker END フローには「git-orchestrator を呼ぶ」記述がない。実運用では agent description の起動条件 `(2) task-tracker END フローが完了し、計画書アーカイブが行われた直後` で auto-trigger される設計だが、明示的に手順追記すべきかは別 PR で検討（過剰連携で task-tracker の独立性を損なうリスクとのトレードオフ）
- **動作確認の宿題**: 今回の commit + push 自体は git-orchestrator を経由せず task-tracker 内蔵 commit を使用したため、agent 自体の auto-trigger を体感確認できていない。次セッション以降の運用シーン（branch 切替提案 / 通常コミット / PR 作成 / conflict 検出 / force push ガード）で実地テスト推奨
- **プロジェクト固有上書き**: agent は `.claude/CLAUDE.md` または `.claude/git-strategy.md` の上書き設定を読みに行く設計だが、life-editor / novel 等での上書き例はまだ無し。必要になったタイミングで `.claude/git-strategy.md` 雛形を作成
- **グローバル `~/dev/Claude/` の git 管理**: 現状 git 管理外。`~/.claude/settings.json` のバックアップ仕組みは存在するが、`~/dev/Claude/skill-lib/` と `~/dev/Claude/agents-lib/` の独立 git 管理は未実施。誤削除のリスク管理は将来検討
- **アンステージ変更**: 別セッション由来の `.claude/CLAUDE.md` / `.claude/docs/code-explanation/*` / `.claude/docs/known-issues/009-*.md` / `.claude/docs/vision/plans/*` の移動 / `frontend/src/components/{Database,Tasks,Notes,RichEditor,ScheduleList,shared}/*` / `frontend/src/{context,extensions,hooks,services,types}/*` / `frontend/src/index.css` / `src-tauri/src/{commands,db,sync}/*` / `cloud/db/migrations/0008_*.sql` 等の大量変更が working tree に残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルに限定
- **HISTORY.md ローリング**: 6 件目超過のため最古「2026-04-27 - life-editor 固有エージェント 3 件追加」を `.claude/HISTORY-archive.md` 先頭に prepend（5 件保持ルール）

---

### 2026-05-10 - チャット間ファイル通信プロトコル (.claude/comm/) Phase 1 配置 + CLAUDE.md §9 更新

#### 概要

複数 Claude チャット間の非同期通信仕組み Phase 1（Outbox のみ）を本プロジェクトに導入。`~/.claude/templates/comm-protocol/` に作成したグローバルテンプレートから `.claude/comm/` を展開し、CLAUDE.md §9 Document System 末尾に「並行チャット間通信」サブセクションを追加した。中核設計は単一書き込み者・複数読み取り者ルール（各チャット専用 Outbox + 他 Outbox 読み取り専用）+ append-only 構造で、同時編集衝突を設計レベルで排除する。Anthropic 公式 (Harness Design / Multi-agent Research System / Effective Harnesses) の「ファイル経由のエージェント間通信」パターンに準拠。Claude Code はファイル監視機能を持たないため、相手チャットのメッセージ取得は手動指示が必要（Phase 2 の SessionStart hook 自動読み込みで解消予定）。

#### 変更点

- **新規 `.claude/comm/README.md`**: Phase 1 プロトコル定義（ファイル構造 / 命名規則 `chat-<name>` / Outbox フォーマット (timestamp + 宛先タグ + 本文の append-only) / 宛先タグ仕様 (`@all` / `@chat-name` / `@self`) / 衝突対策 4 層 (設計 / append-only / ロック (Phase 4) / git) / アンチパターン (他 Outbox 編集禁止 / 過去エントリ書き換え禁止)）
- **新規 `.claude/comm/outbox/.gitkeep`** + **`.claude/comm/archive/.gitkeep`**: Outbox / アーカイブディレクトリ確保
- **`.claude/CLAUDE.md`**: §9 Document System 末尾に「並行チャット間通信」サブセクションを追加（プロトコル参照リンク + 運用開始時のチャット名宣言 + 書き込み・読み取り・衝突対策の 5 項目）
- **テンプレート由来の運用**: グローバル `~/.claude/templates/comm-protocol/` から `cp -r` で一式コピー、サンプル `outbox/EXAMPLE-chat-engineer.md` のみ削除して空 outbox 状態で運用開始

#### 残課題

- **動作確認**: 並行 Claude チャット 2 つで Outbox 書き込み → grep 読み取り → 返信の往復を試運転し、フォーマット書き込みの自然さ・context 消費量を確認
- **Phase 2 判断**: SessionStart hook で他チャットの Outbox 最新エントリを自動読み込みするかは試運転後に判断（手動「outbox 確認して」指示で十分なら hook 不要）
- **Phase 3-4 (Inbox / Shared State / ロック)**: Phase 1 運用で不便を感じてから着手
- **アンステージ変更**: 別セッション由来の `.claude/skills/feature-files` が working tree に残存。本コミットは `.claude/CLAUDE.md` + `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` + `.claude/comm/` のみに絞る
