---
Status: IN PROGRESS # Step 1 は 2026-11-11 に回答済み（D-20261111-harness-1 = A）。Step 3 以降は PR #2711 の merge のあと
Created: 2026-11-11
Branch: claude/claude-md-slimming-plan
Owner-chat: harness
Parent: .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md
---

# Plan: CLAUDE.md から経緯の記述を外し、大きさの上限を機械で見る

> 親計画の Phase 3（移送）は「移行完了後」の関門（D-20260806-main-3）で止まっています。この計画は関門を外すものではありません。移行で動かない移送先を持つ記述だけを、先に移す提案です。

---

## Context

- **動機**: `.claude/CLAUDE.md` は毎回読まれます。2026-08-06 の計測では 5,357 tok でした。2026-11-11 に同じスクリプト（`.claude/scripts/context-cost-measure.mjs`）で測ると 9,882 tok で、3 か月で 1.84 倍になっていました。毎回読まれる分の合計（22,304 tok）の 44% を、この 1 ファイルが占めます。
- **増えた理由**: 冒頭の「150 行目標」は守れています（145 行）。増えたのは 1 行の長さです。機能を足したり退役させたりするたびに、決定の日付・Issue 番号・退役の経緯が、同じ行の括弧の中に足されてきました。行数の目標では、これを止められません。
- **どこが増えたか**（2026-08-06 → 2026-11-11、tok）:

  | 節 | 08-06 | 11-11 | 増えた分 |
  | --- | ---: | ---: | ---: |
  | §7 Development Workflows | 2,192 | 3,758 | +1,566 |
  | §5 AI Integration | 120 | 1,063 | +943 |
  | §8 Feature Tier Map | 347 | 1,076 | +729 |
  | §4 Data Model | 436 | 822 | +386 |
  | §2 Platform | 395 | 719 | +324 |
  | そのほか（冒頭・§0・§1・§3・§6・§9） | 1,863 | 2,444 | +581 |
  | 合計 | 5,353 | 9,882 | +4,529 |

  08-06 の値は `docs/reports/2026-08-06-context-fixed-cost-baseline.md` §3.1 と `docs/vision/claude-md-layering.md` §2 の表です。11-11 の値は、同じ係数（ASCII 3.6 字/tok、それ以外 0.9 tok/字）で節ごとに数えた計算です。

- **制約**: D-20260806-main-3 = A（移送は移行完了後）が生きています。関門の理由は「移送先そのものが移行で動く」ことでした。移行は Phase 3 まで終わり、Phase 5 の完了が残っています（移行の元文書の Status 行）。
- **Non-goals**: 節の並べ替えと 2 層への組み直し（親計画の Phase 3 の本体）、スキルの本文の見直し、グローバル側（claude-dotfiles）の直し。

---

## 検討した代替案（必須）

| 案 | 採否 | 却下理由 | 復活条件 |
| --- | --- | --- | --- |
| A: 経緯の記述だけを先に外し、大きさの上限を docs-lint で見る | ✓（2026-11-11 こうだいさんの回答 = D-20261111-harness-1） | — | — |
| B: 今のまま、移行の完了を待つ | ✗ | 3 か月で 1.84 倍になっていて、待つ間も増え続ける | — |
| C: 関門を外して、親計画の Phase 3 を全部いま行う | ✗ | §2〜§5 の構造の移送先は、移行でまだ動く。関門の理由が残っている | 移行の Phase 5 が完了したら |
| D: 行数の目標を厳しくする（たとえば 120 行） | ✗ | 増えたのは 1 行の長さで、行数では測れない | — |

A が関門の理由に当たらないと考える根拠は、移送先です。経緯の移送先は、決定の台帳 `.claude/decisions/D-*.md`、完了した計画書の `.claude/archive/`、要件の `docs/requirements/tier-*.md` で、どれも移行（Electron・Capacitor・Supabase）では動きません。

---

## Scope (Touchable Paths)

```
.claude/CLAUDE.md
.claude/docs/requirements/tier-1-core.md
.claude/docs/requirements/tier-2-supporting.md
.claude/docs/requirements/tier-3-experimental.md
.claude/docs/vision/claude-md-layering.md
.claude/docs/reports/2026-08-06-context-fixed-cost-baseline.md
.claude/decisions/D-20261111-harness-*.md
.claude/skills/worktree-policy/SKILL.md
scripts/docs-lint.sh
.claude/docs/vision/plans/2026-11-11-claude-md-history-offload.md
```

スコープ外の変更が必要になったら、P-008 に従って実装せずにキューへ出します。

---

## Steps

「経緯の記述」は、次の 3 つを指します。退役・移設・作り直しの経緯、決定の日付と「ユーザー確定」の注記、すでに閉じた Issue や PR の番号です。CLAUDE.md には今の状態と、決定の ID（`D-…`）だけを残します。

| # | Step | Gate | Acceptance |
| --- | --- | --- | --- |
| 1 | D-20260806-main-3 の関門を、経緯の記述に限って外すかを決める | 🛑 人手 | こうだいさんの回答を `decisions/D-20261111-harness-1.md` に記録 |
| 2 | 節ごとの今の値を、計測結果のファイルに 1 行追記する | 🤖 自律 | `docs/reports/2026-08-06-context-fixed-cost-baseline.md` に 2026-11-11 の行がある |
| 3 | §8 の括弧の中の経緯を `docs/requirements/tier-*.md` へ移す（1 PR） | 🤖 自律 | §8 が 500 tok 以下。消した記述が移送先にあることを PR 本文に grep で示す |
| 4 | §5 と §2 の経緯を、決定の台帳と計画書への ID 参照に置き換える（節ごとに 1 PR） | 🤖 自律 | §5 が 500 tok 以下、§2 が 450 tok 以下。消失ゼロを grep で示す |
| 5 | §7.3 と §7.4 の hook の細かい説明を、hook のスクリプト冒頭と `worktree-policy` スキルへ寄せる（1 PR） | 🤖 自律 | §7 が 2,800 tok 以下。禁止事項の行は残っている |
| 6 | 冒頭の「150 行目標」を tok の上限に書き換え、`scripts/docs-lint.sh` に上限の検査を足す | 🤖 自律 | 上限を超える CLAUDE.md で docs-lint が失敗し、今の CLAUDE.md で通る |
| 7 | 各 PR の merge | 🛑 人手 | こうだいさんが merge する（P-001） |

Step 3〜5 は、どれも `.claude/CLAUDE.md` を触ります。同じファイルを触る変更は 1 度に 1 本だけ動かす決まりなので、前の PR の merge を待ってから次のブランチを切ります。

---

## Acceptance Criteria (機械検証可能)

- [ ] `node .claude/scripts/context-cost-measure.mjs` で、project の `.claude/CLAUDE.md` が 7,600 tok 以下（今は 9,882 tok）
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` が OK
- [ ] 各 PR の本文に、消した記述が移送先のファイルにあることを示す grep の結果がある（消失ゼロ）
- [ ] `docs/vision/claude-md-layering.md` §4 の「実体の無い禁止」7 件が、CLAUDE.md に文章のまま残っている
- [ ] 完了時に、この計画書と親計画の Status を更新した

7,600 tok は仮の値です。Step 3〜5 の節ごとの上限（§8 500・§5 500・§2 450・§7 2,800）に、動かさない節の今の値 3,266 tok を足すと 7,516 tok になります。Step 2 の測定のあとで、こうだいさんと合わせて見直します。

---

## Risks / Known Issues 参照

- 経緯を消すと、「なぜそうなっているか」を Claude が推測で埋めるおそれがあります。そのため、決定の ID は必ず残します（`rules/records.md` §1 の「2 箇所目以降は ID 参照」）。
- 関門を一部だけ外すと、「どこまでが経緯か」の線引きがあいまいになります。上の 3 つの定義に当たらない記述は、この計画では動かしません。
- 上限の検査を足すと、機能を足す PR が docs-lint で落ちることがあります。落ちたときの直し方（経緯は台帳へ、CLAUDE.md は今の状態だけ）を、検査のメッセージに書きます。

---

## References

- 親計画: `.claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md`（Phase 3）
- 振り分け表: `.claude/docs/vision/claude-md-layering.md`
- 関門の決定: `.claude/decisions/D-20260806-main-3.md`
- 2026-11-11 のハーネスの見直しの報告書: https://claude.ai/artifact/3AFfp1PhQxJs6d2SJwFPZt（8 節）

---

## Worklog

- 2026-11-11: Step 1 は、こうだいさんが A（経緯だけ先に移す）と回答した（D-20261111-harness-1）。Step 2 の再測定を `docs/reports/2026-08-06-context-fixed-cost-baseline.md` §10 に追記した。Step 3 以降は `.claude/CLAUDE.md` を触るので、同じファイルを触る PR #2711 の merge を待ってから、`origin/main` でブランチを切る。

