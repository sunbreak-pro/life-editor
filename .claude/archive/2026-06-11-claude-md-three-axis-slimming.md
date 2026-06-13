---
Status: COMPLETED (2026-06-11, PR #71)
Created: 2026-06-11
Branch: docs/claude-md-three-axis-slimming
Owner-chat: main
---

# Plan: CLAUDE.md 三軸スリム化（253 行 → 150 行前後）

## Context

- **動機**: 公式ガイダンス（code.claude.com/docs/en/memory / best-practices）は CLAUDE.md を 200 行以下とし、長文化を "over-specified CLAUDE.md" アンチパターン（重要ルールがノイズに埋もれ半分無視される）と明記。Fable 5 公式ガイドも「規定しすぎた指示は品質を下げる」と明言
- **編集原則 = 3 軸**: ①推測できない事実（コマンド・不変式・gotcha）②委譲ポインタ（手順は本文に持たない）③安全境界（事故実績ベース）。各行に「消したら Claude が間違うか？」テストを適用
- **制約**: 章番号 §0-§9 は維持（`coding-principles.md` §6-7 / 移行 SSOT §8 が章番号を参照中）。3 軸は章構成ではなく編集基準として適用

### Non-goals

- グローバル `~/.claude/CLAUDE.md`・dotfiles rules/ は対象外
- agents-lib の Tauri 時代 §参照修正・`coding-principles.md` の Tauri 時代記述改訂・スキル本文の de-prescribe は別タスク
- 情報の完全消去はしない（git 履歴 + 移管先に残る）

## Scope (Touchable Paths)

```
.claude/CLAUDE.md
.claude/rules/frontend.md
.claude/docs/vision/plans/2026-06-11-claude-md-three-axis-slimming.md
.claude/memory/chat-main.md
.claude/history/chat-main.md
```

## Steps

| #   | Step                                                                 | Gate | Acceptance                           |
| --- | -------------------------------------------------------------------- | ---- | ------------------------------------ |
| 1   | 本計画書を作成                                                       | 🤖   | ファイル存在 + frontmatter 完備      |
| 2   | `.claude/rules/frontend.md` 新規作成（§6 詳細の移管先・path-scoped） | 🤖   | `paths:` frontmatter が公式構文      |
| 3   | `.claude/CLAUDE.md` を章別ディスポジション通りに書き換え             | 🤖   | `wc -l` ≤ 160                        |
| 4   | 機械検証: 不変式 grep / 参照パス実在チェック                         | 🤖   | チェックリスト全項目 hit、参照切れ 0 |
| 5   | 一時 worktree → pathspec commit → push → PR                          | 🤖   | PR URL 取得、diff が Scope 内のみ    |
| 6   | PR diff レビュー                                                     | 👀   | ユーザー確認                         |
| 7   | PR merge                                                             | 🛑   | ユーザー操作                         |
| 8   | task-tracker 記録                                                    | 🤖   | chat-main.md 更新                    |

## Acceptance Criteria (機械検証可能)

- [ ] `wc -l .claude/CLAUDE.md` ≤ 160
- [ ] 不変式チェックリスト（DataService 境界 / items_meta / Mobile 省略 Provider / tsc -b / worktree policy / .mcp.json / apply_migration 禁止 / 音源 gitignore / per-chat 機構 / Plan Gate / IME / notion-\*）が CLAUDE.md または rules/frontend.md に grep で存在
- [ ] 新 CLAUDE.md 内の相対パス参照が全て実在
- [ ] PR 作成済み・diff が Scope 宣言パスのみ

## References

- 承認済み詳細プラン（章別ディスポジション表含む）: `~/.claude/plans/synthetic-wondering-widget.md`
- 公式: https://code.claude.com/docs/en/memory / https://code.claude.com/docs/en/best-practices
- Fable 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
