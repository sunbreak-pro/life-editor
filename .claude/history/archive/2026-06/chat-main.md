# HISTORY ARCHIVE (chat-main, 2026-06)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-06-08 - Batch A 残3レーン PR#62 + グローバル化 follow-up(#7)

#### 概要

前セッションで保留した #6(Batch A 残3レーン)と #7(グローバル化 follow-up)を順に完了。#6 は w0/docs が PR#58/#59 で main マージ済みを確認した上で残3レーンを実装→PR#62。#7 は novel への per-chat 機構 commit と life-editor hooks のリンク化(skip-worktree 方式)を実施。

#### 変更点

- **#6 Batch A 残3レーン → PR#62**: (1)factory= web の getDataService 重複を `shared/src/services/dataServiceFactory.ts` に集約(単一singleton+setDataServiceForTest, lazy init) (2)comment= S8 stale comment 更新 (3)docs= CLAUDE.md §3.3/§4.1 を items_meta.updated_at LWW モデル+db-conventions §10 参照に修正。role-engineer×3並列→role-qa独立監査。
- **QA P1 検出と修正(重要)**: comment Agent が「schedule_items は REALTIME_TABLES外→Realtime反映されない」と書いたが、QAが実装(SupabaseDataService.ts:1850-1868)を辿り schedule_items は role='event' で items_meta+events_payload に永続化され両テーブルは REALTIME_TABLES 内と判明。「loadDate は Realtime遅延を待たない即時反映の最適化(購読欠落の補償ではない)」へ訂正。stale comment 修正レーンが別の不正確comment生成になる事故をQAが防いだ。
- **#7(a) novel**: setup-per-chat.sh 適用分(per-chat memory/history/comm + hooks リンク + settings.json + .gitignore)を commit(d8f9299)。hooks は 120000(symlink)記録、INDEX.md は .gitignore 除外、既存 inbox-check.sh 無変更、settings.local.json の inbox SessionStart と共存。
- **#7(c) life-editor hooks リンク化**: 4 hook(regen-index/session-start-check/pre-commit-mcp-check/pre-commit-index-guard)を hooks-lib リンクに置換。共有リポで他環境リンク切れを避けるため **skip-worktree 方式**採用 = git checkout で index を実体に戻す→`git update-index --skip-worktree`→worktree のみ再リンク。結果「手元はリンク(hooks-lib SSOT で DRY)・git HEAD は実体blob維持(他クローンで切れない)」。stop-check.sh は life-editor固有のため対象外。
- **#7(b) card-battle**: `chore/claude-harness-and-battle-fixes`(dirty・別チャット作業疑い)のため適用保留継続。

#### 設計判断 / 申し送り

- **並列QAの価値の実証**: P1(schedule_items×Realtime因果)は実装Agentがテーブル名の表層だけ見て誤判断したもの。別コンテキストのQAが実装を辿って訂正。「stale comment を直すレーンが別の不正確comment を生む」皮肉をクロス検証で捕捉。
- **skip-worktree の運用注意**: life-editor の hooks 4つは skip-worktree フラグ付き。将来 hook 本体を更新したい時はこのフラグの存在を意識する(git で実体が更新されてもworktreeのリンクは無視され続ける)。novel は個人ローカルなので素直に symlink commit。
- **未了**: `.claude/hooks/.bak-pre-linkify/` がuntracked残存(rm権限制約でユーザー手動削除依頼)。project-setter の per-chat 統合は setup-per-chat.sh が当面兼任。card-battle 適用はブランチ clean 後。

### 2026-06-07 - Batch A PR#61 + supabase誤報決着 + コア機構グローバル化

#### 概要

Web移行整合監査(Dynamic Workflows 8エージェント並列)を起点に、非競合2レーンをBatch A=PR#61化、QAが見つけたsupabase消失疑いを誤報と決着、per-chat運用機構をグローバル化(hooks-lib新設+novel適用)した一連のセッション。

#### 変更点

- **監査(①)**: Dynamic Workflows 8エージェントで並列監査。重要発見=`frontend/`は破棄予定の旧Tauriツリー(磨かない)、現行は`web/`+`shared/`+`supabase/`、SSOTは`2026-06-07-web-desktop-parity-roadmap`(W0-W4)。型/ビルド緑・shared 307テスト緑。
- **Batch A=PR#61(②③)**: web manualChunks(react-vendor/dnd/editor/supabase+limit600、500KB超警告解消) + shared relation/group系6 Mapper roundtripテスト(+63、244→307緑)。role-engineer×2並列実装(worktree隔離)→role-qa独立PASS→worktreeからpush(main専有hook誤ブロック回避)。残3レーン(factory/docs-sync/comment)はw0/docs競合で保留。
- **supabase誤報決着(⑤)**: distにcreateClient 0ヒットを本番ログイン不動と疑ったが、原因はworktreeの.env.local欠落→VITE*SUPABASE*\* undefined→getSupabaseClient throw経路→rollupがcreateClient到達不能判定→tree-shake削除。main(env あり)でcreateClient/GoTrueClient/signInWithPassword残存確認=誤報。memory化(project_worktree_supabase_treeshake)。
- **グローバル化(④)**: `~/dev/Claude/hooks-lib`新設+4hook汎用化(ROOT検出CLAUDE_PROJECT_DIR基準・ハードコード除去)+`setup-per-chat.sh`(冪等/settings.json jqマージ、一時dirで空/マージ/冪等テスト、jq selectスコープバグ修正)。novelに適用し実動確認(regen-index/session-start-check動作・inbox-check無傷)。card-battleは`chore/claude-harness-and-battle-fixes`(dirty,別チャット疑い)で保留。

#### 設計判断 / 申し送り

- 並行worktree(w0-shared-ui/docs-cleanup)競合回避のため、監査の「5レーン並列OK」を実態(2 worktreeがshared/.claudeを押さえ)で2レーンに絞った。残3レーンはマージ後。
- session-start-checkはgit toplevel優先=CLAUDE_PROJECT_DIRを渡してもcwdのgit優先(テスト時注意・実運用は各プロジェクトで起動するので問題なし)。
- card-battle/novelは旧MEMORY.md/HISTORY.md方式。setup-per-chatは旧ファイル無変更で共存(凍結)。

### 2026-06-07 - web-desktop parity W0-4/5/6 完了 + role-qa/security 並列独立監査 PASS

#### 概要

web-desktop parity ロードマップ W0（共有 UI 基盤）のうち W0-4/5/6（i18n 基盤 + 共有 UI mount 検証 + 2層モデルのドキュメント記録）が worktree `w0-shared-ui`（branch `feat/w0-shared-design-system` @`e86819e`）で完了。メインからは実装せず、**role-qa と security-reviewer を別コンテキストで並列起動して独立監査**し PASS を確認した（コード変更はメイン working tree に無し）。

#### 変更点（監査対象 = `git diff c927b27..e86819e`）

- **W0-4/5（commit `c42f96d`）**: `shared/src/i18n/index.ts`（react-i18next idempotent init / fallback=en / 永続化）+ `locales/{en,ja}.json`（各 ~2650 行）+ 共有 i18n provider + web mount 検証（`web/src/main.tsx` 改修 / `web/src/_w0demo/W0Demo.tsx` デモ）+ `shared/tests/i18n.test.ts`。
- **W0-6（commit `e86819e`）**: `docs/vision/coding-principles.md` に §6「UI 2層モデル（部品共通/画面分岐）」新設（既存 §6→§7 繰り上げ・連番正常）+ §6.4 props 経由 i18n 不変式維持を明記。`.claude/CLAUDE.md` §6.4 と移行 SSOT §0 に Option A（共有 UI 集約）方針転換を記録。

#### 検証（並列監査の実機ログ）

- **role-qa**（91.6k tok / 22 tool / 186s）: Acceptance Criteria 全達成。`shared tsc -b` exit 0 / `shared vitest` 258 pass / `web vite build` exit 0。**en/ja key parity 完全一致（各 1778 key・欠落0）**＝当初疑った行数差（2651 vs 2649）は整形差で誤検知。`escapeValue:false` は危険シンク（dangerouslySetInnerHTML/Trans/innerHTML）ゼロで実害なし。判定 PASS（merge 可）。
- **security-reviewer**（73.5k tok / 16 tool / 157s）: Critical/High/Medium 0、Low 1（デモ残留）、Info 3。新規依存 `i18next@25.10.10`/`react-i18next@16.6.6` + transitive 4 件は正規エコシステム・`npm audit` 0 件・integrity 整合。秘密情報・prototype pollution 該当なし。
- **両者一致の唯一 follow-up（merge 非ブロック）**: `web/src/_w0demo/W0Demo.tsx` が `main.tsx` で静的 import され production バンドル混入・`?w0demo` で認証なし到達可能（ただしデータ/秘密に非接触）。**W0 sign-off 時に削除**（残すなら `import.meta.env.DEV` ガード）。

#### 設計判断 / 申し送り

- **並列監査のコスパ評価**: サブエージェントは各々独立コンテキストのため「並列で 1 本あたりの質が落ちる」は起きない。落ちるのは「追加トークンあたりの新規発見量」で、W0-4/5/6 は面が狭い（i18n/docs）ため 2 本目（security）は大半が再確認だった。独立 2 本の結論収束＝クロス検証で確信度は上昇。指針: 監査本数は固定でなく**差分の面の多様さに合わせる**。`life-editor-*`（IPC/migration/sync）は該当変更ゼロのため非起動（空振りノイズ回避）。
- **次アクション**: (1) `_w0demo` 削除を W0 sign-off follow-up として実施予定（本セッションで着手）。(2) W0 全体（W0-1〜6）の main への merge（PR）は別途 git-orchestrator 経由。(3) その後 W1（UX 基盤: Settings/Theme/FontSize/Shortcut）着手。
- focus-trap on Modal/BottomSheet は `e86819e` で「follow-up (QA)」と明示宣言済みで W0 スコープ外（今回監査範囲では越境・未達なし）。

### 2026-06-07 - セクション統一 Phase1確認 + Phase3 Materials完了 + Phase2/4調査 → FROZEN一本化把握

#### 概要

Mobile 基準セクション統一の master プラン（`2026-06-05-mobile-first-section-unification.md`）まわりで、Phase 1 の PR 確認・Phase 3 の実行・Phase 2/4 の構造調査を行い、最終的に別チャットの FROZEN 判断（web 移行一本化）を把握してセッションを区切った。コード変更はメイン working tree に無し（全て別 worktree でサブエージェントが PR 化 → main merged）。

#### 変更点

- **Phase 1 (Work)**: PR 新規作成を依頼されたが、確認すると既に PR #51 が MERGED（2026-06-06）と判明。新規作成は不要だった。ローカル main が一時 3 コミット遅れだったが後に origin と一致。
- **Phase 3 (Materials)**: 専用 worktree `feat/materials-section-cleanup` でサブエージェント実行。Materials は `Ideas/DailyView`/`NotesView` が既に Desktop/Mobile 共有済みのため統一作業不要と判明。未使用 Mobile dead code 6 ファイル（`MobileDailyView` / `MobileNoteView` / `materials/{MobileNoteTree,MobileNoteTreeItem,MobileNoteTagsBar,MobileTagPicker}`、いずれも外部 import 0 を grep 確認）を `git rm` 削除（`Mobile/materials/` ディレクトリも消滅）。Files タブ（Desktop FileExplorer）は維持。build exit 0 / lint は main baseline と同一 99 problems（増減なし）。→ PR #53 MERGED（merge commit `9349d12`）。
- **Phase 2 (Schedule) / Phase 4 (Settings) 構造調査**: Explore で両セクションをマッピング。両者とも Work 型（完全分離）。Schedule = Desktop 47 / Mobile 12 ファイル、データ取得が Desktop=useScheduleContext・Mobile=getDataService 直で非対称、CalendarTagsProvider が Mobile 不在。Settings = Desktop 27 / Mobile 6 ファイル、Desktop 専用設定（キーボードショートカット/システム/サウンド/開発者ツール/Claude/エディタ）は Provider・OS 連携前提で Mobile に物理的に存在不可 → 残す一択、共有可能は Theme/Language/Sync/Timer/Notifications/Trash/Data/FontSize の 8 項目のみ。
- **FROZEN 把握（重要な意思決定）**: 別チャットが master プランを PR #55 で更新し Status を FROZEN 化。理由は `frontend/`（Tauri 版 UI）が移行 Phase 5 で破棄予定で、frontend での統一成果が `web/`+`shared/` に伝播しないため。→ frontend での Phase 2/4 統一は着手しない。Phase 2 の設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は計画書に詳細化済みで「web 移植時の仕様参照元」として保全。新統合 SSOT は `2026-06-07-web-desktop-parity-roadmap.md`（W0-W4）。
- **このチャットの Phase 2/4 設計タスクは取り下げ**（FROZEN 方針に従う。competing 回避で master プランはこのチャットから未編集）。

#### 検証

- PR #51 / #53 / #55 すべて gh で MERGED 確認。main 最新は `0ef24b5`（#55）。
- `git status --short` 空（working tree クリーン）、`rev-list --left-right --count main...origin/main` = 0 0（origin 同期）。

#### 申し送り

- 無関係な孤立 worktree 残骸 `.claude/worktrees/du-g/`（git レジストリ未登録・参照先不在）+ マージ済みローカルブランチ複数 + stash 1 件の片付け漏れあり。プラン整合性には影響なし。掃除は別途。
- 次の主軸は web-desktop-parity-roadmap（W0-W4、web/+shared/ を旧 Desktop 同等へ）。各 Phase は着手時に `2026-06-XX-web-parity-w<N>-*.md` へ子分割予定（現状未生成）。
