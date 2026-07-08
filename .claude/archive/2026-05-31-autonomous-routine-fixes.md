---
Status: COMPLETED — 起動前パッチ 6 件を全適用。PR #42 merge 済
Created: 2026-05-31
Branch: fix/autonomous-routine-fixes
Owner-chat: chat-main
Parent: 2026-05-26-autonomous-dev-routine.md
Previous: (none)
Goal: 0 (meta — Routine 機構の起動前安全化)
---

# Plan: Autonomous Routine Fixes (起動前パッチ 6 件)

> PR #37 (`feat: autonomous development routine`) merge 済。Cloud Routine 登録前に発見された構造的不具合 6 件を一括修正する。
> いずれも prompt / 設定 / 文書のみで、frontend や DB には触らない。

---

## Context

- **動機**: PR #37 で導入した Night Routine を `/schedule` 登録する前に、レビューで判明した穴を塞ぐ。Routine 起動後に直すと「最初の数夜が壊れる」コストを払うため、起動前に処理する
- **制約**: frontend / src-tauri / DB に触らない（automation 機構の修正のみ）
- **Non-goals**:
  - Routine 自体の再設計（コスト構造・iteration loop 形は維持）
  - Morning Routine の前倒し登録（MVP 据え置き）

---

## Scope (Touchable Paths)

```
.claude/settings.json                                          # deny list 拡張
.claude/automation/routine-night.md                            # Step 6 / 3.5 / Section H / I / モデル指定
.claude/automation/goals.md                                    # Goal 2 BLOCKED / Goal 3 終端
.claude/automation/README.md                                   # コスト確定情報
.claude/docs/vision/plans/2026-05-26-autonomous-dev-routine.md # Risks 章にコスト確定追記
.claude/docs/vision/plans/2026-05-31-autonomous-routine-fixes.md  # 本ファイル
.claude/memory/chat-main.md / .claude/history/chat-main.md     # task-tracker 経由
```

---

## Components

### Fix 1: deny list 拡張

`.claude/settings.json::permissions.deny` に以下 9 項目を追加（17 → 26 項目）。

- **削除 push の refspec**: `git push * :main*` / `git push * :master*`
- **強制 push の refspec (`+`)**: `git push * +*main*` / `git push * +*master*`
- **`git switch` 系（checkout の代替コマンド）**: `git switch main` / `git switch master` / `git switch -c main*` / `git switch -c master*`
- **force-create checkout**: `git checkout -B main*`（master 版は既存の `git checkout master` で要追加検討、ここでは main 系のみ追加）

実際は対称性のため master 版も追加し合計 9 → 10 項目になる。最終 entries 数は **26**。

### Fix 2: routine-night.md Step 6 の HHMM 欠落

```diff
-`.claude/comm/outbox/chat-auto-<YYYYMMDD>/night-report.md` に以下を追記:
+`.claude/comm/outbox/chat-auto-<YYYYMMDD>-<HHMM>/night-report.md` に以下を追記:
```

Step 2 / Step 7 / Section G の表記と一致させる。

### Fix 3: goals.md の Goal 2 BLOCKED + Goal 3 終端

- **Goal 2 BLOCKED 条件**: 「監査の過程で破壊的変更（既存機能を壊す可能性のあるリファクタ）が必須と判明したらユーザー承認待ちで BLOCKED」を明記、`BLOCKED → Goal 3 へ自動遷移`
- **Goal 3 終端処理**: DONE / BLOCKED 到達後は Routine を `idle 化`。具体的には:
  - 新規 plan 起票のみ続行（実装は走らせない）
  - 新 Goal がユーザー手動で追加されたら通常運用に復帰
  - `goals.md` 末尾に「Terminal State Handling」セクションを追加して明記
- 夜 Routine の Step 3.5 / Section I は「次の PENDING Goal が無ければ idle 化」分岐を追加

### Fix 4: Step 3.5 / Section I の goals.md 単独 commit 経路明文化

「別 worktree を `git worktree add` で切る」を一次選択肢として明記。具体コマンド例も入れる:

```bash
git worktree add ../life-editor-goal-transition/ -b chore/goal-transition-<YYYYMMDD> main
cd ../life-editor-goal-transition/
# goals.md だけ編集 → add → commit → push → draft PR → worktree remove
```

メイン worktree は触らない（`git checkout main` が deny list でブロックされる前提を継承）。

### Fix 5: Section H 並行検出の chat-auto-\* 排他化

```diff
-3. **Owner-chat 検査**: plan frontmatter の Owner-chat が `chat-main` で、かつ最終更新が過去 12h 以内なら弾く（ユーザー本人作業中の可能性）
+3. **Owner-chat 検査**: plan frontmatter の Owner-chat が `chat-auto-*` 以外（= 何らかのユーザー chat）で、かつ最終更新が過去 12h 以内なら弾く（人間 chat の作業中 plan を盗まない）
```

`chat-main` ハードコードから「Routine 以外の全 chat」排他に拡張。

### Fix 6: コスト前提の確定明記

ユーザー確認: **Anthropic Max plan 枠内で課金されない（$0 維持）**。

- `.claude/automation/README.md`「安全則」セクションに「コスト: Max plan 枠内・追加課金なし」を追記
- `.claude/docs/vision/plans/2026-05-26-autonomous-dev-routine.md` の Risks「Cost overrun」行を更新（$1〜3 想定→Max 枠内に訂正）
- `routine-night.md` の「モデル指定」末尾「高コスト警戒」項を削除（誤情報のため）

---

## Steps

| #   | Step                                                          | Gate    | Acceptance                                             |
| --- | ------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| 1   | feature branch 作成（メイン worktree 上で `git checkout -b`） | 🤖 自律 | branch `fix/autonomous-routine-fixes` 上に居る         |
| 2   | 本計画書を Active で起票                                      | 🤖 自律 | このファイル存在                                       |
| 3   | `.claude/settings.json` deny list 拡張 (Fix 1)                | 🤖 自律 | JSON valid + entries=26                                |
| 4   | `routine-night.md` を一括修正 (Fix 2 / 4 / 5 / 6 一部)        | 🤖 自律 | diff が想定範囲内                                      |
| 5   | `goals.md` を更新 (Fix 3)                                     | 🤖 自律 | Goal 2 BLOCKED 行存在 / Terminal State Handling 章存在 |
| 6   | `README.md` + 元計画書 Risks 更新 (Fix 6)                     | 🤖 自律 | $0 維持の文言が両方に存在                              |
| 7   | session-verifier (JSON valid + hook 自己テスト)               | 🤖 自律 | exit 0 / 平文トークンで exit 1                         |
| 8   | task-tracker END (memory / history 更新)                      | 🤖 自律 | per-chat ファイル更新                                  |
| 9   | commit + draft PR 作成                                        | 🛑 人手 | PR URL 取得                                            |
| 10  | ユーザー確認 → merge                                          | 🛑 人手 | main へ merge                                          |

---

## Acceptance Criteria (機械検証可能)

- [ ] `.claude/settings.json` JSON valid（`python3 -m json.tool .claude/settings.json > /dev/null`）
- [ ] deny entries が **26 項目**（`python3 -c 'import json; print(len(json.load(open(".claude/settings.json"))["permissions"]["deny"]))'` == 26）
- [ ] deny に `git push * :main*` / `git push * +*main*` / `git switch main` / `git checkout -B main*` を含む（grep 各 1 件以上）
- [ ] `routine-night.md` Step 6 の outbox パスに `<HHMM>` が含まれる
- [ ] `routine-night.md` Section H Owner-chat 行が `chat-auto-*` 以外を排他する文言に変更
- [ ] `routine-night.md` Section I に `git worktree add` 例が含まれる
- [ ] `routine-night.md` から「高コスト警戒」行が削除
- [ ] `goals.md` Goal 2 ブロックに `BLOCKED 遷移条件` 行が存在
- [ ] `goals.md` 末尾に `Terminal State Handling` セクションが存在
- [ ] `README.md` に「Max plan 枠内」の文言が存在
- [ ] 元計画書 (`2026-05-26-autonomous-dev-routine.md`) Risks 章に Max 枠確定の追記が存在
- [ ] frontend 変更 0 行 (`git diff main..HEAD -- frontend/ | wc -l` == 0)
- [ ] PR diff が ±500 行以内

---

## DB Migration Notes

該当なし。

---

## Risks / Known Issues 参照

- **deny list 過剰**: `Bash(git push * main*)` が `main-foo` branch push もブロック → Routine 設計上は `auto/<slug>` しか push しないので運用影響なし。ユーザーが緊急に `main-hotfix` 等の branch を push したい場合は一時的に deny を緩める必要がある
- **goals.md 別 worktree 経路の複雑さ**: BLOCKED 例外で別 worktree を切る手順が増える → 実運用で詰まったら Section I を更に簡素化（例: `chore/` branch 用の固定 worktree を pre-allocate）
- 関連: `feedback_destructive_git_confirmation.md` / `feedback_branch_protection.md`

---

## References

- 元計画書: `.claude/docs/vision/plans/2026-05-26-autonomous-dev-routine.md`
- PR #37: `feat: autonomous development routine`
- CLAUDE.md §7.3 Plan Gate Convention / §7.4 Multi-chat Worktree Policy

---

## Worklog

- 2026-05-31: chat-main がレビュー結果 6 件を集約、本計画書起票
