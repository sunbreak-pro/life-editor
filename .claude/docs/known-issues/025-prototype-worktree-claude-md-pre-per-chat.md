# 025: prototype+mobile-ui worktree の CLAUDE.md が per-chat 化前のスナップショット

**Status**: Fixed
**Category**: Structural
**Severity**: Minor
**Discovered**: 2026-05-23
**Resolved**: 2026-05-24

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

- **採用された解** (2026-05-24): `prototype/mobile-ui` ブランチを PR #12 (commit `bc7d87d`) で main に merge → prototype worktree は削除 (`git worktree remove`)。さらに後続の cleanup PR #13 で main の `CLAUDE.md` も per-chat 機構を SSOT として明示する形に正式更新済 (L14/L15 で `memory/INDEX.md` / `history/INDEX.md` を関連節に明記、L181/L228 で task-tracker per-chat fallback を明記)
- **副次効果**: 新しく追加された worktree (例: `cleanup-and-consolidation`) は merge 済の per-chat 対応 CLAUDE.md + `.claude/memory/` + `.claude/history/` + INDEX を最初から保持しているため、本件と同種のドリフトは構造的に再発しない
- **恒久対応候補** (残課題): Phase 4 (worktree 横断・正本パス解決) で、CLAUDE.md 自体を main 正本に symlink / stub 化する設計は依然有効。新規 worktree が長期分岐したら同様の drift が発生し得るため、計画書 `2026-05-23-memory-history-per-chat-split.md` Phase 4 として継続検討

## References

- 関連 plan: `.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md` (Phase 4 worktree 横断)
- 関連 file (削除済): `.claude/worktrees/prototype+mobile-ui/.claude/{CLAUDE,MEMORY,HISTORY}.md` (merge 後 worktree ごと削除)
- 関連 commit:
  - main の per-chat 化 (commit `4497606` 周辺)
  - prototype 凍結マーカー追記 + 参照手段追加 (prototype 側 commit `e054b96`、本作業)
  - prototype merge to main (PR #12, commit `bc7d87d`、2026-05-24)
  - main CLAUDE.md 正式 per-chat 化 (cleanup PR #13, commit `9688632` 関連)

## Lessons Learned

worktree が長期分岐していると `.claude/` 系メタファイル (CLAUDE.md / MEMORY.md / HISTORY.md / INDEX 等) の更新伝播が完全に途切れる。**per-chat 化のような構造変更時は、active worktree 一覧 (`git worktree list`) を確認し、各 worktree で同期措置を打つか、本件のように known-issue 化して運用上の認識を揃える運用が必要**。

検索キーワード: `worktree`, `per-chat`, `CLAUDE.md`, `凍結マーカー`, `prototype`, `mobile-ui`, `MEMORY.md`, `HISTORY.md`, `auto-load`, `分岐ドリフト`.
