# HISTORY (chat-main)

### 2026-06-10 - W1/W2 merge 後検証 + 統合修復（PR #66）+ merged worktree 一括 prune

#### 概要

PR #62/#63/#64 の連続 squash merge で競合解決時に W1 hunks が脱落し、main の web build が破損していたことを merge 後の全数検証で検出。fix worktree で統合修復し PR #66 として merge 済み（f652a542）。後処理として merged worktree 7 個を prune し、W1/W2 子計画書を archive 化。

#### 変更点

- **検出**: ローカル main と origin/main の分岐（squash merge 由来 3 ahead / 4 behind）を tree 差分で安全確認後にユーザーが reset --hard で同期 → main 全数検証で web build 失敗（TS2305×4 / TS2304 / TS2322 / TS6133 + lint 1 error）。shared build/test は緑 = 被害は components barrel と MainScreen に限定。i18n キー・shared/index.ts・main.tsx(ThemeProvider)・W2 実装は無傷
- **修復（PR #66 @ f652a542）**: (1) shared components barrel に W1 Settings 系 export（SettingsAppearance/Language/Shortcuts + ShortcutRow）復元 (2) MainScreen に settings セクション一式（Section 型 / nav / SECTION_ICON / 描画 + ShortcutConfigProvider ラップ）復元・旧ローカル getDataService を削除し #62 shared factory に一本化 (3) `section.settings` i18n キー追加（en/ja）= CommandPalette に「Go to 設定」コマンドが正しいラベルで統合
- **検証**: shared build / web build (tsc -b --force + vite) / shared test 339 passed (29 files) / web lint 0 errors すべて緑。merge 後 main の tree が fix branch と完全一致確認（= worktree 検証が main にそのまま適用）
- **後処理**: merged worktree 7 個 prune（batch-a / batch-a-rest / docs-cleanup / w0-shared-ui / w1-ux-settings / w2-trash-palette / w1w2-merge-fix）。ローカル branch 削除は deny ルール（`git branch -D`）でブロック → ユーザー実行依頼。history ローリングアーカイブ実施（13→5 エントリ・2026-05×8 / 2026-06×1 を archive へ）

#### 設計判断 / 申し送り

- **再発防止**: 同一ファイル（barrel / i18n locales / MainScreen）を触る複数 PR の連続 squash merge は、競合解決で片側 hunks が落ちても GitHub 上 green に見える。**連続 merge 後は main で build 全数検証を必須**とする（今回それで検出）
- **fix worktree の node_modules**: 新規 worktree は node_modules 非共有で tsc/eslint が 127 で落ちる。本体への symlink（`ln -s <main>/shared/node_modules` 等）で解消。`shared/node_modules` は gitignore 漏れのため pathspec stage 必須（W1/W2 と同じ注意）
- **W1/W2 子計画書はこの END で COMPLETED 化し archive へ移動**（merge 完了につき）

### 2026-06-09 - web-desktop パリティ W1（UX基盤）+ W2（Trash/CommandPalette）

#### 概要

親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md`（W0-W4・web を Desktop 同等へ）の W1・W2 を実装。各々独立 worktree/ブランチ/PR。role-pm 分解 → 子計画書 → role-engineer 実装（W1 は socket hang up 対策で2バッチ分割）→ role-qa 独立監査 → git-orchestrator で commit/PR。merge はユーザー判断（🛑 人手ゲート・未merge）。

#### 変更点

- **W1（PR #63・feat/w1-settings-theme @ 9277644）**: web に Theme 基盤を新設。役割判明=「設定画面移植」でなく「web に Theme/FontSize/Language/Shortcut を機能させる shared 基盤の新設」（web には dark/light も font-size 適用も Provider も無かった）。
  - shared 新規: useLocalStorage / ThemeContext(Value/Context/hook・Pattern A・theme/fontSize/language の3点・editor系は web 消費者ゼロで除外) / ShortcutConfig(Optional バリアント=Mobile省略Provider) / SettingsAppearance・SettingsLanguage・SettingsShortcuts(props注入の純粋部品) / shortcut 型・defaultShortcuts(web実在10件選別・nav は web section に再キー) / platform・shortcutBinding util + テスト11件。
  - web: main.tsx に ThemeProvider マウント(documentElement に data-theme/font-size 適用・localStorage 永続化) / MainScreen に settings section + nav + ShortcutConfigProvider(SyncProvider 内側)。
  - 検証: shared build/web build/shared test 332緑/web lint(0 err)。role-qa=PASS with concerns(C/H=0)。Low#1(`--notion-accent`→`--color-notion-accent` トークン名誤記)修正取込。
- **W2（PR #64・feat/w2-trash-command-palette @ ebd0d6d）**: web に Trash + CommandPalette。DB変更ゼロ(既存 soft-delete API 利用)。
  - shared 新規: CommandPalette(frontend 195行を i18n props 化コピー・useTranslation 撤去・Cmd+K/Ctrl+K・IMEガード・検索/↑↓Enter) / TrashView(純粋部品・書き直し=frontend版は DU-G で消えた legacy context 依存で流用不可・5カテゴリ tasks/notes/dailies/routines/events・Modal confirm) + テスト10件。
  - web: TrashScreen host(getDataService で5カテゴリ fetchDeleted\* 並列取得・restore/permanentDelete 配線・cancelled フラグ+busy ガード) / MainScreen に trash section + nav + Cmd+K window リスナ + コマンド配列。
  - 検証: shared build/web build/shared test 328緑(新規10)/web lint(0 err)。role-qa=PASS(C/H/M=0・5カテゴリ配線を DataService 実装本体まで遡り取り違えゼロ確認)。Low(untitled フォールバック未定義キー→`common.untitled` 新設)修正取込。

#### 設計判断 / 申し送り

- **2バッチ分割の経緯**: W1 初回 role-engineer が socket hang up(接続切断系・本体SSEバグ)で103分・実装0で落ちた。原因は worktree の node_modules リンク先(本体 shared/web)に W0 deps(i18next/react-i18next/lucide-react/jsdom/@testing-library)が未 install だったこと＋長時間SSE露出。本体で npm install 解消後、Theme コア(Step1-4)/Shortcut+Settings(Step5-8)に分割して稼働短縮。W2 の role-qa も hang したため検証4本を main が background 実測→QA はコード読解専念に切替。
- **shortcut executor 未配線(W1→W3 申し送り)**: W1 で shortcut の設定/rebind/conflict/reset は動くが、グローバル keydown executor が無く押下実行されない(Step7 でスコープ外と定義・要件違反でない)。W3 で `useGlobalShortcuts(matchEvent, setSection, undo, redo, openPalette)` を MainScreen に配線予定。`global:command-palette` は W2 で UI 実装済のため W3 で結線。
- **Trash の host 直叩き設計**: web は Provider をセクション別マウントするため、Trash の5カテゴリ横断には section context が使えない。host(TrashScreen)で DataService 直叩きが正解(host が getDataService を呼ぶのは規約OK・禁止はフック/部品内のみ)。
- **worktree node_modules 非混入**: `shared/node_modules` は検証用シンボリックリンクで gitignore 漏れ(`web/node_modules` は ignore 済)。両 PR とも `git add -A` 禁止・明示 pathspec で stage し非混入確認。
- **merge 順序**: W1→W2 推奨(両者 `shared/src/components/index.ts` + i18n locales を触る・i18n JSON 軽微競合回避)。

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

> 古いエントリは [`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
