# HISTORY.md - 変更履歴

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S2(Daily) 完了（PostgREST select バグ修正 + generated column 化 + 実機 parity 実証）

#### 概要

S2 は「コードのみ commit 済・実機未確認」だった。手動 parity 確認で本番ブロッカーを発見: `dailyMapper.ts` の `DAILY_SELECT_COLUMNS` に PostgREST 非対応の SQL 式 `password_hash is not null as has_password` が埋め込まれ、`column dailies.password_hashisnotnullashas_password does not exist` の 400 で Daily 全 read/upsert が全滅、本番 `public.dailies` は 0 行（fire-and-forget な upsertDaily がエラーを握り潰し optimistic state のみ生存→リロードで消失）。root cause を実機コンソールで確定後、サブエージェント分担で構造修正（実装=role-engineer / 監査=role-qa=APPROVE W/C + security-reviewer=PASS W/N、いずれも別コンテキスト）。0004 を本番 SQL Editor 再適用（MCP write は前提未達で凍結維持）、MCP read-only で RLS owner-only 4 policy + `has_password` generated column ALWAYS を実証、実機 parity green。password 設定 UI は web DailyView 意図的未実装のため S3 へ申し送り（ユーザー承認）。ブランチ refactor/web-first-v2、別チャット（frontend-refactor + doc 整理）同居でパス指定ステージ。

#### 変更点

- **root cause（PostgREST select の SQL 式不可）**: PostgREST `select=` はカラム名 or DB 側 generated column / computed field のみ受理し任意 SQL 式を評価しない。`password_hash is not null as has_password` がスペース詰めで存在しないカラム名として 400 化。`DAILY_SELECT_COLUMNS` を使う全 read/upsert（fetchAllDailies / fetchDailyByDate / fetchDeletedDailies / upsertDaily の .select / setDailyPassword / removeDailyPassword）が全滅していた。tasks は別 mapper のため無事
- **修正（generated column 化）**: `0004_dailies_full_schema.sql` の `password_hash text` 直後に `has_password boolean generated always as (password_hash is not null) stored` を追加（raw hash 非投影のセキュリティ要件を維持しつつ PostgREST が素のカラム名で projection 可能に）。`dailyMapper.ts` の `DAILY_SELECT_COLUMNS` を SQL 式 → 素カラム名 `has_password` に修正、`DailyRow`/`DailyWriteRow`/各 docstring を generated column の事実へ整合更新。`dailyMapper.roundtrip.ts` はコメントのみ。0004 の idempotent `drop ... cascade`+create / RLS 4 policy / `enable row level security` / `user_id default auth.uid()` / `date not null unique` は不変
- **本番再適用 + RLS 実証**: 0004 をユーザーが SQL Editor 再適用（idempotent・現状 0 行で損失なし）。MCP read-only で `rls_enabled=true` / `policy_count=4`（select/insert/update/delete 全 `to authenticated`+`auth.uid()=user_id`、UPDATE は USING+WITH CHECK）/ `has_password_is_generated=ALWAYS` / `generation_expression=(password_hash IS NOT NULL)` / `password_hash` 列存続を確認。`get_advisors(security)` のテーブル RLS lint 0
- **実機 parity 実証**: pin parity を実機操作 + MCP 客観確認。`daily-2026-05-16` が content 再編集を繰り返し `version=9` まで `is_pinned=true` を保持（DEFAULT 潰れなし＝PostgREST merge-duplicates の partial-payload DO UPDATE が送信列のみ更新）、リロード永続化、`restoreDaily` も機能。`password_hash` は `is_pinned` と同一の upsert payload 非含有列で帰納的に parity 成立（role-qa が PostgREST セマンティクスで論理確認）
- **監査**: role-qa=APPROVE WITH COMMENTS（Blocker0/Important0、全 write パス精読で generated column write 混入なしを独立再確認、round-trip 8/8 独立再現、frontend `tsc -b`=0 非破壊）/ security-reviewer=PASS WITH NOTES（Critical/High/Medium0、raw `password_hash` 非到達維持・むしろ改善、RLS 不変、インジェクション余地なし、plaintext-equality は既存債務で悪化なし、Low2 は将来提案）
- **検証**: session-verifier 3 回 PASS（role-engineer / role-qa 独立再現 + メイン最終差分）— web `tsc -b`=0 / frontend(Tauri) `tsc -b`=0 非破壊 / dailyMapper round-trip 8/8
- **commit**: パス指定ステージ（`shared/src/services/dailyMapper.ts` `dailyMapper.roundtrip.ts` `supabase/migrations/0004_dailies_full_schema.sql` + `.claude/MEMORY.md` `.claude/HISTORY.md`）。別チャット領域（`.claude/2026-*.md` 削除 / `.mcp.json` / `.claude/docs/*` / HISTORY-archive ロール）は `git add -A` 不使用で巻き込まず

#### 残課題

- **[再発防止知見]** PostgREST `select=` に任意 SQL 式不可（カラム名 or generated column / DB 関数のみ）。computed boolean は generated column 化が定石。S3+ の mapper でも厳守。known-issues 起票は別チャット doc 整理(`.claude/docs/known-issues/*`)衝突回避で見送り＝MEMORY が記録正本
- **[軽微・別途修正候補]** 0004 冒頭コメントが「APPLY VIA SUPABASE MCP apply_migration — NOT manual SQL Editor paste」と実運用（MCP write 凍結＝SQL Editor 手動）に不整合
- **[要ユーザー判断]** `get_advisors(security)` の `auth_leaked_password_protection` WARN（dailies 無関係の Supabase Auth 設定・HaveIBeenPwned 照合無効）。完成後/友達配布時判断
- **[S3 申し送り]** password 設定/解除/lock UI は web DailyView 意図的未実装で S3(TipTap + password/lock dialog 横断)に移譲（ユーザー承認済）。upsertDaily payload 付近に partial-payload 意図コメント追記推奨(Suggestion) / plaintext-equality password の docs/known-issues 化は Phase 後段 / password verify の raw hash クライアント転送は既存債務(悪化なし・将来 RPC security invoker 化案)
- **[未解消・要ユーザー]** PAT 露出インシデント止血継続（MCP write 昇格前提=専用組織/write時のみ token/直後 check-rls/破壊的 DDL 人間目視/版固定 未達のため write 凍結維持）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8) / `web/src/TasksScreen.tsx` dead code 要確認
- **[別チャット同居]** `.claude/HISTORY-archive.md.bak`・frontend-refactor・doc 整理が混在。HISTORY-archive ロールは衝突回避で見送り継続（HISTORY.md は prepend のみ、6 エントリ許容）

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S2 コード完了 + Supabase MCP 採用 + token インシデント止血（0003 本番適用・RLS 実証）

#### 概要

S1 完了後: 0003 を本番適用（Phase1 同様 SQL Editor 経由＝`supabase db push` は履歴テーブル不在+非タイムスタンプ命名で不発の既知問題判明）、Supabase MCP read-only で **0003 RLS 実証**（advisor lints 0 + owner-only 4 policy 確認、42P05 pooler 問題を MCP で回避）。Supabase 接続の摩擦解消のため **Supabase MCP Server を Phase 2 migration/検証経路に採用**（公式パッケージ・`--read-only`・`--project-ref` スコープ・token は env 間接参照）。S2（Daily 移植）コード実装完了（role-engineer→role-qa=APPROVE W/C）。**セキュリティインシデント**: `.mcp.json` に PAT 平文ベタ書きを security-reviewer が検出（git tracked・未 commit で止血間に合い）、`${SUPABASE_ACCESS_TOKEN}` 間接参照へ修正。token ローテーション等はユーザー対応（下記残課題）。ブランチ refactor/web-first-v2、別チャット（frontend-refactor + doc 整理）と同居でパス指定ステージ。

#### 変更点

- **0003 本番適用 + RLS 実証**: tasks が text id・28列・CHECK(type/status/folder_type/priority)・FK・rows 0 で稼働。Supabase MCP `get_advisors(security)` lints 0 + `pg_policies` 4 owner-only policy（SELECT/INSERT/UPDATE/DELETE すべて `to authenticated` + `auth.uid()=user_id`、UPDATE は USING+WITH CHECK）を確認＝S1-9 の RLS/スキーマ検証完了（実ブラウザ CRUD は残）
- **Supabase 接続知見**: `supabase db push` 不発（履歴テーブル無し+`0001_`命名）/ Transaction pooler 6543+`pgbouncer=true` は prepared stmt 非互換(`42P05`)/ パスワード percent-encode 必須。memory `project_supabase_migration_gotchas` に記録。解決＝MCP 採用
- **Supabase MCP 採用**: `.mcp.json` に `@supabase/mcp-server-supabase@latest --read-only --project-ref=mcrfdnjplfmqwnwbcbol`、token は `${SUPABASE_ACCESS_TOKEN}` 間接参照。`supabase/scripts/db-push.sh` 新規（gate→`--db-url` push 1コマンド化、URL 手打ち全角スペース混入回避）+ `package.json db:push` 差し替え。`check-rls.sql` を Postgres compound ORDER BY 準拠に修正（派生テーブルラップ、self-test 20/20）
- **S2 Daily コード**: `0004_dailies_full_schema.sql`（id text PK=`daily-<date>`/user_id default auth.uid()/soft-delete/version/RLS owner-only 4 policy、0003 と同形、冪等）/ `dailyMapper.ts`+`roundtrip.ts`（ランタイム検証・`Omit<...,"user_id">`・往復8/8）/ `SupabaseDataService` daily 12メソッド（`DAILY_SELECT_COLUMNS` は `password_hash is not null as has_password` 投影で raw hash 非返却）/ `DailyContext`(Pattern A)+`useDailyAPI`+`dateKey` / `web/src/MainScreen.tsx`(旧 TasksScreen rename)+`daily/DailyView.tsx`(plain textarea、TipTap は S3)。バグ3自己修正（App.tsx 参照漏れ/roundtrip コメント`*/`早期終了/DailyView setState-in-effect）
- **検証**: session-verifier（engineer+QA 独立再現）PASS — shared/web/**frontend `tsc -b`=0 非破壊** / web vite build / eslint / dailyMapper round-trip 8/8 / check-rls self-test 20/20

#### 残課題

- **[Critical・要ユーザー] PAT ローテーション必須**: `sbp_2d4f...` が会話ログ・`~/.zshrc`・監査ログに露出。Supabase Dashboard で Revoke→再発行、新 token は `~/.zshrc`(`chmod 600`) のみ、`~/.zsh_history` の旧 token も削除。完了まで **MCP write(`apply_migration`) 凍結＝0004 本番適用不可＝S2 未完**
- **[要ユーザー] MCP write 昇格前提（security High）**: 専用 Supabase 組織分離 / write 時のみ token 投入・作業後 unset / `apply_migration` 直後に同セッション check-rls 検証 / 破壊的 DDL は人間が SQL 目視 / `@latest`→バージョン固定
- **[S2 完了条件] 0004 適用後の手動 upsert parity 確認**（QA High-1）: 新規日作成→pin/password 設定→本文再編集 blur→pin/password 保持を実機確認するまで S2 完了マークしない
- **[申し送り] password 平文保存・平文比較**（Tauri 1:1 移植 pre-existing、raw hash 非返却は QA 確認済）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8 再構成) / upsert payload から id 除外(Suggestion) / `web/src/TasksScreen.tsx` 残存（MainScreen rename 後の dead code 要確認）
- **[別チャット同居]** `.claude/HISTORY-archive.md.bak`・frontend-refactor の `frontend/**/*.test.*`・known-issues・doc 整理が混在。S2 commit はパス明示で巻き込まず（`git add -A` 禁止）。HISTORY-archive ロールは別チャット圧縮と衝突回避で見送り

#### 概要

`.claude/archive/` 肥大化の解消と、CLAUDE.md / MEMORY.md 等の矛盾調査をサブエージェント3並列で実施。(A) archive 圧縮統合、(B) HISTORY-archive コンパクト化、(C) ドキュメント矛盾調査 を独立ワークストリームで並行。ユーザー判断: archive 個別プランは要約統合後に全削除 / HISTORY-archive は古い部分のみ要点圧縮し最近は温存 / サブディレクトリも対象 / vision-tauri も含め全削除 / 矛盾修正は Top3+#3 / 検出した未起票 known-issues を新規作成。並行して Claude Desktop に life-editor MCP サーバを登録（config はリポジトリ外 `~/Library/.../claude_desktop_config.json`、GUI 起動のため node 絶対パス必須）。ブランチ refactor/web-first-v2、別チャットの pre-existing 変更（shared/ web/ 等 38 ファイル）と分離するためパス指定で `.claude/` のみコミット。

#### 変更点

- **archive 圧縮統合**: `.claude/archive/` の 28 プラン .md + TODO.md + サブディレクトリ docs/dropped/rules/vision-tauri（計 50 tracked ファイル）を `git rm`。`archive/SUMMARY.md`（283 行 / 元 601KB → 約 22KB、96% 削減）に「目的 / 結果採否 / Lessons」をテーマ別5グループで圧縮統合。削除前に vision-tauri の恒久知見（単一データソース原則 / 無料 Apple ID 7日署名制約 / Realtime レイテンシ目標）を SUMMARY.md へ抽出（逐語原文は git 履歴で復元可）
- **HISTORY-archive コンパクト化**: `HISTORY-archive.md` 1257 行/269KB → 413 行/82KB（69% 減）。実効カットオフ 2026-04-29（指示の 2026-04-01 だと対象ゼロのため調整）、2026-04-29 以降は逐語温存、2026-04-19〜04-27 の Tauri 期 29 エントリを要点圧縮（見出し45件は全保持）。原本を `HISTORY-archive.md.bak` に退避（git 未追跡・コミット対象外）
- **ドキュメント矛盾修正（Top3+#3）**: ①リンク切れ解消 — CLAUDE.md §8 / MEMORY.md / 移行SSOT の `vision-tauri/`・`docs/vision/realtime-sync.md` 等を `archive/SUMMARY.md` へ張替（残参照0確認）②Phase 表記 — CLAUDE.md §1 + 移行SSOT Status を「Phase 1 着手準備中」→「Phase 2 進行中（Phase 1 完了 / S0・S1 完了 / S2 準備中）」③IPC 同期矛盾 — `coding-principles.md` の「3 点同期」→「4 点同期」+ DataService.ts 追記 + 正本=CLAUDE.md §7.2 明記 ④MCP ツール数 — CLAUDE.md §5.1「30 ツール」→ 実数 32 + Schedule に dismiss/undismiss 追記
- **known-issues 新規 3 件**: 017（カレンダーに soft-deleted task 残存 + Routine 削除後 schedule_items 再生成）/ 018（macOS WebKit で button クリックが focus を奪わず autoFocus input の blur 先行）/ 019（createPortal 配下 DOM 分離で click-outside 誤発火しパネル即閉じ）。INDEX.md に Fixed 追記 + Category/Status 集計更新（Fixed 11→14、合計 12→15）。mobile-data-parity Provider バイパスは既存 009 で収載済のためスキップ、D1 multi-statement は web-first 移行で廃止予定のため起票せず
- **Claude Desktop MCP 設定**: `~/Library/Application Support/Claude/claude_desktop_config.json` の mcpServers に `life-editor` 追加（既存 pencil 保持）。GUI アプリは nvm の PATH 非継承のため `command` に node 絶対パス（`/Users/newlife/.nvm/versions/node/v20.20.0/bin/node`）指定。mcp-server を `npm run build` で最新化（dist は gitignore 対象）、起動スモークテストで tools/list 応答確認。リポジトリ外変更のため commit 対象外

#### 残課題

- **`HISTORY-archive.md.bak`（1257 行・git 未追跡）**: 当面保持。`.gitignore` 追加 or 削除はユーザー判断（MEMORY.md S1 申し送り⑤と連動）
- **Agent C 検出の残 5 件未修正**: 🟡 core.md「Web UI 非対象」自己矛盾 / §7.1 に Web スタックコマンド欠落、🟢 §3.4「全テーブル sync」/ §3.3 Section Routing の Tauri 前提 / MEMORY.md 予定セクション凍結化。今回は Top3+#3 のみ指定のため別タスク
- **コミット範囲**: 作業ツリーに別チャットの pre-existing 変更（shared/ web/ App.tsx 等 38 ファイル）混在。本コミットはパス指定で `.claude/` のみ、`git add -A` 不使用で完全分離

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S1 完了（Tasks 移植: 0003 スキーマ + SupabaseDataService + shared TaskTree）

#### 概要

Phase 2 S1（Tasks ドメインの Web 移植）を完了。サブエージェント分担（実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン）。tasks を `0001`(uuid id, RLS deny-all) → **`0003`(text id = CLAUDE.md §4.3 準拠, owner-only 4 policy) に破壊的 rebuild**。`SupabaseDataService` の tasks 系を Phase1 最小4メソッドから9メソッド全列実装へ拡張、`row.status as TaskNode["status"]` 型詐称を `taskMapper.ts` のランタイム検証へ撤廃（申し送り④解消）。`frontend/src/components/Tasks/` の Tauri 非依存ロジック（hooks/context/utils）を依存注入化して `shared/src/` へ移植、web に @dnd-kit ベースの機能的 TaskTree UI を新規実装。TipTap(TaskDetail)/i18n/UndoRedo フルチェーンは計画書通り S3/S6 に分離（web は no-op UndoRedo 注入）。監査: role-qa=APPROVE WITH COMMENTS（回帰独立再現 frontend/web/shared `tsc -b`=0）、security-reviewer=SECURE WITH RECOMMENDATIONS（0003 RLS 完全・IDOR 不成立・check-rls ゲート論理通過 offender 0、Critical/High なし）。Important-1（folder_type の DB CHECK 欠落↔validator 乖離）を 0003 push 前に CHECK 追加で解消。ブランチ refactor/web-first-v2、別チャット frontend-refactor 同居のためパス指定ステージ。

#### 変更点

- **0003_tasks_full_schema.sql 新規**: tasks 全27カラムを Postgres 化（`id text primary key` クライアント生成 §4.3 / `type`/`status`/`folder_type`/`priority` を CHECK 制約化 / `parent_id text references tasks(id)` / `"order" integer` / soft-delete `is_deleted`+`deleted_at` §4.4 / `user_id uuid not null default auth.uid()` / `version integer default 1`）。`drop table ... cascade` で 0001/0002 を破壊的 rebuild（Phase1 残骸ユーザー掃除済）。RLS enable + owner-only 4 policy（select USING / insert WITH CHECK / update USING+WITH CHECK / delete USING すべて `to authenticated` + `auth.uid()=user_id`）。1 ファイル完結（README 分割禁止規約準拠）
- **shared services**: `taskMapper.ts` 新規（純マッパー、`toNodeType/toStatus/toFolderType/toPriority` が不正値で throw = 型詐称撤廃、`TaskWriteRow=Omit<TaskRow,"user_id"|"due_date">` で server-derived 列を書き込みから除外）/ `taskMapper.roundtrip.ts`（往復8ケース、Node 直実行）/ `SupabaseDataService.ts` tasks 9メソッド全列実装（fetch/create/update/permanentDelete/fetchDeleted/syncTaskTree/softDelete/restore + migrateTasksToBackend=no-op）
- **shared context/hooks/utils 移植**: Pattern A 3ファイル `TaskTreeContext{Value}` + web 用 no-op `SyncContext`（§6.3 例外条項明文化、`syncVersion=0` 固定）+ barrel。`useTaskTree{API,CRUD,Deletion,Movement,History}` を DataService/UndoRedo/config 依存注入化（§6.4 準拠、UndoRedo は `createNoopUndoRedo()` 注入で S6 置換可能）。`walkAncestors/folderTag/getDescendantTasks/sortTaskNodes` 等 tree utils（`SortDirection` を UI 非依存に独立化）
- **shared React 化**: `shared/package.json` に react を peer(>=19)+dev / `@types/react` dev、`tsconfig.json` に `jsx:react-jsx`+`types:["react"]`。S0(b) composite/project-references 設計維持（web/frontend `tsc -b` 双方0で実証）、peerDependency 化で React 実体重複回避。計画書 Files 表に追記要（S1 達成に不可分の必要変更と QA 判定）
- **web 配線**: `web/src/tasks/TaskTreeView.tsx` 新規（@dnd-kit core/sortable/utilities、notion トークン、CRUD/階層/soft-delete/restore/trash）、`TasksScreen.tsx` を Provider 配線（§6.2 順 Sync→TaskTree、`createSupabaseDataService` 注入）。`web/package.json` に @dnd-kit 追加
- **RLS ゲート回帰拡張**: `check-rls-selftest.sh` に B9/B10（0003 qual パリティ）+ C2（0003 静的構造）追加 = 18/18
- **Important-1 解消**: 0003 L64 `folder_type text` → `check (folder_type is null or folder_type in ('normal','complete'))`。DB CHECK と `taskMapper::toFolderType` 受理集合 `{null,normal,complete}` を完全一致（type/status/priority 3列と設計統一）。ゲートは pg_constraint 非参照のため非回帰、self-test 18/18・round-trip 8/8 維持
- **検証**: session-verifier コミット前ゲート PASS — shared `tsc -b`=0 / web `tsc -b`=0 / **frontend `tsc -b`=0（非破壊実測）** / web `eslint`=0 / web `vite build` green / self-test 18/18 / round-trip 8/8

#### 残課題

- **[要ユーザー対応] SUPABASE_DB_URL パース失敗**: `supabase/.env` 配置済だが pooler 接続文字列のパスワード部に未エンコード特殊文字（`net/url: invalid userinfo`）。RLS ゲート本番実行は exit 2(INCONCLUSIVE) で正しく fail-safe（誤 PASS せず）。0003 push 前にパスワードを URL エンコード or Session pooler/Direct connection 文字列へ要修正
- **[S1-9 未実施] 実ブラウザ CRUD/DnD 検証**: SUPABASE_DB_URL 修正 → `npm run db:check-rls` green → `npx supabase db push`(ユーザー確認) → web で実 CRUD/DnD/soft-delete/restore + RLS 実証（別アカウントで他者行不可視）。S8 Realtime 未実装のため他タブ非反映は想定挙動
- **[S8 へ申し送り] M1 version 非増分**: softDelete/restore/update が `version` を増分せず LWW 同期前提と乖離。複数デバイスで削除復活リスク（自分のデータ範囲）。S8 同期実装で対処
- **[低優先 申し送り]** M2 mutation 0行サイレント / L1 0003 再適用 runbook / L2 parent_id FK on delete 未指定 / Suggestion(Proxy Symbol ガード, created_at クライアント送信) → S2 以降
- **[別チャット同居]** 作業ツリーに frontend-refactor-pre-migration（別チャット）の `frontend/src/**/*.test.ts`・`vitest.config.ts`・`known-issues/*`・plan `.md`・`HISTORY-archive.md.bak` が混在。S1 commit はパス明示で `supabase/migrations/0003*` `supabase/scripts/check-rls-selftest.sh` `shared/` `web/{src,package*.json}` + `.claude` tracker のみ、`git add -A` 不使用で完全分離

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S0 完了（RLS 漏れ検出ゲート + tsconfig project references 化）

#### 概要

Phase 2（コア機能 Web 移植）の申し送り先行対処 S0 を完了。サブエージェント分担（設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン）。**S0(a)** Supabase は anon key 公開前提のため RLS 漏れ = 全行流出 Critical。`supabase db push` 前に「RLS 無効 / policy 0件 / 全開 policy（anon・public ロール / 無スコープ述語 / WITH CHECK 欠落 / auth.uid() 非 owner 等値）」を機械検出するゲートを新設。初回監査で security-reviewer が **VULNERABLE（Critical-1: 全開 policy 素通り）** を指摘、engineer 3 ラウンド + 監査 3 ラウンドで Critical-1 / High-1（`auth.uid() is not null` 型すり抜け）/ High-2（migration 分割 deny-all 盲点）/ Medium-1,2 / Low-1 を全 CLOSED、self-test 15/15。番兵行方式で接続失敗を安全側（exit 2）に倒し「未検証なのに push 通過」を構造的に排除。**S0(b)** `shared` を composite project 化 + `web` を project references 化（Phase 1 申し送り②）。`frontend/`(Tauri) `tsc -b`=0 で並立非破壊を維持。ユーザー判断: tasks id 型=text（CLAUDE.md §4.3 準拠）/ S0(b) を S1 前実施 / 検証は本番直 push（S0a ゲートを安全網に）/ Phase1 検証残骸はユーザー手動掃除。ブランチ refactor/web-first-v2、別チャット Point Graph 同居のためパス指定ステージ。

#### 変更点

- **S0(a) RLS ゲート（新規）**: `supabase/scripts/check-rls.sql`（pg_catalog/pg_policies read-only 走査。`relkind in ('r','p')`、5 検出器: rls_disabled / no_policy / anon_or_public / unscoped_true / qual_no_authuid + insert_no_check + owner_table_no_authuid WARN、`(table_name, why_reason)` 複合 allowlist で誤検知のみ WARN 降格・detector は弱めない、末尾番兵行 `___RLS_GATE_OK___`）/ `check-rls.sh`（stdout・stderr 分離、番兵有無で完走判定 → 接続失敗 exit 2 / leak exit 1 / safe exit 0、`source .env` 廃止し `SUPABASE_DB_URL` 1 行のみ安全抽出、DSN パスワードマスク、`tail -n +2` でヘッダ除去）/ `check-rls-selftest.sh`（DB レス 15 ケース、SEC-High-1 B4/B5 含む）/ `supabase/package.json`（`db:check-rls` && `db:push` 直列、`db:check-rls:selftest`、supabase devDependency 固定）/ `supabase/README.md`（1 テーブル 1 migration 分割禁止明文化、ゲート射程外節 = view/SECURITY DEFINER/owner bypass/foreign table は手動レビュー、複合 allowlist 運用手順、WARN/BLOCK 表記是正）
- **S0(b) tsconfig project references**: `shared/tsconfig.json` を `composite:true`+`declaration`+`declarationMap`+`outDir:dist`、`shared/package.json` に `build`(tsc -b) + `typecheck` が build 兼任の旨注記 + main/types/exports を dist 指す。`web/tsconfig.app.json` の `include` から `../shared/src` 除去 → `references:[{path:"../shared"}]` + `paths` を `dist/index.d.ts`、`web/tsconfig.json` solution に shared 参照追加。`web/package.json` build を `tsc -b --force && vite build`（dist stale 耐性）。`.gitignore` に `shared/dist/` `supabase/node_modules/` + `supabase/.env` 多層防御コメント
- **計画書追記**: `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md` の S0(b) 決定（Vite=shared/src 直 import / tsc=shared/dist .d.ts の二経路維持、web `tsc -b` を正、references が cascade build、型定義削除/リネーム時は `rm -rf shared/dist` 後 build）を追記
- **検証**: session-verifier コミット前ゲート PASS — shared `tsc -b`=0 / web `tsc -b`=0 / **frontend `tsc -b`=0（非破壊実測）** / web `eslint`=0 / web `vite build` green（174ms）/ `bash -n` ×2 OK / self-test 15/15。TS/React ソース変更ゼロ・frontend/src-tauri/cloud 無変更・Point Graph ファイル無変更を構造確認
- **監査収束**: round1 QA=APPROVE W/C・security=**VULNERABLE** → round2 security=Crit-1/High-2 **CLOSED**・新規 High-1 → round3 security=High-1 **CLOSED / S1 着手可 Yes**。当初の anon-key 公開前提の致命的 RLS 偽陰性を S1 で実 policy を書く前に封鎖

#### 残課題

- **[非ブロッカー] `%true%or%`/`%or%true%` over-report**: Phase 2 で `is_public OR owner` 系の意図的公開 policy を誤 BLOCK しうる。allowlist 1 行（`(table, 'policy_qual_no_authuid')`）で WARN 降格・セキュリティ実害なし。S1 で共有テーブル設計時に「誤 BLOCK → allowlist 登録」フローを事前周知
- **[要ユーザー対応] 実接続検証ブロック中**: `SUPABASE_DB_URL` 未提供のため pg_catalog 実走査は未実施（self-test で論理担保）。最初の Phase 2 新テーブル push 直前に `supabase/.env` へ接続文字列を置き `npm run db:check-rls` green を 1 回必須（README 運用ルール化済）
- **[要ユーザー対応] Phase1 検証残骸**: `rls.a@gmail.com` / `rls.b@gmail.com` / テスト行 "A-task" を Supabase ダッシュボードから手動掃除（S1-1 適用前推奨）

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

### 2026-05-16 - クロスプラットフォーム移行 Phase 1 完了 — 新スタック土台 + Supabase Auth/RLS（RLS 実証済み）

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
- **ブロッカー解消（ユーザー操作）**: ①`web/.env.local` URL をホスト形式へ修正 ②supabase CLI 非対話ログイン不可 + メールレート制限のため、0001/0002 を **Supabase SQL Editor で適用**（CLI 管理は Phase5 へ申し送り）③メール確認 OFF + ダッシュボードで Auto Confirm ユーザー 2 名手動作成し probe を signUp→signInWithPassword 方式へ変更
- **RLS 実証完了（probe）**: `supabase/.temp/probe.mjs`（gitignore 済）実行で 完了判定 5/5 達成 — 未認証 read 0 行 / USER A signIn→insert(user_id=auth.uid() 既定)→自分の 1 行可視 / USER B は A の行 0 件・delete 0 件 / `frontend/`(Tauri) `tsc -b`=0。実証後 probe 削除（成果物に残さず）。SSOT `2026-05-04-cross-platform-migration.md` の Phase 1 完了判定 5 項目を [x] 化
- **後始末**: throwaway 検証ユーザー `rls.a@gmail.com`/`rls.b@gmail.com` + テスト行 "A-task" はユーザーが Supabase ダッシュボードから削除（要対応・記載）
- **commit**: `d1abd8a`(R1) / `ce6a5cb`(R2) / `ec540ec`(tracker) + 本クローズ tracker commit。次フェーズ Phase 2（コア機能 `shared/` 移植）はユーザー指示待ち
