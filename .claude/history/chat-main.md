# HISTORY (chat-main)

### 2026-07-19 - Notes/Daily エディタ即クラッシュ修正（tiptap Suggestion PluginKey 衝突・PR #294）

#### 概要

Notes のアイテムクリックで詳細パネルが真っ白になる regression（#288 merge の [[ autocomplete 導入で顕在化）を Windows 機の chat-main で診断・修正。"/" スラッシュメニューと "[[" オートコンプリートが @tiptap/suggestion の共有デフォルト PluginKey に衝突し、両方を登録する Notes/Daily エディタが ProseMirror の RangeError でマウント時にクラッシュしていた。

#### 変更点

- **Root Cause**: `web/src/notes/slashCommand.ts` / `itemLinkSuggestion.ts` の両 `Suggestion({...})` が `pluginKey` 未指定 → 共有デフォルト `SuggestionPluginKey` に二重登録 → `RangeError: Adding different instances of a keyed plugin (suggestion$)`。実行時にのみ発生し型/build 検証は通過するため merge 前検出不可（運用どおり merge 後の chat-main 実ブラウザ確認で発覚）
- **Fix**: 各 Suggestion に module-level の固有 `PluginKey`（`"slashCommand"` / `"itemLinkSuggestion"`）を付与（2 files, +14 行・commit `11acaac0`）。一時 worktree `tmp-suggestion-key` 経由で push・push 後即削除（main 直 push 禁止準拠）
- **起票/追跡**: Issue #293（type:bug / sev:blocking / section:materials・DoD 付き）→ PR #294 が `Fixes #293`。issue-dispatch スキルは Windows 機に未配備のため gh 直接起票
- **検証**: web build（tsc -b --force + vite）0 / eslint 対象 2 ファイル 0 / role-qa 独立レビュー PASS（BLOCKING/IMPORTANT 0 — prosemirror-state の `Configuration` 実装を実測し、module-level PluginKey の複数エディタ共有はキー衝突判定が単一 EditorState 内のみのため安全と確証。MINOR 1 件 = const 配置の見た目のみ・見送り）。merge 後の実ブラウザ確認（Issue #293 DoD）は「予定」に登録

### 2026-06-27 - Loop Engineering Step 3 + 並行レーン memory 棚卸し（#105 merged / connect-link-ui 検出）

#### 概要

Loop Engineering の自動検証ループ（`scripts/loop-engine/`）を Step 3 まで完成させ PR #106 を作成。続けて全 per-chat memory を git/gh 実態と照合し、マージ済みなのに「PR 待ち / 未コミット」と古いままだった 4 レーンの memory をユーザー認可のもと実態へ同期した。

#### 変更点

- **loop-engine Step 3**: `loop.sh` 新規（run-once を PASS/上限まで反復・4停止条件・課金同意ゲート・空 TODO は子 Claude 起動せず $0）。check.sh/run-once.sh のハードコード絶対パスを script 相対化（worktree 移動・マージ後も動く）。`count_todo` をコメント無視へ修正（TODO 冒頭の例を実タスクと誤認するバグ）。スタブ harness で 4 停止条件＋無課金経路を 5/5 実証（トークン/npm 不使用）。`feat/loop-engine` worktree で commit `c72e61d7` → push → **PR #106 open**。CLAUDE.md §7.4 に Orca ADE worktree 例外 1 行を stash から復元同梱。
- **並行レーン棚卸し**: gh で全 PR 状態を確認（#79/#88/#51/#105/#102/#97/#96/#78/#48/#40/#46/#38/#36 = MERGED、#106 のみ OPEN）。**#105（W8 救出）も merged 済**と判明し chat-main の「open」表記を訂正。stale だった chat-phase3-electron（#79）/ chat-phase4-capacitor（#88）/ chat-work-mobile-unify（#51）/ chat-prototype-mobile（#40/#46/#48）の 4 memory を「完了」へ同期（各ファイル冒頭に棚卸しマーカー付記）。単一書込者原則の例外＝ユーザー明示認可の cross-lane reconciliation。
- **検出した宙吊り（申し送り）**: `connect-link-ui` worktree が **台帳外の生きたレーン**（別セッションで Connect リンク作成/削除 UI を実装中・独自 commit `8711acfe`・未コミット 3 ファイル・`.session-name`/memory 無し・PR 未作成）。`stash@{1}` に DU-F Step 6-14 の未コミット作業が宙吊り。本コミットでは触らず記録のみ。

### 2026-06-27 - 進捗整理 + worktree 棚卸し + W8 対話グリッド救出（PR #105）

#### 概要

「現在のタスク進捗を整理 + 全タスクを終わらせたい」依頼を受け、全体監査 → main 同期 → 唯一の未マージ実作業 w8-salvage の仕上げ → PR 化 → merge 済み worktree のお掃除を一気通貫で実施。tracker メモリが古く多数の「PR 未作成」が実は merged だったことを突き止め、現実に再同期した。

#### 変更点

- **全体監査**: gh 認証断による偽陰性（PR 0件・branch 1本）に一度誤誘導されたが再認証で確定。「未マージ実作業」と記録されていた W4(#78)/Phase3(#79)/Phase4(#88)/Work-mobile(#51)/Kanban(#102)/W8(#96/#97) は**全て merged**。真の未マージは **w8-salvage 1件のみ**と特定。
- **main 同期**: origin/main へ rebase（behind 7→0）。詰まりの原因 2 件を解消 = (1) PR #98 の hooks symlink 化とローカル実ファイルの型不一致 → working tree を一旦実ファイルへ戻して rebase、着地で symlink 復帰。(2) CLAUDE.md 衝突 → ローカル版が stale（`shared/src/services` を `frontend` へ逆戻り・schedule-management 行欠落）と判明し origin 版採用、旧編集は `stash@{0}` に保全。
- **w8-salvage 仕上げ**（PR #105・commit `14d9719e`）: サブエージェント監査で完成度 85–90%・3 機能とも実データ結線済みと確認。残作業を実施 — `pxToMinutes` ゼロ高さフォールバックを「1px=1分」傾きへ修正（失敗していた layout 単体テスト緑化）/ `weekTimeGrid.test.tsx` に対話テスト4本追加（jsdom が PointerEvent 非実装で RTL fireEvent.pointerDown が button を落とす罠を、ネイティブ `MouseEvent("pointerdown")` 発火で回避）/ origin/main へ rebase（merge-tree クリーン）/ 計画書 Draft→In Progress。検証: shared 503 pass・shared tsc -b 0・web build exit 0。
- **検証の工夫**: worktree は node_modules 非共有のため、メイン worktree の `node_modules` / `shared/node_modules` / `web/node_modules` を symlink で借用（package.json 同一）→ ENOSPC リスク（残 2.9Gi）を回避して install なしで全テスト/build 実行。
- **お掃除**: merge 済み 6 worktree（hooks-symlink / phase3-electron / w4-analytics-connect / w8-dedup / w8-schedule-calendar / web-kanban-ui-ux）を `git worktree remove` で prune。残 worktree = main + w8-salvage のみ。ローカル/remote の merged branch 削除は `git branch -D` deny ルールのためユーザー実行（tracker 予定に列挙）。

### 2026-06-20 - デザインシステム整備 + ブランド Cobalt+Mint リブランド（PR #102）

#### 概要

Pencil 連携がクラッシュで使用不能（MCP 全ツールがキャンバス開状態を要求・`filePath` 明示でも不可）になったため、**ClaudeDesign（claude.ai/design の DesignSync）**へ切替えてデザインシステムを整備。新ブランドパレット **Cobalt Ink + Mint** を確定し実トークンへ適用、作成原則を成文化。並行 Kanban UI/UX 作業と同梱で **PR #102** にて merge（merge commit `d6103eec`）。

#### 変更点

- **ツール切替**: Pencil（要キャンバス・ローカル・クラッシュでブロック）→ ClaudeDesign（claude.ai ログイン経由の DesignSync）。後者が「今後の正本」の置き場と判明。新規「DesignSystem」project（`962335c3-…`・type `PROJECT_TYPE_DESIGN_SYSTEM`）は既存・空だった（前に「見えない」は索引反映待ち）。
- **ブランドパレット**: workflow で 6 方向探索→4 厳選（WCAG AA 検証）→ユーザーが **Cobalt Ink** ベースに **Mint 第2アクセント**を足した「Cobalt + Mint」を採用（緑 3 段階 A/B/C のうち B）。
- **tokens.css**: light/dark の chrome/accent/semantic を Cobalt+Mint へ置換・旧 Notion teal `#2eaadc` 退役。`accent-secondary`(mint)+`chip-mint`+`accent-hover` 追加・**dark の on-accent を near-black `#0a1024` に切替**（dark accent が明るいコバルト＝白文字でコントラスト不足のため）・旧 teal をミラーしていた task チップを cobalt 系へ再調整。Functional/Data（status band・chart・event紫・routine藍）はテーマ固定符号化として現状維持。`graph-theme.ts` の CSS 変数フォールバックも新ブランド値へ。web build 通過。
- **作成原則**: `shared/design-system/PRINCIPLES.md`（不変式トップ6 / カラー4役割 / 透明度ポリシー / アクセシビリティ / トークン追加手順の SSOT）+ `palette-candidates.md`（4 案＋採用記録）。
- **ClaudeDesign DesignSystem**: foundations(colors/principles/typography) + components(button/card/input/chips/modal/toast/sheet/nav) の計 **11 カード**（`@dsCard` 付き自己完結 HTML）を投入。コンポーネント 6 枚は workflow で並列生成。ローカルミラー `shared/design-system/claude-design/`（README に projectId 記録）。
- **旧 project 退役**: 旧「Design System」（`d0c25129-…`）のパイロット4枚（colors/button/card/input）を削除し `_ARCHIVED.html` マーカー設置（project の殻削除/改名は DesignSync に API 無く claude.ai UI 操作）。
- **PR**: 並行プロセスが working tree を `git stash -u`→`feat/web-kanban-ui-ux` に pop+commit+push 済みで、私の rebrand+design-system も同梱されていた（PR #102）。draft 化＋タイトル/本文に design-system スコープ加筆ののち、ユーザーが merge。
- **申し送り**: ローカル main が origin より 5 behind で ff-pull が `chore/hooks-symlink-distribution` 由来の `.claude/hooks/*.sh` 衝突でブロック（別作業・本タスク外・触らず）。

### 2026-06-20 - W8 二重実装の解消 + main ビルド破壊の緊急修復（#97）

#### 概要

W8 (Schedule 週グリッド) を **2 つの並行チャットが互いを知らず二重実装**し、両方 main へ merge された結果、origin/main の web ビルドが破綻していたのを修復。原因の本質は技術ではなく**並行作業の境界調整不足**。`fix/w8-schedule-dedup`・commit `13e96a8d`・PR #97。

#### 経緯（タイムライン）

1. main=`bda164ec`(#94 W8 plan) を共通 base に、両チャットが W8 着手。
2. 別チャットが **#95 `c9c93690`「W8-1 Schedule 週グリッド」** を先に merge（`WeekGrid.tsx` / `weekGridLayout.ts` 新設・`<WeekGrid />` 配線）。
3. main チャット(自分)が **#96 `228ddd8b`「Schedule カレンダー 週/日タイムグリッド」** を後で merge。#96 は #95 を含まない `bda164ec` ベースで作成（着手時 origin/main に #95 がまだ無く `.claude/comm/` でも捕捉できず）。
4. GitHub 3-way merge が `MainScreen.tsx` を #96 側で解決 → **#95 の `<WeekGrid />` JSX が消え `import { WeekGrid }` だけ残存**。
5. `web/tsconfig.app.json` の `noUnusedLocals:true` が `error TS6133: 'WeekGrid' is declared but its value is never read.` で web build を恒常破綻。CI 不在で気付かれず。

#### 変更点

- **検証**: 撤去**前**に origin/main 相当を build し `TS6133` を実証（壊れている確証）。
- **方針**: 機能の広い #96(`ScheduleCalendarView`/`WeekTimeGrid`/`scheduleGridLayout`・週/日分割・編集・i18n・386行) を Schedule の正とし、#95(read+navのみ・267行) の dead 一式を撤去。
- **撤去(-573行)**: `web/src/schedule/WeekGrid.tsx` / `shared/src/utils/weekGridLayout.ts` / `shared/tests/weekGridLayout.test.ts` 削除 + `MainScreen.tsx` の dead import + `shared/src/index.ts` の `weekGridLayout` export ブロック（`timeToMinutes`/`layoutDayEvents`/`addDays`/`startOfWeek`/`weekDates`/`todayLocal`/型2 — 全て WeekGrid.tsx のみ使用を grep 実証）。
- **温存**: #95 同梱の Desktop 常駐(STEP1・`desktop/` 配下)は別機能のため無改変。
- **再発防止**: Known Issue `029-parallel-chats-double-implemented-w8-dead-import-broke-main.md` 追加（着手前に同名機能の進行中 PR/branch 確認・`noUnusedLocals` 環境で host 共有ファイル衝突時は merge 後 build 必須・CI build gate 推奨）。
- **検証後**: shared build 0 / shared test **463 passed** / web build **0(TS6133 解消)** / web eslint 0err / frontend build 0。
- **5173 の扱い**: メイン作業ツリー(`/life-editor`)は origin/main 2-behind + Connect/Task/Kanban 未コミット変更あり=別チャット進行中作業の可能性大。ユーザー判断で**触らない**（各自 #97 merge 後に pull 同期）。

> 古いエントリは [`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
