# Decision Queue — chat-tags-docs

worktree `tags-docs`（担当 = #368 / #474 / #472 / #473）。

### D-20260730-tags-1: ClaudeDesign fan-out 計画書を archive に移すか（CLAUDE.md §6 の「追跡正本」宣言の付け替え）

- 背景: #474 の実測で `docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md` は COMPLETED 相当（brief 9 本 + 実装 PR #160 / #164〜#168 / #170 / #174 / #175 が全 merge・Step 8 以降は別計画が承継）。ただし `.claude/CLAUDE.md:54` と `.claude/docs/design/README.md:21` が本書を「**Web/Mobile UI デザインの追跡正本**」と宣言しており、archive に移すと「正本が完了済み書庫にある」矛盾が出る。承継先の 07-05 / 07-10 も #474 で archive 化済みで、デザイン追跡の実務は Epic #321 + `docs/requirements/mobile-scope.md` + Issue 群へ移っている
- A: COMPLETED 化して archive へ移し、CLAUDE.md §6 の宣言を「デザイン追跡は Epic #321 + mobile-scope.md（完了した fan-out は archive/）」へ書き換える（推奨 — 実態に一致する。ただし CLAUDE.md の SSOT 行を worktree が書き換えることになる）
- B: plans/ に残し、Status 行に「追跡正本として維持中」の根拠を明記する（CLAUDE.md は無変更）
- 放置時: plans/ に IN PROGRESS のまま据え置き。#474 の他 11 本の判定・移動は完了済みなので後続作業はブロックしない
- 期限感: いつでも（#474 の PR merge をブロックしない）
