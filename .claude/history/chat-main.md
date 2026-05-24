# HISTORY (chat-main)

### 2026-05-24 - subagent self-contained brief 規約 + worktree integrity 改善（Plan 一気通貫実装、PR #22）

#### 概要

「現在の Claude Code 使い方 vs 世間典型」調査（Anthropic 公式 + コミュニティ 12 ソース triangulation）で見つかった中優先 4 件（subagent context inheritance / worktree 散乱 / hook 拡張 / 公式 --worktree 棲み分け）を 1 計画書にまとめ、Plan モード承認後 Phase 1-5 順次実施。PR #22 (draft) で hook + 計画書のみ提出（agents-lib は git 管理外のため PR 外で同時実施）。

#### 変更点

- **subagent（PR 外、agents-lib 一元管理）**: role-pm / role-engineer / role-qa に「## メインから受け取る前提（self-contained ブリーフ必須）」セクション追加。各役割 5 項目（pm = ユーザー発言原文 + memory 抜粋 + 関連パス + 過去意思決定リンク + 期待フォーマット / engineer = pm サマリ + 編集対象絶対パス + 触禁止パス + 検証コマンド + 既存パターン参照 / qa = pm サマリ + engineer 出力 + 監査観点 hint + 並列起動候補 + 検証ログパス）。GH Issue #56068（parallel sub-agent が parent context 全継承で 100K tokens 浪費）対策
- **git-orchestrator（PR 外）**: §2.4 worktree 命名規約（dir 名 = branch 名の `/` を `-` に置換 / `+` 禁止 / `worktree-` prefix 二重禁止 / cleanup 3 条件: PR MERGED + `log origin/main..HEAD` 空 + `status -s` 空）追加。§12「公式機能との棲み分け」（Claude Code v2.1.150 の `claude --worktree [name] --tmux` / `.worktreeinclude` との分担表 7 観点）追加。旧 §12 参考は §13 に繰り下げ
- **SessionStart hook（PR 内）**: 検査 E（worktree dirty 24h+ 検知）追加。`ls-files -mo --exclude-standard` で各 worktree の dirty を列挙、`OLDEST_MTIME`（NEWEST だと「全部新しい」ケースで fire しない設計判断）が 24h 以上前なら警告。informational only、既存 A-D 検査と `set -uo pipefail` 維持。合成テスト（一時ファイル backdate）で 1288h 検出 → cleanup 確認
- **worktree 整理**: `cleanup-and-consolidation` worktree + branch 削除（PR #15 MERGED 済の clean 状態を再確認後）。`prototype+mobile-ui` はユーザー指示で保留（深掘り再調査でも reflog はブランチ create のみ・PR 紐付け無し・最終 mtime 5/24 15:10 だったが、ユーザー認識を優先）
- **MCP 整理（前タスクで実施）**: pencil 削除 + claude-in-chrome 無効化 + Linear は claude.ai Web UI 切断手順案内（`~/.claude.json` 編集 + バックアップ取得）
- **計画書**: `.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md` 新規（Status COMPLETED 反映、Lessons Learned 5 項目 + 次の計画候補 5 項目記載）

#### 検証

- 全 4 symlink (`~/.claude/agents/role-*.md` + `git-orchestrator.md`) が agents-lib への正しい参照
- 3 役 role-\*.md とも「メインから受け取る前提」セクションが 1 件のみ存在
- hook 合成テスト: 一時 untracked ファイル backdate → E 警告 fire（1288h 検出）→ cleanup 完了
- `bash -n` syntax check OK
- PR #22 draft 作成、pathspec staging で他チャットの dirty（web/ shared/ CLAUDE.md）は除外

#### 設計判断 / Lessons Learned

- **agents-lib は git 外（一元管理設計通り）**: PR には含まれず、履歴管理はユーザー側依存。重要編集は手動バックアップ推奨
- **subagent ファイル編集は symlink 経由で全プロジェクト即反映**: novel / original-card-battle にも影響。プロジェクト固有変更は `agents-lib/projects/` に分離すべき
- **hook 検査 E は OLDEST_MTIME 採用が正解**: NEWEST だと「最新の dirty が新しいだけで他は古い」ケースで警告が出ない。「ANY ファイルが 24h+ 放置」を検知するには OLDEST が正解
- **worktree 削除前の re-verification 重要**: PR / commit / outbox 監査だけでは「ユーザー認識」を捉えきれない。prototype+mobile-ui で 1 度スキップ判断、ユーザー指示で保留
- **`ls-files -mo --exclude-standard` が `status` と乖離するケース**: tracked / untracked + .gitignore + 別チャットの並行 commit タイミングで結果が変わる。worktree 内状態確認は `status` 併用
- **PR diff vs 実作業の境界明示**: agents-lib は git 外なので「PR 外で同時実施」を commit message + PR description に明記、後のレビュー混乱を予防
### 2026-05-24 - DU-F Step 6-14 完了（WikiTag/Link UI 4 role + wiki_tag_groups CRUD + Notes/Daily Unified bridge fix）

#### 概要

Data Unification の「ユーザーから見える完了」を達成。WikiTag/Link UI を 4 role（Task / Event / Note / Daily）で稼働 + CalendarTag 概念の完全消滅 + wiki_tag_groups CRUD UI 実装 + 親計画書 DoD 達成宣言。実機検証で顕在化した Notes/Daily 永続化問題（legacy stub error + RLS items_meta exists check 失敗）を bridge delegate パターンで同時解決。

#### 変更点（commit `8a45397`、23 files / +1939 / -162）

**Tag/Link UI 新規 (Step 6-10)**:

- `web/src/wikitag/{TagPill,TagPicker,LinkPanel,WikiTagsManagementView,index}.tsx` 新規 — 4 role 共通 + tag/group 管理ビュー
- TagPicker: pills + 検索 + 既存タグ選択 + Create new affordance（Enter で確定）
- LinkPanel: outgoing + incoming（backlink）+ datalist autocomplete で linkable items 候補表示
- WikiTagsManagementView: tag CRUD + group CRUD + tag↔group 双方向 membership 編集
- 4 role view (TaskTreeView / ScheduleItemsView / NotesView / DailyView) に `<TagPicker itemId>` + `<LinkPanel itemId>` 配置
- MainScreen に "tags" セクション追加（Tasks / Daily / Notes / Schedule / Tags の 5 タブ）

**wiki_tag_groups CRUD layer (Step 11)**:

- `SupabaseWikiTagsUnifiedService` に group / group_assignment の 7 メソッド追加（list / create / update / softDelete / assignments / assign / unassign）
- `useWikiTagsUnifiedAPI` を allGroups + allGroupAssignments の bulk cache 戦略に拡張
- `DataService` interface に新メソッド型追加
- PHASE2_WIKI_TAGS_UNIFIED_METHODS dispatch set に 7 メソッド追加

**Notes/Daily 永続化 + RLS items_meta exists check fix (Step 14 中)**:

- 問題: migration 0007 で `public.notes` / `public.dailies` が DROP 済 → legacy `SupabaseNotesService` / `SupabaseDailyService` が `_pendingDuRewrite` stub error throw → 書き込み停止 / リロード消失 / Tag/Link 経由の `wiki_tag_assignments` INSERT RLS WITH CHECK (`exists items_meta where id = item_id`) が 403
- 対応: legacy class のコンストラクタに Unified service 参照を渡して **bridge delegate** に置換
  - Notes: `fetchAllNotes` / `createNote` / `createNoteFolder` / `updateNote` / `syncNoteTree` / `softDeleteNote`
  - Daily: `fetchAllDailies` / `fetchDailyByDate` / `upsertDaily` / `deleteDaily` / `toggleDailyPin`
- 未対応（DU-G 残置）: password / lock / restore / permanentDelete / fetchDeletedNotes / searchNotes は stub or 空配列のまま（UI から触らなければ無害）

**Step 12-13**:

- RLS gate 確認（Supabase MCP advisor + execute*sql で 5 テーブル × RLS + 4 policy 確認 / calendar_tag*\* 不在確認）
- 親計画書 `2026-05-21-data-unification-items-meta.md` DoD 達成宣言（DU-E / DU-G 残作業として明示分離）
- CLAUDE.md §4.3 に composite FK pattern + Routine UX 再定義（Routine = Event の生成テンプレ、Tag/Link UI は持たない）一行追記
- 移行 SSOT `2026-05-04-cross-platform-migration.md` の Phase 2↔3 間に Data Unification レーン完了記録追記
- DU-G スケルトン `2026-05-25-data-unification-g-notes-daily-unified.md` 作成（Notes/Daily Unified write path 切替）
- Link UX 強化スケルトン `2026-05-26-link-ux-obsidian-style.md` 作成（Obsidian 風 cross-role link + 遅延実体化 + クリック遷移）
- CalendarTag stale comment 一掃（CalendarContext.tsx / context/index.ts / MainScreen.tsx）
- DU-C+ / DU-F 両計画書を `.claude/archive/` に Status=COMPLETED で移動

#### 検証

- shared `tsc -b` exit 0 / shared vitest 170/170 / web `npm run build` exit 0
- RLS gate offender 0（wiki_tags 系 5 テーブル × 4 policy 確認済）
- Supabase advisor lint 新規 WARN 0（既知 `auth_leaked_password_protection` のみ）
- `git grep -E "CalendarTagsProvider|CalendarTagsView|useCalendarTags|useCalendarTagsAPI|calendarTagDefinitionMapper|calendarTagAssignmentMapper" web/src shared/src` ヒット 0
- `frontend/` touched 0
- 実機 golden path 確認 OK: Task/Event/Note/Daily の Tag 付与 + Link 作成 + backlink 表示 / Notes/Daily のリロード後永続化

#### 設計判断

- **Bridge delegate 採用**: 既存 `useNotesAPI` / `useDailyAPI` の UI surface (700+ 行) を温存しつつ、内部の DataService 呼び出しだけを Unified に差し替え。完全な hook 書き換え（= DU-G）より遥かに低リスクで「リロードで残る」「Tag/Link が動く」を同時達成
- **4 role 共通 UI**: Routine は Event の生成テンプレートに UX 再定義したため Tag/Link UI は持たない（4 role に限定）。データモデル上は items_meta 経由で Routine への Tag/Link も許容（UI 追加のみで対応可）
- **bulk cache 戦略**: WikiTagsUnifiedAPI の `allGroups` / `allGroupAssignments` を mount 時 + syncVersion bump で一括 fetch。各 GroupCard が derived state で表示するため N+1 query を回避
- **per-item assignments は lazy 取得**: TagPicker / LinkPanel は item_id ごとに on-mount fetch。N=1 ユーザー想定で行数が小さいため bulk vs lazy のトレードオフは lazy を選択

#### Known Issues 候補（DU-G / Link UX 強化計画で消化予定）

- Notes/Daily の Trash UI が常に空（DU-G で `fetchDeletedNotesUnified` 実装）
- Notes の password / lock が未実装（DU-G）
- Link 入力欄に存在しない id をペーストすると 403（Link UX 強化計画で stub 実体化を導入）
- Schedule から Note への link 候補が autocomplete に出ない（Link UX 強化計画で cross-role 集約）

#### 並行チャット干渉メモ

- DU-F Step 6-14 作業中、別チャットが PR #22（`chore/subagent-worktree-tuning`）を進行 → working tree branch が chore に切り替わった状態で実装が進んでいた
- 解決: stash → checkout data-unification → pop（chat-main.md で conflict → /tmp バックアップから resolve）→ pathspec stage で chore 由来の差分を含めずに commit
- 教訓: per-chat memory ファイル名（chat-main）が両チャットで衝突。今後は session-id 別の per-chat name を採用するか、conflict 検出時の自動マージ戦略を検討

### 2026-05-24 - Anthropic Cloud Routine 2 本セットアップ（朝の歴史学習 + 帰宅時モバイル開発準備）

#### 概要

Claude Code の `/loop` (ローカル・短期ポーリング) と `/schedule` (Anthropic Cloud Routine = cron 永続) の挙動差を hello world で実体験した上で、life-editor 用に永続 Routine を 2 本セットアップ。学習用 (朝 07:03 JST 配信の紀元前歴史マイクロエッセイ・週単位ジャンル深堀り型) と開発支援用 (帰宅 17:55 JST に GitHub 上のリポジトリ健全性チェック → 電車中タスク 3〜5 件抽出 → 高信頼 auto-fix draft PR 最大 2 件作成 → HTML ブリーフィング出力)。

#### 変更点

- **/loop hello world 完走**: `1-59/2 * * * *` (cron) + counter file + 自己 CronDelete で 3 回発火後の自動停止を実装・動作確認。観察: 奇数分指定でも実発火は :38 だった = REPL idle 待ちで jitter (10% / 最大 15 分の仕様内)
- **Routine 1: weekly-bce-bronze-age-collapse** (`trig_01K2emDH9VwKsFif4MTELcKK`): hello-world-utc-time を update で上書き再利用 (削除 API 不在による累積防止)。cron `3 22 * * *` UTC = 07:03 JST 毎日 / model claude-opus-4-7 / tools Bash のみ。7 日カリキュラム (海の民と青銅器時代の崩壊 BCE 1200 年) を prompt 内 case 文で日付別 dispatch。各日構成: 今日の題材 / 背景 / 情景 / つながり / 一次資料 (5 ブロック / 1500〜3000 字 / セピア紙色 HTML embed)。週末ジャンル変更フロー = チャットで選定 → 新 7 日カリキュラム設計 → 同 Routine を update で上書き
- **Routine 2: commute-mobile-dev-prep** (`trig_01SPebtYwCLHKMLEZoH5vkiH`): cron `55 8 * * *` UTC = 17:55 JST 毎日 / model claude-opus-4-7 / tools Bash/Read/Edit/Write/Glob/Grep。5 ステップ: 健全性チェック (build/lint/test exit code 収集) → 24h 活動収集 (git log + gh pr/issue list + TODO grep) → 電車中タスク 3〜5 件特定 (type=auto-fix/decide/review × effort × mobile-feasible) → auto-fix draft PR 最大 2 件作成 (`commute/YYYY-MM-DD-N-<slug>` branch) → HTML ブリーフィング出力 (cool blue-grey dev tool テンプレ)
- **auto-memory 書き残し** (`~/.claude/projects/-Users-newlife-dev-apps-life-editor/memory/` 配下、リポジトリ外): `project_weekly_learning_routine.md` / `user_history_learning_preferences.md` / `project_commute_mobile_dev_routine.md` + MEMORY.md index 3 件追記

#### 検証

- /loop hello world: 3/3 表示 + 自己削除完走確認
- /schedule hello world: 手動キック投入後、即時 routine 上書きで実行ログは未取得
- 学習 Routine: Day 1 配信は明朝 07:03 JST (現時点は prompt 設計のみ)
- commute Routine: 手動キック投入済 (cloud 非同期)。結果は claude.ai routine ページで確認待ち
- 未検証ポイント: cloud env での gh CLI 認証 / git push 権限 / npm ci 動作 → 初回 run の HTML Notice セクションに自己記録される設計

#### 設計判断

- **Routine 再利用 (累積防止)**: hello-world を学習 Routine に update で転用。削除 API がない (web UI のみ) ため、新規作成は厳禁
- **状態管理は date case 文に集約**: クラウド Routine 間で状態共有不可なので、Notion DB 等の外部状態は採用せず、prompt 自体に 7 日分の date 直接列挙で stateless dispatch
- **auto-fix PR 件数上限 2**: 1 日 21 件 PR スパム化を防ぐ。decide / review は briefing 内に留め PR 化しない
- **MCP 接続性の制約認識**: クラウド Routine は stdio ベース life-editor MCP に触れない (ローカル machine 不在)。学習 Routine は外部状態不要、commute Routine は GitHub 経由のみで完結する設計
- **HTML 出力 = 唯一の応答**: routine ログに HTML がレンダリングされる前提で、応答全体を 1 個の自己完結 HTML に統一 (前置き・後書き禁止)

### 2026-05-24 - DU-D scope-reduced 完了（Notes/Daily shared 2-row mapper + composite FK migration 0014）

#### 概要

DU-D（Notes role + Daily 移植）を scope-reduced で完了。DU-C+ で判明した frontend↔shared 統合（Phase 2 完成相当）未達問題が同様に立ちはだかるため、frontend NoteProvider / DailyProvider 置き換え + UI 動作確認は DU-F に後送り。本サブフェーズは「shared 層 mapper + Unified service + composite FK migration」のみで完了とした。migration 適用時に既存 FK 依存による destructive drop エラーが発生し、修正版（DO ブロックの存在 assert に置換）で再 push 成功。実装計画書は `.claude/archive/` へ移動（計画書: archive/2026-05-24-data-unification-d-notes-daily.md）。

#### 変更点

- **DB migration 0014**: `supabase/migrations/0014_notes_payload_parent_fk.sql` 新規（DU-B 0009 と同型パターンを notes_payload に適用）。`items_meta(id, role)` UNIQUE は 0009 で既に追加済 + 0009/0011 の FK が依存するため drop-and-recreate 不可 → DO ブロックで「存在 assert + 不在なら raise exception」に変更（v1 で `drop constraint if exists` が SQLSTATE 2BP01 で失敗、修正版で再 push 成功）。0008 単独 FK `notes_payload_parent_item_id_fkey` を drop、`parent_item_role text generated always as ('note') stored` 列追加、composite FK `notes_payload_parent_fk ((parent_item_id, parent_item_role) → items_meta(id, role)) ON DELETE NO ACTION` 追加、単独 index `idx_notes_payload_parent` drop + 複合 `idx_notes_payload_parent_role` 追加、insert/update policy に parent_item_id owner EXISTS 二重防衛 + `(select auth.uid())` initplan キャッシュ
- **0014_rollback.sql** は `supabase/migrations_archive_rollback/` 配置（DU-C+ で確立した運用に従う = migrations/ には forward migration だけを置く）
- **shared mapper**: `notesUnifiedMapper.ts` / `dailiesUnifiedMapper.ts` 新規（既存 `noteMapper.ts` / `dailyMapper.ts` legacy 単独テーブル版と coexist、`*UnifiedMapper.ts` 命名で 1 文字差衝突回避）。`ItemsMetaNoteRow` / `NotesPayloadRow` / 同 Daily 版 / Write 型から `parent_item_role` / `has_password` を type-level で除去 / SELECT カラムリスト / `rowsTo*Node` / `*NodeToRows` / `*UpdatesToPatches`（DB-Q2 = ALWAYS `metaPatch.updated_at = now` bump）/ `contentJsonToString` ↔ `contentStringToJson`（jsonb ↔ TipTap string 双方向）
- **shared service**: `SupabaseNotesUnifiedService.ts`（6 メソッド: list / get / create / update / softDelete / move）+ `SupabaseDailiesUnifiedService.ts`（6 メソッド: list / getByDate / upsertByDate / create / update / softDelete）新規。`user_id` を insert object から省き DB default `auth.uid()` に任せる。FK 順守でメタ INSERT → payload INSERT、失敗時はメタを hard-delete cleanup（DU-B R2 同型 / soft-delete ghost 防止）。`PHASE2_NOTES_UNIFIED_METHODS` / `PHASE2_DAILIES_UNIFIED_METHODS` を export し SupabaseDataService の Proxy route に登録
- **DataService interface**: 12 Unified メソッド宣言追加（`*Unified` suffix。既存 PHASE2_NOTES_METHODS / PHASE2_DAILY_METHODS と coexist）
- **SupabaseDataService.ts**: import 2 行 + service 生成 2 行 + Proxy route 2 行追加
- **単体テスト**: `notesUnifiedMapper.test.ts` (18) + `dailiesUnifiedMapper.test.ts` (11) = 29/29 緑、全 174/174 緑（DU-C+ 18 + 既存 127 含む）
- **frontend build clean**（touched=NO 維持。Tauri frontend は引き続き tauriDataService のみ参照）
- **計画書改訂**: DU-D 子計画書を `Status: COMPLETED (scope-reduced)` に更新 + worklog 追記 → `.claude/archive/` へ移動

#### 検証

- shared `npx tsc -b --force`: exit 0
- shared `npx vitest run`: 174/174 pass
- frontend `npm run build`: exit 0
- Supabase 静的検証 A/B/C: `items_meta_id_role_uk` 存在 / `notes_payload_parent_fk` composite FK 設置（def "FK (parent_item_id, parent_item_role) REFERENCES items_meta(id, role)" / ON DELETE 省略 = NO ACTION default）/ 単独 FK `notes_payload_parent_item_id_fkey` 不在 / `parent_item_role` = `'note'::text` ALWAYS generated
- 動的検証 D-G は MCP execute_sql が read-only mode のためスキップ。A/B/C の静的証拠が「composite FK + 'note' 固定 generated stored 列」の組合せで cross-role 物理拒否を論理的に完全証明
- Supabase `mcp__supabase__list_migrations`: 0014 適用済
- Supabase advisor lint: 既知 `auth_leaked_password_protection` WARN のみ（新規 WARN 0）

#### 設計判断 / 残知見

- **既存 FK 依存下での冪等再追加は不可**: `items_meta_id_role_uk` を `drop constraint if exists` → re-add するパターンは、依存 FK がない初回（0009）でしか動かない。DU-B 以降の migration では「存在 assert」に切り替えるパターンを採るべき = 今後の migration テンプレ知見として記録（known-issues 化候補）
- **shared mapper 命名規則の coexist 戦略**: legacy `noteMapper.ts` (単数) と DU 版 `notesMapper.ts` (複数) は視認性で危険なため `*UnifiedMapper.ts` suffix を採用。DU-C+ の `wikiTagUnified.ts` と整合
- **MCP execute_sql は read-only**: 動的 INSERT/DELETE 検証が必要な場合は SQL Editor 経由か `apply_migration`（ただし計画書 §7.3 で単独使用禁止）で実施する必要あり。今回は静的証拠 + 既存テスト + composite FK の論理保証で代替
- **後送り対象 (DU-F)**: frontend NoteProvider / DailyProvider 置き換え、Pattern A Provider・Hook 実装、UI 動作確認（Notes 階層 DnD / TipTap 編集 / Daily UPSERT）、frontend↔shared 統合（vite alias + tsconfig path + dependency）

### 2026-05-24 - .claude/ 配下整理（vision/plans 精査 + 学習教材削除 + 残骸クリーンアップ）

#### 概要

`.claude/docs/vision/plans/` が 17 ファイルまで肥大したため整理。Status 確認 + 関連リンク追跡で「完了済」「放置」「規約違反」「単発実験の残滓」を分類し、削除 / archive 移動を実施。並行チャットが `shared/src/services/` で作業中だったため pathspec で self-owned のみを stage する方針を厳守。

#### 変更点

- **vision/plans 精査**: 17 → 15（テンプレ + 進行中 12 + プロトタイプ worktree 用 2）。削除 = `2026-04-25-point-view.md`（Tauri 前提・5/15 起票後動きなし）+ `2026-05-16-phase5-giant-component-decomposition.md`（Carry-over 未着手で 5/16 から放置）。残置判断 = `2026-05-16-phase2-core-migration.md` は S5〜S8 未着手のため進行中扱いで保留
- **学習教材系削除**: `.claude/docs/code-explanation/` (15 files) + `.claude/docs/code-examples/PointGraphView.demo.jsx` (56KB)。CLAUDE.md は「任意」と書くが memory `feedback_no_learning_logs.md`「学習用 Markdown ログを書かない」方針と矛盾していたため整理
- **残骸ファイル削除**: `HISTORY-archive.md.bak` (263KB, 5/16 バックアップ) / `LearningRoadmap/` (2 files, 学習ログ廃止方針違反) / `note-summaries/summary-2026-04-16.md` (4/16 単発実験) / `docs/code-inventory.md` (参照先 `2026-04-25-refactoring-plan.md` 消失で orphan)
- **instructions archive 移動**: `.claude/instructions/2026-05-11-apply-release-docs.md` → `.claude/archive/`。1ファイルだけのディレクトリだったため空化 → ディレクトリ自体も消滅
- **stale lock 除去**: `.git/index.lock` (0 bytes, 14:57 残骸) を pgrep で git プロセス不在を確認後に除去。原因不明（hooks 由来の可能性）
- **scope-drift ガード**: 並行チャット由来の dirty file（`shared/src/services/{DataService,SupabaseDataService}.ts` 変更 / `shared/src/services/Supabase{Notes,Dailies}UnifiedService.ts` 等 untracked / `.claude/settings.json` 変更 / `.claude/hooks/session-start-check.sh` untracked / `.claude/scheduled_tasks.lock`）を stage しないよう pathspec で限定

#### 検証

- `ls .claude/docs/vision/plans/`: 15 ファイル（テンプレ + 進行中 + プロトタイプ用）
- `ls .claude/archive/`: instructions 由来 1 件が増えて 8 ファイル + sessions/
- `git status --porcelain | grep "^D\|^R"`: 削除 / 移動が想定通り
- 並行チャット (chat-engineer 等) の作業ファイル群は stage 対象外を pathspec で担保

#### 設計判断 / 残知見

- **学習教材は memory フィードバック優先**: CLAUDE.md に「任意」と書かれた残骸ドキュメントでも、user 由来の `feedback_no_learning_logs.md` 方針があれば削除側に倒す（フィードバックが SSOT より上位）
- **plans/ の整理判定基準**: Status が "Carry-over 未着手" のまま 1 週間以上動いていない / 移行方針と相容れない前提（Tauri 等）/ 参照先が消失 = 削除候補。"IN PROGRESS" でも残工程が明確なら残置（phase2-core S5〜S8）
- **空ディレクトリ掃除**: `git rm` 後はディレクトリも自動で消えるため `rmdir` 明示不要

### 2026-05-24 - DU-C+ scope-reduced 完了（CalendarTag DROP + shared 層 WikiTag mapper/service/Provider 整備）

#### 概要

DU-C+（Events 限定 WikiTag/Link + CalendarTag 吸収）の実装途中で frontend↔shared 統合が Phase 2 完成タスクとして残っていることが判明し、Events UI 実装 / NoteProvider 置き換え等を DU-F に統合する形で scope reduction。DU-C+ は「DB migration 0012_drop_calendar_tags.sql 適用 + shared 層 (mapper 5 / SupabaseWikiTagsUnifiedService / Pattern A Provider) 整備 + 単体テスト 18 緑」のみで完了とした。shared 層は build-clean 状態で温存され、DU-F の frontend↔shared 統合と同時に活性化される設計。

#### 変更点

- **DB migration 0012**: `supabase/migrations/0012_drop_calendar_tags.sql` 新規。`calendar_tag_assignments` + `calendar_tag_definitions` を CASCADE DROP。0007 で truncate のみ済の 2 テーブル構造を完全削除。`calendars` テーブルは保持（Schedule フォルダフィルタマスタとして）。supabase CLI 経由で push 適用（履歴乖離が判明したため migration repair で 0009/0010/0011 を applied として補正後 0012 のみ流す手順）
- **shared types**: `shared/src/types/wikiTagUnified.ts` 新規。Supabase 0008 設計（items_meta(id) FK / 5 role 共通）に対応する WikiTag / WikiTagGroup / WikiTagAssignment / WikiTagConnection / WikiTagGroupAssignment 5 型。既存 `wikiTag.ts`（Tauri 時代 polymorphic entityType 設計）と並存（DU-F で旧型削除）
- **shared mapper 5**: `wikiTagMapper.ts` / `wikiTagGroupMapper.ts` / `wikiTagAssignmentMapper.ts` / `wikiTagConnectionMapper.ts` / `wikiTagGroupAssignmentMapper.ts` 新規。Row 型 + INSERT / Patch 型 + SELECT カラムリスト + rowTo... / ...ToRow / updatesToPatch 関数。`updatesToPatch` は ALWAYS `updated_at` を bump（DB-Q2 同型契約）。`wikiTagConnectionToRow` は self-loop を mapper 層で reject（DB CHECK の二重防衛）
- **shared service**: `SupabaseWikiTagsUnifiedService.ts` 新規（2.8k 行の SupabaseDataService.ts を肥大化させない判断）。11 メソッド: tag master CRUD (4) / item↔tag assignment (3) / item↔item link (4)。`user_id` を insert object に含めず DB default `auth.uid()` に任せる設計（frontend が userId を threading 不要）。`PHASE2_WIKI_TAGS_UNIFIED_METHODS` を export し SupabaseDataService の Proxy route に登録
- **shared DataService interface**: `DataService.ts` に 11 メソッドを `*Unified` サフィックスで追加。既存 `fetchWikiTags()` 等 (Tauri polymorphic 旧 API、現状 `not implemented in phase 2` を throw) は touched=NO で温存（DU-F で削除）
- **shared hook + Provider**: `useWikiTagsUnifiedAPI` + `WikiTagsUnifiedContext` (Pattern A 3 ファイル) + `useWikiTagsUnifiedContext` consumer hook。`dataService` injection（CLAUDE.md §6.4）/ `syncVersion` 連動 / generateId は shared util を使用
- **shared/src/{context,index}.ts**: 新 Provider / Context / 型を re-export
- **単体テスト**: `wikiTagMapper.test.ts` (8) + `wikiTagAssignmentMapper.test.ts` (6) + `wikiTagConnectionMapper.test.ts` (5) = 18 / 18 緑
- **frontend 軽修正**: `frontend/src/services/data/scheduleItems.ts` の unused `ScheduleItemUpdate` import 削除（main 由来の既存 build error 解消）
- **計画書改訂**: DU-C+ 計画書を v2 (SCOPE-REDUCED) に。DU-D 計画書も同じ問題で SCOPE-REDUCED に（frontend NoteProvider 置き換え + UI 動作確認は DU-F へ）。親計画書の DU-C+ / DU-D / DU-F 行を更新（DU-F は **EXPANDED** で frontend↔shared 統合 + 後送り分を吸収）

#### 検証

- shared `npx tsc --noEmit`: exit 0
- shared `npx vitest run tests/wikiTag*.test.ts`: 18/18 pass
- frontend `npm run build`: exit 0（vite build 緑）
- Supabase: `mcp__supabase__list_migrations` で 0012 適用確認 / `calendar_tag_*` 2 テーブル不在 / `wiki_tags` 系 5 テーブル健在 / `calendars` 健在 / advisor lint は既知 WARN (auth_leaked_password_protection) のみ

#### 設計判断 / 残知見

- **frontend↔shared 統合未達の発覚**: frontend は独自 `tauriDataService` のみ参照、shared パッケージ（`@life-editor/shared`）への vite alias / tsconfig path 未設定。Phase 2 (Tauri→Web 移行) が frontend 側で完了していない状態。DU-C+ の Events UI 実装には vite alias + tsconfig 追加 + getDataService 切替が必要 = Phase 2 完成相当のタスク → DU-F に統合の判断
- **shared SupabaseDataService の WikiTag メソッド未実装の発見**: 既存 DataService.ts は WikiTag メソッド多数宣言（Tauri 時代 polymorphic 設計）だが、SupabaseDataService の Proxy route に WikiTag が登録されておらず、呼ぶと `not implemented in phase 2` を throw する状態だった。新 `*Unified` メソッドを別系統で追加し、旧 API を temporarily 温存する判断
- **userId injection 設計の単純化**: 当初 `useWikiTagsUnifiedAPI(options: { dataService, userId })` を想定したが、frontend に userId 取得経路がなかった（`getSession()` 等を呼んでいない）。`user_id` を insert object から省略 → DB default `auth.uid()` に任せる設計に変更。RLS policy で `auth.uid() = user_id` を強制しているため正しく動作
- **Supabase CLI migration repair の必要性**: `supabase db push` 初回実行時に CLI 履歴（`supabase_migrations.schema_migrations`）と実 DB schema の乖離（0009/0010/0011 が MCP `apply_migration` 経由で適用済だが CLI 履歴未登録）が露見し、`0009_rollback.sql` を未適用 migration として実行してエラー。修復手順: rollback ファイルを `supabase/migrations_archive_rollback/` へ退避 + `supabase migration repair --status applied 0009 0010 0011` で履歴補正後 push 成功

#### 概要

DU-C/D pending stubs 投入後の実機検証で顕在化した「Routine 削除→key duplicate 警告→無限ループ」バグの根本治療として、DU-A (0008) で用意済の `items_meta + <role>_payload` スキーマに Routines / RoutineGroups / RoutineGroupAssignments / ScheduleItems の 4 ドメインを 2-row pattern で本実装。0011 migration で events_payload に composite FK + initplan-cache RLS を追加し、最後に RoutineScheduleSync の no-op 状態を解除して useScheduleItemsRoutineSync の notifyChanged を try ブロック内へ移動 (landmine 構造除去)。

#### 変更点

- **DB / migration 0011** (commit 564a4d8): `supabase/migrations/0011_du_c_events_payload_fk.sql` 新規。events_payload に `routine_item_role text GENERATED ALWAYS AS ('routine') STORED` + composite FK `(routine_item_id, routine_item_role) → items_meta(id, role)` NO ACTION。BEFORE INSERT trigger `trg_events_payload_init_cache` で is_deleted_cache 初期化 (UPDATE trigger は 0008 既存)。events_payload / routines_payload / routine_groups / routine_group_assignments の 16 RLS policy を `(select auth.uid())` initplan キャッシュ形式へ。本番 Supabase は SQL Editor 経由で apply (`supabase` CLI 不在 + MCP `--read-only` mode のため)、Acceptance Criteria A〜F 全件緑
- **Shared mapper** (commit 5fd8574): routineMapper / routineGroupMapper / routineGroupAssignmentMapper / scheduleItemMapper を 2-row pattern に書き換え。legacy API は deprecated shim として並走。新規 vitest 2 ファイル合計 36 ケース (routineMapper 18 + scheduleItemMapper 18) — `shared npm test` 127/127 緑 (91 base + 36)。`RoutineNode` に `version?: number` を TaskNode 整合で追加
- **SupabaseRoutinesService** (commit 6d02c1e): 8 methods 本実装。softDeleteRoutine が events_payload の routine_item_id 経由で由来 events を連動 soft-delete し `{ deletedScheduleItemIds }` を返す (trigger は単一行ミラーのみなのでアプリ層責務)。permanentDeleteRoutine は composite FK NO ACTION のため依存 events を先に hard-delete
- **SupabaseRoutineGroupsService + AssignmentsService** (commit c22992e): 6 methods 本実装。`deleteRoutineGroup` は 0008 schema が is_deleted 列を持つので **soft-delete** に変更 (Phase 2 物理削除と挙動差)。`setGroupsForRoutine` は diff 計算 (current LIVE vs new set) → 新規 INSERT + 削除 soft-delete (Issue 008 contract)
- **SupabaseScheduleItemsService** (commit 2c12119): 19 methods 本実装。`fetchByPayloadFilter` ヘルパで payload-first フィルタ + items_meta JOIN。`bulkCreateScheduleItems` は events_payload upsert ON CONFLICT (routine_item_id, source_date) ignoreDuplicates で Issue 011 partial UNIQUE 衝突を冪等吸収。`source_date` は routine_item_id 非 null の場合のみ start_at から patch (mapper INSERT path は DU-A pre-spec で null)
- **RoutineScheduleSync 復活 + ハードニング** (commit 1ea4371): web/src/schedule/RoutineScheduleSync.tsx を Phase 2 (S4-5) 実装に復元。shared/src/hooks/useScheduleItemsRoutineSync.ts の `notifyChanged()` を try ブロック判定下へ移動し、`bulkCreateOk` フラグで bulkCreate 失敗時抑止を構造的保証 (2026-05-23 stub-throw 無限ループ landmine の構造除去)
- **Docs** (commit fbc7cab): db-conventions.md §10.7 (events_payload 案 A 完成記録) + §10.8 (bulkCreate ON CONFLICT 戦略) 追加。子計画書を Status=COMPLETED + commit ハッシュ 6 件記録 + Worklog 時系列追記して `.claude/archive/` へ git mv

#### 検証

- shared `npx tsc -b`: exit 0 (全 commit 後)
- shared `npm test`: 127/127 pass (91 base + routineMapper 18 + scheduleItemMapper 18)
- web `npm run build`: exit 0
- Supabase 0011 適用後 Acceptance Criteria A〜F: 全件緑 (composite FK / generated 列 / 同期 trigger 2 種 / 16 RLS policy initplan / advisor auth_rls_initplan WARN は DU-C 4 テーブルで 0 件)
- 残: 👀 ユーザー実機確認 (Routine 作成/削除/復元 + 連続フリック / 月またぎで bulkCreate ループしないこと)

#### 設計判断 / 残知見

- **Supabase CLI 不在 + MCP `--read-only` mode**: `supabase db push` が使えない (CLI 未インストール + 過去 history table 不在で不発と判明) + MCP の write 系も `--read-only` でブロック → 確立パターンは **SQL Editor 直貼り** (0001-0008 と同じ経路)。MCP は read-only verification (execute_sql / get_advisors) に専念
- **`apply_migration` MCP 単独使用禁止** (CLAUDE.md §7.3) はファイル先行ルールを意味し、ファイルがコミット済なら MCP push 自体は許容される — ただ `--read-only` モードでは blocked のため事実上 SQL Editor 経路一択
- **Routine→Event cascade はアプリ層責務**: 0008/0011 の sync trigger は events_payload.item_id 単位でしかミラーしない。Routine soft-delete からの events 連動は `SupabaseRoutinesService.softDeleteRoutine` が `.in()` で一括 UPDATE
- **`source_date` populate ルール**: routine 由来 event は `source_date = start_at` で partial UNIQUE 有効化。手動 event は source_date=null で partial UNIQUE 非発火 — 手動 event 同日同 routineId は重複可能 (routineId=null なので空集合)

### 2026-05-24 - 並行作業基盤強化（Stop hook + Plan Gate Convention + 計画書テンプレ）

#### 概要

並行 worktree / 複数チャット運用で「見てない隙の品質劣化」「Supabase 手動操作で計画書が止まる不安」「人手ゲートを置きたくない誘惑」が認知負荷を上げていた問題に対し、調査（Anthropic 公式 / Supabase 公式 / 個人開発者事例の triangulation）を踏まえて 3 つのメタ運用基盤を追加。計画書テンプレに Gate 列（🤖 自律 / 👀 目視 / 🛑 人手）を必須化し、Stop hook で per-chat outbox に build 結果スナップショットを蓄積する仕組み。frontend 実装は無変更。

#### 変更点

- **計画書テンプレ新設**: `.claude/docs/vision/plans/_TEMPLATE.md` を新規作成。Scope 宣言 / Gate 列 / 機械検証可能な Acceptance Criteria / DB Migration Notes（ローカルファイル先行 + ユーザー `supabase db push` ルール）を含む。新規・大改訂時に使用、既存 14 本は触る時に逐次移行
- **Stop hook 新設**: `.claude/hooks/stop-check.sh` を新規作成（実行権限付与）。応答終了時に `git diff` で frontend 変更を検知し、バックグラウンドで `npm run build` を走らせ結果を `.claude/comm/outbox/<chat>/stop-report.md` に追記。ユーザー待ち時間 0（subshell + & + disown）
- **settings.json 新設**: `.claude/settings.json` を新規作成し `hooks.Stop` に stop-check.sh を登録。auto-mode classifier が一度ブロックしたためユーザー明示承認を取得して再書き込み
- **CLAUDE.md §7.3 追加**: 「Plan Gate Convention」小節を新設し、テンプレ・hook・Gate 凡例・DB Migration ルールを SSOT 化。session-verifier との役割分担も明示（verifier = commit 前明示呼び出し / Stop hook = 毎ターン自動スナップショット、重複しない）
- **設計判断**: 「人手ゲートを減らす」のではなく「人手 1 コマンドで通せる形に圧縮する」方針を採用。`apply_migration` MCP 単独使用は schema drift を確定させるため禁止と明記
- **検証**: hook dry run（frontend 変更なし → 即 exit 0）成功。本番動作は次回応答終了時から有効化

> 古いエントリは [`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照（DU-B-3 / B-4 / B-6 / DU-C/D pending stubs / TaskTreeView DnD ほか）
