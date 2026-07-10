# CLAUDE.md — Life Editor 統合定義書

> 設計判断・実装規約の SSOT。**「変わらない事実」だけを持ち、手順はスキル / エージェント、frontend 詳細規約は [`.claude/rules/`](./rules/) へ委譲**。各行は「消したら Claude が間違うか」基準で維持する（150 行目標）。
>
> ⚠️ **Active Migration**: Tauri 2 + D1 + portable-pty → **Electron + Capacitor + Web + Supabase** へ移行中。**現行スタック・Phase 状況・移行手順の SSOT は [`2026-05-04-cross-platform-migration.md`](./2026-05-04-cross-platform-migration.md) と `memory/INDEX.md`** (進捗 / 履歴は per-chat — §9 参照)。本ファイルの実装パス/コマンドはアーキ非依存に一般化済み（具体は移行 SSOT 参照）。方針: 学習ログ廃止 / 完成までコスト $0 厳守。

---

## 0. Meta

- **更新規則**: 実装変更はコードと同一 PR で更新。新機能は §8 + `docs/requirements/` に記入
- **数値の非複製原則**: 個数・列挙は単一の正本（コード or SSOT）だけに書き、他文書は参照にする。「一覧はコードが正」と書くなら数字を併記しない。改名・退役時の波及手順は [`rules/docs-consistency.md`](./rules/docs-consistency.md)
- **関連**: 進捗 / 履歴 = [`memory/INDEX.md`](./memory/INDEX.md) / [`history/INDEX.md`](./history/INDEX.md)（git 非追跡の派生ビュー。SSOT は per-chat `chat-*.md` — §9）・設計 = `docs/vision/`・要件 = `docs/requirements/`・障害知見 = [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md)・完了プラン = `archive/`

## 1. Vision（詳細 → [`docs/vision/core.md`](./docs/vision/core.md)）

- AI と会話しながら生活を設計・記録・運用するパーソナル OS。ユーザーは作者本人のみ（N=1、macOS + iOS）
- **Non-Goals**: マルチテナント / 特化専用アプリ / Claude API 直課金 / モバイル単独起動

## 2. Platform

- Desktop（macOS / Windows / Linux）= 全機能。Mobile（iOS / Android）= Consumption + Quick capture。MCP は Desktop 専用（Terminal は 2026-07-05 に機能ごと退役決定 → §8。MCP Server 自体は存続）
- **Mobile 省略 Provider（4 種）**: Audio / ScreenLock / FileExplorer / ShortcutConfig（CalendarTags は DU-F で全プラットフォーム撤去済み。WikiTag / SidebarLinks は Mobile でも有効）
- Cloud Sync = 作者本人のみ（友達ビルドは feature flag で無効）。配布・署名 → 移行 SSOT

## 3. Architecture（恒久原則のみ。構成図 → 移行 SSOT）

- **3.1 DataService 境界（不変式）**: フロントは `getDataService()` 経由でのみデータアクセス。**コンポーネントから直接バックエンド呼び出し（`invoke()` 等）禁止**。実装 = `shared/src/services/`（旧 `frontend/src/services/` は FROZEN）。バックエンドが替わってもこの境界は不変
- **3.2 Section Routing**: React Router なし。`web/src/MainScreen.tsx` の section state で切替（旧 frontend は `App.tsx::activeSection`）。セクション定義（`SectionId`・nav 順・グループ・アイコン・mobile 順）は **`shared/src/sections.ts` の registry が SSOT**（`types/taskTree.ts::SectionId` は registry 派生の再 export・一覧はコードが正）。旧 `terminal` セクションは SectionId / nav / i18n から除去済み（#146・退役の経緯 → §8）
- **3.3 Sync**: `items_meta.updated_at` を LWW cursor とする 2 行分割モデル。`<role>_payload` は `updated_at` を持たない（詳細 → [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) §10）。「全テーブルに version カラム」は旧 Tauri 時代の遺物で未使用
- **gotcha**: `AudioContext` は `suspended` 開始 — ユーザー操作後に `resume()` 必須

## 4. Data Model（規約詳細 → `docs/vision/db-conventions.md` / 変更手順 → `db-migration` スキル）

- 約 20 テーブル（`items_meta` + `<role>_payload` モデル・移行済みドメインのみ。ドメイン一覧はコード / db-conventions が正）
- **特化 vs 汎用 DB の判断**: 特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が必要 → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database
- **ID 不変式**: TaskNode `<type>-<timestamp+counter>` / DailyNode `daily-<YYYY-MM-DD>` / 他 `generateId(prefix)`。全 String。`id` は role を跨いで一意
- **items_meta + composite FK**: 5 role（task / event / routine / note / daily）は `items_meta(id, role)` が SSOT、payload テーブルは `(id, role)` 複合 FK で参照。WikiTag / Link 系は role 区別なしで `items_meta.id` を参照
- **Routine**: Event の生成テンプレート。Routine 専用 Tag/Link UI は持たない（必要なら生成された Event 側に付与）
- **ソフトデリート**: `is_deleted` + `deleted_at` → TrashView 復元。対象: Tasks / Notes / Dailies / Routines / Databases / Templates
- PropertyType 実装済み: text / number / select / date / checkbox。汎用 DB は MCP 未対応（新型追加時に MCP ツールも整備）

## 5. AI Integration

- MCP Server = 独立 Node.js プロセス。Claude Code が stdio 接続し同一 DB を直接操作（ツール一覧はコードが正）
- `claude`（Claude Code）起動で MCP 自動接続（MCP Server は存続。起動導線だったアプリ内ターミナルは 2026-07-05 退役決定 → §8。退役後の常設起動導線は生成デザイン確定後に再設計）

## 6. Coding Standards

- **詳細規約 = [`.claude/rules/frontend.md`](./rules/frontend.md)**（path-scoped: `frontend/src/**` / `shared/src/**` を扱う時のみ自動ロード）: Provider 順序 / Pattern A / 配置表 / デザイン規約 / IME 等の gotcha
- 不変式の要約: `lumen-*` トークン必須（色ハードコード禁止）/ i18n は props 経由・en / ja 両 catalog / DataService はコールバック注入 / 主要 UI 背景に透明度禁止
- **新規 UI は `shared/src/components/` に集約**（`frontend/` は FROZEN — W0 案 A → `docs/vision/coding-principles.md §6`）
- **Web/Mobile UI デザインの追跡正本 = ClaudeDesign fan-out 計画書**（[`docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`](./docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md)）。旧 W-parity ロードマップ（#121/#127）は完了・`archive/` 済でこれに一本化

## 7. Development Workflows

### 7.0 ワークフロー = スキル/エージェント（手順の正本）

手順は本ファイルに書かず、以下に委譲する。**実装タスクの起点は `lead-pipeline` スキル**（ティア判定 → 必要工程を采配）。

| 局面 | 委譲先 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 実装タスク全体の采配 | `lead-pipeline` スキル（軽=直接 / 中=verifier→tracker / 重=フルチェーン） |
| 長時間・並列・条件達成型の実行戦略 | `execution-router` スキル（/goal・/batch・/loop・subagent 判断） |
| 要件分解 / 実装 / 独立監査 | `role-pm` → `role-engineer` → `role-qa`（メインが Agent 起動。再帰禁止） |
| セッション開始/中断/終了 | `session-loader` / `task-tracker` / `session-verifier` |
| 品質ゲート | `session-verifier`（commit 前） |
| 進捗記録 | `task-tracker`（per-chat: `memory/chat-<self>.md` + `history/chat-<self>.md` + INDEX 集約 / legacy fallback あり） |
| 週次開発スケジュール | `schedule-management` スキル（平日30–60分/休日4h+ を Phase・plans から週次ブロック化 → Google Calendar(MCP) ミラー・台帳 `automation/dev-schedule.md` で進捗追跡） |
| branch / PR / merge | `git-workflow` / `git-branch-flow` / `git-conflict-resolver` |
| IPC 追加 | `add-ipc-channel` スキル ／ DB 変更 | `db-migration` スキル |
| デバッグ | `debug-strategy` スキル + open bug は `gh issue list -R sunbreak-pro/life-editor --label type:bug`（過去知見は `--state closed --search` と `docs/known-issues/` grep） |
| ツール実行ハング（応答停止） | [`~/.claude/rules/bash-tool-stability.md`](file:///Users/newlife/.claude/rules/bash-tool-stability.md)（原因=本体 SSE バグ・ローカルはシロ。ESC 復帰 → jsonl 系統判定 → 混雑帯回避。重い Bash は background/subagent に逃がす。**運用既定: 状態変更・複数行系の Bash（git 操作 / build / test / install / コマンド連結）はサブエージェント or background 経由、単発の軽い読み取り（ls / git status / 単発 grep）は直接実行**。詳細切り分けは memory `bash-tool-hang-diagnosis`） |
| life-editor 整合監査 | `life-editor-migration-validator` / `life-editor-sync-auditor`（`-ipc-validator` は Tauri IPC 前提のため 2026-07-08 retire） |

### 7.1 開発コマンド

> 生きている本流は `shared/`（コード本体）+ `web/`（renderer）。旧 `frontend/` は FROZEN（実行しない）。

```bash
cd shared && npm run test       # vitest（本体ロジック / mapper）
cd shared && npm run build      # 型検証 + dist 出力（tsc -b）
cd web && npm run build         # web 型検証 + ビルド（tsc -b --force && vite build）
cd web && npm run dev           # ローカル起動（vite）
```

起動・配布コマンドの詳細は移行 SSOT を参照（Tauri 時代の `cargo tauri dev` 等は廃止）。

### 7.2 コミット規約

`<type>: <subject>` — type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`（詳細・破壊的操作の境界は `git-workflow` スキル）

### 7.3 Plan Gate Convention

新規・大改訂の計画書は [`docs/vision/plans/_TEMPLATE.md`](./docs/vision/plans/_TEMPLATE.md) ベースで以下を必須とする:

- **Scope 宣言**（触ってよいパス）・**Gate 列**（🤖 自律 / 👀 目視 / 🛑 人手 = DDL push・シークレット投入・PR merge・本番デプロイ）・**機械検証可能な Acceptance Criteria**
- DDL は「ローカルファイル先行 → ユーザー `supabase db push`」（**`apply_migration` MCP 単独使用禁止**）
- hooks 連動（検査内容の正本 = 各スクリプト。登録 = `.claude/settings.json`・全 hook `${CLAUDE_PROJECT_DIR}` 相対で worktree 側の実体が走る）: Stop = `hooks/stop-check.sh`（frontend 変更で build 検証 → outbox 報告）/ SessionStart = `hooks/regen-index.sh`（INDEX 派生ビュー再生成）+ `hooks/session-start-check.sh`（informational only）/ PreToolUse(Bash) = `hooks/pre-commit-mcp-check.sh`（トークン平文検知）+ `hooks/pre-commit-index-guard.sh`（derived INDEX の commit 混入を自動除外）

### 7.4 Multi-chat Worktree Policy（**"1 chat = 1 worktree = 1 branch"**）

- メイン（`/Users/newlife/dev/apps/life-editor`）は chat-main 専有・**`main` のみ**。**メインで `git checkout <feature>` 禁止** — feature 作業は `.claude/worktrees/<slug>/` から
- **worktree 新規作成は 4 ステップ 1 セット**: `git worktree add` → `cd` → `echo <branch> > .claude/comm/.session-branch` → `claude`（省略禁止 — `.session-branch` 抜けで hook が無音スキップ）
- **Orca ADE 利用時の例外処理**: Orca の GUI worktree 作成は `.session-branch` / `.session-name` を書かないため hook が無音スキップする。Orca で作った worktree は Claude 起動前に `echo <branch> > .claude/comm/.session-branch`（必要なら `.session-name` も）を手動で書くか、Orca 内蔵ターミナルで上記 4 ステップを踏むこと。メインリポジトリは Orca から開いてもブランチ切替しない（`main` 専有を維持）
- 既知制約（npm install / .tsbuildinfo 非共有・二重 checkout 不可）・prune 手順 → [`2026-05-24-multi-chat-worktree-policy.md`](./docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md)

## 8. Feature Tier Map（詳細 → `docs/requirements/`）

- **Tier 1 コア**（6）: [`tier-1-core.md`](./docs/requirements/tier-1-core.md) — Tasks / Schedule / Notes / Daily / MCP Server / Cloud Sync（Terminal は 2026-07-05 に機能ごと退役 = ユーザー決定・tier-1-core は本文を履歴として保持 / 汎用 Database は一旦凍結 = 移行 SSOT Phase 5-A 決定・requirements 本体は保持）
- **Tier 2 補助**（11）: [`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md) — Audio / Playlist / Pomodoro / WikiTags / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash（File Explorer は退役 = 移行 SSOT Phase 5-A 決定・requirements 本体は保持）
- **Tier 3 実験 / 凍結**（6）: [`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md) — Paper Boards / Analytics / NotebookLM / Google Calendar / Google Drive / Cognitive Architecture
- 次フェーズ計画は移行 SSOT が正本（恒久知見の保全先 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)）

## 9. Document System

- **進捗 / 履歴は per-chat**: `.claude/memory/chat-<self>.md` + `.claude/history/chat-<self>.md`（task-tracker 経由・git 追跡・単一書込者）。集約 `memory/INDEX.md` / `history/INDEX.md` は **git 非追跡の派生ビュー**（`hooks/regen-index.sh` が再生成）。チャット名宣言 = `.claude/comm/.session-name`
- **実装プラン**: `docs/vision/plans/YYYY-MM-DD-<slug>.md` → 完了で `archive/` へ移動。Status 語彙は enum のみ: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)。移行 SSOT（`2026-05-04-cross-platform-migration.md`）のみ歴史的経緯で `.claude/` 直下に置く例外。ADR は作らない（理由 → `docs/vision/coding-principles.md` 冒頭）
- **Known Issue / 課題管理（2026-07-04〜）**: 追跡の正 = **GitHub Issues + Projects**（`gh -R sunbreak-pro/life-editor` で読み書き・種別 = label `type:*`）。新規バグは Issue で起票（`.github/ISSUE_TEMPLATE/known-issue.yml`）。`docs/known-issues/` は Fixed の凍結アーカイブ ＋ 環境系知見（Issue 化対象外 — 例 026/028）の管理台帳。**類似バグは `gh issue list --search` + INDEX.md grep の両輪**。計画書 .md 更新時は対応 Issue の DoD も更新（.md=詳細 / Issue=追跡）
- **worktree 担当ルーティング（2026-07-10〜）**: セクション単位の Issue には `section:<id>` ラベルを付与（`<id>` は `shared/src/sections.ts` の SectionId と一致。trash は担当 worktree がないため運用外）。各セクション worktree は `gh issue list -R sunbreak-pro/life-editor --label section:<id>` で自分の担当タスクを判断する。セクションに紐づかない横断タスク（app-integration / layout-standard / docs-workspace 等のレーン）は `shared-fix` ラベルに集約（運用詳細 → `comm/README.md` §Shared-fix ルート）。ラベル一覧の正本は GitHub（`gh label list`）
- **GitHub Issues のスコープ境界**: Issue はプロダクト課題（life-editor のコードを直せば直るもの）専用。**Claude Code の作業環境・hook・ツール挙動に関する知見は Issue 化せず `docs/known-issues/` + `rules/` で管理する**。判定 = 「life-editor のコードを直せば直るか？」— No なら環境系として Issue 化しない（例: cwd 漂流 028 / formatter 挙動 026）
- **並行チャット通信**: `.claude/comm/`（自分の Outbox にのみ append → [`comm/README.md`](./comm/README.md)）
- **鉄則**: 機能追加 / 削除時は §8 更新 ／ 音源ファイルはコミット禁止（`public/sounds/` は `.gitignore`）／ API キーをフロントエンドに直書きしない ／ **`.mcp.json` のトークンは `${SUPABASE_ACCESS_TOKEN}` 等の参照のまま維持・平文展開禁止**（2026-05-17 流出未遂。`hooks/pre-commit-mcp-check.sh` が commit 時に機械チェック）
