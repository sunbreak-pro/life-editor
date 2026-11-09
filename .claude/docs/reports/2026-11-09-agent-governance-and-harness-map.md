# AI エージェント運用の判断枠組みと、life-editor ハーネスの地図（2026-11-09）

> 調査断面: life-editor `551f7fb`（main）/ claude-dotfiles `3516ba2`（main）。
> 調査方法: 両リポジトリの CLAUDE.md・rules・skills・agents・hooks・settings・decisions・plans を読み、`context-cost-measure.mjs`（`CLAUDE_GLOBAL_DIR` に dotfiles の clone を指定）と `docs-lint.sh` / `records.mjs check` を手元で回した。サブエージェントは使っていない。
> 位置づけ: こうだいさんの依頼「AI エージェントを使うとき、何を見張り、何を知り、何を任せるかを決めてから、ハーネス（CLAUDE.md・`.claude/`・hooks）の中身を把握し、実践する」への回答。Gemini 案の 4 原則（仮説の提示 / テスト通過 ≠ 完了 / 説明できないコードの排除 / 確認の問い）を既存のハーネスに重ねて穴を探し、埋め方を rule 1 本と PR テンプレート 1 本にした（[`rules/human-in-the-loop.md`](../../rules/human-in-the-loop.md) / [`.github/pull_request_template.md`](../../../.github/pull_request_template.md)）。

---

## 0. 要旨

1. ハーネスは 2 層（グローバル = claude-dotfiles が `~/.claude/` に配る分、プロジェクト = `.claude/`）で、すでに「ユーザーは見ていない」前提（非同期）で組まれている。Gemini 案の 4 原則は同期の確認を増やす方向に読めるが、この前提と両立する形は「止まって待つ」ではなく「決まった場所に書いて残す」である。人が止まる場所は既存の 👀 / 🛑 Gate（計画書の UI 確認・DDL push・merge・不可逆操作）に限る。
2. 4 原則のうち、1（仮説）と 2（検証の範囲）は半分ある。スコープ宣言と session-verifier の Verdict 表が「何を触るか」「どのゲートが通ったか」を書くが、「どういう仕組みで動く想定か」「何を確かめていないか」は書かない。3（読む順）は PR 本文の要約だけで、4（確認の問い）は無い。
3. 今回足したのは常駐 rule 1 本と PR テンプレート 1 本で、どちらも宣言であり機械の実体は無い。実体の候補（PR 本文の見出し検査 hook）は §4.2 に置き、判断はキューに積んだ（§5）。
4. 人が握るものは 5 つ（目的と優先順位 / 不可逆操作 / A・B に割れる判断 / Scope・AC の変更 / 差分を説明できるかの最終判定）で、それ以外は任せる。見張るのは「自己免除」「緑 = 完了の報告」「捏造」「固定費の肥大」「ハーネス自体の腐り」の 5 つで、それぞれ既存の部品が受け持つ（§1）。
5. 副産物として、常駐コストの支配項がプロジェクト側に移っていた。2026-08-06 の計測ではグローバル側が約 66% だったが、今日はプロジェクトの CLAUDE.md 1 本（33,202 B）だけで、グローバル側の常駐の合計を超えている（§2.3）。本報告はこれを直さない（`loop-prune` と移行後の Phase 3 の担当）が、見張る対象として記録した。

---

## 1. 判断枠組み — 握る / 任せる / 見張る / 知っておく

### 1.1 人が握るもの（AI に任せない）

| 握るもの | なぜ | 受け持つ部品 | 実体 |
| --- | --- | --- | --- |
| 目的・Non-Goals・優先順位 | 判断を委ねるための基準そのもので、AI は推論で埋められない | CLAUDE.md §1 / `comm/decisions/POLICY.md`（P-001〜P-008） | 宣言 |
| 不可逆操作（DDL push・シークレット・merge・force 系 git・本番） | 取り返しがつかない | P-007 / P-001 / `settings.json` の deny と ask / `hooks/merge-gate.mjs` | 機械 |
| A / B に割れる判断と、UX が変わる分岐 | 正解が 1 つに決まらない | `rules/decision-queue.md` / `comm/decisions/chat-*.md` / P-005 | 宣言 |
| Scope・AC の変更 | AI が自分で免除すると計画が意味を失う（[2026-08-09 の報告](./2026-08-09-harness-loop-redesign.md) H3 / H4） | P-008 / `plans/_TEMPLATE.md` の Scope と AC / `scripts/scope-overlap.mjs` | 半分（照合は機械、免除の禁止は宣言） |
| 差分を読んで説明できるかの最終判定 | 説明できないコードは、次に壊れたとき誰も直せない | 今回の rule 3 と PR テンプレートの「読む順」 | 宣言（今回新設） |

### 1.2 AI に任せるもの

| 任せるもの | 受け持つ部品 | 人が見るのは |
| --- | --- | --- |
| ティア判定と工程の采配 | `lead-pipeline`（軽 / 中 / 重）・`hooks/pipeline-gate.mjs`（グローバル） | 重ティアの計画書だけ |
| 実装と単体テスト | `role-engineer`（Opus）・`loop-implement` | PR の差分と「読む順」 |
| 型 / lint / test のゲート回し | `session-verifier`（Gate 0〜5）・`scripts/local-ci.mjs` | Verdict 表の SKIP と「確かめていないこと」 |
| 独立監査 | `role-qa`・`security-reviewer`・`life-editor-migration-validator`・`life-editor-sync-auditor` | Blocking の有無 |
| 調査・棚卸し | Explore・`harness-reflect`・`scripts/known-issue-usage.mjs`・`scripts/context-cost-measure.mjs` | 件数そのものより月ごとの変化 |
| 記録 | `task-tracker`・`scripts/records.mjs`・派生 INDEX | 乖離レビュー 3 行 |
| 並列の采配と仕上げ | `issue-workflow`・`work-finishers`・`merge-round`（回の起動は人） | 回の事前確認の表 |

### 1.3 見張るもの（監視点）

| 監視点 | 何が起きるか | 検出する部品 | 足りないところ |
| --- | --- | --- | --- |
| 自己免除 | AI が Scope や AC を自分で緩めて続行する | P-008・`task-tracker` END の乖離レビュー 3 行・`role-qa` の「採用案からの逸脱」 | 照合の hook は未実装（2026-08-09 報告の Phase D） |
| 「緑 = 完了」の報告 | SKIP したゲートや jsdom で見えない経路が「通った」に丸まる | Verdict の SKIP 欄・CLAUDE.md §7.1 の罠・`japanese.md`（グローバル）の報告の節 | 「何を確かめていないか」を書く欄が無い。今回の rule 2 で埋める |
| 捏造 | 無い file:line・無い数字・「merge された」の断言 | `docs-consistency.md` §5（サブエージェント報告の実測必須則）・`japanese.md`「成功したと書くのは引用できるときだけ」 | 宣言のみ |
| 固定費の肥大 | 常駐の文書が増えてセッションが重くなる | `scripts/context-cost-measure.mjs`・`loop-prune`・`docs/vision/claude-md-layering.md` | 測るのは人の起動待ち。§2.3 のとおり既に進んでいる |
| ハーネス自体の腐り | 参照先が消えた・2 か月起動ゼロ・担当表が古い | `scripts/docs-lint.sh`（CI）・`harness-reflect`・`scripts/scope-overlap.mjs --selftest`・dotfiles の `check-freshness.mjs` と `test/` | グローバル側は人の起動待ち |

### 1.4 知っておくべきこと

- **規範は宣言、強制は決定論**。禁止のうち機械の実体があるのは main への push・merge・トークン平文・派生 INDEX の混入・tracker の混入で、[`docs/vision/claude-md-layering.md`](../vision/claude-md-layering.md) §4 の表に実体の無い禁止が残っている。文章だけの禁止は破られる前提で読む。
- **3 前提（ユーザーは見ていない / 範囲を限定する / 並列で進める）はグローバル CLAUDE.md が正本**で、プロジェクト側の `decision-queue.md` は前提 1 の実装である。Human-in-the-Loop の施策はこの前提を壊さない形にする。
- **Gate の語彙は 🤖 自律 / 👀 目視 / 🛑 人手の 3 つ**（`plans/_TEMPLATE.md`）。人が止まる場所は後ろの 2 つだけで、それ以外は書いて進む。
- **どこに書くかは [`rules/records.md`](../../rules/records.md) §2 の 1 分判定**で決まる。これを知らないと記録が散る。
- **merge-round は Refs の無い実装 PR を止める**（`scripts/merge-round.mjs` の hold）。Issue の無い PR はこうだいさんが手で merge するか、chat-main が Issue を起票してから回に入れる。本 PR もこれに当たる。
- **グローバル側の hooks はプロジェクト側と役割が違う**。グローバルは「秘密ファイルを開かない」「実装語を見たら lead-pipeline を指す」「整形」で、プロジェクトは「commit と merge の形を守る」である。両方を読まないと、どこで止まるかが分からない。

---

## 2. ハーネスの地図（2 層）

### 2.1 どこに何があるか

| 層 | グローバル（claude-dotfiles `claude/` を `~/.claude/` に配る） | プロジェクト（life-editor `.claude/`） |
| --- | --- | --- |
| 常駐 | CLAUDE.md（3 前提・Working Rules）/ `rules/japanese.md` / output style `tone-persona` | CLAUDE.md（不変式の SSOT）/ `rules/decision-queue.md` / `rules/design-first-planning.md` / 今回の `rules/human-in-the-loop.md` |
| 条件付き（`paths:`） | `harness-management.md`（skills・agents を触るとき）/ `plan-mode-quality.md`（plans） | `frontend.md`（shared / web）/ `records.md`（`.claude/`）/ `docs-consistency.md`（docs・archive・CLAUDE.md） |
| 手順（skills） | lead-pipeline / session-verifier / task-tracker / code-plan-editor / code-review / git-workflow / execution-router / issue-workflow / harness-reflect / pdca-loop / finished-work / visual-inspect / html-report ほか | add-component / add-feature / db-migration / test-writing / docs-workflow / worktree-policy / issue-dispatch / merge-round / design-critique / dev-digest / loop-implement ほか loop 系 ほか（一覧はディレクトリが正） |
| 役（agents） | role-pm（Sonnet）/ role-engineer（Opus）/ role-qa（Sonnet）/ security-reviewer / playwright-ui-verifier / work-finishers / web-researcher ほか | life-editor-migration-validator / life-editor-sync-auditor（監査のみ。コードを変えない） |
| 機械（hooks） | UserPromptSubmit = pipeline-gate / PreToolUse = protect-files（秘密ファイル）・skill-launch-notice / PostToolUse = prettier / SessionStart・Stop = sui-memory | SessionStart = 派生 INDEX の再生成と宣言の整合検査 / PreToolUse(Bash) = トークン平文・派生 INDEX 混入・tracker 混入・merge-gate |
| 機械（permissions） | deny = `rm -rf`・force push・`reset --hard`・`clean -f`。allow = Edit / Write / WebSearch / Agent | deny = main への push の全形・force・`reset --hard`・`branch -D`・`checkout main`。ask = `supabase db push` |
| 記録 | `.claude/MEMORY.md` / `HISTORY.md`（dotfiles 自身の作業） | `decisions/D-*.md`（確定）/ `comm/decisions/`（未決・POLICY・ANSWERS）/ `memory/` `history/`（per-chat）/ `docs/vision/plans/` と `archive/` / `docs/known-issues/` |
| 検査 | `test/*.test.mjs`（hooks の精度・settings の合成・freshness） | `scripts/docs-lint.sh`（CI）/ `scripts/local-ci.mjs` / `scripts/records.mjs check` / `scripts/scope-overlap.mjs` / `hooks/__tests__/` |

### 2.2 1 つの実装が通る道と、人が止まる場所

| 工程 | 部品 | 人の手番 |
| --- | --- | --- |
| 依頼 | `pipeline-gate.mjs` が実装語を見て lead-pipeline を指す | 依頼文を書く |
| 計画 | 中 = スコープ宣言（今回、仕組みの仮説を足す）/ 重 = role-pm → code-plan-editor（`_TEMPLATE.md`）。画面が変わるなら design-first-planning | 重ティアの計画書と試作を確かめる（👀） |
| 実装 | role-engineer か メイン・worktree-policy・scope-overlap | 止まらない |
| 検証 | session-verifier の Verdict → role-qa / playwright-ui-verifier。手元 CI = local-ci | 止まらない。Verdict の SKIP と「確かめていないこと」を読む |
| 記録 | task-tracker（専用ブランチ）・乖離レビュー 3 行 | 止まらない |
| PR | git-workflow / work-finishers。本文は `Refs #N`（Closes 禁止）。今回、仮説と実際・確かめていないこと・読む順・確認の問いが加わる | PR 本文を読んで差分を説明できるか確かめる |
| merge | merge-round（chat-main・回の事前確認）/ merge-gate | 回を起動するか、手で merge する（🛑） |
| 着地後 | 実ブラウザ確認（chat-main）・db push・Issue close | 🛑 と 👀 |
| 改善 | loop-postmortem / harness-reflect / loop-prune | 起動は人 |

### 2.3 今日の常駐コスト（概算）

計測 = `CLAUDE_GLOBAL_DIR=<dotfiles の clone>/claude node .claude/scripts/context-cost-measure.mjs`。係数は 2026-08-06 の計測と同じで、概算の誤差も同じ（±30% 程度）。バイト数は正確である。

| 対象 | 概算 tok | バイト | 備考 |
| --- | ---: | ---: | --- |
| project `.claude/CLAUDE.md` | 9,648 | 33,202 | 2026-08-06 は 5,357 tok、2026-09-02 は 24,843 B（[`plans/2026-09-02-fable-51-harness-retune.md`](../vision/plans/2026-09-02-fable-51-harness-retune.md) §実測） |
| project `rules/design-first-planning.md` | 1,441 | 4,883 | 2026-10-28 新設 |
| project `rules/human-in-the-loop.md` | 826 | 2,788 | 今回新設 |
| project `rules/decision-queue.md` | 370 | 1,256 | |
| global `CLAUDE.md` | 1,236 | 4,198 | 2026-08-06 は 1,991 tok |
| global `rules/japanese.md` | 1,831 | 6,153 | 2026-08-06 は rules 8 本で 4,317 tok |
| global output style `tone-persona` | 476 | 1,595 | 2026-08-06 は 1,338 tok |
| **always 合計** | **15,828** | **54,075** | 2026-08-06 は 13,223 tok |
| listing（skills の description） | 6,116 | 21,066 | project 19 本 2,866 / global 17 本 2,211 ほか |

読み方: グローバル側は 2026-09-02 の Fable 5.1 向け改訂で痩せ、プロジェクト側の CLAUDE.md が 2 か月で 8.4 KB 増えて、支配項が入れ替わった。今回の rule は always の約 5% で、`design-first-planning.md` の 6 割の重さである。これ以上 rules を常駐で足すときは、`paths:` で条件付きにできないかを先に考える（`loop-prune` の「環境の事実」）。

---

## 3. Gemini 案の 4 原則との照合

| 原則 | すでにあるもの | 穴 | 今回の埋め方 | 実体 |
| --- | --- | --- | --- | --- |
| 1. 仮説と期待値を先に出す | lead-pipeline のスコープ宣言（触るファイル / 完了条件 / 触らないもの）・計画書の Context と「検討した代替案」・role-pm の仮定表・design-first-planning | 宣言は「何を触るか」で、「どういう仕組みで動く想定か」が無い。中ティアは計画書を通らない | rule 1: 宣言に仕組みの仮説を 1〜3 行足す。PR テンプレートの「仮説と実際」で突き合わせる | 宣言 |
| 2. テスト通過 = 完了にしない | Verdict 表（ゲート別・要約禁止）・SKIP の理由・local-ci の終了コード表・引き継ぎ表の「検証の結果 N/M」・CLAUDE.md §7.1 の罠 | 「そのテストで何を確かめ、何を確かめていないか」を書く欄が無い。緑の表だけが残る | rule 2: 「確かめたこと / 確かめていないこと（誰がいつ）」を PR 本文に分けて書く | 宣言 |
| 3. 説明できないコードを作らない | PR 本文の要約（D-20260801-main-1 で PR 本文側に要約を書くと決めた）・`japanese.md` の「読み手が知らない呼び名を出さない」・コメントは why だけ | 差分をどの順で読めば仕組みが追えるかが無い。こうだいさんが説明できるかを誰も確かめない | rule 3: 3 ファイル超か一読で追えないときは「読む順」を書く | 宣言 |
| 4. 理解のずれを問いで確かめる | 最後に AskUserQuestion でまとめて聞く（グローバル前提 1）・判断キューの A/B | 聞くのは「決めてほしいこと」だけで、「読み手が理解できたか」を確かめる問いは無い | rule 4: 重ティアと自明でない中ティアで、確認の問いを 1〜3 つ（答えは折りたたみ） | 宣言 |

4 原則と 3 前提の折り合い: 原則 1 の「把握・検証できるようにしてから実装へ」を文字どおりに取ると、中ティアごとに止まることになり、前提 1 と衝突する。今回は「書いてから進む」を既定にし、止まるかどうかはキュー D-20261109-harness-1 でこうだいさんに聞く。重ティアはもともと計画書で止まる（design-first-planning と `_TEMPLATE.md` の 👀 Gate）ので、原則 1 をすでに満たしている。

---

## 4. 今回入れたものと、次の候補

### 4.1 入れたもの（この PR）

- [`rules/human-in-the-loop.md`](../../rules/human-in-the-loop.md)（常駐・826 tok）: 4 原則の置き場と対象ティア。
- [`.github/pull_request_template.md`](../../../.github/pull_request_template.md): 概要 / Refs / 仮説と実際 / 確かめたこと・確かめていないこと / 読む順 / 確認の問い / 残っている手作業。`gh pr create --body-file` で本文を渡す issue-workflow の PR には効かない（GitHub のテンプレートは本文を渡さないときだけ使われる）。
- [`comm/decisions/chat-harness.md`](../../comm/decisions/chat-harness.md): 判断 2 件（§5）。
- 本報告。

### 4.2 次の候補（判断待ち・別 PR）

| 候補 | 何を機械にするか | 置き場 | 前提 |
| --- | --- | --- | --- |
| PR 本文の見出し検査 | `gh pr create` の本文に「確かめていないこと」「読む順」の見出しが無ければ止める（`hooks/pre-commit-tracker-guard.sh` と同じ PreToolUse(Bash) 型） | life-editor `.claude/hooks/` | D-20261109-harness-2。MCP 経由で PR を作るクラウドのセッションには効かない |
| Verdict に「確かめていないこと」の行 | session-verifier の表に行を足し、role-engineer の引き継ぎにそのまま載せる | claude-dotfiles（別リポジトリ・別 PR） | こうだいさんが dotfiles 側で判断する |
| issue-workflow の PR の決まり | `.claude/issue-workflow.md` §PR の決まりに同じ項目を足す | life-editor | rule が merge されたあと |
| Issue フォームに「仕組みの仮説」欄 | `roadmap-item.yml` に欄を足す（Issue 本文が計画書の代役なので） | life-editor `.github/ISSUE_TEMPLATE/` | 起票は chat-main なので、chat-main の運用に乗るかを先に聞く |

---

## 5. 判断が要る点

同じ内容を [`comm/decisions/chat-harness.md`](../../comm/decisions/chat-harness.md) に積んだ。回答は `ANSWERS.md` へ。

| ID | 問い | A | B |
| --- | --- | --- | --- |
| D-20261109-harness-1 | 中ティアでも、仮説を書いたあと確認を待ってから実装に入るか | 書いて進む（推奨。前提 1 と両立し、無人の回でも成立する。仮説と実際のずれは PR で突き合わせる） | 中ティアも 👀 で待つ（確認の回数が増える。無人の回では成立しない） |
| D-20261109-harness-2 | PR 本文の見出しを hook で検査するか | 次の PR で足す（推奨。宣言だけの規約は破られる前提のため） | 宣言のまま 1 か月様子を見る |

---

## 6. 確認の問い（この報告を読んだあとに）

1. この repo で「人が止まる」と決めている Gate は 2 種類です。どれとどれでしょうか。今回の rule はそこに新しい停止点を足したでしょうか。
2. `session-verifier` の Verdict 表が PASS だけで埋まっていても、まだ「確かめていない」ことがありえます。この repo で代表的なものを 1 つ挙げてください。
3. 常駐コストの支配項は、2026-08-06 と今日で、どちらからどちらへ移ったでしょうか。

<details><summary>答え</summary>

1. 👀 目視（計画書の UI 確認・実ブラウザ確認）と 🛑 人手（DDL push・シークレット・merge・不可逆操作）です。rule は停止点を足していません。書く場所（スコープ宣言・PR 本文・最終報告）を足しただけです。
2. jsdom にレイアウトが無いので、座標に依存する経路（ProseMirror の `posAtCoords` など）は `web/tests/` では確かめられません（CLAUDE.md §7.1）。ほかに SKIP したゲート、実ブラウザ待ち、db push 前の DDL があります。
3. グローバル側（約 66%）からプロジェクト側へ移りました。今日はプロジェクトの CLAUDE.md 1 本が、グローバル側の常駐の合計より重いです（§2.3）。

</details>

---

## 7. この作業で確かめたこと / 確かめていないこと

- 確かめたこと: `LC_ALL=C bash scripts/docs-lint.sh` と `node .claude/scripts/records.mjs check` が、変更の前後ともに OK。常駐の増分は `context-cost-measure.mjs` で測った（§2.3）。
- 確かめていないこと: PR テンプレートが issue-workflow の `--body-file` に効かないことは GitHub の仕様から推論したもので、実際に回していない。rule が実装 PR の本文を実際に変えるかは、次の実装 PR で見る（確かめるのは chat-main）。hook は足していないので、hook のテストは無い。

---

## References

- [`2026-08-09-harness-loop-redesign.md`](./2026-08-09-harness-loop-redesign.md): 穴 H1〜H5 と Phase A〜D。本報告の §1.3 はこの H3 / H4 を引き継ぐ
- [`2026-08-06-context-fixed-cost-baseline.md`](./2026-08-06-context-fixed-cost-baseline.md): 常駐コストの前回計測。§2.3 の比較元
- [`../vision/claude-md-layering.md`](../vision/claude-md-layering.md): 実体の無い禁止の表（§4）と移送の判定
- [`../vision/plans/2026-09-02-fable-51-harness-retune.md`](../vision/plans/2026-09-02-fable-51-harness-retune.md): グローバルの 3 前提とプロジェクト側の整合
- `D-20261028-main-1`（design-first-planning）/ `D-20261102-main-1`（merge-round と merge-gate）/ `D-20260801-main-1`（tracker の分離と PR 本文の要約）
