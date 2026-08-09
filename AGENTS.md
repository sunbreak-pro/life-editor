# AGENTS.md — Life Editor（Codex 用エントリポイント）

> **このファイルは入口であって正本ではない。** 設計判断・実装規約の SSOT は
> [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)。**セッション開始時に必ずそちらを開くこと。**
>
> ここに CLAUDE.md の内容を複製しない。複製すると原本の改訂に追随できず、片方だけ古くなる
> （2026-08-09 に実際そうなった — 全文コピーが 5 コミット分ズレた状態で発見された）。

---

## 0. まず読むもの

| 目的                               | ファイル                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 統合定義書（SSOT）                 | [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)                                                                                                     |
| 現行スタック・Phase 状況・移行手順 | [`.claude/2026-05-04-cross-platform-migration.md`](./.claude/2026-05-04-cross-platform-migration.md)                                           |
| 進捗 / 履歴                        | `.claude/memory/chat-<self>.md` / `.claude/history/chat-<self>.md`（集約ビュー `INDEX.md` は SessionStart hook が生成する git 非追跡の派生物） |
| frontend 詳細規約                  | [`.claude/rules/frontend.md`](./.claude/rules/frontend.md)                                                                                     |
| 障害知見                           | [`.claude/docs/known-issues/INDEX.md`](./.claude/docs/known-issues/INDEX.md)                                                                   |

ディレクトリ名が `.claude/` でも、中身はツール非依存のプロジェクト規約である。**Codex で作業する
ときも `.claude/CLAUDE.md` の記述がそのまま適用される** — §2 の読み替え表に載っているものだけが例外。

## 1. Codex 固有の構成

| 対象       | 場所                                         | 中身                                                            |
| ---------- | -------------------------------------------- | --------------------------------------------------------------- |
| MCP サーバ | [`.codex/config.toml`](./.codex/config.toml) | Supabase（`--read-only`）。トークンは `env_vars` 参照で平文禁止 |
| hooks      | [`.codex/hooks.json`](./.codex/hooks.json)   | 実体は持たず `.claude/hooks/*.sh` を git ルート相対で呼ぶ       |
| skills     | `.agents/skills/<name>/SKILL.md`             | 発見用の入口のみ。本文は `.claude/skills/<name>/SKILL.md`       |

hooks / skills が実体を持たないのは意図的で、Claude Code 側と同じスクリプト・同じ本文を 1 つだけ
保つため。**`.codex/` や `.agents/` にコピーを増やさない。**

`.claude/skills/` のうち `.agents/skills/` に入口を置いているのは、この機械で実際に機能している
実体スキル（シンボリックリンクでないもの）に限る。`loop-*` 系は Claude Code のスラッシュコマンド
前提のため意図的に除外している。

## 2. Claude Code 前提の記述の読み替え

`.claude/CLAUDE.md` と各スキルは Claude Code を前提に書かれた箇所がある。Codex では次のように読む。

- **`claude` 起動 / Claude Code 本体** — Codex では `codex`。MCP の自動接続は `.codex/config.toml` が担う
- **`${CLAUDE_PROJECT_DIR}`** — Codex には無い。git ルート相対（`$(git rev-parse --show-toplevel)`）で解決する。
  hook のコマンドは**セッションの cwd** で走るため、相対パス単体では sub-directory 起動時に壊れる
- **サブエージェント（Agent ツール）・`role-pm` / `role-engineer` / `role-qa`・output style** — Codex には無い。
  該当する工程は Codex 自身が順に実行する
- **`/loop` `/goal` `/batch` などのスラッシュコマンド** — Codex には無い
- **ツール実行ハング（CLAUDE.md §7.0）** — Claude Code 本体の SSE バグの話であり、Codex には該当しない。
  「状態変更の Bash はサブエージェント経由」の運用既定も Codex では不要
- **「Claude API 直課金」（CLAUDE.md §1 Non-Goals）** — Anthropic の API を指す固有名詞。読み替えない

## 3. Codex で作業しても変えないもの

- **ブランチ名は `claude/<slug>-<issue>`** のまま（正本 = `.claude/skills/worktree-policy/SKILL.md`）。
  ツールが変わってもブランチ命名規約は変えない
- **`.claude/comm/.session-branch` / `.session-name` の宣言**は Codex でも必須。抜けると hook が無音スキップする
- **`.codex/config.toml` / `.mcp.json` のトークンは参照形式のまま**。平文展開禁止（CLAUDE.md §9 鉄則・2026-05-17 流出未遂）
- **merge と main への取り込みは常にユーザー**（POLICY P-001）。Codex も自分で merge しない
