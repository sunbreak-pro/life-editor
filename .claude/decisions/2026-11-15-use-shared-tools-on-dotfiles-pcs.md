---
id: 2026-11-15-use-shared-tools-on-dotfiles-pcs
type: decision
status: answered
asked: 2026-11-15
answered: 2026-11-15
chat: main
answer: A
topics: [harness, skills, hooks, portability, shared-rules]
refs: ["docs/vision/plans/2026-11-15-align-with-shared-rules.md", "docs/known-issues/031-mac-only-symlinked-skills-agents.md", "CLAUDE.md §7.0"]
supersedes: ["D-20260810-main-2"]
superseded-by: []
implemented-by: []
promoted-to: null
---

# 共通の道具が無い PC を、どう扱うか

## 背景

> 計画書 `docs/vision/plans/2026-11-15-align-with-shared-rules.md` の「こうだいさんに決めてもらう点」の 4 番目から写しました。

- **何が起きているか。** 2026-08-10 の決定（`D-20260810-main-2`）は、「スキルの実体をリポジトリの中に置き、どの PC でも同じものが見える」と決めました。この計画は、スキル 3 本（`merge-round`・`worktree-policy`・`issue-dispatch`）と hook 6 本を、`~/.claude/` の共通の道具に置き換えます。claude-dotfiles を入れていない PC（Mac、リモートのセッション、新しい clone）では、この 3 本と hook が無くなります。
- **なぜ決める必要があるか。** 決めないと、Step 8 でファイルを消してよいかが決まりません。消したあとで Mac から作業すると、秘密の値の検査の hook も動きません。
- **推奨と根拠。** claude-dotfiles を入れた PC だけで作業する案を推奨しました。この PC では数か月、この形で動いているためです。Mac をいまも使っているかは、確かめていません（未確認）。

## 選択肢と裁定

- A: claude-dotfiles を入れた PC だけで作業する（**採用** — ユーザー回答 2026-11-15。Mac は当面そのままにします）。共通の道具（`merge-round`・`worktree-policy`・`issue-dispatch`・`issue-workflow` と hook）はリポジトリに置かず、`~/.claude/` の版を使います。別の PC で作業するときは、先に claude-dotfiles の `install.mjs` を流します。
- B: リポジトリの中にも残す（却下）。共通の道具との食い違いが続き、同じ名前の 5 件を例外の一覧に載せることになるためです。

## 変わらない点

プロジェクト固有のスキルとエージェント（`.claude/skills/` と `.claude/agents/` に残るもの）は、これまでどおり実体をリポジトリに置きます。repo の外を指す symlink を作らない決まり（known-issues 031）も残ります。この決定が置き換えるのは、`D-20260810-main-2` の「どの PC でも同じものが見える」の範囲を、共通の道具まで広げていた点です。

## 波及

- `.claude/skills/` の `merge-round`・`worktree-policy`・`issue-dispatch`、`.claude/hooks/` の 8 本、`.claude/scripts/hooks-lib/` の 4 本、`.claude/scripts/merge-round.mjs`・`scope-overlap.mjs` とそれぞれのテストを消しました。
- `.claude/settings.json` の hook の登録を、`records.mjs index` の 1 本だけにしました。
- claude-dotfiles の無い PC・クラウドのセッション・新しい clone では、commit・起票・merge を止める hook が動かず、`.claude/settings.json` の `permissions.deny` だけが残ります。CI の文書の検査（`scripts/docs-lint.sh`）は、共通の担当表の検査が見つからないときは警告して飛ばします。
