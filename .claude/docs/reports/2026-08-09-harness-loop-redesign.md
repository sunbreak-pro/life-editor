# ハーネス整理とループ設計 — 調査・分析・考案（2026-08-09）

> 調査断面: life-editor `89e8ea2d`（#615 織り込み済み）/ claude-dotfiles `a7bceca`。
> 調査方法: サブエージェント 3 体（プロジェクト側棚卸し / グローバル側棚卸し / ループ監査）+ 柱となる指摘の実測裏取り。
> 位置づけ: 実装前の分析レポート。ここからユーザー裁定を経て `docs/vision/plans/` の計画書に落とす。

---

## 0. 要旨

1. **「途中の路線変更」を防ぐ防波堤は重ティア + 並行レーン運用には実在し実績もある**が、(a) 計画時に代替案を網羅する欄が無い、(b) 計画書を通らない軽・中ティアが無防備、(c) 計画書の Scope/AC を Claude 自身が更新・免除して続行できる、の 3 つの穴が開いている。
2. **ハーネスの役割重複は実在し、大半は「同じ命題の手動転記」**。`rules/records.md` §1 の「2 箇所目以降は ID 参照」原則（#615 で明文化済み）を文書群へ適用すれば機械的に解消できる。ただし少数、**実害のある食い違い**（計画テンプレ 3 系統・archive 実行者 2 箇所・トリガー語衝突・正本宣言の衝突・tone 正本の欠落）がある。
3. 提案は 4 フェーズ: **A = ループの穴埋め（最優先）→ B = 実害の修正 → C = 重複のポインタ化 → D = 機械化**。CLAUDE.md 本体の構成変更は D-20260806-main-3 のゲート（移行完了後）に抵触しない範囲で行う。

---

## 1. 現状のループ設計（実測マップ）

起点はメインチャットの `lead-pipeline`（グローバル）。ティア判定で工程が分岐する。

| フェーズ | 担当                                                               | 成果物                                    | 規定の所在                                                       |
| -------- | ------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------- |
| 計画     | role-pm → code-plan-editor / Plan mode                             | 要件サマリ → `plans/YYYY-MM-DD-<slug>.md` | role-pm.md / code-plan-editor / `_TEMPLATE.md`（§7.3 Plan Gate） |
| 実行戦略 | execution-router                                                   | モード判定 + 貼り付けコマンド             | execution-router SKILL.md                                        |
| 実装     | role-engineer（または loop-implement）                             | 変更 + セルフ検証済み引き継ぎ             | role-engineer.md / loop-implement                                |
| 検証     | session-verifier（Gate 0-5）→ role-qa（独立監査）                  | Verdict → QA 判定                         | session-verifier / role-qa.md                                    |
| 記録     | task-tracker                                                       | memory/history 更新 + plan の archive     | task-tracker SKILL.md Step 5                                     |
| 改善     | loop-postmortem（**手動起動のみ**）+ decisions 台帳 + known-issues | 再発防止 1 行 / D ファイル / Issue        | loop-postmortem / decisions/README                               |

重要な非対称: **計画書（Plan Gate）が必須なのは「新規・大改訂」だけ**。lead-pipeline の軽ティアは直接実装、中ティアは「実装 → verifier → tracker」で、**role-pm も計画書も通らない**。日常の Issue 駆動作業では Issue body の DoD がミニ計画書の代役。

---

## 2. 課題 1: 途中の路線変更 — 原因分析

### 効いている防波堤（維持する）

- 三役のスコープ逸脱禁止: role-pm「ついでに提案しない」/ role-engineer「ついで修正禁止」/ role-qa「対象外への越境を計画と照合して検出」
- `_TEMPLATE.md` の Scope 宣言（触ってよいパス）+ AC の diff 行数ガード
- decision queue + POLICY（P-005「UX が変わる分岐は実装で先行しない」/ P-007「不可逆はキュー不可・同期確認」）。「途中で出た変更は別 Issue に切る」文化は実績あり（D-20260728-main-3・D-20260731-tags-3）
- #615 で tracker 混入の機械ガード（`hooks/pre-commit-tracker-guard.sh`）が追加 — 「規約 → hook で機械化」の型が実証済み

### 穴（埋める対象）

| #   | 穴                                                                                                                                                                                                                                                                                                                                                                                       | 根拠                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| H1  | **計画時に代替案を網羅する仕組みが無い**。`_TEMPLATE.md` には Non-goals（:22）だけで「検討した代替案・却下理由・復活条件」欄が無い。role-pm の出力にも無い。ask-user で選ばれなかった案を計画書へ残す規定も無い。却下案を構造的に持つのは `decisions/_TEMPLATE.md` だけで、**判断が途中で噴出してから事後に書く**後追い型 — こうだいさんの意図（計画時点で網羅）とちょうど逆のタイミング | `_TEMPLATE.md:18-22` 実測 / role-pm.md:133-157                  |
| H2  | **軽・中ティア（作業の大多数）に Scope 宣言が無い**。追加要望も「ついで」もそのまま実装に流れ込む。role-engineer の禁止規定はメインが直接実装する時には適用文書が無い                                                                                                                                                                                                                    | lead-pipeline SKILL.md:25-26                                    |
| H3  | **計画書の自己更新で Scope を広げられる**。「スコープ外が必要になったら計画書を更新してから手を付ける」（`_TEMPLATE.md:53`）に**承認者の規定が無い**。P-005 は UX 分岐しか拾わないため、非 UX の路線変更は Claude が計画書を書き換えるだけで正規化できる                                                                                                                                 | `_TEMPLATE.md:53` 実測                                          |
| H4  | **AC 逸脱の自己免除の前例**。diff ±400 行ガードを超過（実測 ~560 行）した際「許容範囲と判断（要ユーザー承認）」と自己判断で続行した記録が残る。逸脱をキューに積む規定が無い                                                                                                                                                                                                              | `archive/2026-06-20-w8-salvage-interactive-schedule.md:88` 実測 |
| H5  | **完了時の乖離レビューが無い**。Worklog は「(任意)」、loop-postmortem は `disable-model-invocation: true` でユーザー明示起動のみ。QA の Suggestion / verifier の non-blocking findings は**行き先が未定義**で、拾われなければ消える                                                                                                                                                      | `_TEMPLATE.md:124` / loop-postmortem:4                          |

---

## 3. 課題 2: 役割重複 — 重複マップ

### 3.1 実害あり（食い違いが既に発生 or 事故に直結）

| #   | 重複                                                                                                                                                                                                                                                                                            | 実害                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **計画テンプレが 3 系統**: life-editor `_TEMPLATE.md`（Scope + Gate + AC）/ グローバル `code-plan-editor/references/plan-template.md`（5 節・Status enum が `rules/docs-consistency.md` §3 と不一致）/ グローバル `rules/plan-mode-quality.md`（第 3 の形式）                                   | code-plan-editor 経由で計画書を作ると **§7.3 が必須とする Scope / Gate / AC の無い計画書**ができる。Plan Gate の正面をすり抜ける経路 |
| D2  | **plan archive の実行者が 2 箇所**: code-plan-editor §Workflow 4 と task-tracker Step 5                                                                                                                                                                                                         | どちらが動くか未定義。二重実行 or 取りこぼし                                                                                         |
| D3  | **tone 正本に呼び名が無い**: 呼び名「こうだいさん」+ 捏造事故の注記はグローバル CLAUDE.md にのみあり、正本の `output-styles/tone-persona.md:16` と `rules/tone.md:25` は「名前 + さん」とだけ書く                                                                                               | 捏造事故（過去 2 回）の再発防止情報が正本から漏れている                                                                              |
| D4  | **実効 `~/.claude/settings.json` が dotfiles 非リンク**: model / effortLevel / Orca hooks が dotfiles 側と乖離。`rules/agent-management.md` の「effortLevel は high」記述も実効値 xhigh と食い違い                                                                                              | dotfiles を直しても実環境に反映されない。「子の effort はメインを超えない」原則の基準値がずれる                                      |
| D5  | **トリガー語の衝突**: `ultracode` `総力戦` が lead-pipeline と execution-router の両方に登録。先に execution-router が単独起動すると采配順序が崩れる。ultracode と /batch の選択は両スキルが**相互委譲**                                                                                        | 起動順が不定                                                                                                                         |
| D6  | **自動マージ規定 3 箇所**: git-workflow §0.1.1（正本宣言・情報量最少）/ git-branch-flow §6（正本より詳しい）/ lead-pipeline:57,60（独自ケース分岐・P-001 と衝突する無条件記述のまま）                                                                                                           | life-editor は CLAUDE.md §7.2 の override（D-20260806-main-1）で守られているが、スキル単体では危険な記述が残存                       |
| D7  | **正本宣言の衝突**: `comm/README.md:207` が「Issue dispatch = タスク分配の正本」を自称、CLAUDE.md §9 は「正本 = docs-workflow」                                                                                                                                                                 | 2 つの「正本」。起票一元化の同一命題は計 6 箇所に転記                                                                                |
| D8  | **この機械で解決不能な symlink 10 本**（skills 8 + agents 2、Mac 絶対パス）を生きた文書が参照し続ける: CLAUDE.md §7.0 の整合監査 2 エージェント・`issue-dispatch`・`db-migration` 等。グローバルにも死んだ参照（`/project-setter`・`frontend-refactoring`・`dep-auditor`・sui-memory は no-op） | Windows セッションでは委譲先が常に不在。Mac では生きているため**削除ではなく vendor 化 or OS 分岐が必要**                            |

### 3.2 二重管理（今は一致しているが、ずれた瞬間に D3〜D7 型の事故になる）

- **tone 3 重メンテの制度化**: tone-persona（正本）/ グローバル CLAUDE.md 口調章 / `rules/tone.md` に同一内容（助詞の例・比喩 3 例・避けること・応答量）が逐語転記され、「3 つを同期させる」運用が明文化されている。サブエージェントには output style が届かず rules だけが届くという構造制約が転記を正当化しているが、転記範囲が要点 3 つを大きく超えている
- **要件確認の 3 重定義**: `rules/conversation-workflow.md`（委譲先ゼロの孤立ルール）/ ask-user / role-pm が同じ 3 手順・**逐語一致の例外条件**を各自保持
- **worktree 手順の二重 + 食い違い**: CLAUDE.md §7.4 の「要約」がスキル本文とほぼ同文（4 命題）。加えて lead-pipeline「4 ステップ 1 セット」vs git-branch-flow「3 段必須セット」で手順数が不一致。`.session-branch` の解説は 4 箇所目まである
- **判断キュー運用が 4 箇所**（`rules/decision-queue.md` / `comm/decisions/README.md` / `comm/README.md` / docs-workflow）。「昇格 3 手順」は 4 箇所とも D-20260809-main-1 を出典に同文転記
- **環境の事実の literal 転記**: 「web lint は web/ しか歩かない（PR #488）」「TS 版差」「LC_ALL=C」「jsdom に座標なし」が CLAUDE.md §7.1 と loop-verify / loop-prune / rules/frontend.md に重複
- **session-verifier が 1 チェーンで最大 3 回走る**（role-engineer Step 5 / lead-pipeline Step 4 / role-qa Step 2 — 同じ tsc/lint/test を 3 回）
- **検証ラベルが 3 体系**: code-review `Blocking/Important/Suggestion` / role-qa `Blocker/Suggestion` / security-reviewer `Critical/High/Medium/Low`。role-qa が code-review を内部実行するのに `Important` の写像が未定義
- **code-review の Security 章と security-reviewer が同一守備範囲**（境界宣言は片側にしかない）
- 「誰が何を担当するか」の委譲境界表が 5 箇所に別フォーマットで存在（role-qa / security-reviewer / multi-session-coordinator / execution-router / lead-pipeline）

### 3.3 低リスク（棚卸しのついでに）

記録型対応表 3 箇所（`records.md` §1 が正本宣言済み — 他 2 箇所のポインタ化）/ 「生成物・手編集禁止」注記 6 箇所 / `.bak` リンクの grep 汚染 / dev-digest と schedule-management のタスク源重複（両方とも派生ビュー `memory/INDEX.md` を一次入力にしている）/ `comm/README.md` の「Phase 1 試作版」自己記述が実態（decisions・digest・dispatch まで拡張済み）から乖離。

---

## 4. 設計案 — 長期的に回るループ

### 原則（3 つ）

1. **要件は計画で凍結、変更は次のループで**: 実装中に浮上した追加・変更・削除は「実装しない・キュー or Issue へ積む・現計画を続行」を既定にする。計画の変更自体は禁止しないが、**変更にはユーザー回答（キュー経由 or 同期）を必須**にする。
2. **1 命題 1 ファイル**: `records.md` §1「2 箇所目以降は ID 参照」を文書間へ全面適用。「要約」節は本文転記ではなく「事故防止の禁止事項 + ポインタ」だけを持つ（CLAUDE.md §7.4 の現構成が良い見本。ただし同文転記部分は削る）。
3. **規約はいずれ hook へ**: 文章の禁止則は破られる（H4 の前例）。tracker-guard で実証した型で、Scope 照合・AC 照合を機械化する。

### フェーズ別の設計

**計画（Plan）**

- `_TEMPLATE.md` に **「検討した代替案」節を必須追加**: 案 / 採否 / 却下理由 / 復活条件（`decisions/_TEMPLATE.md` の欄の前倒し）。「復活条件」が書いてあれば、実装中に代替案が魅力的に見えても「復活条件を満たしたか」の判定に変わり、路線変更の議論が構造化される
- role-pm の出力フォーマットに「代替案の列挙（最低 2 案 + 採らない理由）」を追加。ask-user で提示した選択肢と回答は**そのまま計画書の代替案節へ転記**する（現状は揮発）
- code-plan-editor は「プロジェクトに `_TEMPLATE.md` があればそれを正とし、無い場合のみ内蔵テンプレ」に変更（D1 の解消）。内蔵テンプレにも Scope / 代替案節を追加し、Status enum を docs-consistency §3 に合わせる

**実装（Implement）**

- **スコープ変更ゲートを POLICY へ昇格（P-008 案）**: 「実装中に計画外の変更が必要になったら、(1) 手を止めず現計画の残りを進め、(2) 変更はキュー or 別 Issue へ、(3) 計画書の Scope / AC の変更はユーザー回答があるまで行わない。AC 逸脱（diff 超過等）も同様にキューへ積み、自己免除しない」— H3 / H4 の正面玄関を閉じる
- **軽・中ティアにミニスコープ**: 中ティアは着手時に「対象ファイル / 完了条件 / 触らないもの」を 1〜3 行チャットに宣言（計画書は作らない）。宣言外に手を出す時は P-008 と同じ扱い。軽ティアは対象外（typo にゲートは過剰）

**検証（Verify）**

- **session-verifier は 1 チェーン 1 回**: role-engineer が実行し Verdict を返す。lead-pipeline Step 4 は「Verdict の受領確認」に、role-qa は「Verdict を読んで抜けの指摘」に変更（3 回 → 1 回）
- **検証ラベルを `Blocking / Important / Suggestion` に統一**（code-review の 3 段を正とし、role-qa / security-reviewer は写像を明記）
- role-qa のチェック項目に「**計画書の代替案節と突き合わせ、採用案から逸れていないか**」を 1 行追加（H1 の運用面の締め）

**改善（Improve）**

- **task-tracker END に「乖離レビュー 3 行」を組み込む**: plan を archive する時、(1) スコープ逸脱の有無 (2) AC 免除の有無 (3) 途中で出た判断とその行き先（D-* / Issue #）を Worklog に必須記入。乖離が規約級なら decisions / known-issues へ昇格（loop-postmortem の中身を END フローに吸収し、単体スキルは薄い外枠として残す）
- **QA Suggestion / verifier findings の行き先を定義**: 非 Blocker は「outbox 経由で Issue 起票依頼」or「キューへ」の二択とし、消える経路を塞ぐ

### 重複解消の統合方針

- **正本の確定**（宣言が割れている箇所）: タスク分配 = docs-workflow（comm/README §dispatch はポインタ化）/ plan archive = task-tracker / 自動マージ = git-workflow §0.1.1（branch-flow の詳細を正本へ移し、lead-pipeline の独自分岐は削除して参照に）/ トリガー語 = lead-pipeline が入口（execution-router から `ultracode` `総力戦` を外す）
- **tone**: tone-persona を正本のまま、呼び名「こうだいさん」+ 捏造事故注記を tone-persona へ移す。`rules/tone.md` は「サブエージェント用の要点 3 つ + ユーザー口調 + 良い例/悪い例」に縮小、グローバル CLAUDE.md 口調章は 5 行程度のポインタ + 保険要約へ
- **要件確認**: `rules/conversation-workflow.md` を「原則 1 行 + role-pm / ask-user へのポインタ」に縮小（例外条件の正本は ask-user）
- **環境の事実**: 正本 = CLAUDE.md §7.1（layering 判定で「残す」と確定済み）。loop-verify / loop-prune / frontend.md 側は ID 参照化
- **symlink 10 本**: Mac では実体があるため削除しない。方針は「repo 内 vendor（hooks-lib で実証済みの fallback chain 型）」を推奨。少なくとも CLAUDE.md §7.0 の整合監査 2 エージェント参照には「(Mac のみ)」の注記を付け、Windows セッションが空振りし続ける状態を明示する

---

## 5. 実装ロードマップ

CLAUDE.md の**構成**変更は D-20260806-main-3（layering Phase 3 は移行完了後）にゲートされているため、本件は**スキル / rules / テンプレ側の変更 + CLAUDE.md の行単位修正**に限定する（ゲート非抵触）。レーンは 2 本: life-editor 側と claude-dotfiles 側（別リポジトリ・別 PR）。

| Phase       | 内容                                                                                                                                | 対象リポジトリ | 期待効果                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------- |
| A（最優先） | `_TEMPLATE.md` 代替案節 / P-008 起案 / role-pm 出力改訂 / task-tracker END 乖離レビュー / 中ティア・ミニスコープ                    | 両方           | H1〜H5 の穴埋め = こうだいさんの主訴     |
| B           | D1〜D8 の実害修正（テンプレ一本化・archive 一本化・tone 正本補完・settings 同期・トリガー衝突・自動マージ・正本宣言・symlink 注記） | 両方           | 食い違い事故の根絶                       |
| C           | §3.2 の二重管理をポインタ化（tone / 要件確認 / worktree / キュー運用 / 環境事実 / verifier 1 回化 / ラベル統一）                    | 両方           | 同期メンテの廃止・固定費削減             |
| D           | 機械化: Scope 宣言 vs `git diff` 照合 hook（#173）・AC diff 行数照合                                                                | life-editor    | 文章規約の hook 昇格（P-008 の機械実体） |

各 Phase 完了時に本レポートの該当節へ消し込みを記録し、Phase A 着手時に `docs/vision/plans/2026-08-XX-harness-loop-redesign.md` を Plan Gate 形式で起こす。

---

## 6. ユーザー判断が要る点

| #   | 問い                                                                                           | 選択肢                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Q1  | スコープ変更ゲートを **P-008 として POLICY へ追加**するか（POLICY 追加はユーザー明示承認のみ） | A: 追加（推奨） / B: rules/ の通常規約に留める                                                                  |
| Q2  | ミニスコープ宣言の適用範囲                                                                     | A: 中ティアのみ（推奨） / B: 軽含む全部 / C: 導入しない                                                         |
| Q3  | 計画テンプレの一本化方向                                                                       | A: プロジェクト `_TEMPLATE.md` 優先 + グローバルは fallback（推奨） / B: グローバル側を正本に全プロジェクト統一 |
| Q4  | tone 3 重メンテのポインタ化                                                                    | A: 実施（正本 = tone-persona、rules/tone.md はサブエージェント用要点のみ）（推奨） / B: 保険として現状維持      |
| Q5  | 死んだ symlink 10 本                                                                           | A: repo 内 vendor 化（推奨・hooks-lib で型実証済み） / B: 参照に「Mac のみ」注記だけ付ける / C: 現状維持        |

---

## References

- 調査サブエージェント報告 3 本（本セッション・2026-08-09）
- `rules/records.md` §1（ID 参照原則）/ `archive/2026-08-09-record-graph-layer.md`（#615 で 6/7 消化・残り 1 件は #1337 で消化して archive 入り）
- `docs/vision/claude-md-layering.md`（CLAUDE.md 移送ゲート = D-20260806-main-3）
- D-20260801-main-1（tracker 分離 → hook 化の先行事例）/ D-20260806-main-1（P-001 維持）
