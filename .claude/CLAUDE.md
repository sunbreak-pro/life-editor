# CLAUDE.md — Life Editor 統合定義書

> 設計判断・実装規約の SSOT。**「変わらない事実」だけを持ち、手順はスキル / エージェント、frontend 詳細規約は [`.claude/rules/`](./rules/) へ委譲**。各行は「消したら Claude が間違うか」基準で維持する。大きさの上限は `scripts/docs-lint.sh` の (h) が tok で見る。経緯は書かず、決定の記録へのリンクで指す。
>
> ⚠️ **Active Migration**: Tauri 2 + D1 + portable-pty → **Electron + Web + Supabase** へ移行中（iOS / Android のアプリの殻は作らない = #2760）。**現行スタック・Phase 状況・移行手順の SSOT は [`2026-05-04-cross-platform-migration.md`](./2026-05-04-cross-platform-migration.md) と `memory/INDEX.md`** (進捗 / 履歴は per-chat — §9 参照)。本ファイルの実装パス/コマンドはアーキ非依存に一般化済み（具体は移行 SSOT 参照）。方針: 学習ログ廃止 / 完成までコスト $0 厳守。<!-- words-ok: D1 は Cloudflare のデータベースの製品名 -->

---

## 0. Meta

- **更新規則**: 実装変更はコードと同一 PR で更新。新機能は §8 + `docs/requirements/` に記入
- **数値の非複製原則**: 個数・列挙は単一の元になる文書（コード or SSOT）だけに書き、他文書は参照にする。「一覧はコードが正」と書くなら数字を併記しない。改名・退役時の波及手順は [`rules/docs-consistency.md`](./rules/docs-consistency.md)
- **再編中（航法 / 目的の 2 層）**: 各節をどちらの層に置き、層外の記述をどこへ移すかは [`docs/vision/claude-md-layering.md`](./docs/vision/claude-md-layering.md) が元になる文書（固定費の実測 = [`docs/reports/2026-08-06-context-fixed-cost-baseline.md`](./docs/reports/2026-08-06-context-fixed-cost-baseline.md)）。**移送は移行完了後**のため、それまで本ファイルの構成は現状維持（[移送を移行の完了後にする決定](./decisions/D-20260806-main-3.md)）
- **関連**: 記録の入口 = [`INDEX.md`](./INDEX.md)（`records.mjs` 生成・git 非追跡の派生ビュー = 2026-08-12 ユーザー確定 / #735）・進捗 / 履歴 = per-chat `chat-*.md`（§9。集約 `memory/INDEX.md` / `history/INDEX.md` も同じく git 非追跡の派生ビュー）・設計 = `docs/vision/`・要件 = `docs/requirements/`・障害知見 = [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md)・完了プラン = `archive/`（所在表 = `archive/INDEX.md` も同じく派生ビュー）

## 1. Vision（詳細 → [`docs/vision/core.md`](./docs/vision/core.md)）

- AI と会話しながら生活を設計・記録・運用するパーソナル OS です。**作者本人（macOS + iOS）だけが使う個人の道具**で、他人への配布とサインアップの開放はしません（[個人の道具にする決定](./decisions/D-20261022-main-1.md)）。リポジトリは参考のために公開したままで、ライセンスは All rights reserved（ルートの `LICENSE`）です。配布向けに作った機能（ツアー・ヘルプ・利用規約・サインアップ・アカウント削除）はコードから消しました（[配布向けの機能を消す決定](./decisions/2026-11-16-remove-distribution-features.md)）。git の履歴から戻せます
- **Non-Goals**: 他人への配布 / マルチテナント（組織・共有・権限管理 — 各ユーザーは RLS で分離された個人ワークスペースのみ）/ 特化専用アプリ / Claude API 直課金 / モバイル単独起動

## 2. Platform

- Desktop（macOS / Windows / Linux）= 全機能。Mobile（iOS / Android）= Consumption + Quick capture。**MCP の入口は 2 本で、stdio は Desktop 専用のまま**（入口ごとの役割 → §5）。アプリ内 Terminal は退役し、MCP Server は存続（→ §8）
- **画面別 Mobile スコープの元になる文書 = [`docs/requirements/mobile-scope.md`](./docs/requirements/mobile-scope.md)**（[置き場の決定](./decisions/D-20260723-main-1.md)）: 各セクション内機能の Full / Consumption / Quick capture / 省略 と Phase 1/2 の段取り。§2 は大方針のみを持ち、画面別の取捨は同文書が正（数値の非複製原則）
- **スマホからは公開 Web URL をブラウザで開く**（[主導線の決定](./decisions/D-20260807-main-1.md)）: モバイル UI は画面幅（`useMediaQuery`）で出る。iOS / Android のアプリの殻（Capacitor の `mobile/`）は #2760 で消し、今後も作らない。Provider の鎖はブラウザと Desktop で同じで、ホストごとに省く Provider は無い（ネストの元 = `web/src/AppProviders.tsx`）。PWA の採用範囲 → 移行 SSOT §8 / §9
- Cloud Sync はログインしたアカウントごとに動きます（RLS owner-only でアカウント単位に分離）。使う人は §1 のとおり。ビルドの配布・署名の手順 → 移行 SSOT

## 3. Architecture（恒久原則のみ。構成図 → 移行 SSOT）

- **3.1 DataService 境界（不変式）**: フロントは `getDataService()` 経由でのみデータアクセス。**コンポーネントから直接バックエンド呼び出し（`invoke()` 等）禁止**。実装 = `shared/src/services/`（旧 `frontend/` は 2026-07-11 削除 #197・復元 = git tag `pre-tauri-removal`）。バックエンドが替わってもこの境界は不変
- **3.2 Section Routing**: React Router なし。`web/src/MainScreen.tsx` の section state で切替（旧 frontend は `App.tsx::activeSection`）。セクション定義（`SectionId`・nav 順・グループ・アイコン・mobile 順）は **`shared/src/sections.ts` の registry が SSOT**（`types/todoTree.ts::SectionId` は registry 派生の再 export・一覧はコードが正）。旧 `terminal` セクションは SectionId / nav / i18n から除去済み（#146・退役の経緯 → §8）
- **3.3 Sync**: `items_meta.updated_at` を LWW cursor とする 2 行分割モデル。`<role>_payload` は `updated_at` を持たない（詳細 → [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) §10）。「全テーブルに version カラム」は旧 Tauri 時代の遺物で未使用。差分の読み出しの基準は `items_meta.changed_at`（トリガーでサーバーの時計を書く）と物理削除の記録 `items_meta_tombstones`（0045・#2333）で、`updated_at` は使わない

## 4. Data Model（規約詳細 → `docs/vision/db-conventions.md` / 変更手順 → §7.3（ローカルファイル先行 → ユーザー db push）+ `supabase/migrations/`）

- `items_meta` + `<role>_payload` モデル（テーブル一覧は `supabase/migrations/` + db-conventions が正）
- **特化 vs 汎用 DB の判断**: 特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が必要 → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database
- **ID 不変式**: TodoNode `<type>-<timestamp+counter>`（`<type>` は `items_meta.role` の値。Todo は `task` のまま据え置き = #831） / DailyNode `daily-<YYYY-MM-DD>` / 他 `generateId(prefix)`。全 String。`id` は role を跨いで一意
- **items_meta + composite FK**: 各 role（task / event / routine / note / daily / goal / table。一覧の正 = `items_meta_role_check` = 最新は `supabase/migrations/0040_note_table_items.sql`）は `items_meta(id, role)` が SSOT、payload テーブルは `(id, role)` 複合 FK で参照。WikiTag / Link 系は role 区別なしで `items_meta.id` を参照。**目標 ↔ Todo は専用の `goal_todo_links`**（`(goal_id, 'goal')` / `(todo_id, 'task')` の複合 FK で種類の取り違えを DB が拒否）で、アイテム間リンクの表には入れない（#2101・規約 → db-conventions §15）。**`table` はノート本文の中の表**で、タグを初めて付けたときだけアイテムになる。セルの元は本文のままで、本文の表ノードが `tableId` 属性でアイテムを指す（#2094・規約 → db-conventions §16）
- **拡張アプリの表は残してある**: 拡張アプリの機能は #2720 で消したが、`app_records`・`extension_apps`（0039）・`record_views`（0041）と `items_meta` の作成元の列 `origin_app` など（0038）は、DDL を打たずにわざと DB に残した。読むコードも書くコードも無い（最後に読んでいたデータの書き出しは #2759 で消した。規約 → db-conventions §17）
- **Routine**: Event の生成テンプレート。Routine 専用 Tag/Link UI は持たない（必要なら生成された Event 側に付与）。UI 上は「単一アイテム型（Event）+ 繰り返し設定」として提示し、Routine は実装詳細（[Routine を実装詳細に隠す決定](./decisions/D-20260711-main-1.md)）
- **ソフトデリート**: `is_deleted` + `deleted_at` → TrashView 復元。対象の正 = `shared/src/components/TrashView.tsx::TrashCategory`（5 カテゴリ・Events 含む）
- 汎用 Database は凍結（[凍結の決定](./decisions/D-20260704-main-1.md)）・現行スタックに実装なし。旧 PropertyType 5 種は退役スタック側の記録（requirements 参照）

## 5. AI Integration

- MCP Server = 独立 Node.js プロセス。Claude Code が stdio 接続し同一 DB を直接操作（ツール一覧はコードが正）
- **入口は 2 本・ハンドラは 1 本**（[スマホから MCP を使う決定](./decisions/D-20260909-mcp-mobile-1.md)）: `mcp-server/src/index.ts` = stdio（Desktop）、`mcp-server/src/worker.ts` = Cloudflare Workers 上の Remote MCP（スマホの Claude アプリのカスタムコネクタ）。拡張アプリ用の 3 本目の Worker は #2720 で消した。**ツール集合の元は `src/remoteTools.ts`**（どこでも動くドメイン）で、`src/tools.ts` はそれ + verification harness（`node:fs` の台帳を持つため local 専用）。新ドメインは remoteTools 側に足す — 逆にすると Worker 側だけ無言で欠ける
- **Worker の前提**: スマホ用の Worker（`worker.ts`）の認証は URL パスの共有シークレット 1 本（不一致は 404。per-user OAuth は配布ユーザーに開く時の課題）／`vars.LIFE_EDITOR_TZ` 必須（Workers の isolate は UTC 固定で、未設定なら日付ツールが前日を返すため、`worker.ts` が例外にする）
- **道具の失敗は `mcp-server/src/errorCodes.ts` の code を付けて投げる**: 引数の誤りは `invalidArguments()`、見つからないは `notFoundError()`、許可されないは `CodedError("forbidden", …)`。素の `Error` は code が `failed` になり、呼び手が文面を読んで分岐するしかなくなる。code は `structuredContent.code` に載り、文面は変わらない。
- **ツールを足したら `cd mcp-server && npm run catalog` を回す**: Settings の AI 連携カードはビルド時生成の `shared/src/generated/mcpToolCatalog.json` を読む。shared から registry を直 import すると handler 経由で Supabase クライアントがフロントのバンドルに混入するため、パッケージ境界をデータで跨ぐ。再生成漏れは `mcp-server/tests/toolCatalogFreshness.test.ts` が落ちて気付ける
- `claude`（Claude Code）起動で MCP 自動接続（起動導線だったアプリ内ターミナルは退役 → §8）。**常設の起動導線は Desktop 殻にある**: サイドバー下部の常設行と Settings の AI 連携カードのどちらからでも、Settings のパス欄で指定したフォルダを起動ディレクトリにして素の `claude` を立てる（プロンプトは渡さない。根拠 = [起動導線の置き場・起動形態・起動フォルダの決定](./decisions/D-20260831-settings-1.md)）

## 6. Coding Standards

- **詳細規約 = [`.claude/rules/frontend.md`](./rules/frontend.md)**（path-scoped: `shared/src/**` / `web/src/**` を扱う時のみ自動ロード）: Provider 順序 / Pattern A / 配置表 / デザイン規約 / IME 等の gotcha
- 不変式の要約: `lumen-*` トークン必須（色ハードコード禁止）/ i18n は props 経由・en / ja 両 catalog / DataService はコールバック注入 / 主要 UI 背景に透明度禁止
- TypeScript は、export する関数とコンポーネントの戻り値の型を明示する（公開 API の型を推論に任せない。strict は各パッケージの tsconfig が守る）
- **新規 UI は `shared/src/components/` に集約**（[UI 部品を shared/ に集める決定](./decisions/D-20260607-main-1.md) → `docs/vision/coding-principles.md §6`）
- **Web/Mobile UI デザインの追跡の元 = Epic #321 + [`docs/requirements/mobile-scope.md`](./docs/requirements/mobile-scope.md) + Issue 群**（[追跡の元を付け替える決定](./decisions/D-20260730-tags-1.md)）。ClaudeDesign の brief の作り方だけは [`archive/2026-07-04-claudedesign-screen-design-fanout.md`](./archive/2026-07-04-claudedesign-screen-design-fanout.md) を見る

## 7. Development Workflows

### 7.0 ワークフロー = スキル / エージェント（手順の元）

手順は本ファイルに書かず委譲する。**実装タスクの起点は `lead-pipeline` スキル**（軽 = 直接 / 中 = verifier → tracker / 重 = フルチェーン）。各スキルの説明文は自動で読まれるため、ここには説明文から読み取れない規律だけを置く。

- **役割分担 = `role-pm` → `role-engineer` → `role-qa`**: メインが Agent ツールで順に起動する（サブエージェントからの再帰起動は禁止）
- **commit 前は `session-verifier`、作業の区切りで `task-tracker`** を必ず通す
- **worktree / ブランチ運用 = 共通の `worktree-policy` スキル**（§7.4 は life-editor だけの決まり）／ **Issue 起票 = 共通の `issue-dispatch` スキル**、**docs 運用 = `docs-workflow` スキル**（§9 は要約のみ）／ **PR の merge = 共通の `merge-round` スキル**（§7.2）
- **整合監査 = `life-editor-migration-validator` / `life-editor-sync-auditor`**（`-ipc-validator` は Tauri IPC 前提のため退役 = [退役の決定](./decisions/D-20260708-main-1.md)）
- **共通の道具は claude-dotfiles のものを使い、claude-dotfiles を入れた PC だけで作業する**（2026-11-15 の決定 = [`decisions/2026-11-15-use-shared-tools-on-dotfiles-pcs.md`](./decisions/2026-11-15-use-shared-tools-on-dotfiles-pcs.md)）: `merge-round`・`worktree-policy`・`issue-dispatch`・`issue-workflow` と hook はリポジトリに置かない。claude-dotfiles の無い PC・クラウドのセッション・clone では commit・起票・merge を止める hook が動かず、`permissions.deny` だけが残るので、別の PC では先に claude-dotfiles の `install.mjs` を流す
- **プロジェクト固有のスキル / エージェントの実体は repo 内に置く**（[known-issues 031](./docs/known-issues/031-mac-only-symlinked-skills-agents.md)）: `.claude/skills/` と `.claude/agents/` に **repo 外を指す symlink を作らない**（旧 `skill-lib` / `agents-lib` 参照は Windows で解決できず空振りしていた）
- **ツール実行ハング（応答停止）**: 原因は Claude Code 本体の SSE バグでローカルはシロ（詳細 = `~/.claude/docs/bash-tool-stability.md`）。**運用既定 = 状態変更・複数行系の Bash（git 操作 / build / test / install / コマンド連結）はサブエージェント or background 経由、単発の軽い読み取り（ls / git status / 単発 grep）は直接実行**
- **open bug の確認** = `gh issue list -R sunbreak-pro/life-editor --label type:bug`（過去知見は `--state closed --search` と `docs/known-issues/` grep）

### 7.1 開発コマンド

> 生きている本流は `shared/`（コード本体）+ `web/`（renderer）。旧 `frontend/` は削除済み。

**PR 前に回すゲートの元は [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)** — `verify` ジョブのステップ列（shared → web → desktop → mcp-server の順）と `docs-lint` ジョブがすべて。**ここにコマンドを列挙しない**（[列挙をやめる決定](./decisions/D-20260816-main-2.md)）: 手で写した表は必ず CI から遅れ、「ローカル全緑・CI だけ赤」を生むため。

回し方 = **`node scripts/local-ci.mjs`**（#2349）。`ci.yml` を実行時に読み、`docs-lint` と `verify` の全ステップを各 `working-directory` で回してステップごとの終了コード表を出す（コマンドを持たないので CI と食い違わない。`--list` で読み取り結果だけ確認 / `--skip-install` で `npm ci` を飛ばせる）。手で回すなら `verify` ジョブを上から読み、各ステップの `working-directory` へ `cd` して同じ `npm run <script>` を打つ。**触ったパッケージだけでなく全部回す** — 依存が shared → web → desktop / mcp-server と一方向に繋がっており、`shared/` の変更だけで下流 3 つが落ちる。CI に無いローカル起動だけ別記: `cd web && npm run dev`（vite）。

コマンド名からは読み取れない罠:

- **`build` はテストファイルを見ず、`vitest` は型を見ない**。両方緑でも `typecheck:tests`（shared / web の独立ゲート）だけが赤くなる — 実装を触っていなくてもテストの型は壊れる
- **`web` の lint は `web/` 配下しか歩かない**ので、`shared/` に入れた lint error は `cd shared && npm run lint` でしか出ない（2026-07-30 PR #488 で CI だけが落ちた）
- `web/tsconfig.json` が `../shared` を参照するため、`cd web && npm run build` は shared も **web 側の tsc** で検査する。片方だけ緑でも安心しない
- `scripts/docs-lint.sh` をローカルで回すときは `LC_ALL=C` を付ける（Git Bash の grep 3.0 + UTF-8 locale では日本語を含む Status 行が偽陽性になる）
- **ゲートをまとめて回すラッパーを書くなら、`( npm run X | tail )` で終了コードを取らない**（2026-09-02 実測）: 括弧の終了コードは中の**最後のコマンド = `tail`** のものになるので、`npm run` が何本エラーを吐いても常に 0 が返る。エラー本文は画面に出るのに集計行だけが緑になり、PR #1424 / #1433 が「ローカル全緑」の報告のまま CI で落ちた。**出力を先に変数へ取り、`code=$?` を見てから `tail` で表示する**（`set -o pipefail` でも可）。`tsc -b` の `.tsbuildinfo` のキャッシュは原因ではない（#1436 の見立ては誤り）— 温まった状態で import を壊しても `tsc -b` は exit 1 する（実測）

`web/tests/` は jsdom に**レイアウトが無い**（要素の座標がすべて 0）。ProseMirror の `posAtCoords` のように画面座標を文書位置へ戻す経路はここでは検証できないので、UI の入力経路は座標に依存しない形（DOM イベント + `closest()` 等）で組む — 座標依存のままにするとテストが書けず、#475 のように壊れても気付けない。

起動・配布コマンドの詳細は移行 SSOT を参照（Tauri 時代の `cargo tauri dev` 等は廃止）。

### 7.2 コミット規約

`<type>: <subject>` — type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`（詳細・破壊的操作の境界は `git-workflow` スキル）

- **本文の行頭 `#` は git に無警告で捨てられる**（`core.commentChar` 既定 = `#`）。Issue 番号で行を始めず、`git commit -F` には `--cleanup=verbatim` を付ける（[known-issues 032](./docs/known-issues/032-git-commit-message-hash-line-dropped.md)）

- **merge は [`POLICY.md`](./comm/decisions/POLICY.md) の方針「merge と main への取り込み」に従う**（[共通の merge の決まりに合わせる決定](./decisions/2026-11-15-adopt-shared-merge-rules.md)）。条件を満たした PR は、メインのチャットか仕上げ役 `work-finishers` が、共通の **`merge-round` スキル**で 1 本ずつ入れる（コマンドの形は `merge-round.mjs check <n>` が表示する）。担当の worktree と無人の実行は merge しない。承認が要る種類（設定・hook・秘密の値・データベースなど）の PR は共通の hook が止め、メインのチャットが回す merge-round で、こうだいさんがその場で決める

- **PR 本文は `Refs #N`。`Closes` / `Fixes` / `Resolves` を使わない**（#2349）: merge で Issue が勝手に close されると、実ブラウザ確認や db push が残っていても完了に見える。close は確認が済んだあとにユーザーか chat-main が手で行う
- **1 Issue = 1 ブランチ = 1 PR**（#2349）: 複数 Issue を 1 本にまとめず、1 本の PR に別 Issue の変更を混ぜない。ブランチ名に Issue 番号を入れる（`claude/<slug>-<issue>`）

### 7.3 Plan Gate Convention

新規・大改訂の計画書は [`docs/vision/plans/_TEMPLATE.md`](./docs/vision/plans/_TEMPLATE.md) ベースで以下を必須とする:

- **Scope 宣言**（触ってよいパス）・**Gate 列**（🤖 自律 / 👀 目視 / 🛑 人手 = DDL push・シークレット投入・PR merge・本番デプロイ）・**機械検証可能な Acceptance Criteria**
- DDL は「ローカルファイル先行 → ユーザー `supabase db push`」（**`apply_migration` MCP 単独使用禁止**）。`Bash(supabase db push*)` は `permissions.ask` に入れて機械側でも担保済み（#2349）
- **反映済み（db push 済み）のマイグレーションは中身も編集しない。直すときは次の番号で新しいファイルを足す**（#2349）: 反映済みの履歴を書き換えると、本番の実態とファイルが静かに食い違う。空白やコメントの整形も対象。反映済みかどうかは `supabase migration list` で見る。番号の衝突は PR 巡回で `origin/main` と突き合わせる
- hooks 連動: hook はこのリポジトリに置かず、claude-dotfiles の共通の 2 本を使う（登録は claude-dotfiles の `claude/settings.json`）。SessionStart の `project-session-start.mjs` が進捗の索引を作り直し、`.session-name` / `.session-branch` の食い違いを警告する。PreToolUse(Bash) の `bash-guards.mjs` が、`.mcp.json` のトークンの平文、生成物 `INDEX.md` の commit 混入、tracker の更新と実装の同梱（逃がし道は `[tracker-ok]`）、main 以外の `gh issue create`、条件の欠けた merge のコマンドを止める。どちらも `.claude/issue-workflow.md` の設定値を、main の checkout から読む。`.claude/settings.json` に残す hook は、決定の索引を作る `records.mjs index` の 1 本だけ

### 7.4 Multi-chat Worktree Policy（要約 — 手順は共通の `worktree-policy` スキル）

**"1 chat = 1 worktree、ブランチは課題ごとに切替"**。置き場・作り方・ブランチの切り替え・main の取り込み・merge 済みの判定・消し方は、共通の `worktree-policy` スキルに従う — **worktree に触る前に必ず開く**。既知制約・prune 手順と、life-editor だけの決まり（臨時の worktree を並べない、Orca のターミナルが掴んだ worktree の消し方）は [`2026-05-24-multi-chat-worktree-policy.md`](./docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md)。

知らないと事故る禁止事項だけここに残す:

- **メイン（リポジトリ直下）は chat-main 専有・`main` のみ。`git checkout <feature>` 禁止** — feature 作業は worktree から
- **着手前と PR 前に `node ~/.claude/skills/worktree-policy/scripts/scope-overlap.mjs` を打つ** — 同じファイルを動いている別の PR・別の worktree が触っていると、並列の PR は必ず衝突する。BLOCK が出たら直列にする。担当表の唯一の元 = [`.claude/scripts/lane-ownership.json`](./scripts/lane-ownership.json)（設定の `workspaceMapPath`）。main の checkout は持ち主の名前 `main` で数える
- **worktree はリポジトリの外**（設定の `worktreeRoot` = `../workspaces/life-editor` の下の `<slug>/`）に**絶対パスで**作る — 相対パスは cwd 基準で解決され、リポジトリ内にネストした worktree ができる
- **worktree が `Permission denied` で消えないとき** — 掴んでいるのが Orca のターミナルなら、`orca terminal list --json` で handle を探し、`orca terminal close --terminal <handle>` で閉じてから消す
- **`.claude/comm/.session-branch` と `.session-name` はブランチを切り替えるたびに書き換える** — 抜けると、共通の hook がセッションの最初に名前とブランチの食い違いを警告する。Orca の画面で作った worktree は書かれないので、Claude Code を起動する前に手で書く
- **tracker（`memory/` + `history/`）の更新を実装ブランチに載せない**（[tracker を分ける決定](./decisions/D-20260801-main-1.md)）— 並行ブランチが必ず衝突するため。PR 本文側に要約を書き、tracker は専用ブランチ `chore/tracker-<chat>-YYYYMMDD` に分ける。**実行は `session-verifier` が緑になった直後**で、実装 PR の merge を待たない（[実行の時期の決定](./decisions/D-20260810-main-1.md)）。**`.claude/comm/outbox/` も同じ扱い**（実装 PR に載せず別枠 = [outbox を分ける決定](./decisions/D-20260802-sched-1.md)）
- **マージ済み判定は `gh pr list --json number,state,headRefName` の state**。`git diff` / `git log` / `git cherry` は、設定の `mergeMethod`（`.claude/issue-workflow.md`）で 1 つの commit にまとめて入れた PR を「未マージ」と誤判定する
- **playwright MCP（実ブラウザ検証）と dev server は chat-main のみ**で起動する（ポート重複で確認が壊れるため）。worktree 側は build / 型検証まで。例外は chat-main のサブエージェント `work-finishers` の動作確認で、1 度に 1 本、固定のポートで `wf-*` の worktree に dev server を立て、終わったら止める（手順 = `.claude/issue-workflow.md` の「動作確認」）

## 8. Feature Tier Map（詳細 → `docs/requirements/`）

- **Tier 1 コア**: [`tier-1-core.md`](./docs/requirements/tier-1-core.md) — Briefing / Todos / Schedule / Notes / Daily / MCP Server / Cloud Sync。Briefing は目標と Todo をつなぐ朝刊・夕刊。退役した Terminal と凍結した汎用 Database は、本文を履歴として残す
- **Tier 2 補助**: [`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md) — WikiTags / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Connect（Tag hub）/ Trash。Trash の入口は Settings の中で、nav の独立セクションではない。タグの編集所は Connect で、Connect の力学グラフは復活させない（検索・タグ・リンク一覧と役割が重なったため）。File Explorer と、Work 画面とともに外した Audio / Playlist / Pomodoro と、#2720 で外した拡張アプリの Apps は退役し、本文を履歴として残す
- **Tier 3 実験 / 凍結**: [`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md) — Paper Boards / NotebookLM / Google Calendar / Google Drive / Cognitive Architecture。Analytics は #2754 でセクションごと消し、朝刊の右パネルの Todo 完了の推移だけを残した（本文は履歴として残す）
- 退役・移設・凍結の経緯と決定の記録のパスは、各 tier のファイルの機能の節にある
- 次の段階の計画は移行の計画書が元になる文書（残す知見の置き場 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)）

## 9. Document System（要約 — 元は `docs-workflow` スキル）

Issue のラベル routing（`section:<id>` / `shared-fix`）・`[all]` 禁止則・plans のライフサイクル・comm / decisions の運用は [`skills/docs-workflow/SKILL.md`](./skills/docs-workflow/SKILL.md) が元になる文書。**docs を書く / Issue を起票する前に開く**。

- **進捗 / 履歴は per-chat**: `.claude/memory/chat-<self>.md` + `.claude/history/chat-<self>.md`（task-tracker 経由・git 追跡・単一書込者）。集約 INDEX は git 非追跡の派生ビュー（共通の hook `project-session-start.mjs` が再生成）。チャット名宣言 = `.claude/comm/.session-name`
- **課題追跡の正 = GitHub Issues + Projects**（`gh -R sunbreak-pro/life-editor`）。**起票は chat-main に一元化**する — worktree チャットは実装に着手してよいが、自分で起票せず outbox に依頼を append する。設定の `issueCreation` が `main-only` なので、共通の hook が main 以外の `gh issue create` を止める
- **Issue はプロダクト課題専用**。判定 = 「life-editor のコードを直せば直るか？」— No（Claude Code の環境 / hook / ツール挙動）なら Issue 化せず `docs/known-issues/` + `rules/` で管理する
- **実装プラン**の置き場と書き方は共通の `code-plan-editor` スキルに従い、完了で `archive/` へ移動する（Status enum の語彙 → [`rules/docs-consistency.md`](./rules/docs-consistency.md)）。移行 SSOT のみ `.claude/` 直下に置く例外。**決定の Why・却下案 = [`decisions/`](./decisions/README.md) 台帳**（[台帳を作る決定](./decisions/D-20260809-main-1.md)。どこに書くかの判定 = `rules/records.md`）
- **鉄則**: 機能追加 / 削除時は §8 更新 ／ バイナリは repo に置かない — ノートの添付は **非公開**バケット `attachments` から（#1404。ドキュメントはパスだけを持ち URL は毎回署名する — `shared/src/constants/attachments.ts`）。`.gitignore` の機械ガードは無い／ API キーをフロントエンドに直書きしない ／ **`.mcp.json` のトークンは `${SUPABASE_ACCESS_TOKEN}` 等の参照のまま維持・平文展開禁止**（2026-05-17 流出未遂。共通の hook `bash-guards.mjs` が commit 時に機械チェック）
