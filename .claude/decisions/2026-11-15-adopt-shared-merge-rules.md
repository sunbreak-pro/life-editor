---
id: 2026-11-15-adopt-shared-merge-rules
type: decision
status: answered
asked: 2026-11-15
answered: 2026-11-15
chat: main
answer: A
topics: [merge-gate, policy, harness, shared-rules]
refs: ["docs/vision/plans/2026-11-15-align-with-shared-rules.md", "comm/decisions/POLICY.md", "issue-workflow.md", "CLAUDE.md §7.2"]
supersedes: ["D-20261102-main-1", "D-20260806-main-1"]
superseded-by: []
implemented-by: []
promoted-to: "POLICY P-001（改定）"
---

# merge の方針を、共通の決まりに合わせるか

## 背景

> 計画書 `docs/vision/plans/2026-11-15-align-with-shared-rules.md` の「こうだいさんに決めてもらう点」の 1 番目から写しました。

- **何が起きているか。** このリポジトリの方針（`POLICY.md` の `P-001`）は、merge をこうだいさんが行うか、こうだいさんが merge の手順を起動した回に限ります。2026-08-06 の決定は、条件つきの自動の merge を認めませんでした。共通の決まり（claude-dotfiles の `claude/docs/development-flow.md` の「merge」）は、手順と検証の条件を満たした PR を、Claude Code が確認なしで merge してよいとしています。設定・hook・秘密の値・データベースの変更を含む PR は、共通の hook が止めて、こうだいさんの確認に回します。
- **なぜ決める必要があるか。** 決めないと、計画書の Step 8 で方針の文書と `mergePolicy` を書けません。共通の hook は、条件が欠けた merge を「確認」ではなく「停止」にします。方針と hook の動きが食い違ったまま切り替えると、merge の手順が途中で止まります。
- **推奨と根拠。** 共通の決まりに合わせる案を推奨しました。こうだいさんが 2026-11-11 に全プロジェクトの決まりとして決め、original-card-battle でも 2026-11-14 に同じ案を選んだためです。共通の hook は、確かめたあとに PR へ commit が足されていないこと、全体確認が通っていること、別の役の確認の記録があることの 3 つを、機械で確かめます。

## 選択肢と裁定

- A: 共通の決まりに合わせる（**採用** — ユーザー回答 2026-11-15）。条件を満たした PR は、chat-main か、`issue-workflow` の仕上げ役 `work-finishers` が、共通の `merge-round` で入れます。承認が要る種類の PR は、共通の hook が止め、chat-main が merge-round を回して、こうだいさんがその場で決めます。定時の実行と無人のループは merge しません。
- B: いまの方針のままにする（却下）。共通の例外の一覧（claude-dotfiles の `claude/docs/exceptions.md`）に 1 行足し、「人が起動した回だけ通す」仕組みを共通の hook に足す依頼が要ります。その依頼が済むまで、共通の道具へ切り替えられないためです。

## 却下案が復活する条件

共通の hook が止めるべき merge を通した、または条件を満たした merge のあとに戻せない失敗が起きたとき。

## 波及

- `comm/decisions/POLICY.md` の方針「merge と main への取り込み」（`P-001`）の行を書き換えました。
- `issue-workflow.md` の `mergePolicy`・「仕上げ」・「実行のあと」から、承認の印（`.git/merge-round/finisher-approved.json`）と merge のコマンドの形を外しました。merge のコマンドの形は、共通の `merge-round.mjs check` が表示します。
- `CLAUDE.md` §7.2、`automation/README.md`、`automation/run-routine.ps1` のコメント、`skills/add-feature/SKILL.md`、`docs/vision/claude-md-layering.md` を合わせました。
- 置き換えた決定は、2026-11-02 の merge-round の決定（`D-20261102-main-1`）と、2026-08-06 の「条件つきの自動の merge を開けない」決定（`D-20260806-main-1`）です。
