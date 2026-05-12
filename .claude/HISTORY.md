# HISTORY.md - 変更履歴

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

---

### 2026-05-04 - Schedule > Task フォルダ残タスク 6 件 + Calendar/DayFlow タスク継承色の全廃

#### 概要

ユーザー要望「現在の life-editor フォルダ内 Tasks フォルダにある未完了タスクを実装」を Auto mode で実施。MCP `list_tasks` / `get_task` / `get_task_tree` で Schedule > Task フォルダの未完了 7 件を読み出し、各タスクの content が全て null（タイトルのみ）だったため要件解釈一覧を提示しユーザーと内容確認後に着手。**6 件を実装、1 件は MCP 権限拒否で手動委譲（後にユーザーが完了報告）**。続けて第 2 ターンの要望「Calendar 系がタスクから流用しているカラーも廃止してほしい」で `getTaskColor` / `resolveTaskColor` の prop drilling を Calendar / DayFlow チェーン全段（11 ファイル）から完全撤去。session-verifier 全 6 ゲート PASS（lint findings 13 errors / 3 warnings は全て pre-existing で本変更の編集行外、別タスク扱い）、`tsc -b` 0、`npm test` 43 files / 385 tests pass。本ブランチは `refactor/web-first-v2`（Web ファースト移行ブランチ）上での作業のため、commit は当該作業ブランチに帰属。

#### 変更点

- **TaskTree カラー全廃 (#7)**: `node.color` 由来の row bgStyle / TaskNodeCheckbox の icon color / 新規 folder 作成時の `getColorByIndex` 自動付与をすべて削除（`useTaskTreeCRUD.ts:1-5,40-46,70` 編集 + `frontend/src/utils/folderColor.ts` ファイル削除 + `frontend/src/utils/index.ts` の `resolveTaskColor` re-export 削除 + `walkAncestors.test.ts` の `resolveTaskColor` 用 describe ブロック削除）
- **Calendar/DayFlow 色 prop drilling 撤去 (続編)**: `useTaskTreeAPI.ts` から `getTaskColor` export 削除（`resolveTaskColor` import / `getTaskColor` useCallback / return 値・deps 配列計 4 箇所）→ `ScheduleSection.tsx:149,571,588` の context 取得・prop 渡し → `CalendarView.tsx:209,639,660,878` の prop 渡し・`previewTask.id` 経由の color 取得 → `MonthlyView.tsx:18,28,58` / `DayCell.tsx:15,29,87,98,125` / `CalendarItemChip.tsx:13,18,24,44-61`（task chip の動的 backgroundColor / textColor を除去し `bg-notion-accent/10` 系の固定 fallback を残置）→ `WeeklyTimeGrid.tsx:29,127,275-277,357`（all-day chip と TimeGridTaskBlock 渡し、動的色を `#E0E7FF` / `#4338CA` 固定に）→ `TimeGridTaskBlock.tsx:1-67`（color prop / `getTextColorForBg` import を撤去、`bgColor` / `textColor` を固定値に）→ `TaskPreviewPopup.tsx:13-19,52-55,114-117`（`color` prop と `barColor` 渡しを撤去）→ `OneDaySchedule.tsx:52,80,528,1030` / `DualDayFlowLayout.tsx:22,47,78,95,114,136,292` / `ScheduleTimeGrid.tsx:47,106,566,690` の prop 鎖を全段で削除
- **周辺 color 表示の撤去**: `TaskPickerNode.tsx:71-76` の folder color dot 削除 / `FolderSidebarContent.tsx:355-362,388-398` の child / grandchild folder icon の inline `style={{ color: folder.color ?? "#9CA3AF" }}` を `text-notion-text-secondary` に置換 / `FolderList.tsx:14,30,59-64` と `FolderDropdown.tsx:19,33,68` の `showColor` prop を全廃（呼び出し側で値を渡している箇所がないことを grep 確認）
- **TaskTree タイトル truncate 改善 (#6 / #2)**: `TaskTreeNode.tsx:265` の row container に `relative` 追加、`TaskNodeActions.tsx:38` を `absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-notion-hover rounded-md pl-2 opacity-0 group-hover:opacity-100` に変更し非 hover 時に幅を奪わない設計に。`TaskNodeContent.tsx:40-50` を `flex-1 min-w-0 ... flex items-center gap-1` + 子 `<span className="truncate">{title}</span>` 形式に修正（flex 子に truncate を直接書くと効かない問題への対応）。folder/task 両方で Trash アイコンが行右端に揃うため #2 も同時解消
- **TaskDetail メモフィールド (#3)**: `TaskSidebarContent.tsx:22,222-235` に folder と同じ `DebouncedTextarea` 形式の memo セクションを追加、`node.content` 経由（既存の TaskNode 型に `content?: string` 既存）。i18n キー `taskDetailSidebar.memo` / `taskDetailSidebar.memoPlaceholder` は en/ja 既存。TipTap は導入しない（ユーザー指定）
- **作成→詳細自動 open (#5)**: `TaskTree.tsx:344-353` root `InlineCreateInput` の onSubmit / `TaskTreeNode.tsx:204-218` の `handleMakeFolder` / `handleMakeTask` / 同 384-399 の context menu `onAddTask` / `onAddFolder` の **5 経路全て**で `addNode().id` の戻り値を捕捉し `onSelectTask?.()` に渡すように配線。`useTaskTreeCRUD.ts::addNode` は元々 `return newNode` していたため設計変更なし
- **`TaskDetailPanel` → `TaskDetailContent` リネーム (#4)**: `frontend/src/components/Tasks/TaskDetail/TaskDetailPanel.tsx` を `mv` で `TaskDetailContent.tsx` にリネーム + ファイル内の interface 名 / 関数名 / TaskDetailPanelProps すべて置換 + `frontend/src/components/Tasks/TaskTreeView.tsx`（2 箇所）/ `frontend/src/components/ScheduleList/ScheduleTasksContent.tsx`（1 箇所）の import / JSX を全更新。残置していた vim swap `.TaskDetailPanel.tsx.swp` も削除（rename と同期取れなくなるため）
- **#1 空 New Task (`task-1777823455650`)**: MCP `delete_task` 呼出が hooks の権限制御で拒否（外部 state mutation の安全策）。ユーザーに手動削除を依頼 → ユーザーが完了報告
- **Verification**: `cd frontend && npx tsc -b` exit 0 / `cd frontend && npm test` 43 files / 385 tests pass / `cd frontend && npx eslint <変更ファイル>` 13 errors 3 warnings — **全て pre-existing で本変更の編集行外**（CalendarView.tsx:359/374/389/480 の `react-hooks/preserve-manual-memoization` + `exhaustive-deps` / DualDayFlowLayout.tsx:63,69 の `refreshOther` 同種 / TimeGridTaskBlock.tsx:68 の `set-state-in-effect` / FolderSidebarContent.tsx:157,247 と TaskSidebarContent.tsx:56 の `react-hooks/refs` ref-during-render / useTaskTreeCRUD.ts:19,81 の `persistSilent` 欠落、すべて `git show HEAD:<file>` で本セッション前から存在することを確認済）/ session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) TaskTree の hover 時 Trash 位置が folder/task 両方で右端に揃う / (b) Calendar 月ビュー / 週ビュー / DayFlow で task chip が固定の `#E0E7FF` 背景 + `#4338CA` 文字色になっていること（既存 folder で color を設定していた場合も含めて差が消えていること）/ (c) TaskTree で新規 task/folder 作成直後に詳細パネルが選択状態になり名前編集モードに入ること（root + nested + context menu の 3 系統）/ (d) Task Detail のメモフィールドで入力 → 500ms debounce で persist / 別 task 切替時に flush
- **既存 lint findings の一括対応（別タスク）**: `CalendarView.tsx` の `handlePrev/Next/Today` メモ化警告 / `DualDayFlowLayout.tsx::refreshOther` / `TimeGridTaskBlock.tsx::useEffect` setState / `FolderSidebarContent.tsx` と `TaskSidebarContent.tsx` の ref-during-render / `useTaskTreeCRUD.ts::addNode` の `persistSilent` 欠落。本変更とは無関係に蓄積していた lint 116 問題（MEMORY.md「予定」に既登録）の一部。本セッションで触ると scope creep
- **`getFolderTagForTask` は残置**: タスクの folder 階層 breadcrumb path **文字列**を返すユーティリティで、色とは別概念。Calendar / DayFlow で chip 周辺の sub-label として使用中。色廃止のスコープ外
- **既存 folder の DB 上 `color` 値**: `tasks.color` カラムには物理データが残存。UI で参照されないため見た目では消失するが、Cloud Sync を経由しても消えない。将来 schema slim 時に DROP するかは別判断。Web ファースト移行で SQLite → Postgres 切替時に同時整理可能
- **Calendar 系 `taskColor` を撤去したことで動的色が失われた影響**: 元々 folder.color 由来で task ごとに異なる色を出していた箇所が固定色に統一された。視認性低下を感じた場合は別の手段（例: status 別 / priority 別の色付け）で代替検討
- **アンステージ変更（無関係、別セッション由来）**: `.claude/2026-04-29-web-first-migration.md` の削除 + `.claude/archive/2026-04-29-web-first-migration.md` 新規 + `.claude/2026-05-04-cross-platform-migration.md` 新規（auto-memory 更新で別セッションが Web ファースト → クロスプラットフォーム再設計に切替えた痕跡）。本コミットには含めない

---

### 2026-04-29 - Web ファースト大規模移行の方針決定 + 計画策定 + ブランチ運用整備

#### 概要

ユーザー要望「現状プロジェクトに大規模な改革を課す。React + TS + SQLite を軸にメジャーで情報量の多い技術で再選定し、Claude が扱いやすい環境にする」を受けて、N=1 主作者 + 友達数人配布、Web ファースト、常時オンライン前提のもと、Tauri 2 + Cloudflare Workers + D1 + portable-pty + 自前 sync_engine から **Vite + React + TypeScript + Tailwind + Supabase + Capacitor** への移行を 2.5-4 ヶ月で実施する方針を決定。3 並列の調査エージェント（deep-web-research × 2 + Explore × 1）で技術スタック比較（PWA / Capacitor / Tauri 2 / Expo Universal / Electron+RN）+ BaaS 比較（Supabase / Firebase / Convex / Cloudflare D1 / Turso / PocketBase / Neon / Appwrite / PowerSync）+ 既存資産流用可能性 + terminal-division 構成把握を並行実施。本命 **Capacitor 8 + Supabase 無料枠**（毎日アクセス前提なら 7 日 pause 問題なし、超過時 Pro $25/月で N=1 + 友達カバー）、認証は Apple Sign-in 込み Supabase Auth、AI 連携は terminal-division からの **stdio MCP**（Remote MCP 不採用）、Desktop は当面ブラウザ運用（将来 Electron 検討）。既存 React コードの **65-70% が流用可能**、`DataService` 抽象化はそのまま `SupabaseDataService.ts` 実装で切替可能と判明。Apple Developer Program $99/年は配布期間のみ加入で運用（未更新で取り下げ、再加入で復活）。本セッションはコード変更なし、計画策定 + ブランチ運用整備 + Phase 0 学習着手のメタ整備。

#### 変更点

- **新規 `.claude/2026-04-29-web-first-migration.md`**（約 200 行、Status: ACTIVE — Phase 0 開始前）: 6 フェーズ実装プラン。Phase 0（環境構築 + 学習、2 週、Day 1-3 Vite+React+TS+Tailwind / Day 4-5 Supabase 基礎 / Day 6-8 Auth / Day 9-11 Realtime / Day 12-14 Capacitor）→ Phase 1（新スタック土台、`/web/` 新設 + `SupabaseDataService.ts` + 既存 SQLite → Postgres 移行スクリプト）→ Phase 2（コア機能移植、Tasks/Schedule/Notes/Daily/WikiTags）→ Phase 3（Capacitor 化）→ Phase 4（周辺機能整理）→ Phase 5（terminal-division 連携 + 旧スタック削除）。各フェーズに完了判定チェックボックス + 影響ファイル表 + verification を記載
- **archive 移動**: 旧プラン `.claude/2026-04-29-claude-desktop-style-chat-ui.md`（CONCEPT、Web UI 否定前提）を `.claude/archive/` へ移動。本移行で前提（「Web UI を Vision で否定済み」）が反転するため
- **ブランチ `refactor/web-first-v2` 新規作成**: main から派生。`feat/server-authoritative-sync-phase0-1`（Cloud D1 関連の進行中作業、本移行で廃止方針）はリモートに保存済みで凍結
- **新規 `.git/hooks/pre-push`**（実行可能、リポジトリ管理外）: main ブランチでの push を `exit 1` でブロック。`git push --no-verify` で回避可能だがユーザーが明示しない限り使わない運用
- **`.git/config` 編集**: `branch.main.pushRemote = no_push` を追加。存在しない remote 名で `git push` 実行時に確実に失敗させる第 2 安全網
- **コミット `f440f4b docs: kick off web-first migration plan` on refactor/web-first-v2**: 新規プラン doc + archive 移動の 2 ファイル変更、622 insertions
- **`~/dev/learning/` 独立 git repo init**（初回 commit `ee3fb10`）: life-editor 本体とは別リポジトリ。`life-editor-web-first/`（教材: README / 01-overview / key-concepts / day-02-counter-and-forms / \_learning-log）+ `web-first-spike-1/`（実 Vite プロジェクト、`npm create vite@latest --template react-ts` の成果物）を含む。`.gitignore` で node_modules / 親ディレクトリへの誤 npm install 痕跡（`/package.json`, `/package-lock.json`）を除外。リモート未連携
- **auto-memory 更新**（`/Users/newlife/.claude/projects/-Users-newlife-dev-apps-life-editor/memory/`）: `project_web_first_migration.md`（本移行を新 SSOT として宣言、旧 Tauri/Cloud Sync/iOS gotchas メモを deprecated 化）と `feedback_branch_protection.md`（main push 禁止 + task-tracker は作業ブランチで commit する運用ルール）を新規作成。MEMORY.md インデックスにポインタ追加 + 旧 Tauri 関連エントリを (deprecated) マーク

#### 残課題

- **Phase 0 Day 1 の Tailwind wiring**: `~/dev/learning/web-first-spike-1/package.json` に `tailwindcss` + `@tailwindcss/vite` 未登録 + `vite.config.ts` に plugin 未追加 + `src/index.css` に `@import "tailwindcss";` 未追加。最初の `@teilwindcss` タイポ後、リカバリ時に親ディレクトリ `~/dev/learning/` で `npm install` 実行してしまった。次セッションでユーザーが正しい場所で再インストール → 動作確認 → Day 2（useState + controlled component + IME 対応）へ。Q1（Vite dev vs build）/ Q2（TS の実行モデル）はユーザー両方正解、Lv.2-3 のレベル感を確認済
- **`~/dev/learning/` のリモート連携**: `gh` CLI は `sunbreak-pro` アカウントで認証済みだが GitHub repo create はまだ未実施。次セッションで `gh repo create life-editor-learning --private` 等で連携検討
- **`feat/server-authoritative-sync-phase0-1` ブランチ**: Cloud D1 + 自前 sync_engine 関連の進行中コミット（`1b15bbd feat(sync): Server-Authoritative migration Phase 0 + Phase 1`）が残存。Phase 5 の旧スタック削除タイミングで `archive/` 行き or 削除判断
- **MEMORY.md 予定リスト**: 旧 Tauri アーキテクチャ前提のタスクが多数（Q2 機能パッチ手動 UI 検証 / リファクタリング Phase 2-4 検証 / Realtime Sync Phase 1 / Mobile Settings 改修 / Desktop パッケージ更新 / 旧バンドル DB クリーンアップ / iOS 4G 同期検証 / Mobile Schedule 検証 / iOS 追加機能要件残タスク / lint 116 問題解消）。本移行で大半が deprecated になるが、本セッションでは触らず維持し、移行 Phase 1-2 進行時に再評価
- **アンステージ変更**: 別セッション由来の各種 frontend / src-tauri 変更が working tree に残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` のみに絞る
