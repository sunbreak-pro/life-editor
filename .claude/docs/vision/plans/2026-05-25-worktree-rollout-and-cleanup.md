---
Status: Draft
Created: 2026-05-25
Branch: main (本計画書 commit は main 直接 push 禁止 — 軽量 doc PR ブランチを別途切る)
Owner-chat: main
Parent: 2026-05-24-multi-chat-worktree-policy.md
Previous: (なし)
---

# Plan: Worktree Policy ロールアウト整備 + 死蔵 worktree 整理

> 目的: 並行チャット運用規約 (CLAUDE.md §7.4 / `2026-05-24-multi-chat-worktree-policy.md`) の運用検証で見えた 3 つの死角を、1 本の計画書で並列処理する。
>
> - ① du-g worktree (`feat/du-g-notes-daily-unified`) の不在発覚と新規セットアップ
> - ② `.session-branch` 書き出しフローを worktree 作成手順に明示的に組み込む規約強化
> - ③ `prototype+mobile-ui` worktree の退役判断（規約違反の `+` 含み dir 名）

---

## Context

- **動機**:
  - chat-main の検証セッション (2026-05-24) で「規約は CLAUDE.md にあるが実施されない」「`+` 含み dir が残存」「du-g 系の worktree 名がチャット間で食い違う」の 3 件が判明
  - 計画書 2026-05-24-multi-chat-worktree-policy.md の "死角" 議論を実装に落とす段階
- **制約**:
  - メインリポジトリ (`/Users/newlife/dev/apps/life-editor`) は `main` 専有 (CLAUDE.md §7.4)。本計画の commit も main 直接 push 不可 (memory `feedback_branch_protection`)
  - agents-lib / skill-lib は git 外管理 (`~/dev/Claude/` 配下)。プロジェクト commit には乗らない
  - 破壊的 git 操作 (`worktree remove` / `branch -D`) はユーザー承認必須 (memory `feedback_destructive_git_confirmation`)
  - cost $0 厳守
- **Non-goals**:
  - du-g worktree の実作業 (Notes/Daily Unified Service) は本計画スコープ外。worktree 作成までで止める
  - `prototype-mobile` 側のリファクタは扱わない (アクティブ作業ブランチ)
  - hook ロジック追加 (検査 F は実装済)

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-05-25-worktree-rollout-and-cleanup.md    # 本計画書
.claude/CLAUDE.md                                                        # §7.4 への 1 行追記 (任意 / 判断後)
.claude/memory/chat-main.md                                              # task-tracker 経由で更新
.claude/history/chat-main.md                                             # task-tracker 経由で更新
~/dev/Claude/agents-lib/global/session-manager.md                        # git 外 / symlink 経由
~/dev/Claude/agents-lib/global/git-orchestrator.md                       # git 外 / symlink 経由
~/dev/Claude/skill-lib/global/lead-pipeline/SKILL.md                     # git 外 / symlink 経由
```

スコープ外の変更が必要になった場合は計画書を更新してから手を付ける。

---

## Discoveries — 要件と実環境の矛盾点 (2026-05-25 調査)

ユーザー要件と実環境が食い違っている点を全て記録する。実施前提を共有するため、本節は計画書冒頭に必須で残す。

### D-1: 要件① の worktree が存在しない

| 要件記載                                                                  | 実環境                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 「このチャットは du-g worktree (`feat/du-g-notes-daily-unified`) を担当」 | このチャットは **main worktree** (`pwd` = `/Users/newlife/dev/apps/life-editor`, branch = `main`)  |
| 「dirty 6 files が放置されています」                                      | `git status` = clean                                                                               |
| 「`.session-branch` を `feat/du-g-notes-daily-unified` に」               | `.session-name` = `main` / `.session-branch` = `main`                                              |
| 想定 branch `feat/du-g-notes-daily-unified`                               | **branch も worktree も未作成**。近い名前は `du-g3` (branch `feat/du-g3-provider-web-switch`) のみ |

→ 本計画では「du-g worktree を新規作成する手順」をステップ化する。**作成・移動の実行はメインから行わず、別の作業チャットに任せる** (CLAUDE.md §7.4 "メインで `git checkout` 禁止")。

### D-2: 要件② の参照は **既に 3 ファイルすべてに存在する**

`grep -n session-branch ...` の結果:

| ファイル                    | 既存記述                                                  | 性質           |
| --------------------------- | --------------------------------------------------------- | -------------- |
| `session-manager.md:100`    | START フロー 0.5 で「未宣言なら echo を促す」             | reactive       |
| `git-orchestrator.md:197`   | §2.5 table で「未宣言で起動 → echo を促す」               | reactive       |
| `lead-pipeline/SKILL.md:86` | Worktree Policy 節で「新規 feature 着手時は echo を提案」 | proactive 寄り |

ユーザー要望は「`git worktree add` / `claude --worktree` の**直後**に書き出すステップ」を **手順の一部として明示**すること。既存記述は「未宣言なら促す」という条件付きで、worktree 作成シーケンス内に組み込まれていない。

→ 「強化作業」として価値あり。本計画では「reactive な ifガード」から「作成手順内の必須ステップ」へ昇格させる diff を書く。

### D-3: 要件③ の「規約違反」は半分正しく半分誤り

| 観点                                               | 評価                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+` 記号を dir 名に使うのは規約違反                | ✅ 正しい (`git-orchestrator.md:160`)                                                                                                                                 |
| `prototype+mobile-ui` は手動で違反作成された       | ❌ 誤り。`claude --worktree prototype+mobile-ui` 経由で作られ、`+` が dir 名に残ったまま branch に `worktree-` prefix が付いた結果 (`git-orchestrator.md:168` で明記) |
| 自動付与結果でも `+` 含む dir は規約上望ましくない | ✅ リネーム/削除候補                                                                                                                                                  |

→ 退役判断のロジックは「規約違反だから即削除」ではなく「cleanup 基準 §2.4 (PR merged / unmerged commit 0 / clean / `claude agents --json` で活動なし) を満たしたら退役候補」。

### D-4: prototype 系 2 worktree の関係

`git worktree list` + `git log` 調査結果:

| worktree              | branch                         | HEAD                                                           | session-name          | dirty                                    | アクティブ session                                      |
| --------------------- | ------------------------------ | -------------------------------------------------------------- | --------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `prototype+mobile-ui` | `worktree-prototype+mobile-ui` | `05a3f90` (Phase 3.I keyboard accessory bar)                   | `prototype-mobile-ui` | clean                                    | なし (`claude agents --json` で cwd=worktree 該当 0 件) |
| `prototype-mobile`    | `prototype/mobile-ui`          | `edeb224` (Phase 3.J swipe + accessory bar / 2026-05-25 00:13) | `prototype-mobile`    | `?? prototype/tsconfig.tsbuildinfo` のみ | なし                                                    |

- `prototype-mobile` のほうが新しい (Phase 3.J まで進行) かつ `main` を merge 経由で取り込み済
- `prototype+mobile-ui` の Phase 3.I 内容が `prototype-mobile` または `main` (PR #28 = Phase 3.H) に吸収されているかは未確認 — Step P3-2 で `git log 05a3f90 ^edeb224 ^main --oneline` で確定する
- `+` 含み dir はシェルで `cd` が失敗するケースあり (本調査中に `cd .claude/worktrees/prototype+mobile-ui` が `no such file or directory` で失敗。クォート必須) → 規約 §2.4 「`+` 禁止」の妥当性を実体験で再確認

---

## 採用方針

### タスク① (du-g worktree セットアップ)

**メインからは作成しない**。本計画書に「別チャットが作成する手順」を記述し、ユーザーが別ターミナルで新チャットを起こして実行する。理由: CLAUDE.md §7.4 "メイン専有"、および memory `feedback_destructive_git_confirmation` (破壊的でなくとも環境変更は事前確認)。

### タスク② (規約整備)

3 ファイルに既存記述がある (D-2) ことを踏まえ、**追加ではなく強化** として diff を書く。具体的には:

- 「未宣言なら促す」(reactive) → 「作成コマンドの直後に `echo <branch> > .claude/comm/.session-branch` を打つ」(手順への組み込み)
- 「なぜ必要か」の 1 行 ("hook 検査 F は `.session-branch` 存在時のみ opt-in。宣言しないと検査が無音スキップされる") を全ファイルに統一文言で挿入

agents-lib / skill-lib は git 外なので commit 不要。本計画書 (CLAUDE.md §7.4 への 1 行追記の判断含む) のみ PR 化。

### タスク③ (prototype+mobile-ui 退役判断)

3 段階で進める:

1. **調査** (Claude 自律) — `git log 05a3f90 ^edeb224 ^main --oneline` で `prototype+mobile-ui` 固有 commit を抽出
2. **報告** (Claude → ユーザー) — 「固有 commit 0 件なら退役推奨 / 1 件以上なら吸収 or 保留判断をユーザーに仰ぐ」
3. **退役実行** (🛑 人手) — ユーザー承認後、リネーム or 削除コマンドを Claude が出力、ユーザーが実行

---

## Steps

| #                                                              | Step                                                                                                                                                                                         | Gate    | Acceptance                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| 0                                                              | 本計画書を `feat/worktree-rollout-and-cleanup` 等の branch で commit (main 直接 push 禁止)                                                                                                   | 🛑 人手 | branch 切り替えは別 worktree 経由 (`git worktree add .claude/worktrees/wt-doc-rollout/ -b feat/worktree-rollout`) |
| **タスク①: du-g worktree セットアップ手順 (実行は別チャット)** |
| G1-1                                                           | 本計画書に「`git worktree add .claude/worktrees/du-g/ -b feat/du-g-notes-daily-unified` 手順」を Annex として記述                                                                            | 🤖 自律 | Annex A に手順あり                                                                                                |
| G1-2                                                           | Annex A に「作成直後に `echo feat/du-g-notes-daily-unified > .claude/comm/.session-branch` を打つ」を必須化                                                                                  | 🤖 自律 | Annex A に該当行あり                                                                                              |
| G1-3                                                           | Annex A に「`.session-name = du-g` を書き出す (chat- prefix 禁止)」を必須化                                                                                                                  | 🤖 自律 | Annex A に該当行あり                                                                                              |
| G1-4                                                           | 別チャット起動 → Annex A 手順を実行 → `bash .claude/hooks/session-start-check.sh` の検査 A/E/F が緑                                                                                          | 🛑 人手 | 別チャットの SessionStart hook outbox 警告 0 件                                                                   |
| **タスク②: 規約整備 (agents-lib / skill-lib + CLAUDE.md)**     |
| R2-1                                                           | `session-manager.md:99-101` を「reactive ifガード」→「作成手順内の必須ステップ」へ書き換え                                                                                                   | 🤖 自律 | START フロー 0.5 が `git worktree add` 直後の `.session-branch` 書き出しを明示的なステップとして記述              |
| R2-2                                                           | `git-orchestrator.md:151-200` (§2.4 cleanup / §2.5 policy) の worktree 作成手順例に `.session-branch` 書き出しを必須化                                                                       | 🤖 自律 | §2.4/§2.5 の `git worktree add` の例示すべてに後続 `echo` 行が付随                                                |
| R2-3                                                           | `lead-pipeline/SKILL.md:80-86` の "Worktree Policy" 節を、`git worktree add` の直後に echo を打つ手順順序へ書き換え                                                                          | 🤖 自律 | 手順の番号付き列に echo 行が独立ステップとして存在                                                                |
| R2-4                                                           | `grep -n session-branch ~/dev/Claude/{agents-lib/global/session-manager.md,agents-lib/global/git-orchestrator.md,skill-lib/global/lead-pipeline/SKILL.md}` で全ファイル 2 件以上ヒット       | 🤖 自律 | 全 3 ファイルが grep ヒット (既存 1 + 強化追記 1+)                                                                |
| R2-5                                                           | CLAUDE.md §7.4 に「(セッションマネージャ / オーケストレータが自動で宣言を促す)」を 1 行追記するか判断 (任意)                                                                                 | 🤖 自律 | 追記 or 不要の判断をユーザーに提示。追記するなら 1 行のみ                                                         |
| **タスク③: prototype+mobile-ui 退役判断**                      |
| P3-1                                                           | `git log 05a3f90 ^edeb224 ^main --oneline` で `prototype+mobile-ui` 固有 commit を抽出                                                                                                       | 🤖 自律 | 抽出 commit 一覧と件数を本計画書 Worklog に記録                                                                   |
| P3-2                                                           | `git -C .claude/worktrees/prototype+mobile-ui status -s` で dirty 再確認                                                                                                                     | 🤖 自律 | dirty 0 件 (調査時 clean)                                                                                         |
| P3-3                                                           | `claude agents --json` で cwd=worktree 該当セッション 0 件再確認                                                                                                                             | 🤖 自律 | 該当 0 件 (調査時 0 件)                                                                                           |
| P3-4                                                           | 判定マトリクスをユーザーに提示: (a) 固有 commit 0 → 退役推奨 / (b) ≥1 かつ吸収済 → 退役推奨 / (c) ≥1 かつ未吸収 → 保留 or リネーム提案                                                       | 🤖 自律 | マトリクスとユーザーへの質問が outbox に出力                                                                      |
| P3-5                                                           | ユーザー判断後、実行コマンドを生成 (`git worktree remove .claude/worktrees/prototype+mobile-ui` + `git branch -D worktree-prototype+mobile-ui` または `git worktree move` + `git branch -m`) | 🛑 人手 | コマンド出力のみ。Claude は実行しない                                                                             |
| P3-6                                                           | ユーザー実行後、`git worktree list` で対象消失 (退役の場合) or 新 dir 名に変更 (リネームの場合) を確認                                                                                       | 🛑 人手 | `git worktree list` に意図通りの結果                                                                              |

### Gate 凡例

- **🤖 自律** — Claude が完結。後追い検証 (grep / type check) で品質担保
- **🛑 人手** — ユーザー操作必須 (worktree 作成 / 削除 / リネーム、PR merge)

---

## Acceptance Criteria (機械検証可能)

- [ ] 本計画書が `.claude/docs/vision/plans/2026-05-25-worktree-rollout-and-cleanup.md` に存在
- [ ] (タスク①) `git worktree list` に `.claude/worktrees/du-g` (branch `feat/du-g-notes-daily-unified`) が出現 — **別チャット実行後**
- [ ] (タスク①) du-g worktree 内 `.claude/comm/.session-branch` の中身が `feat/du-g-notes-daily-unified`
- [ ] (タスク②) `grep -c session-branch ~/dev/Claude/agents-lib/global/session-manager.md` が **2 以上** (既存 1 + 強化 1+)
- [ ] (タスク②) `grep -c session-branch ~/dev/Claude/agents-lib/global/git-orchestrator.md` が **2 以上**
- [ ] (タスク②) `grep -c session-branch ~/dev/Claude/skill-lib/global/lead-pipeline/SKILL.md` が **2 以上**
- [ ] (タスク③) Worklog に `git log 05a3f90 ^edeb224 ^main --oneline` の結果が記録されている
- [ ] (タスク③) ユーザー判定後の最終状態 (`git worktree list` 出力) が Worklog に記録されている
- [ ] (全体) `cd frontend && npm run build` exit 0 (本計画書編集はフロントエンドに無影響だが、CLAUDE.md §7.4 編集時の保険として)

---

## DB Migration Notes

該当なし (DDL 変更ゼロ)。

---

## Risks / Known Issues 参照

- `feedback_destructive_git_confirmation` — `worktree remove` / `branch -D` は実行直前再確認
- `feedback_branch_protection` — main 直接 push 禁止、本計画書 commit も別 branch 経由
- `feedback_task_tracker_parallel_chat_override` — 別チャット (du-g) と並行する場合、共有 tracker (`memory/INDEX.md`) 書き込みは自レーン (`memory/chat-main.md`) のみ
- 計画書 `2026-05-24-multi-chat-worktree-policy.md` §12 — `claude agents --json` を活動シグナルとして使う原則

新規 known issue 候補: **`+` 含み dir 名は `cd` がクォートなしで失敗する** (本調査で実体験) → タスク③完了後に `docs/known-issues/` 化を判断。

---

## References

- vision: `.claude/CLAUDE.md` §7.4 "Multi-chat Worktree Policy"
- 親計画書: `.claude/docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md`
- 関連スキル: `lead-pipeline` (Worktree Policy 節) / `git-orchestrator` (§2.4 / §2.5) / `session-manager` (START フロー 0.5)
- hook: `.claude/hooks/session-start-check.sh` 検査 A/E/F
- 公式 doc: https://code.claude.com/docs/en/worktrees

---

## Annex A: du-g worktree セットアップ手順 (別チャットで実行)

メインから実行禁止。新ターミナルで以下を順に実行する。

```bash
# 1. メイン位置から worktree + branch を作成
cd /Users/newlife/dev/apps/life-editor
git worktree add .claude/worktrees/du-g/ -b feat/du-g-notes-daily-unified

# 2. worktree 内に移動 (以降はこの worktree が作業位置)
cd .claude/worktrees/du-g/

# 3. .session-name 宣言 (chat- prefix なし、検査 B 違反回避)
echo du-g > .claude/comm/.session-name

# 4. .session-branch 宣言 (検査 F が opt-in で動く根拠)
echo feat/du-g-notes-daily-unified > .claude/comm/.session-branch

# 5. Claude セッション起動 (この path から起動することで agents --json の cwd が worktree になる)
claude

# 6. セッション内で SessionStart hook を再実行して検査 A/E/F が緑か確認
bash .claude/hooks/session-start-check.sh
echo "exit: $?"
ls -la .claude/comm/outbox/du-g/ 2>/dev/null
```

期待結果:

- `exit: 0`
- `outbox/du-g/` に `session-start-warnings.md` が出ない、または空
- `git worktree list` に `.claude/worktrees/du-g  <sha> [feat/du-g-notes-daily-unified]` が出現

失敗時のロールバック:

```bash
cd /Users/newlife/dev/apps/life-editor
git worktree remove .claude/worktrees/du-g/
git branch -D feat/du-g-notes-daily-unified
```

---

## Annex B: 次セッション (du-g) 用コピペプロンプト

別ターミナルで `cd /Users/newlife/dev/apps/life-editor` してから `claude` 起動。最初のプロンプトに以下をそのまま貼り付ける。

```
このチャットは du-g worktree を新規セットアップするセッションです。
親計画書: .claude/docs/vision/plans/2026-05-25-worktree-rollout-and-cleanup.md (Annex A)

セットアップ手順:

1. 現在地確認
   - pwd が /Users/newlife/dev/apps/life-editor (メイン) であることを確認
   - git rev-parse --abbrev-ref HEAD が main であることを確認
   - 違っていれば停止してユーザーに報告

2. worktree + branch 作成
   git worktree add .claude/worktrees/du-g/ -b feat/du-g-notes-daily-unified

3. worktree に移動
   cd .claude/worktrees/du-g/

4. 宣言ファイル書き出し (順序通り)
   echo du-g > .claude/comm/.session-name
   echo feat/du-g-notes-daily-unified > .claude/comm/.session-branch
   ※ .session-name は chat- prefix を付けない (SessionStart hook 検査 B 違反になる)

5. SessionStart hook を実行して検査 A/E/F が緑か確認
   bash .claude/hooks/session-start-check.sh
   echo "exit: $?"
   ls -la .claude/comm/outbox/du-g/ 2>/dev/null

6. 期待結果
   - exit: 0
   - outbox/du-g/session-start-warnings.md が出ないか空
   - git worktree list に .claude/worktrees/du-g [feat/du-g-notes-daily-unified] が出現

7. 結果サマリをユーザーに報告して停止
   - du-g worktree の実作業 (Notes/Daily Unified Service) は本セッションのスコープ外
   - 親計画書の Acceptance Criteria 「worktree list に出現」「.session-branch の中身が feat/du-g-notes-daily-unified」がチェックできるか報告

失敗時:
   - git worktree add で「branch already exists」が出たら、現在の worktree 一覧を git worktree list で確認してユーザーに報告 (勝手にロールバックしない)
   - hook 警告が出たら警告内容を outbox から読み出してユーザーに転送

注意:
   - ユーザー承認なしで git worktree remove / git branch -D は実行禁止
   - メイン (/Users/newlife/dev/apps/life-editor) で git checkout は実行禁止 (CLAUDE.md §7.4)
```

---

## Worklog (実装中に追記)

### 2026-05-26 P3-1 実行 (chat-main)

`git log 05a3f90 ^edeb224 ^main --oneline` 結果:

```
05a3f90 fix(prototype): keep Materials keyboard accessory bar always visible while editor is open
1efb908 feat(prototype): global sticky BottomNav + Materials TipTap RichText with iOS-style keyboard accessory bar
```

- 件数: **2 件**
- prototype-mobile (edeb224) / main のいずれにも未マージ
- 判定マトリクス: (a) 0 件 → 自動退役推奨 ✗ / (b) ≥1 かつ吸収済 → 要確認 / (c) ≥1 かつ未吸収 → 保留 or リネーム提案

参考: prototype-mobile 側にも類似テーマの commit が存在

- `5dbea86 fix(prototype): Phase 3.I — swipe rebound + Materials keyboard accessory bar`
- `edeb224 fix(prototype): Phase 3.J — swipe transition condition + iOS-style accessory bar`

両者は keyboard accessory bar / Materials 周りで重複作業の可能性。**実装内容が同等なら吸収済 (b) 判定 → 退役推奨**、別実装なら未吸収 (c) 判定 → cherry-pick or リネーム保留が望ましい。

次ステップ P3-4 でユーザーに判定マトリクスを提示する (本セッション末尾で実施)。

### 2026-05-26 P3-2 / P3-3 再確認 (chat-main)

- P3-2: `git -C .claude/worktrees/prototype+mobile-ui status -s` → 空 (clean)
- P3-3: `claude agents --json` → cwd=`.claude/worktrees/prototype+mobile-ui` のセッション 0 件 (現在の active 2 件は両方 main の cwd)

### 2026-05-26 R2 系 (規約整備) 実行 (chat-main)

`.session-branch` の言及を 3 ファイルすべてで「reactive ifガード」→「作成手順の必須ステップ」へ強化。

- `~/dev/Claude/agents-lib/global/session-manager.md` → START フロー 0.5 を 3 ステップ 1 セット化（grep ヒット 3 件）
- `~/dev/Claude/agents-lib/global/git-orchestrator.md` → §2.5 table の「feature 作業の開始要求」「既存 feature branch を別チャットで触りたい」行に echo を組み込み、「未宣言で起動」行はフォールバック扱いに格下げ（grep ヒット 3 件）
- `~/dev/Claude/skill-lib/global/lead-pipeline/SKILL.md` → Worktree Policy 節を 4 ステップ 1 セット化（grep ヒット 2 件）
- `.claude/CLAUDE.md` §7.4 → 「ブランチ宣言」「委譲先での明文化」両方を proactive 表現に書き換え（line 230 / 234）

R2-4 Acceptance: 全ファイル grep ヒット 2 以上達成。

### 2026-05-26 cwd 漂流事故 (chat-main で発生・自己検出)

**症状**: P3-2 / P3-3 調査時に `cd /Users/newlife/dev/apps/life-editor/.claude/worktrees/prototype-mobile && git status -s` を実行 → Bash の cwd 持続仕様により以降ずっと prototype-mobile worktree 内で動作。次の `git status` で branch が `prototype/mobile-ui` になっていて発覚。

**実害**: なし。後続の Write / Edit はすべて絶対パスを使ったため、ファイルはメインの正しい場所に書かれていた。

**対処**: `cd /Users/newlife/dev/apps/life-editor` でメインに復帰、`git status` で差分が main 側に存在することを確認。

**Known Issue 化**: → [`028-bash-cwd-drift-across-worktrees.md`](../../known-issues/028-bash-cwd-drift-across-worktrees.md) 作成済 (本 commit)。

### 2026-05-26 prototype+mobile-ui worktree 削除済を発見

`git worktree list` から消えており、ユーザーの「すでに削除済みのため対応不要」発言と整合。`git branch --list "worktree-prototype+mobile-ui"` も該当なし。タスク③ P3-4〜P3-6 は **すでに完了済 (削除済)** と判定。

ただし固有 commit 2 件 (`05a3f90` / `1efb908` = global sticky BottomNav + Materials TipTap keyboard accessory bar) が prototype-mobile / main いずれにもマージされず消失したことになる。`git reflog` には残るので必要なら復元可能（実装が prototype-mobile 側で同等に再実装されているなら不要）。

### 2026-05-26 計画書 commit 用 worktree 作成 (chat-main)

`git pull --ff-only` で main を `e2233ad` (PR #31 G3) へ更新後、`git stash push -u` で本計画書 + CLAUDE.md 差分を退避。

`git worktree add .claude/worktrees/docs-worktree-rollout-2026-05-26/ -b docs/worktree-rollout-2026-05-26` で新 worktree 作成 → 新 worktree 内で `echo docs/worktree-rollout-2026-05-26 > .claude/comm/.session-branch` → `git stash pop` で差分復元。

以降の commit は新 worktree 側で実施。chat-main は commit 後にメインへ復帰する。
