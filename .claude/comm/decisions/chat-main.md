# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260731-main-2: `[all]` shared-fix Issue の二重着手をどう防ぐか

- 背景: 2026-07-31 に同じ Issue を 2 レーンが同時に掴む事象が 2 回。#473 = mobile-refine(PR #498 merge) と tags-docs(`claude/tags-473-...` commit 0) / #499 = mobile-refine(PR #501 merge) と tags-docs(`3564a89b` で自主的に parking)。どちらも実害は出なかったが、気付きが遅れれば片方の実装が丸ごと無駄になる
- A: 着手時に `gh issue edit <n> --add-assignee` で自分を assign し、着手前に assignee 有無を確認する（推奨 — GitHub 側の状態だけで判定でき、outbox の読み落としに依存しない）
- B: 着手時に Issue へ「着手します（<worktree-slug>）」と 1 行コメントする（軽いが、コメント欄が流れると見落とす）
- 実地の動き（2026-07-31 追記）: 回答を待たずに **schedule-refine が B を自発的に始めた**（#503 に「着手宣言: chat-schedule-refine が拾います」+ 触るファイル範囲 + 異議があれば返信、のコメント）。B は運用開始済みなので、判断は実質「A を足すか / B だけで足りるか」になっている
- 放置時: 現状維持（早い者勝ち + 気付いた側が parking）。実害が出た時点で再検討
- 期限感: いつでも（次に `[all]` の Issue を起票する前までに決まっていると良い）

## D-20260731-main-1: schedule レーンが空回りのままなら #467 / #468 を chat-main が引き取ってよいか（取り下げ）

> 2026-07-31 取り下げ。schedule-refine が `claude/schedule-468-ledger-filter` で #468 に着手したため、前提（レーンが空回り）が消えた。放置時の挙動どおり A（レーンを待つ）で確定。再び数サイクル止まったら起票し直す。

- 背景: #467 / #468 は `section:schedule`（schedule-refine 担当）。2026-07-31 時点で schedule-refine worktree は merge 済みの `claude/schedule-469-gate-docs` に居座り、#467/#468 のブランチは local / origin どちらにも無い（着手ゼロ）。#473 は tags-docs が local ブランチで着手済み
- A: schedule レーンの手番を待つ（推奨 — 1 worktree = 1 チャットの担当分離を崩さない。ラベル routing の前提が守られる）
- B: chat-main が一時 worktree を切って #467 → #468 を実装する（レーン競合のリスクあり。schedule-refine が同じ Issue に着手すると二重実装になる）
- 放置時: A。chat-main は merge gate に徹し、#467/#468 は着手せず監視のみ
- 期限感: いつでも（急がないが、schedule レーンが数サイクル止まったままなら判断が要る）
