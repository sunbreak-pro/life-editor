# Plan: subagent self-contained brief + worktree integrity（中優先 4 件統合）

## Meta

- **Status**: COMPLETED
- **Created**: 2026-05-24
- **Completed**: 2026-05-24
- **Scope project**: life-editor + `~/dev/Claude/agents-lib/global/`（symlink 一元管理、git 管理外）
- **Branch**: `chore/subagent-worktree-tuning`
- **元 plan ファイル**: `/Users/newlife/.claude/plans/deep-whistling-pancake.md`（実施後本ファイルが SSOT）

---

## Context

「現在の Claude Code 使い方 vs 世間典型」調査の結果、以下 2 領域に中優先の改善余地が見つかった：

1. **Subagent 側**: GitHub Issue #56068 で確認された "parallel sub-agent が親コンテキストを丸ごと継承" 問題への対策が手薄。role-pm / role-engineer / role-qa の現定義は「再帰禁止」「自己評価バイアス回避」までは明文化されているが、**「メインからプロンプトに self-contained に何を渡すべきか」**は規定されていない。結果として 100K tokens × 3 役 = 300K tokens の浪費リスク
2. **Worktree 側**: 3 本稼働中だが命名と用途がねじれている：
   - `cleanup-and-consolidation`: PR #15 MERGED、origin/main と差分なし → **役目終わり**
   - `prototype+mobile-ui`: PR 紐付け無し、reflog は create のみ → **inactive と判定したが、ユーザー指示で保留**
   - `prototype-mobile`: 実作業中（別チャット）
3. **SessionStart hook**: `.session-name` の 4 観点（A-D）に加え、worktree 横断の dirty 放置検知 E を追加
4. **公式 `claude --worktree` (v2.1.150)**: 自作 git-orchestrator と機能重複の可能性。棲み分け文書化

---

## 実施結果サマリ

### 完了 (✓)

- ✓ **Phase 1.1**: `cleanup-and-consolidation` worktree + branch 削除（PR #15 MERGED 済の clean な状態を再確認後）
- ✓ **Phase 1.4**: `git-orchestrator.md §2.4` worktree 命名規約 + cleanup 基準を追加
- ✓ **Phase 2.1-2.3**: `role-pm.md` / `role-engineer.md` / `role-qa.md` 全 3 ファイルに「## メインから受け取る前提（self-contained ブリーフ必須）」セクションを追加
- ✓ **Phase 2.4**: 3 ファイルとも symlink 健全性確認（`~/.claude/agents/role-*.md` は agents-lib を指し、新セクションも 1 件のみ存在）
- ✓ **Phase 3.1-3.2**: `session-start-check.sh` に検査 E（worktree dirty 24h+ 検知）を追加。`OLDEST_MTIME` 採用（NEWEST だと全ファイル新しいケースで fire しない）。合成テスト（一時ファイルを backdate）で 1288h 検出 → cleanup 完了確認
- ✓ **Phase 4.1**: `git-orchestrator.md §12` に公式 `claude --worktree` との棲み分け表を追記、旧 §12 参考は §13 に繰り下げ

### スキップ (—)

- — **Phase 1.2**: `prototype+mobile-ui` worktree + branch 削除をスキップ
  - 理由: ユーザーが「作業中だと認識している」と明示。深掘り再調査でも reflog はブランチ create のみ・PR 紐付け無し・最終 mtime 5/24 15:10 だったが、ユーザー認識を優先
  - 残置物: worktree dir + branch `worktree-prototype+mobile-ui`
- — **Phase 4.2**: 公式 `claude --worktree` 実地試用（ユーザー判断、本計画外）

---

## Scope 宣言（CLAUDE.md §7.3 準拠）

### 触ってよいパス（実施範囲）

- `~/dev/Claude/agents-lib/global/role-pm.md` ✓ Edit
- `~/dev/Claude/agents-lib/global/role-engineer.md` ✓ Edit
- `~/dev/Claude/agents-lib/global/role-qa.md` ✓ Edit
- `~/dev/Claude/agents-lib/global/git-orchestrator.md` ✓ Edit
- `/Users/newlife/dev/apps/life-editor/.claude/hooks/session-start-check.sh` ✓ Edit
- `/Users/newlife/dev/apps/life-editor/.claude/worktrees/cleanup-and-consolidation/` ✓ Delete
- `/Users/newlife/dev/apps/life-editor/.claude/worktrees/prototype+mobile-ui/` — Skip（ユーザー指示）
- `/Users/newlife/dev/apps/life-editor/.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md` ✓ Add（本ファイル）

### 触ってはいけないパス（守った範囲）

- `frontend/` `web/` `src-tauri/` `cloud/` `supabase/` — アプリ本体には一切触れず
- `.claude/worktrees/prototype-mobile/` — 別チャットの実作業中（介入せず、Phase 5 commit でも pathspec で除外）
- `~/.claude.json` — 前タスクで編集済み、本計画では未変更

---

## Phase 1: Worktree 整理（提案 B）

### Steps

- [x] **1.1** `cleanup-and-consolidation` worktree 削除（🤖 自律）
  - 事前確認: `git status` clean ✓、`log origin/main..HEAD` 空 ✓、PR #15 MERGED ✓
  - 実行: `git worktree remove .claude/worktrees/cleanup-and-consolidation`
  - branch 削除: `git branch -d refactor/cleanup-and-consolidation` → `was 1740c1e`
- [ ] **1.2** `prototype+mobile-ui` worktree 削除（🛑 → スキップ）
  - **結果**: ユーザー指示により未実施
- [x] **1.3** `prototype-mobile` は**残す**（作業中のため触らない）
  - 後日確認: chat-prototype-mobile が `feat(prototype): Phase 3.A-F` を commit 済
- [x] **1.4** Worktree 命名規約を `git-orchestrator.md §2.4` に追加（🤖 自律）
  - 規約: dir 名 = branch 名の `/` を `-` に置換、`+` 禁止、`worktree-` prefix 二重禁止、`.claude/worktrees/` 配下統一
  - cleanup 基準: PR MERGED + `log origin/main..HEAD` 空 + `status -s` 空 の 3 条件揃いで候補

### 受け入れ基準

- [x] `cleanup-and-consolidation` の worktree + branch が消えている
- [x] `git-orchestrator.md` に §2.4 が追加されている
- [ ] `prototype+mobile-ui` の処遇 — 未削除（ユーザー指示）

---

## Phase 2: Subagent self-contained brief 規約追加（提案 A）

### 設計

3 つの role-\* に共通の「## メインから受け取る前提（self-contained ブリーフ必須）」セクションを追加。中身は役割ごとに微調整。

### Steps

- [x] **2.1** `role-engineer.md`: §0 設計思想と §1 起動時フローの間に挿入（5 項目: role-pm 出力サマリ / 編集対象絶対パス / 触ってはいけないパス / 検証コマンド / 既存パターン参照ファイル）
- [x] **2.2** `role-qa.md`: 同位置に挿入（5 項目: role-pm 要件サマリ / role-engineer 出力サマリ / 監査観点 hint / 並列起動候補ドメイン / 既存テスト・検証ログパス）
- [x] **2.3** `role-pm.md`: 同位置に挿入（5 項目: ユーザー発言原文 / 既存 memory・history 抜粋 / 関連ファイルパス / 過去の意思決定リンク / 期待する出力フォーマット）
- [x] **2.4** symlink 健全性確認
  - 結果: `~/.claude/agents/role-pm.md` / `role-engineer.md` / `role-qa.md` / `git-orchestrator.md` の 4 つとも `~/dev/Claude/agents-lib/global/` を指す
  - 各 role-\* に「メインから受け取る前提」セクションが 1 件のみ存在

### 受け入れ基準

- [x] 3 ファイルとも新セクションが存在
- [x] yaml frontmatter 健全
- [x] symlink target 正しい

---

## Phase 3: SessionStart hook 拡張（提案 C）

### Steps

- [x] **3.1** `session-start-check.sh` に検査 E を追加
  - ロジック: 各 worktree dir の dirty を `ls-files -mo --exclude-standard` で列挙、各ファイルの mtime を取得、**最古** mtime が 24h 以上前なら警告（NEWEST だと全部新しいケースで fire しない設計判断）
  - 設計: `informational only`、既存 A-D 検査を壊さない、`set -uo pipefail` 維持
  - ヘッダコメントにも E の説明を追記
- [x] **3.2** 合成テスト
  - prototype-mobile の dirty は全て当日（<24h）だったため、一時ファイル `HOOK_TEST_STALE.tmp` を作って `touch -t 202604010000.00` で backdate
  - 結果: `E: worktree prototype-mobile に 1288h 以上放置の dirty ファイルあり (2 files 中、最古は 1288h 前)` 警告 fire ✓
  - exit code 0 ✓
  - cleanup: 一時ファイル削除済

### 受け入れ基準

- [x] hook の exit code が 0
- [x] outbox に E 警告が追記される（合成テスト時）
- [x] 既存 A-D 検査が壊れていない（bash -n syntax check OK）

---

## Phase 4: 公式 `claude --worktree` 試用 + 棲み分け文書化（提案 D）

### Steps

- [x] **4.1** `git-orchestrator.md` §12 に「公式機能との棲み分け」を追記、旧 §12 参考は §13 に繰り下げ
  - 役割分担表（7 観点）: worktree dir 作成 / `.env` 引き継ぎ / branch 戦略 / 命名規約遵守 / main 防御 / cleanup 基準 / PR 作成
  - 推奨運用: 新規 worktree 作成は公式 `claude --worktree --tmux` を試し、branch 戦略決定後の操作は本エージェントに委譲
- [ ] **4.2** 実地試用は本計画ではトリガーしない（👀 ユーザー判断、本計画外）

### 受け入れ基準

- [x] `git-orchestrator.md §12` が追加されている
- [x] 文書だけの変更、コード/設定は未変更

---

## Phase 5: 検証 + 計画書のプロジェクト移動

### Steps

- [x] **5.1** 全体検証
- [x] **5.2** 本計画書を `.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md` にコピー（本ファイル、Status=COMPLETED）
- [ ] **5.3** task-tracker END フロー（次工程）
- [ ] **5.4** commit + PR 作成（次工程）
  - 新 branch: `chore/subagent-worktree-tuning`（現 `data-unification/items-meta-redesign` から分岐）
  - pathspec commit: `.claude/hooks/session-start-check.sh` + `.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md` のみ（他チャットの dirty は触らない）

---

## Files（実施結果）

| File                                                                     | Operation | Status       | Notes                                                            |
| ------------------------------------------------------------------------ | --------- | ------------ | ---------------------------------------------------------------- |
| `.claude/worktrees/cleanup-and-consolidation/`                           | Delete    | ✓ 完了       | merged & clean、PR #15、branch -d 完了                           |
| `.claude/worktrees/prototype+mobile-ui/`                                 | Delete    | — Skip       | ユーザー指示で保留                                               |
| `~/dev/Claude/agents-lib/global/role-pm.md`                              | Edit      | ✓ 完了       | self-contained brief 追加（pm 5 項目）                           |
| `~/dev/Claude/agents-lib/global/role-engineer.md`                        | Edit      | ✓ 完了       | self-contained brief 追加（engineer 5 項目）                     |
| `~/dev/Claude/agents-lib/global/role-qa.md`                              | Edit      | ✓ 完了       | self-contained brief 追加（qa 5 項目）                           |
| `~/dev/Claude/agents-lib/global/git-orchestrator.md`                     | Edit      | ✓ 完了       | §2.4 命名規約 + §12 公式機能棲み分け（旧 §12 参考は §13 に移動） |
| `.claude/hooks/session-start-check.sh`                                   | Edit      | ✓ 完了       | 検査 E 追加（worktree dirty 24h、OLDEST_MTIME 採用）             |
| `.claude/docs/vision/plans/2026-05-24-subagent-worktree-improvements.md` | Add       | ✓ 本ファイル | COMPLETED 反映済                                                 |

**注意**: agents-lib 側 4 ファイルは git 管理外（`~/dev/Claude/` は git repo ではない）。バックアップはユーザー側で管理。本 PR には含まれない。PR diff は hook + 本計画書のみ。

---

## Plan Gate matrix（実績）

| Phase / Step                       | Gate | 実績                                       |
| ---------------------------------- | ---- | ------------------------------------------ |
| 1.1 cleanup-and-consolidation 削除 | 🤖   | ✓ 完了                                     |
| 1.2 prototype+mobile-ui 削除       | 🛑   | — スキップ（ユーザー指示）                 |
| 1.3 prototype-mobile 保護          | —    | ✓ 触れず                                   |
| 1.4 命名規約追記                   | 🤖   | ✓ 完了                                     |
| 2.1-2.4 role-\* 編集               | 🤖   | ✓ 完了                                     |
| 3.1 hook 拡張                      | 🤖   | ✓ 完了                                     |
| 3.2 hook 動作確認                  | 🤖   | ✓ 合成テスト fire 確認                     |
| 4.1 git-orchestrator §12 追記      | 🤖   | ✓ 完了                                     |
| 4.2 公式機能試用                   | 👀   | — 本計画外（ユーザー判断）                 |
| 5.1 検証                           | 🤖   | ✓ 完了                                     |
| 5.2 計画書移動                     | 🤖   | ✓ 本ファイル                               |
| 5.3 task-tracker END               | 🤖   | （次工程）                                 |
| 5.4 PR 作成                        | 🛑   | （次工程、ユーザー承認済: 新 branch + PR） |

---

## 非対象（Non-Goals）— 守った範囲

- アプリ本体（`frontend/` `web/` 等）への変更: 一切触れず
- `.mcp.json` / `~/.claude.json` のさらなる編集: 未変更
- Linear connector 切断: 未対応（claude.ai Web UI でユーザー手動）
- `prototype-mobile` worktree への介入: 一切触れず
- 公式 `claude --worktree` への完全移行: 文書化のみ
- Agent View / Agent Teams (experimental) の評価: 別計画で
- Dreaming / Auto memory への移行検討: GA 後に再評価

---

## Lessons Learned（次回計画への引き継ぎ）

1. **agents-lib は git 外**: symlink 一元管理の設計通りだが、PR には含まれないため履歴管理はユーザー側に依存。重要な編集は手動でバックアップが必要
2. **subagent ファイル編集は即座に全プロジェクトに反映**: symlink 経由のため novel / original-card-battle にも影響。プロジェクト固有の変更は `agents-lib/projects/` に分離すべき
3. **hook 検査 E の `OLDEST_MTIME` 採用根拠**: NEWEST だと「最新の dirty が新しいだけで他は古い」ケースで警告が出ない。「ANY ファイルが 24h+ 放置」を検知するには OLDEST が正解
4. **worktree 削除前の re-verification 重要**: PR 履歴 / commit 差分 / outbox 監査だけでは「ユーザーの認識」を捉えきれない。明示的な確認を取ること
5. **ls-files -mo --exclude-standard が status と乖離するケース**: tracked / untracked + .gitignore の組み合わせで結果が変わる。worktree 内の状態確認は status を併用

---

## 次の計画候補（本計画では扱わなかった）

- **MCP インベントリ整理**: プロジェクト別 `.mcp.json` で「life-editor では Gmail/Calendar/Drive を外す」分離
- **Model ルーティング規約**: CLAUDE.md §7 に「メイン = Opus / Explore = Sonnet / 単純抽出 = Haiku」明示（→ Max プラン残量に余裕があるため見送り）
- **Agent View / Agent Teams (experimental)** の評価
- **公式 `claude --worktree`** の実地試用
- **multi-session-coordinator** の自動起動条件拡張（シリアル運用でも起動）
