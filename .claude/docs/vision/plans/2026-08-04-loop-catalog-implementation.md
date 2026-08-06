---
Status: IN PROGRESS # 2026-08-06 初期 4 本を配置し PR #595 merged（18da6b5f）。残 = Step 6 試験運用 / 7 定着判定 / 8 到達点の別計画書
Created: 2026-08-04
Branch: docs/loop-catalog
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-08-04-loop-catalog.md
---

# Plan: ループカタログ実装 — ローカル実測にもとづく責務境界とフォーマット確定

> **これは何か**: 親計画（`2026-08-04-loop-catalog.md`）§4 が求める子計画書。**この Windows 機のローカル実態を実測した結果**をもとに、`loop-*` スキルが何を持ち何を持たないか（責務境界）・定義フォーマット・初期 4 本の中身を確定する。
> **親計画との関係**: 親は「なぜループを宣言的に扱うか」（方針）、本書は「この機械で実際に何をどう置くか」（実装）。

---

## Context

### 動機

親計画は「ループは既存パイプラインを呼ぶ薄い外枠にする」と決めたが、**呼ぶ相手が実在するかは未検証**だった。実測したところ、前提が 2 か所で崩れていた（§1-B / §1-C）。本書はその実測を反映した上で実装可能な形に落とす。

### 制約

- 変更範囲は `.claude/skills/loop-*/` と `docs/vision/plans/` のみ（親計画 Scope を継承）
- merge と main への取り込みは常にユーザー（POLICY P-001）
- $0 運用・移行期間中（Electron + Capacitor + Web + Supabase）

### Non-goals

- 死んでいるリポジトリ内スキル 8 本の復活（§1-B — 別タスク）
- `permissions` / `hooks` の変更（§1-C の穴は decision キューへ回す）
- `automation/routine-*.md` の書き換え（§1-D の統合は定着後に判断）

---

## 1. ローカル実測（2026-08-04・この Windows 機）

### 1-A. ユーザーレベル資産は健在（`~/.claude/` = claude-dotfiles への symlink）

| 層                          | 実体                                                                                                                                           | ループから見た役割                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 采配                        | `lead-pipeline`（軽/中/重ティア判定 → 起動順）・`execution-router`（`/goal` `/batch` `/loop` の選定とコマンド文字列提示）                      | ループが**置き換えるのではなく呼ぶ**側 |
| 役割（`~/.claude/agents/`） | `role-pm` / `role-engineer` / `role-qa` / `security-reviewer` / `multi-session-coordinator`                                                    | ループ本体の実行主体                   |
| ゲート                      | `session-verifier`（Gate 0 Scope → 1 型 → 2 lint → 3 test → 4 coverage → 5 プロジェクト規約。各ゲート最大 2 リトライ）                         | `/loop-verify` の中身そのもの          |
| 記録                        | `task-tracker`（per-chat `memory/` + `history/` + INDEX 再生成）・`git-workflow` / `git-branch-flow` / `git-conflict-resolver` / `code-review` | ループの前後で呼ぶ                     |

**含意**: 検証・記録・git・監査はすべて既存スキルが持っている。ループ側に手順を書けば確実に二重管理になる。

### 1-B. リポジトリ内スキル 12 本のうち **8 本がこの機械で死んでいる**（重要）

`.claude/skills/` の 8 エントリはディレクトリではなく、Mac 時代のパス `/Users/newlife/dev/Claude/skill-lib/projects/life-editor/<name>` を 1 行書いたテキストファイル（symlink の成れの果て）。この機械に該当パスは存在せず、**セッション開始時のスキル一覧にも現れない**（実測確認済み）。

| 状態               | スキル                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実体あり（4 本）   | `dev-digest` / `docs-workflow` / `schedule-management` / `worktree-policy`                                                                                  |
| 死んでいる（8 本） | `add-component` / `add-feature` / `add-ipc-channel` / `db-migration` / `frontend-react-designer` / **`issue-dispatch`** / `session-loader` / `test-writing` |

**含意**: 親計画が想定した「既存パイプラインを呼ぶ」設計のうち、**Issue 起票（`issue-dispatch`）と実装補助（`add-feature` / `test-writing` / `db-migration`）は呼び先が無い**。初期 4 本は生きている 4 本 + ユーザーレベル資産だけで組む。死んだ 8 本を前提にした記述を書かない。

### 1-C. 機械強制の実態と、1 か所の穴

| 層                      | 実体                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| global `permissions`    | `allow: Bash(*)` + `defaultMode: auto` — **既定で素通り**。deny は 4 本（`rm -rf *` / `push --force` / `reset --hard` / `clean -f`）                       |
| repo `permissions.deny` | 27 項目（main/master への push 全形・force 系・`reset --hard` / `branch -D` / `checkout main` / `rm -rf .git*` / `supabase db reset`）                     |
| repo `permissions.ask`  | `Bash(git push*)` / `Bash(gh pr create*)` — 押す前に必ず確認                                                                                               |
| PreToolUse hooks        | `protect-files.mjs`（`.env` / `credentials` / `secrets` を含むパスの Read/Write/Edit を exit 2 でブロック）・`pre-commit-mcp-check.sh` / `-index-guard.sh` |
| UserPromptSubmit hooks  | `pipeline-gate.mjs`（実装系 / `ultracode` キーワードで采配を注入）・`graphify-nudge.mjs`                                                                   |

**穴**: `gh pr merge` は deny にも ask にも無い。POLICY **P-001「merge は常にユーザー」は文章だけで機械では止まっていない**。しかも `git-workflow` §0.1.1 には「role-qa 通過済み + conflict 無しなら確認不要で自動マージ」というユーザー全プロジェクト共通指定があり、**P-001 と正面から衝突している**。親計画の設計思想（「禁止は文章で書かず機械で不可能にする」）に照らすと、ここは最優先で機械化すべき箇所。ただし `settings.json` は本計画の Scope 外 → **decision キューへ起票**（§5）。

### 1-D. 「ループ定義」の型は既に `automation/` に存在する

PR #594 で置いた `routine-night-safe.md` / `routine-digest.md` は、**目標 / 時間計測（45 分 cap を bash で明示計測）/ Scope 宣言 / 報告形式 / 禁止事項** を持つ。これは親計画の必須 5 見出しとほぼ同型。

| 軸       | `automation/routine-*.md`  | `skills/loop-*/SKILL.md`（本計画）          |
| -------- | -------------------------- | ------------------------------------------- |
| 起動     | 時刻発火（headless・無人） | 人間が `/loop-xxx` と打つ（対話セッション） |
| 質問経路 | decision キューのみ        | その場で聞ける                              |
| 再利用   | 1 レーン固定               | 対象を引数で受けて何度でも                  |
| 書込権限 | 単一ファイルに限定         | ループごとに宣言                            |

**含意**: 見出し語彙を揃える（2 つの方言を作らない）。将来 `routine-night.md` 改訂版（親 Phase 2）は `/loop-implement` を呼ぶ薄い外枠にできる — これが親計画が「カタログを Phase 2 の前提」に置いた実利。

---

## 2. 責務境界（本計画の結論）

```
loop-*/SKILL.md    宣言だけを持つ  ── 目標 / 完了条件 / 予算 / 停止条件 / 道具
      │
      ├─ 手順 ────────→ 既存スキル（session-verifier / task-tracker / git-workflow / docs-workflow …）
      ├─ 実行主体 ────→ 既存エージェント（role-pm / role-engineer / role-qa）
      ├─ 禁止 ────────→ permissions.deny + hooks（文章で重ねて書かない）
      └─ 判断の逃がし → decisions/ キュー（rules/decision-queue.md）
```

**ループ側に書いてよいのは、既存資産のどれをどの順で呼ぶかという 1 行の指名だけ**。`session-verifier` のゲート内容や `task-tracker` のファイル形式をループ側に転記しない（転記した時点で正本が 2 つになる）。

判定基準: **「その行を消したら Claude が間違うか？」— 間違わないなら書かない。**

---

## 3. ループ定義フォーマット（1 本目で確定 → 残りに適用）

```markdown
---
name: loop-<verb>
description: <1 行。何を回すか + いつ人間が打つか>
disable-model-invocation: true
---

# /loop-<verb> — <一言>

## 目標

<1 文。達成したら終わる状態>

## 完了条件（機械検証可能）

- <コマンド or 観測可能な状態。yes/no が機械で割れる形>

## 予算

- 反復上限: N 周（超えたら成果ではなく**仮説**を出して停止）
- 時間上限: M 分（`START_TS=$(date +%s)` で明示計測 — cap 設定だけは信用しない）

## 停止条件（人間に返す）

- <箇条書き。該当したら decisions/ に書いて停止>

## 使ってよい道具

- <既存スキル / エージェント名の指名のみ。手順は書かない>

## 環境の事実（任意・6 つ目）

- <知らなければ推論で埋まらないことだけ。判断の細則が混ざったら削る>
```

### 規約

- **frontmatter に `disable-model-invocation: true` を必ず置く**（親計画 §2.3。公式が「副作用のあるスキルは user-only」として定義しているキーで、`/loop-xxx` からのみ起動できる）
- **予算は 2 系統（反復回数 + 経過時間）を両方書く**。親計画 §3-1 の実例（公式プラグインで `--max-iterations` がサイレント無視され 494 回暴走）から、宣言だけでなく bash 計測を併記する
- **反復上限の初期値は暫定**（親計画「実測してから定める」）。1 周目は保守的に置き、`## Worklog` に実測を追記して次回改訂する
- **禁止事項の節を作らない**。機械（deny / hooks）が止めるものを文章で重ねると、守られているのか文章が守らせているのか区別できなくなる。ただし**機械で止まっていない禁止だけは書く**（現状 = merge・Issue への書き込み。§1-C の穴が塞がったらこの行も消す）
- **6 つ目の見出し `## 環境の事実` を許可する**（2026-08-06 ユーザー承認）。親計画 §2.1 の判断軸「環境の事実は教える」に対応する枠で、書いてよいのは**知らなければ推論で埋まらない事実だけ**。設計判断・実装方針・粒度の細則が混ざり始めたら削る（それは「考えさせる」側）

---

## 4. 初期カタログ 4 本の中身（実測反映版）

| ループ             | 目標                                               | 呼ぶ既存資産                                                        | 停止して人間に返す条件                            |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| `/loop-triage`     | 自分宛 open Issue の着手可否を判定し、着手順を出す | `docs-workflow`（ラベル routing）・`gh issue list`                  | 要件が二義的 / 宛先レーンが自分か不明             |
| `/loop-implement`  | Issue 1 件を実装し draft PR 手前まで持っていく     | `lead-pipeline` のティア判定 → `role-engineer` → `session-verifier` | 反復上限到達 / DDL が必要 / Scope 外に出る        |
| `/loop-verify`     | 検証ゲートを通し、落ちた原因を切り分ける           | `session-verifier`（Gate 1-3 が本体）                               | 環境起因と判断した時点                            |
| `/loop-postmortem` | 失敗の記録を読み、事実か skill に 1 行足す         | `docs-workflow`（known-issues 境界）・`task-tracker`                | 追加先が判断できない（Issue か rules か docs か） |

**実測による設計変更 2 点**:

1. **`/loop-triage` は起票しない**。`issue-dispatch` が死んでいる（§1-B）ことに加え、起票は chat-main 一元（`docs-workflow`）。triage は**読む・並べる・判定するまで**とし、起票が要るものは outbox へ依頼を append する
2. **`/loop-implement` は draft PR を作らない**。`gh pr create` は `permissions.ask`（§1-C）で必ず人間の確認が入るため、ループの完了条件を「PR 作成」に置くと**無人実行時に必ず止まる**。完了条件は「commit まで + PR 本文の下書きをファイルに出力」とし、`gh pr create` は人間の手番に残す

---

## Scope (Touchable Paths)

```
.claude/skills/loop-triage/**
.claude/skills/loop-implement/**
.claude/skills/loop-verify/**
.claude/skills/loop-postmortem/**
.claude/docs/vision/plans/2026-08-04-loop-catalog.md
.claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md
.claude/comm/decisions/chat-main.md          # 判断キューへの起票のみ（単一書込者 = chat-main）
```

プロダクトコード・`settings.json`・`hooks/`・`automation/`・CLAUDE.md には触れない。

---

## Steps

| #   | Step                                                         | Gate    | Acceptance                                                                     |
| --- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------ |
| 1   | ローカル実態の調査（§1）                                     | 🤖 自律 | 責務境界が §2 として書き出せた — **完了**                                      |
| 2   | 本書のレビュー                                               | 👀 目視 | ユーザーが §2 の境界と §4 の設計変更 2 点に納得できる — **完了**               |
| 3   | `/loop-triage` を配置しフォーマット確定（§3）                | 👀 目視 | 形式をユーザーが承認 — **完了**（6 つ目の見出し `## 環境の事実` の追加を含む） |
| 4   | 残り 3 本を同一フォーマットで配置                            | 🤖 自律 | 4 本すべてに必須 5 見出し + `disable-model-invocation` — **完了**              |
| 5   | `gh pr merge` の機械化を decision キューへ起票（§1-C の穴）  | 🤖 自律 | `decisions/chat-main.md` に D-20260804-main-2 — **完了**                       |
| 6   | 1〜2 週間の試験運用 → 反復上限の実測値を Worklog に追記      | 👀 目視 | 各ループの実測周回数が記録される                                               |
| 7   | 定着判定 → 親計画 Phase 2 の着手可否                         | 🛑 人手 | decision キューで裁定                                                          |
| 8   | 「自律運転の到達点」を別計画書に起こす（下記 §Worklog 参照） | 👀 目視 | P-001 改訂案 + ゲート 3 段階解除 + 自動 revert が書かれている                  |

---

## Acceptance Criteria (機械検証可能)

- [x] `.claude/skills/loop-*/SKILL.md` が 4 本存在する
- [x] 4 本すべてに `## 目標` `## 完了条件` `## 予算` `## 停止条件` `## 使ってよい道具` が存在する
- [x] 4 本すべての frontmatter に `disable-model-invocation: true` がある
- [x] 4 本すべてに反復上限（回数）と時間上限（分）の両方が書かれている
- [x] 死んでいる 8 スキル（§1-B）を `## 使ってよい道具` で**呼び先として指名していない**（`## 環境の事実` で「この機械では解決できない」と明記するのは可 — 知らなければ推論で埋まらない事実のため）
- [x] 親計画（`2026-08-04-loop-catalog.md`）から本書への参照がある
- [x] `LC_ALL=C bash scripts/docs-lint.sh` が緑
- [x] 完了時に本書・親計画・per-chat memory の Status を更新した（2026-08-06 — 残 Step 6/7/8 は試験運用と別計画書のため Status は `IN PROGRESS` のまま）

---

## Risks

- **フォーマットが `automation/routine-*.md` と分岐する** — §1-D のとおり見出し語彙を揃える。揃わないまま親 Phase 2 に進むと、夜間ルーチンとループで同じことを 2 通り書くことになる
- **`/loop-implement` が無人実行前提と読まれる** — 本書の対象は**対話セッションでの明示起動**。無人実行は親 Phase 2 の管轄で、そこでは `permissions.ask`（push / PR 作成）が必ず止まる前提が要る
- **カタログが増えて選べなくなる** — 棚卸し（`loop-prune`）は姉妹計画の管轄。それが来るまで **4 本を上限**とし、5 本目を足す前に必ず 1 本畳めないか確認する

---

## References

- 親計画: `.claude/docs/vision/plans/2026-08-04-loop-catalog.md`
- 祖父計画: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md`（§3 ガードレール = 予算 2 系統の根拠）
- 姉妹計画: `.claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md`
- 既存のループ型: `.claude/automation/routine-night-safe.md` / `routine-digest.md`
- 判断キュー: `.claude/comm/decisions/POLICY.md`（P-001 / P-007）・`.claude/rules/decision-queue.md`

---

## Worklog

- 2026-08-06: [chat-main] 初期カタログ 4 本の配置完了（Step 3 / 4）。フォーマットは 6 つ目の見出し `## 環境の事実` を含む形でユーザー承認。**次フェーズの方向をユーザーが確定**（Step 8 として追加）— 到達点は「クラウド起動のループが検証から解決まで自走し、次のタスクを自分で起票する」で、安全網は **commit 履歴からの revert**。実測にもとづく補正 3 点を別計画書に起こす: ① ネックは merge ではなく手前の `git push*` / `gh pr create*`（`permissions.ask`）で、`gh pr merge` は既に機械未強制（§1-C） ② revert はコードには効くが **DDL と Cloud Sync が書いたデータには効かない**（LWW のため巻き戻らない）ので、自動 merge の条件から migration を含む PR を除外する ③ **自動 merge と自動 revert は対で入れる**（merge だけ自動化すると手作業が移動するだけ）。ゲートは 3 段階で解除（第 1 段 = `claude/*` への push + draft PR 作成 / 第 2 段 = 機械判定つき自動 merge / 第 3 段 = merge 後の main 検証 → 赤なら自動 revert）。POLICY P-001 と親計画 Non-goals（クラウド不使用）の**明示的な改訂**が前提で、なし崩しに緩めない。クラウド実行がローカルの digest / outbox / worktree に触れない件は未検証 — 別計画書の着手時に実測する
- 2026-08-04: [chat-main] §1 のローカル実測を実施。**前提の崩れ 2 件を検出** — ① リポジトリ内スキル 12 本中 8 本が Mac パスを指す死んだポインタで、`issue-dispatch` を含む（§1-B）② `gh pr merge` が deny / ask のどちらにも無く、POLICY P-001 が機械では未強制。加えて `git-workflow` §0.1.1 の自動マージ指定と衝突している（§1-C）。両者を §4 の設計変更 2 点に反映
