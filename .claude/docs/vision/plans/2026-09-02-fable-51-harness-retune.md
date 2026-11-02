---
Status: Draft
Created: 2026-09-02
Branch: chore/fable-51-harness-retune
Owner-chat: harness-retune # 新規 worktree。chat-main で実行する場合は main に書き換える
Parent: .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md
Previous: (なし)
---

# Plan: Fable 5.1 ハーネス再調律 — dotfiles PR #22 の 3 前提を life-editor 側に写す

> **これは何か**: グローバルハーネス（`claude-dotfiles` PR #22・2026-09-02 merge）で行った Fable 5.1 向けの再調律を、life-editor の `.claude/` に **矛盾している箇所だけ diff 単位で** 反映する計画。
> **作成の経緯**: claude-dotfiles セッションで 2026-09-02 に作成。life-editor の `.claude/` を実測した数値をもとに書いた（§Context）。実行は life-editor 側チャットが本書に従って行う。
> **本書がやらないこと**: CLAUDE.md の本文移送（親計画 Phase 3 / `docs/vision/claude-md-layering.md`）。着手条件「クロスプラットフォーム移行完了」が未達（移行 SSOT = Phase 3 Electron 包装が進行中）のため、本書は移送に手を出さない。

---

## Context

### 動機

PR #22 でグローバル側は次の 5 点を変えた。life-editor の `.claude/` はグローバルを継承するが、プロジェクト側に旧モデル向けの文面が残り、グローバルの前提と食い違う箇所がある。

| PR #22 の変更                                                                                                        | life-editor 側の現状（2026-09-02 実測）                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3 前提**を `~/.claude/CLAUDE.md` に置いた（ユーザーは見ていない / 範囲を限定する / 並列で進め、待たない）          | `rules/decision-queue.md` が前提 1 の実装として既に機能している。ただし CLAUDE.md §7.0 の「メインが Agent ツールで**順に**起動する」は前提 3（待たない）と読み違えを生む |
| effort は `high` 既定。`xhigh` / `max` は `docs/effort-ledger.md` に実測がある種別だけ。全 agent の `effort:` を撤去 | `agents/` 2 本がどちらも `model: opus` + `effort: xhigh`。台帳に実測記録なし                                                                                             |
| 常駐層 26.4KB → 18.4KB、オンデマンド 255KB → 147KB（旧モデル向け定型文・ASCII 図・同じ注意の再掲を除去）             | agent 2 本 = 28,108 B（「設計思想」「opus/xhigh を割く理由」節など、モデルが知りようのない情報以外を含む）。skill 18 本の description 合計 12,566 B（常駐固定費）        |
| `visual-inspect` スキル新設（切り抜き → 拡大 → 読む、を Claude 自身が回す）                                          | playwright 検証のスクリーンショット（`pwv1408-*.png`）をユーザー目視に回している                                                                                         |
| `lead-pipeline` を「リーダー自身も 1 unit を実装し、通知が来たら統合」へ書き換え                                     | §7.0 は `lead-pipeline` を起点と明記済み。文言の追随のみ                                                                                                                 |

### 実測（2026-09-02・`C:\Users\user\orca\life-editor` main = `617d4981`）

| 対象                        | サイズ                                        | 備考                                                                                                                    |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.claude/CLAUDE.md`         | 24,843 B                                      | 固定費の最大項目（親計画の 8/06 計測で 5,357 tok）。**本書では触らない**（§Non-goals）                                  |
| `rules/` 4 本               | 25,434 B（うち常駐 = decision-queue 1,266 B） | 残り 3 本は `paths:` 付きでオンデマンド化済み                                                                           |
| `skills/` 18 本 description | 12,566 B                                      | 上位: frontend-react-designer 932 / docs-workflow 732 / schedule-management 627 / db-migration 623 / issue-dispatch 612 |
| `agents/` 2 本              | 28,108 B（description 2,025 + 2,013 B）       | どちらも `effort: xhigh`                                                                                                |
| `hooks/` 5 本               | —                                             | `regen-index.sh` / `session-start-check.sh` は Mac の hooks-lib へ委譲 → Windows では fallback 経由で無音終了           |

### 制約

- **P-001**（merge と main 取り込みはこうだいさん）と **P-007**（不可逆操作は同期確認）は、グローバルの 3 前提より優先する。前提 1「途中で質問しない」はこの 2 つを免除しない
- 移行未完のため CLAUDE.md の本文移送は不可（親計画 Phase 3 の着手条件）。`loop-prune` の停止条件「移行未完了なのに移送に手が伸びた」もそのまま効く
- グローバル資産（`~/.claude/`）には触らない（D-20260806-main-2 未裁定）
- $0 運用。消失ゼロ（消す記述は移送先を先に確保する）

### Non-goals

- CLAUDE.md の全面リライト・本文移送（→ 親計画 Phase 3。復活条件は §代替案 B）
- 削減量を KPI にすること（親計画・`loop-prune` と同じ立場）
- スキル / エージェント / hook の新設
- `effort-ledger` への life-editor 種別の登録（実測が無い。→ §代替案 D）

---

## 検討した代替案（必須）

| 案                                                                             | 採否 | 却下理由                                                                                               | 復活条件                                                                             |
| ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **A: グローバルと矛盾する箇所だけ diff 単位で直す**                            | ✓    | —                                                                                                      | —                                                                                    |
| B: CLAUDE.md を PR #22 の 4.5KB 型に全面リライト                               | ✗    | メタハーネス原則「全面リライト運動はしない」。移行 gate 未達。`claude-md-layering.md` と二重管理になる | 移行完了（Phase 5）後、親計画 Phase 3 として 1 PR = 1 項目で                         |
| C: グローバルの 3 前提を life-editor CLAUDE.md に転記                          | ✗    | グローバルで常駐済みのものを再掲すると固定費が二重になる（原則 4「規範は宣言、強制は決定論」）         | life-editor をグローバル無しの環境（CI・別マシン）で走らせる要件が出たら             |
| D: agent 2 本を `effort-ledger` に xhigh 採用種別として登録し `effort:` を維持 | 保留 | high と xhigh の比較実測が無い。台帳は「実測が先」                                                     | 同じ監査を high / xhigh で 1 回ずつ回し、差が出たら台帳に行を足して `effort:` を戻す |
| E: hooks の Mac 委譲を Windows で動く形に書き換える                            | ✗    | 本書のスコープ外（挙動変更 = 別 Issue）。本書は実測と記録まで                                          | Step 5 の known-issue を根拠に Issue 起票                                            |

---

## Scope (Touchable Paths)

```
.claude/CLAUDE.md                                  # §7.0 の 1 段落と §7.4 の 1 行のみ（本文移送はしない）
.claude/agents/*.md                                # frontmatter の effort: 行の削除 / description と本文の圧縮
.claude/skills/*/SKILL.md                          # description 行のみ（本文は触らない）
.claude/rules/decision-queue.md                    # 1 行追記
.claude/docs/known-issues/034-*.md                 # Step 5 の新規 1 本（+ INDEX は派生ビューなので触らない）
.claude/docs/reports/2026-08-06-context-fixed-cost-baseline.md   # §再測定への追記のみ
.claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md  # 本書
```

**触らない**: `rules/frontend.md` / `records.md` / `docs-consistency.md`（path-scoped 3 本）、スキル本文、`hooks/` の挙動、`settings.json`、`docs/vision/claude-md-layering.md`、`~/.claude/` 全部、進行中の `2026-09-02-desktop-screen-audit.md`（他チャットが編集中）。

スコープ外の変更が必要になったら **P-008** に従いキューへ積み、現計画を続行する。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                                                                                            | Gate    | Acceptance                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| 0   | ベースライン計測: `node .claude/scripts/context-cost-measure.mjs --sections` を回し、結果を `docs/reports/2026-08-06-context-fixed-cost-baseline.md` の再測定節に日付付きで追記                                                                                                                                                                 | 🤖 自律 | report に `2026-09-02` の行がある                                                                                          |
| 1   | `agents/` 2 本から `effort: xhigh` 行を削除（`model: opus` は維持 = 監査系）。同時に「設計思想」「opus/xhigh を割く理由」節を削除し、本文を「出力フォーマット / 決定論的手順 / 安全則 / 正本ポインタ」だけにする。description は「1 行要約 + 起動条件 + 非対象」で 600 B 以下                                                                   | 🤖 自律 | `grep -l "^effort:" .claude/agents/*.md` が 0 件。各 agent の description ≤ 600 B。frontmatter が YAML として parse できる |
| 2   | skill description の圧縮: 600 B を超える 5 本（frontend-react-designer / docs-workflow / schedule-management / db-migration / issue-dispatch）を「1 行要約 + 起動条件 + 非対象」に書き直す。削った説明は同ファイルの本文冒頭へ移す（消失ゼロ）                                                                                                  | 🤖 自律 | 全 SKILL.md の description ≤ 600 B。移した文の grep が本文で当たる                                                         |
| 3   | CLAUDE.md §7.0 の「メインが Agent ツールで順に起動する」を「依存があるのは pm → engineer → verifier → qa の鎖だけ。メインはサブエージェントの完了を待たず自分も 1 unit を担当し、通知が来たら統合する（正本 = `lead-pipeline`）」に置換。§7.4 の playwright 行に「スクリーンショットの判読は `visual-inspect` で Claude 自身が行う」を 1 行追記 | 🤖 自律 | `LC_ALL=C bash scripts/docs-lint.sh` 緑。CLAUDE.md の増加が +3 行以内                                                      |
| 4   | `rules/decision-queue.md` に 1 行追記: 「A/B に割れない判断は仮定を置いて進め、置いた仮定は PR 本文（または報告の末尾）に書く。キューに積むのは割れる判断だけ」                                                                                                                                                                                 | 🤖 自律 | 追記 1 行のみの diff                                                                                                       |
| 5   | hooks の Windows 挙動を実測: `regen-index.sh` / `session-start-check.sh` を Git Bash から直接実行し、終了コードと出力を `docs/known-issues/034-hooks-lib-dispatch-noop-on-windows.md` に記録（既存 031 と重複するなら 031 への追記に変更）。挙動の修正は Issue 起票依頼を outbox へ                                                             | 🤖 自律 | known-issue 1 本（または 031 への追記）。outbox に起票依頼 1 件                                                            |
| 6   | 再計測: Step 0 と同じコマンドを回し、差分を同じ report に追記。削減量は成果に数えない（消失ゼロが確認できていることを成果とする）                                                                                                                                                                                                               | 🤖 自律 | report に before / after の 2 行                                                                                           |
| 7   | `session-verifier` → `task-tracker (END)` → PR 作成（`git-workflow`。base = main）                                                                                                                                                                                                                                                              | 🤖 自律 | PR が open で CI `docs-lint` 緑                                                                                            |
| 8   | PR merge                                                                                                                                                                                                                                                                                                                                        | 🛑 人手 | P-001                                                                                                                      |

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に検証を回す
- **👀 目視** — 本計画には無い（UI 変更を含まない）
- **🛑 人手** — PR merge（P-001）

---

## Acceptance Criteria (機械検証可能)

- [ ] `grep -l "^effort:" .claude/agents/*.md` の出力が空
- [ ] 全 `.claude/skills/*/SKILL.md` と `.claude/agents/*.md` の description が 600 B 以下（計測は Step 0 と同じスクリプト、または `python` 1 行）
- [ ] 圧縮で本文へ移した文が、移した先のファイルで grep に当たる（消失ゼロ）
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` exit 0
- [ ] `.claude/CLAUDE.md` の diff が +3 / −2 行以内（本文移送をしていない証拠）
- [ ] `docs/reports/2026-08-06-context-fixed-cost-baseline.md` に 2026-09-02 の before / after 行がある
- [ ] PR diff が ±400 行以内（agent 本文の圧縮が主。超えたら agent 1 本ずつに分割する）
- [ ] 完了時: 本書の Status を COMPLETED にし `archive/` へ移動、per-chat memory を更新

---

## Risks / Known Issues 参照

- [`031-mac-only-symlinked-skills-agents.md`](../../known-issues/031-mac-only-symlinked-skills-agents.md) — hooks の Mac 委譲は同じ根の問題。Step 5 で重複判定する
- [`030-posttooluse-formatter-wraps-frontmatter-arrays.md`](../../known-issues/030-posttooluse-formatter-wraps-frontmatter-arrays.md) — frontmatter を編集する Step 1 / 2 で formatter が配列を折り返す。編集後に YAML parse を必ず確認する
- description を削りすぎるとスキルが起動されなくなる。起動条件（Triggers）は必ず残す（グローバル `rules/skill-management.md` §書き方）

---

## References

- グローバル側の正本: `claude-dotfiles` PR #22（`chore(harness): retune for Fable 5.1`）、`~/.claude/CLAUDE.md` §前提、`~/.claude/docs/effort-ledger.md`、`~/.claude/docs/meta-harness.md`、`~/.claude/rules/skill-management.md`
- 親計画: [`2026-08-04-context-cost-reduction-harness.md`](./2026-08-04-context-cost-reduction-harness.md)（Phase 3 = 移送は本書の範囲外）
- 振り分け表: [`../claude-md-layering.md`](../claude-md-layering.md)
- 計測: [`../../reports/2026-08-06-context-fixed-cost-baseline.md`](../../reports/2026-08-06-context-fixed-cost-baseline.md)
- related skills: `lead-pipeline`（中ティア）, `worktree-policy`, `session-verifier`, `task-tracker`, `loop-prune`（Step 2 と同じ判定式）

---

## 貼り付け用プロンプト（life-editor のチャットへ）

新規 worktree で回す前提。chat-main で回す場合は 1 行目を省き、frontmatter の Owner-chat を `main` に直す。

```
worktree-policy スキルの手順で worktree `harness-retune`（ブランチ chore/fable-51-harness-retune・main から）を作り、そこで作業する。

計画書 .claude/docs/vision/plans/2026-09-02-fable-51-harness-retune.md を読み、lead-pipeline の中ティアとして Steps 0〜7 を順に実行する。
- Scope 節に書いたパス以外は触らない。触りたくなったら P-008 に従いキューへ積む
- 各 Step の Acceptance を満たしたことをコマンド出力で確認してから次へ進む
- 判断が要る箇所は仮定を置いて進め、置いた仮定は PR 本文に列挙する。止まってよいのは P-007 の不可逆操作だけ
- Step 7 の PR 作成までで止まる。merge はしない（P-001）
- 最後に「何をしたか / 結果 / 判断が要る点」の 3 点で報告する
```

---

## Worklog

（実装チャットが記入）
