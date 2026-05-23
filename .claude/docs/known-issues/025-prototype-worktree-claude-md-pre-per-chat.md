# 025: prototype+mobile-ui worktree の CLAUDE.md が per-chat 化前のスナップショット

**Status**: Active (Workaround あり)
**Category**: Structural
**Severity**: Minor
**Discovered**: 2026-05-23

## Symptom

`.claude/worktrees/prototype+mobile-ui/.claude/CLAUDE.md` が per-chat 化 (main の commit `4497606` 周辺) 以前のスナップショットのまま残存。具体的には:

- §0 Meta「関連」節が `MEMORY.md`(タスク) / `HISTORY.md`(履歴) を直参照
- §7.0 Development Workflows の進捗記録行が `task-tracker (MEMORY.md / HISTORY.md)`
- §9 Document System が「MEMORY/HISTORY はセッション単位 (task-tracker 経由)」

一方で同 worktree の `.claude/MEMORY.md` / `.claude/HISTORY.md` 先頭には 2026-05-23 凍結マーカー (`🧊 FROZEN since 2026-05-23`、新規書き込みは `.claude/memory/chat-<name>.md` / `.claude/history/chat-<name>.md` に書く指示) が追記済 → CLAUDE.md とマーカーが矛盾している。

## Root Cause

`prototype/mobile-ui` ブランチが per-chat 化 (main の commit `4497606`「docs(infra): MEMORY/HISTORY per-chat — Phase 1 QA Minor/Nit 5 件解消」周辺) 以前に分岐済で、CLAUDE.md の per-chat 化更新が伝播していない。

git worktree は同一リポジトリの異なる checkout を別ディレクトリに展開する機構だが、`.claude/` 配下のファイルもブランチごとに完全独立で管理されるため、main worktree で CLAUDE.md を更新しても prototype worktree には届かない (cherry-pick / merge / rebase 等の明示的な操作が必要)。

## Impact

prototype worktree で新規 Claude セッションを開始するとき、CLAUDE.md は Claude Code 起動時に auto-load される。Claude は per-chat 機構不在の前提で `MEMORY.md` / `HISTORY.md` 直参照を指示されるが、実 MEMORY.md / HISTORY.md には凍結マーカー (2026-05-23) が貼られていて「読み取り専用 / 新規書き込み禁止」と書かれている。結果:

- Claude が混乱し凍結ファイルへの追記を試みる可能性
- 「どちらを正と見るか」(CLAUDE.md の指示 vs 凍結マーカー) が prototype 担当ユーザーから見て不明瞭

実害は限定的:

- task-tracker は legacy モードへフォールバックする (main の per-chat 仕組みは prototype の `.claude/memory/` が存在しないので発火しない)
- 機能破綻はないが、運用上の混乱の温床になる

## Fix / Workaround

- **Workaround** (推奨): prototype 担当チャットが main を merge して CLAUDE.md を per-chat 対応版に揃える。同時に `.claude/memory/` / `.claude/history/` ディレクトリ + INDEX も取り込まれるので、prototype worktree でも per-chat 機構が起動する
- **暫定**: prototype 担当が新規セッション開始時に「凍結マーカーが正、CLAUDE.md は旧版」と認識する運用 (本 known-issue を読むことで成立)
- **恒久対応候補**: Phase 4 (worktree 横断・正本パス解決) で、CLAUDE.md 自体も main 正本を絶対パス参照する設計に統一する余地あり (例: prototype 側の `.claude/CLAUDE.md` を main の symbolic link / stub にする運用)

## References

- 関連 plan: `.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md` (Phase 4 worktree 横断)
- 関連 file:
  - `.claude/worktrees/prototype+mobile-ui/.claude/CLAUDE.md` (旧版のまま)
  - `.claude/worktrees/prototype+mobile-ui/.claude/MEMORY.md` (凍結マーカー追記済)
  - `.claude/worktrees/prototype+mobile-ui/.claude/HISTORY.md` (凍結マーカー追記済)
- 関連 commit: main の per-chat 化 (commit `4497606` 周辺、本作業含む)

## Lessons Learned

worktree が長期分岐していると `.claude/` 系メタファイル (CLAUDE.md / MEMORY.md / HISTORY.md / INDEX 等) の更新伝播が完全に途切れる。**per-chat 化のような構造変更時は、active worktree 一覧 (`git worktree list`) を確認し、各 worktree で同期措置を打つか、本件のように known-issue 化して運用上の認識を揃える運用が必要**。

検索キーワード: `worktree`, `per-chat`, `CLAUDE.md`, `凍結マーカー`, `prototype`, `mobile-ui`, `MEMORY.md`, `HISTORY.md`, `auto-load`, `分岐ドリフト`.
