# CLAUDE.md — Life Editor 統合定義書

> 設計判断・実装規約の SSOT。**「変わらない事実」だけを持ち、手順はスキル / エージェント、frontend 詳細規約は [`.claude/rules/`](./rules/) へ委譲**。各行は「消したら Claude が間違うか」基準で維持する（150 行目標）。
>
> ⚠️ **Active Migration**: Tauri 2 + D1 + portable-pty → **Electron + Capacitor + Web + Supabase** へ移行中。**現行スタック・Phase 状況・移行手順の SSOT は [`2026-05-04-cross-platform-migration.md`](./2026-05-04-cross-platform-migration.md) と `memory/INDEX.md`** (進捗 / 履歴は per-chat — §9 参照)。本ファイルの実装パス/コマンドはアーキ非依存に一般化済み（具体は移行 SSOT 参照）。方針: 学習ログ廃止 / 完成までコスト $0 厳守。

---

## 0. Meta

- **更新規則**: 実装変更はコードと同一 PR で更新。新機能は §8 + `docs/requirements/` に記入
- **数値の非複製原則**: 個数・列挙は単一の正本（コード or SSOT）だけに書き、他文書は参照にする。「一覧はコードが正」と書くなら数字を併記しない。改名・退役時の波及手順は [`rules/docs-consistency.md`](./rules/docs-consistency.md)
- **再編中（航法 / 目的の 2 層）**: 各節をどちらの層に置き、層外の記述をどこへ移すかは [`docs/vision/claude-md-layering.md`](./docs/vision/claude-md-layering.md) が正本（固定費の実測 = [`docs/reports/2026-08-06-context-fixed-cost-baseline.md`](./docs/reports/2026-08-06-context-fixed-cost-baseline.md)）。**移送は移行完了後**のため、それまで本ファイルの構成は現状維持（D-20260806-main-3）
- **関連**: 記録の入口 = [`INDEX.md`](./INDEX.md)（`records.mjs` 生成・git 追跡）・進捗 / 履歴 = per-chat `chat-*.md`（§9。集約 `memory/INDEX.md` / `history/INDEX.md` は git 非追跡の派生ビュー）・設計 = `docs/vision/`・要件 = `docs/requirements/`・障害知見 = [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md)・完了プラン = `archive/`

## 1. Vision（詳細 → [`docs/vision/core.md`](./docs/vision/core.md)）

- AI と会話しながら生活を設計・記録・運用するパーソナル OS。ユーザーは作者本人のみ（N=1、macOS + iOS）
- **Non-Goals**: マルチテナント / 特化専用アプリ / Claude API 直課金 / モバイル単独起動

## 2. Platform

- Desktop（macOS / Windows / Linux）= 全機能。Mobile（iOS / Android）= Consumption + Quick capture。MCP は Desktop 専用（Terminal は 2026-07-05 に機能ごと退役決定 = D-20260705-main-1 → §8。MCP Server 自体は存続）
- **画面別 Mobile スコープの正本 = [`docs/requirements/mobile-scope.md`](./docs/requirements/mobile-scope.md)**（#319 でユーザー確定 = D-20260723-main-1）: 各セクション内機能の Full / Consumption / Quick capture / 省略 と Phase 1/2 の段取り。§2 は大方針のみを持ち、画面別の取捨は同文書が正（数値の非複製原則）
- **Mobile 省略ガードは配線済み**（#320）: `mobile/` は `web/dist` を包む Capacitor 殻で独自 Provider 構成を持たず、web ホストが `isNativeMobile()` で native mobile 時に ShortcutConfig Provider を省略する。Audio は Provider 維持（完了チャイム = work タイマー Full の一部 — mobile-scope.md #10/#11）で Ambient mixer UI のみ native 省略（ScreenLock / FileExplorer / CalendarTags は Provider ごと撤去済みで対象外）。実装状況とネストの正本はコード（`web/src/MainScreen.tsx`）・規約は [`rules/frontend.md`](./rules/frontend.md) §Provider 順序
- **スマホからの主導線 = 公開 Web URL**（#600・2026-08-07 ユーザー確定 = D-20260807-main-1）: モバイル UI は画面幅（`useMediaQuery`）で出るため、ブラウザで開けば Capacitor 殻と同じ画面になる。ネイティブ殻は併存。PWA の採用範囲・配布経路 → 移行 SSOT §8 / §9
- Cloud Sync = 作者本人のみ（友達ビルドは feature flag で無効）。配布・署名 → 移行 SSOT

## 3. Architecture（恒久原則のみ。構成図 → 移行 SSOT）

- **3.1 DataService 境界（不変式）**: フロントは `getDataService()` 経由でのみデータアクセス。**コンポーネントから直接バックエンド呼び出し（`invoke()` 等）禁止**。実装 = `shared/src/services/`（旧 `frontend/` は 2026-07-11 削除 #197・復元 = git tag `pre-tauri-removal`）。バックエンドが替わってもこの境界は不変
- **3.2 Section Routing**: React Router なし。`web/src/MainScreen.tsx` の section state で切替（旧 frontend は `App.tsx::activeSection`）。セクション定義（`SectionId`・nav 順・グループ・アイコン・mobile 順）は **`shared/src/sections.ts` の registry が SSOT**（`types/taskTree.ts::SectionId` は registry 派生の再 export・一覧はコードが正）。旧 `terminal` セクションは SectionId / nav / i18n から除去済み（#146・退役の経緯 → §8）
- **3.3 Sync**: `items_meta.updated_at` を LWW cursor とする 2 行分割モデル。`<role>_payload` は `updated_at` を持たない（詳細 → [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) §10）。「全テーブルに version カラム」は旧 Tauri 時代の遺物で未使用
- **gotcha**: `AudioContext` は `suspended` 開始 — ユーザー操作後に `resume()` 必須

## 4. Data Model（規約詳細 → `docs/vision/db-conventions.md` / 変更手順 → `db-migration` スキル = Mac のみ実体・[known-issues 031](./docs/known-issues/031-mac-only-symlinked-skills-agents.md)）

- 約 20 テーブル（`items_meta` + `<role>_payload` モデル・移行済みドメインのみ。ドメイン一覧はコード / db-conventions が正）
- **特化 vs 汎用 DB の判断**: 特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が必要 → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database
- **ID 不変式**: TaskNode `<type>-<timestamp+counter>` / DailyNode `daily-<YYYY-MM-DD>` / 他 `generateId(prefix)`。全 String。`id` は role を跨いで一意
- **items_meta + composite FK**: 5 role（task / event / routine / note / daily）は `items_meta(id, role)` が SSOT、payload テーブルは `(id, role)` 複合 FK で参照。WikiTag / Link 系は role 区別なしで `items_meta.id` を参照
- **Routine**: Event の生成テンプレート。Routine 専用 Tag/Link UI は持たない（必要なら生成された Event 側に付与）。UI 上は「単一アイテム型（Event）+ 繰り返し設定」として提示し、Routine は実装詳細（2026-07-11 #185 決定 = D-20260711-main-1）
- **ソフトデリート**: `is_deleted` + `deleted_at` → TrashView 復元。対象: Tasks / Notes / Dailies / Routines / Databases / Templates
- PropertyType 実装済み: text / number / select / date / checkbox。汎用 DB は MCP 未対応（新型追加時に MCP ツールも整備）

## 5. AI Integration

- MCP Server = 独立 Node.js プロセス。Claude Code が stdio 接続し同一 DB を直接操作（ツール一覧はコードが正）
- `claude`（Claude Code）起動で MCP 自動接続（MCP Server は存続。起動導線だったアプリ内ターミナルは 2026-07-05 退役決定 = D-20260705-main-1 → §8。退役後の常設起動導線は生成デザイン確定後に再設計）

## 6. Coding Standards

- **詳細規約 = [`.claude/rules/frontend.md`](./rules/frontend.md)**（path-scoped: `shared/src/**` / `web/src/**` を扱う時のみ自動ロード）: Provider 順序 / Pattern A / 配置表 / デザイン規約 / IME 等の gotcha
- 不変式の要約: `lumen-*` トークン必須（色ハードコード禁止）/ i18n は props 経由・en / ja 両 catalog / DataService はコールバック注入 / 主要 UI 背景に透明度禁止
- **新規 UI は `shared/src/components/` に集約**（W0 案 A = D-20260607-main-1 → `docs/vision/coding-principles.md §6`。旧 `frontend/` は 2026-07-11 削除済み #197）
- **Web/Mobile UI デザインの追跡正本 = Epic #321 + [`docs/requirements/mobile-scope.md`](./docs/requirements/mobile-scope.md) + Issue 群**（2026-08-01 ユーザー確定 D-20260730-tags-1）。旧 W-parity ロードマップ（#121/#127）と ClaudeDesign fan-out 計画書はどちらも完了・`archive/` 済（[`archive/2026-07-04-claudedesign-screen-design-fanout.md`](./archive/2026-07-04-claudedesign-screen-design-fanout.md) — brief 作成手順の参照元としてのみ有効）

## 7. Development Workflows

### 7.0 ワークフロー = スキル / エージェント（手順の正本）

手順は本ファイルに書かず委譲する。**実装タスクの起点は `lead-pipeline` スキル**（軽 = 直接 / 中 = verifier → tracker / 重 = フルチェーン）。各スキルの説明文は自動で読まれるため、ここには説明文から読み取れない規律だけを置く。

- **役割分担 = `role-pm` → `role-engineer` → `role-qa`**: メインが Agent ツールで順に起動する（サブエージェントからの再帰起動は禁止）
- **commit 前は `session-verifier`、作業の区切りで `task-tracker`** を必ず通す
- **worktree / ブランチ運用 = `worktree-policy` スキル**（§7.4 は要約のみ）／ **Issue 起票・docs 運用 = `docs-workflow` スキル**（§9 は要約のみ）
- **整合監査 = `life-editor-migration-validator` / `life-editor-sync-auditor`**（**Mac のみ実体** — Windows では解決不能 = [known-issues 031](./docs/known-issues/031-mac-only-symlinked-skills-agents.md)。`-ipc-validator` は Tauri IPC 前提のため 2026-07-08 retire = D-20260708-main-1）
- **ツール実行ハング（応答停止）**: 原因は Claude Code 本体の SSE バグでローカルはシロ（詳細 = `~/.claude/rules/bash-tool-stability.md`）。**運用既定 = 状態変更・複数行系の Bash（git 操作 / build / test / install / コマンド連結）はサブエージェント or background 経由、単発の軽い読み取り（ls / git status / 単発 grep）は直接実行**
- **open bug の確認** = `gh issue list -R sunbreak-pro/life-editor --label type:bug`（過去知見は `--state closed --search` と `docs/known-issues/` grep）

### 7.1 開発コマンド

> 生きている本流は `shared/`（コード本体）+ `web/`（renderer）。旧 `frontend/` は削除済み（2026-07-11 #197）。

```bash
cd shared && npm run lint       # eslint（CI ゲート — react-hooks 系は error）
cd shared && npm run test       # vitest（本体ロジック / mapper）
cd shared && npm run build      # 型検証 + dist 出力（tsc -b）
cd web && npm run lint          # eslint（CI ゲート）
cd web && npm run build         # web 型検証 + ビルド（tsc -b --force && vite build）
cd web && npm run test          # vitest（renderer 側 — jsdom。#475 で追加）
cd desktop && npm run typecheck # tsc --noEmit（CI ゲート。desktop/ を触った時のみ — #529）
cd desktop && npm run build     # electron-vite build（同上。web の install/build が前提）
cd web && npm run dev           # ローカル起動（vite）
```

PR 前は上のブロックの **lint / build / test をすべて**回す（`dev` 以外）。ゲート一覧の正本は `.github/workflows/ci.yml`（docs-lint は CI 専用ジョブ）。**`web` の lint は `web/` 配下しか歩かない**ので、`shared/` に入れた lint error は `cd shared && npm run lint` でしか出ない（2026-07-30 PR #488 で実際に CI だけが落ちた）。同様に **TypeScript の版が web だけ違う**（web = 6.x / shared・desktop = 5.6）: `web/tsconfig.json` が `../shared` を参照しているため `cd web && npm run build` は shared を **web 側の tsc** で検査する。片方だけ緑でも安心せず両方回す。`scripts/docs-lint.sh` をローカルで回すときは `LC_ALL=C` を付ける（Git Bash の grep 3.0 + UTF-8 locale では日本語を含む Status 行が偽陽性になる）。

`web/tests/` は jsdom に**レイアウトが無い**（要素の座標がすべて 0）。ProseMirror の `posAtCoords` のように画面座標を文書位置へ戻す経路はここでは検証できないので、UI の入力経路は座標に依存しない形（DOM イベント + `closest()` 等）で組む — 座標依存のままにするとテストが書けず、#475 のように壊れても気付けない。

起動・配布コマンドの詳細は移行 SSOT を参照（Tauri 時代の `cargo tauri dev` 等は廃止）。

### 7.2 コミット規約

`<type>: <subject>` — type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`（詳細・破壊的操作の境界は `git-workflow` スキル）

- **`git-workflow` §0.1.1（PR の自動マージ）は life-editor では適用しない**（2026-08-06 ユーザー確定 D-20260806-main-1 = B）。同スキルは「全プロジェクト共通」と書いているが、本プロジェクトは POLICY **P-001「merge と main への取り込みは常にユーザー」を優先**する。`Bash(gh pr merge*)` は `permissions.ask` に入れて機械側でも担保済み — Claude は条件が揃っても自分で merge しない

### 7.3 Plan Gate Convention

新規・大改訂の計画書は [`docs/vision/plans/_TEMPLATE.md`](./docs/vision/plans/_TEMPLATE.md) ベースで以下を必須とする:

- **Scope 宣言**（触ってよいパス）・**Gate 列**（🤖 自律 / 👀 目視 / 🛑 人手 = DDL push・シークレット投入・PR merge・本番デプロイ）・**機械検証可能な Acceptance Criteria**
- DDL は「ローカルファイル先行 → ユーザー `supabase db push`」（**`apply_migration` MCP 単独使用禁止**）
- hooks 連動（検査内容の正本 = 各スクリプト。登録 = `.claude/settings.json`・全 hook `${CLAUDE_PROJECT_DIR}` 相対で worktree 側の実体が走る）: SessionStart = `hooks/regen-index.sh`（INDEX 派生ビュー再生成）+ `hooks/session-start-check.sh`（informational only）/ PreToolUse(Bash) = `hooks/pre-commit-mcp-check.sh`（トークン平文検知）+ `hooks/pre-commit-index-guard.sh`（derived INDEX の commit 混入を自動除外）+ `hooks/pre-commit-tracker-guard.sh`（tracker の更新を実装コミットに混ぜたらブロック = D-20260801-main-1・逃がし道は `[tracker-ok]`）

### 7.4 Multi-chat Worktree Policy（要約 — 正本は `worktree-policy` スキル）

**"1 chat = 1 worktree、ブランチは課題ごとに切替"**。手順（新規作成 4 ステップ / ブランチ切替 2 ステップ / main 取り込み / 初回 push / Windows での削除 / Orca ADE 例外）と各規約の理由・実測エピソードは [`skills/worktree-policy/SKILL.md`](./skills/worktree-policy/SKILL.md) が正本 — **worktree に触る前に必ず開く**。既知制約と prune 手順は [`2026-05-24-multi-chat-worktree-policy.md`](./docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md)。

知らないと事故る禁止事項だけここに残す:

- **メイン（リポジトリ直下）は chat-main 専有・`main` のみ。`git checkout <feature>` 禁止** — feature 作業は worktree から
- **worktree はリポジトリの外**（`<repos-parent>/workspaces/life-editor/<slug>/`）に**絶対パスで**作る — 相対パスは cwd 基準で解決され、リポジトリ内にネストした worktree ができる
- **`.claude/comm/.session-branch` はブランチを切り替えるたびに書き換える** — 抜けると hook が無音スキップし、監査が「宣言と実態の不一致」と誤判定する
- **tracker（`memory/` + `history/`）の更新を実装ブランチに載せない**（2026-08-01 D-20260801-main-1）— 並行ブランチが必ず衝突する。merge 後に 1 commit でまとめ、PR 本文側に要約を書く
- **マージ済み判定は `gh pr list --json number,state,headRefName` の state**。`git diff` / `git log` / `git cherry` は squash merge を「未マージ」と誤判定する
- **playwright MCP（実ブラウザ検証）と dev server は chat-main のみ**で起動する（ポート重複で確認が壊れるため）。worktree 側は build / 型検証まで

## 8. Feature Tier Map（詳細 → `docs/requirements/`）

- **Tier 1 コア**（7）: [`tier-1-core.md`](./docs/requirements/tier-1-core.md) — Briefing / Tasks / Schedule / Notes / Daily / MCP Server / Cloud Sync（Briefing の正本 = [`2026-07-15-briefing-loop.md`](./docs/vision/plans/2026-07-15-briefing-loop.md)・requirements 節 = tier-1-core.md §Briefing / Terminal は 2026-07-05 に機能ごと退役 = ユーザー決定 D-20260705-main-1・tier-1-core は本文を履歴として保持 / 汎用 Database は一旦凍結 = Phase 5-A 決定 D-20260704-main-1・requirements 本体は保持）
- **Tier 2 補助**（11）: [`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md) — Audio / Playlist / Pomodoro / WikiTags / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash（File Explorer は退役 = Phase 5-A 決定 D-20260704-main-1・requirements 本体は保持）
- **Tier 3 実験 / 凍結**（6）: [`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md) — Paper Boards / Analytics / NotebookLM / Google Calendar / Google Drive / Cognitive Architecture
- 次フェーズ計画は移行 SSOT が正本（恒久知見の保全先 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)）

## 9. Document System（要約 — 正本は `docs-workflow` スキル）

Issue のラベル routing（`section:<id>` / `shared-fix`）・`[all]` 禁止則・plans のライフサイクル・comm / decisions の運用は [`skills/docs-workflow/SKILL.md`](./skills/docs-workflow/SKILL.md) が正本。**docs を書く / Issue を起票する前に開く**。

- **進捗 / 履歴は per-chat**: `.claude/memory/chat-<self>.md` + `.claude/history/chat-<self>.md`（task-tracker 経由・git 追跡・単一書込者）。集約 INDEX は git 非追跡の派生ビュー（`hooks/regen-index.sh` が再生成）。チャット名宣言 = `.claude/comm/.session-name`
- **課題追跡の正 = GitHub Issues + Projects**（`gh -R sunbreak-pro/life-editor`）。**起票は chat-main に一元化**する — worktree チャットは実装に着手してよいが、自分で起票せず outbox に依頼を append する
- **Issue はプロダクト課題専用**。判定 = 「life-editor のコードを直せば直るか？」— No（Claude Code の環境 / hook / ツール挙動）なら Issue 化せず `docs/known-issues/` + `rules/` で管理する
- **実装プラン** = `docs/vision/plans/YYYY-MM-DD-<slug>.md` → 完了で `archive/` へ移動（Status enum の語彙 → [`rules/docs-consistency.md`](./rules/docs-consistency.md)）。移行 SSOT のみ `.claude/` 直下に置く例外。**決定の Why・却下案 = [`decisions/`](./decisions/README.md) 台帳**（回答済みキューを昇格・旧「ADR は作らない」は D-20260809-main-1 で SUPERSEDE。どこに書くかの判定 = `rules/records.md`）
- **鉄則**: 機能追加 / 削除時は §8 更新 ／ 音源ファイルはコミット禁止（`public/sounds/` は `.gitignore`）／ API キーをフロントエンドに直書きしない ／ **`.mcp.json` のトークンは `${SUPABASE_ACCESS_TOKEN}` 等の参照のまま維持・平文展開禁止**（2026-05-17 流出未遂。`hooks/pre-commit-mcp-check.sh` が commit 時に機械チェック）
