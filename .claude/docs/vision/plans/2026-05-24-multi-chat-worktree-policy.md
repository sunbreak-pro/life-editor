---
Status: ACTIVE (adopted policy) — 規約として採用・運用中（SSOT は CLAUDE.md §7.4。本計画書は詳細・背景の参照元）
Created: 2026-05-24
Branch: data-unification/items-meta-redesign
Owner-chat: main
Parent: (なし)
Previous: 2026-05-24-subagent-worktree-improvements.md (PR #22 MERGED — SessionStart hook 検査 E + agents-lib self-contained brief)
---

# Plan: 並行チャット用 worktree 運用規約（"1 chat = 1 worktree = 1 branch"）

> 目的: 並行 Claude チャット同士のブランチ切替干渉を構造的に防ぐ。`data-unification/items-meta-redesign` 上で別チャットが `chore/subagent-worktree-tuning` の作業を始め、メインの作業ツリーが意図せず切り替わった事故 (DU-F Step 14 中) の再発防止。

---

## Context

- **動機**: 並行チャットがメインリポジトリで `git checkout` するとファイルシステムが他チャットの認識と乖離する。事故 (DU-F Step 14) で実証済み
- **制約**:
  - Claude Code は `--worktree <name>` を一級機能としてサポート（`code.claude.com/docs/en/worktrees`）
  - git 仕様上、同一ブランチを 2 つの worktree から checkout することは不可（`--force` は破損リスク）
  - 現状パッケージマネージャは npm（pnpm の `enableGlobalVirtualStore` は使えず、worktree ごとに `node_modules` が必要）
  - cost $0 厳守
- **Non-goals**:
  - 全 remote branch の事前 worktree 化（不可能 + 無意味）
  - pnpm 移行（別レーン）
  - VSCode TypeScript LS のメモリ最適化（IDE 側のチューニング、別スコープ）

---

## Scope (Touchable Paths)

```
.claude/CLAUDE.md
.claude/hooks/session-start-check.sh
.claude/docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md
.claude/memory/chat-main.md
.claude/history/chat-main.md
~/dev/Claude/agents-lib/global/git-orchestrator.md          # git 外 (symlink)
~/dev/Claude/agents-lib/global/session-manager.md           # git 外 (symlink)
~/dev/Claude/skill-lib/global/lead-pipeline/SKILL.md        # git 外 (symlink)
```

agents-lib / skill-lib は git 外管理（`~/dev/Claude/` 配下、PR #22 で確立済の制約）。プロジェクト commit には含まれないが、本計画の影響範囲としては 1 等市民。

---

## 採用アーキテクチャ

**"1 chat = 1 worktree = 1 branch"**

| 場所                                            | 担当                 | 触ってよいブランチ                           |
| ----------------------------------------------- | -------------------- | -------------------------------------------- |
| `/Users/newlife/dev/apps/life-editor`（メイン） | chat-main 専有       | **`main` のみ**                              |
| `.claude/worktrees/<slug>/`（worktree 配下）    | feature 作業チャット | 任意 feature branch（1 worktree = 1 branch） |

メインで `git checkout <feature>` するのを**運用上禁止**する。feature 作業は必ず worktree から行う。

### Claude Code 公式機能との対応

- `claude --worktree <name>` 起動 → 公式が `.claude/worktrees/<name>/` を作成、`worktree-<name>` ブランチを自動生成
- 既存 feature branch を触りたい場合: `git worktree add .claude/worktrees/<slug>/ <existing-branch>` 後、その path で `claude` を起動
- セッション終了時の保持/削除プロンプトは公式 UI に従う

### `.session-branch` の導入

`.claude/comm/.session-name` と同階層に `.claude/comm/.session-branch` を新設し、各チャットの担当ブランチを宣言する。SessionStart hook の検査 F が「現在の `pwd` の branch ↔ `.session-branch` が一致するか」を informational に検査する。

---

## Steps

| #   | Step                                                                                                                                        | Gate    | Acceptance                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `.gitignore` 確認（`.claude/worktrees/` がすでに登録済を確認）                                                                              | 🤖 自律 | `grep -n worktree .gitignore` で 1 行ヒット                                                                   |
| 2   | CLAUDE.md §7 に §7.4 として "Multi-chat Worktree Policy" を追加                                                                             | 🤖 自律 | 該当節が存在し、本計画書とリンクされている                                                                    |
| 3   | SessionStart hook に検査 F 追加（`pwd` ↔ `.session-branch` 整合 / informational only）                                                      | 🤖 自律 | `bash .claude/hooks/session-start-check.sh; echo $?` → exit 0、`.session-branch` 不一致時に outbox 警告       |
| 4   | `lead-pipeline` SKILL.md に "Worktree Policy" 節を追加（ティア判定前に worktree 内かを言及）                                                | 🤖 自律 | 該当節が存在し、メイン専有 / feature 作業 worktree のルールが書かれている                                     |
| 5   | `session-manager` agent.md に "START フローでの worktree チェック" を追加                                                                   | 🤖 自律 | START フロー記述に worktree 検査ステップが含まれる                                                            |
| 6   | `git-orchestrator` agent.md に "main 専有とブランチ切替の代替案" を追加                                                                     | 🤖 自律 | branch 戦略節に「main で `git checkout <feature>` を提案しない、`git worktree add` を提案」の旨が書かれている |
| 7   | task-tracker END で 本計画書を `.claude/archive/` に移動（Status=ACTIVE のまま、規約は CLAUDE.md に統合済）                                 | 🤖 自律 | (本計画は規約であり、運用開始後も SSOT は CLAUDE.md。archive 移動は実運用 1 週間後に判断)                     |
| 8   | chat-main の worktree 移行（`/Users/newlife/dev/apps/life-editor` を `main` に戻し、現作業を `.claude/worktrees/data-unification/` に移植） | 👀 目視 | 別ターン（DU-F PR #25 merge 後）                                                                              |

### Gate 凡例

- 🤖 自律 = Claude 完結
- 👀 目視 = ユーザー操作必要

Step 1-6 は本ターンで完了させる。Step 7-8 は別ターン（運用検証後）。

---

## Acceptance Criteria (機械検証可能)

- [x] `grep -n worktree .gitignore` で 1 行以上ヒット（root `.gitignore` に `.claude/worktrees/`）
- [x] `grep -n "7.4" .claude/CLAUDE.md` で §7.4 ヘッダが存在
- [x] `grep -n "session-branch" .claude/hooks/session-start-check.sh` で検査 F の実装が存在
- [x] `bash .claude/hooks/session-start-check.sh; echo $?` で exit 0
- [x] `grep -n -i worktree ~/dev/Claude/skill-lib/global/lead-pipeline/SKILL.md` で本規約節が存在
- [x] `grep -n -i worktree ~/dev/Claude/agents-lib/global/session-manager.md` で worktree 検査記述が存在
- [x] `grep -n -i worktree ~/dev/Claude/agents-lib/global/git-orchestrator.md` で main 専有節が存在
- [ ] `cd frontend && npm run build` exit 0（frontend は FROZEN・本計画は docs のみで無改変のため自明・未実行）

---

## DB Migration Notes

該当なし。

---

## 既知の制約（許容前提）

| 制約                               | 影響                                      | 緩和策                                                      |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| worktree ごとに `npm install` 必要 | ディスク × N (1 worktree 約 1-2 GB)       | 当面許容。pnpm 移行は別レーンで検討                         |
| TypeScript `.tsbuildinfo` 共有不可 | worktree ごとに full build                | `npm run build` を worktree 単位で実行する前提に統一        |
| VSCode TS LS の N 倍プロセス       | CPU / メモリ消費                          | active worktree 数を 2-3 に絞る運用                         |
| 古い worktree の残骸               | `.git/worktrees/` 肥大                    | PR #22 検査 E（24h+ dirty 検出）+ 定期 `git worktree prune` |
| 同一ブランチ二重 checkout 不可     | 1 ブランチを 2 チャットで同時編集できない | ブランチを分けて後で merge/rebase（git の基本）             |

---

## Risks / Known Issues 参照

- 関連事故: DU-F Step 14 中の branch 取り違え（`.claude/history/chat-main.md` 2026-05-24 末尾「並行チャット干渉メモ」）
- 関連 PR: #22 (subagent-worktree-tuning) MERGED — SessionStart 検査 E + agents-lib brief
- 公式 doc: [Run parallel sessions with worktrees - Claude Code](https://code.claude.com/docs/en/worktrees)
- 公式 doc: [git-worktree](https://git-scm.com/docs/git-worktree)

新規 known issue 候補:

- 「並行チャット間で同一 working tree を共有すると branch 切替で他チャットが破壊される」を `docs/known-issues/` に記録（実施は別ターン）

---

## References

- vision: `.claude/CLAUDE.md` §7 (Development Workflows)
- previous plan: `.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md`
- related skills: `lead-pipeline`, `git-orchestrator`, `session-manager`, `task-tracker`
- related hooks: `.claude/hooks/session-start-check.sh`

---

## Worklog

- 2026-05-24: 起案。deep-web-research で公式仕様確認、multi-session-coordinator で並行チャット静止確認、ユーザー方針確認（main 専有 / hook F / 即実装まで）
