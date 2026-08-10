# HISTORY ARCHIVE (chat-main, 2026-08)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-09 - main の未追跡資産を 2 PR に整理（Codex 対応を複製から参照へ・PR #610 / #611 merged）

#### 概要

main の作業ディレクトリに未追跡のまま残っていた 13 ファイルと、宙に浮いていた `chore/docs-sync-20260731` を整理した。未コミット分は計画書 1 本（#610）と Codex 対応（#611）に分割し、Codex 側は全文コピーだった初版を「参照」方式へ組み直した。両方 merge 済み・ブランチと一時 worktree は撤去済み。

#### 変更点

- **`chore/docs-sync-20260731` は PR を出さず削除**: 4 commit・docs 5 ファイルの中身が**すべて既に main にあり**、PR を出すと `2026-07-14-schedule-redesign.md` と `memory/chat-main.md` を古い版へ巻き戻す差分になった（main は Step 5-c 完了まで進んでいたのにブランチは Step 6 止まり）。three-dot diff だけ見ると 97 insertions の正当な差分に見えるので、**two-dot で「ブランチ側にしかない行」を数えて 0 と 12 行の巻き戻しであることを確認**してから判断した
- **PR #610（計画書）**: `2026-08-03-open-issue-fanout-r3.md` 313 行を追加。docs-lint が**新しい検査 (e)** で落ちた — pull で入った記録グラフ層（`.claude/INDEX.md` + `records.mjs`）により、plans/ を触った PR は `node .claude/scripts/records.mjs index` を同一 PR に含める必要がある。ローカル検証を Codex 側ブランチで回していたため見落とした（**plans/ を触る PR では lint を必ずそのブランチで回す**）
- **PR #611（Codex 対応）**: 初版は `CLAUDE.md` / skills / hooks の全文コピーで、**発見時点で既に原本 5 コミット分ズレていた**（`.claude/hooks/*.sh` は hooks-lib 分離済み・`docs-workflow/SKILL.md` も更新済み）。加えて「Claude」→「Codex」の一括置換が固有名詞まで巻き込み、`.Codex/rules/` 等の実在しないパス・ブランチ名 `Codex/<slug>`・「**Codex** API 直課金」・「**Codex** 本体の SSE バグ」が生まれていた（`${CLAUDE_PROJECT_DIR}` は置換漏れで残存）
- **参照方式への再設計**: 実体は `.claude/` 側 1 つだけを保ち、Codex 側は入口のみ。`hooks.json` は `.claude/hooks/*.sh` を **git ルート相対**で呼ぶ（初版は `C:\Users\user\...` の絶対パス直書きで他マシン・worktree では動かなかった）。副次的に**バグが 1 つ消えた** — `.claude/hooks/*.sh` は `$(dirname $0)/..` から vendor 実装を探すため、`.codex/hooks/` に置いたコピーからだと `.codex/scripts/hooks-lib/` を見にいって外していた
- **仕様の裏取り**（公式ドキュメント）: スキルは **`.agents/skills/`** から探される（`.codex/skills/` ではない・`$CWD` から repo root まで遡る）／ hooks は `<repo>/.codex/hooks.json` が読まれ、コマンドは**セッションの cwd** で走るため絶対パスか git ルート相対が推奨（公式例が `$(git rev-parse --show-toplevel)`）
- **スキルを 4 本に絞った根拠**: `.claude/skills/` 17 個のうち 8 個はシンボリックリンクで、**Windows では実体化せずリンク先パスが書かれただけのテキストになっている**（`file` で確認）。残る実体 9 本のうち `loop-*` 5 本は Claude Code のスラッシュコマンド前提。差し引き 4 本

### 2026-08-06 - Loop Engineering Phase 2 の文書整備（夜の実装レーンを薄い殻へ・PR #597 merged `5161a9a1`）

#### 概要

親計画 §8 Step 9 のゲート（ループカタログ定着後に decision キューで Phase 2 着手可否を裁定）を**ユーザー指示で前倒しし、試験運用 0 件のまま** Phase 2 の文書整備を実施した。`goals.md` は役割ごと差し替え、`routine-night.md` は `/loop-implement` を呼ぶ薄い殻に書き換えている。**発火は有効化していない**（実行基盤の裁定 D-20260804-main-1 が未回答）。

#### 変更点

- **飛ばしたゲートを先に記録**: カタログは同日 merge（#595）で試験運用ゼロ、キューでの裁定も無し。Step 6（2026-08-04）と同型の前倒しである旨を親計画の Worklog 先頭に明記した上で着手
- **`goals.md` の役割変更**: 旧版は Goal 1〜3 + `ACTIVE` / `PENDING` / `BLOCKED` の状態機械で、中身が Tauri / D1 時代のまま陳腐化。**一覧を持たせず「今夜どれを選ぶか」の判断基準だけ**にした（open Issue の正本は GitHub — 数値の非複製原則）。必須条件 4 つ（一晩で commit まで届く / 無人で完結する / 誰の手番でもない / 未回答の decision に乗っていない）→ 順序（小さく確実な順 → bug > task > feature → 番号の古い順）→ 候補ゼロなら基準を緩めず終わる
- **設計判断（ユーザー裁定）**: open Issue は**全件がレーン宛の prefix 付き**で、無条件では夜のレーンが 1 件も拾えない構造だった。拾う範囲を「**宛先レーンはあるが滞留している Issue**」と確定。滞留の判定 = ① Issue 番号を含むブランチ / open PR の不在 ② 宛先レーンの 3 日無活動（ブランチ最終コミット + `.session-name` の mtime の**両方**。commit を残さず調査だけのレーンを前者だけでは見落とす）③ 着手宣言の不在。3 日は初期値
- **`routine-night.md` を薄い殻へ**: 無人固有の 6 点のみ（Scope 宣言 / Issue の選び方 / セッション予算 90 分の bash 明示計測 / 停止条件 / 報告先 / 質問経路）。検証ゲート・ティア判定・worktree 手順・機械が止める禁止は各正本へ委譲し重ねて書かない。`/loop-implement` との差分 1 点（周回数の記録先を計画書 Worklog ではなく報告に）を明記
- **訂正**: 親計画 §2 / §7 の「draft PR 止まり」→ **commit 止まり**。`Bash(git push*)` / `Bash(gh pr create*)` が `permissions.ask` にあり無人では必ず失敗するため。解放の可否は `2026-08-06-autonomous-operation-endpoint.md` §3 第 1 段の管轄
- **追随 3 か所も同一 PR に同梱**（起草時は Scope 外としたが同日ユーザー指示で取り込み）: `run-routine.ps1` の `ValidateSet` に `night` 追加（**無いと手動でも起動できなかった**）/ `README.md` の状態列と Phase 2 記述 / **`routine-morning.md` を退役**（中心の仕事が「goals.md の状態機械を朝に更新」で、その機械ごと畳んだため前提が消えた。朝の枠は `routine-digest.md`）。旧 Step の行き先表を残し、**後継のいない worktree prune は人手のまま**と明示
- **検証**: `LC_ALL=C bash scripts/docs-lint.sh` OK / `run-routine.ps1` は PowerShell パーサで構文 OK / shared lint 0 errors・test 1502 passed・build 通過 / web lint 指摘なし・build 通過・test 124 passed。**プロダクトコードの変更ゼロ**。fresh worktree には `node_modules` が無く初回は全滅したので `npm ci` 後に再実行している

#### 次セッション用プロンプト（セッション 3: コンテキストコスト削減ハーネス — 同日の旧プロンプトを差し替え）

```
コンテキストコスト削減ハーネスの実装セッション（Loop Engineering セッション 3/3）。

正本 = .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md（Status: Draft・未着手）
親計画 = .claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md
姉妹計画 = .claude/docs/vision/plans/2026-08-04-loop-catalog.md（ループ定義の構造。コストは扱わない）

## 最初に確認すること（「完了」の範囲を先に確定する）

**1 セッションで全 Step は終わらない。** Step 5（Phase 3 移送）は計画自身が
「移行（Electron + Supabase）完了後に実施」と定めていて、移行は未完了。
Risks にも「移行中に移送すると移送先自体が動く」と書いてある。

したがって今回の到達点は **Phase 1（計測）+ Phase 2（枠づくり）+ Phase 4（/loop-prune）** で、
Phase 3 は移行完了まで開けない。Acceptance Criteria の
「移送前後の再測定で固定費が減少している」は今回は満たせない ——
**満たせない項目があることを最初に認めた上で、残りを全部埋める**こと。
Status は COMPLETED にせず IN PROGRESS のまま、残が Phase 3 だけと分かる形で書く。

（移行ゲートを前倒しで開けるかはユーザー判断。開けたいなら decision キューに A/B で起票し、
　回答を待たずに Phase 1/2/4 を進める）

## 本題 1: Phase 1 — 計測（Step 1〜2）

**何も削らない。内訳を数字で出すことだけが目的。** 二段構え（概算 → 上位項目だけ精密）は
2026-08-04 裁定で確定済み。全項目の精密計測はしない。

調査対象は計画書 §4 の表が正本。ただし **表に載っていない支配項が 1 つある**（下の申し送り参照）。

結果は本書の Worklog ではなく**独立した計測結果ファイル**に残す
（再測定して差分を見るため）。再現可能な測定手順を同じファイルに書くこと ——
「どう測ったか」が無いと次回の数字と比較できない。

## 本題 2: Phase 2 — 枠づくり（Step 4）

CLAUDE.md を **航法（Navigation）/ 目的（Why）の 2 層**へ再編する枠を用意し、
移送先（skill / docs）を先に作る。**全面書き換えではなく既存記述の振り分け。**

- 移送先が無い記述は、移送先を作るまで消さない（消失ゼロ）
- 実体の無い禁止は、hooks / permissions に実体を作ってから文章を削る
- この段階では枠と移送先の確保まで。実際の移送は Phase 3

## 本題 3: Phase 4 — /loop-prune（Step 6）

`.claude/skills/loop-prune/SKILL.md` を作る。**これが最終成果物**
（計画書 §1: 成果物として残すのは 1 段目の計測と 4 段目の維持機構）。

- 形式はループカタログの既存 4 本に揃える（必須 5 見出し = 目標 / 完了条件（機械検証可能）/
  予算 / 停止条件 / 使ってよい道具。手順は書かない。disable-model-invocation: true）
- 対になる /loop-postmortem（知見を足す側）が既にあるので、**肥大を戻す側**として設計する。
  カタログ自身も棚卸しの対象に含める
- 予算の実測値は 2026-08-04-loop-catalog-implementation.md の Worklog を参照

## 判断が要る 2 点（キューに書いて進む・待たない）

1. **Phase 3 の移行ゲートを前倒しで開けるか** — 開けるなら移送も今回やる
2. **グローバル資産（~/.claude/CLAUDE.md と claude-dotfiles/claude/rules/）を Scope に入れるか**
   — 計画書の Scope は .claude/** と .mcp.json だけで、グローバル側が入っていない。
   だが実測するとここが無視できない大きさ（申し送り参照）。**別リポジトリなので PR も別**になる

## 制約

- Phase 1 の間は **読み取りと計測結果ファイルの追加のみ**。既存ファイルは変更しない
- 削減量を KPI にしない（削りすぎは探索コストを増やして逆効果）。基準は「移送先があるものは移す」だけ
- 調査を目的化しない。上位項目が見えたら次へ進む
- worktree から作業する。メイン直下は main 専有。ブランチを切ったら .claude/comm/.session-branch を書き換える
- 計画書 frontmatter の Branch を着手時のブランチ名に更新する（現在は配置 PR のまま）
- tracker を実装ブランチに載せない（D-20260801-main-1）。merge は常にこうだいさん（P-001）
- PR 前に CLAUDE.md §7.1 の lint / build / test（docs だけでも docs-lint は LC_ALL=C 付き）

## 申し送り（2026-08-06 実測・そのまま使ってよい）

- **プロジェクトの常時ロード分は約 31KB**: .claude/CLAUDE.md 18.5KB +
  rules/ 3 本 12.6KB（うち frontend.md 7.5KB と docs-consistency.md 4.3KB は path-scoped）
- **グローバル側がほぼ同規模で、計画書 §4 の調査表に入っていない**:
  claude-dotfiles/claude/rules/ は 11 本 28.8KB で、うち 8 本が毎セッション無条件でロードされる
  （bash-tool-stability 3.2KB / tone 7.3KB / heavy-workflows 1.8KB 等）。
  **これが最大の盲点**の可能性がある。§4 の表に 1 行足すところから始めること
- **MCP の仮説は環境側で部分解消されている**: 現行 Claude Code には deferred tools
  （ツール定義を必要時に取り寄せる遅延ロード）があり、MCP ツールは名前だけ提示されて
  スキーマは ToolSearch 時にロードされる。「毎セッション全量積まれる」前提で測らないこと
- .claude/skills/ は 8 本。.claude/scripts/ は実在する（docs-lint はリポジトリ直下の scripts/）
```

### 2026-08-06 - ループカタログ初期 4 本の配置（Loop Engineering セッション 2・PR #595 merged）

#### 概要

親計画 `2026-08-04-loop-catalog.md` §4 の手順どおり、この Windows 機のローカル実態を実測してから子計画書を起こし、`/loop-triage` でフォーマットを確定させたうえで残り 3 本を同一形式で配置した。実測の結果、親計画が置いていた前提が 2 か所で崩れていたため、設計を 2 点変更している。

#### 変更点

- **子計画書**: `2026-08-04-loop-catalog-implementation.md`（§1 ローカル実測 / §2 責務境界 / §3 フォーマット + 規約 / §4 初期 4 本 + 設計変更 2 点 / Scope / Steps 8 本 / 機械検証可能な AC 8 項目）。親計画に `Child:` を追加し Status を `IN PROGRESS` 化
- **前提の崩れ ①（死んだスキル）**: リポジトリ内スキル 12 本のうち **8 本が Mac パスを指すシンボリックリンク切れ**（`add-component` / `add-feature` / `add-ipc-channel` / `db-migration` / `frontend-react-designer` / **`issue-dispatch`** / `session-loader` / `test-writing`）。生きているのは `dev-digest` / `docs-workflow` / `schedule-management` / `worktree-policy` の 4 本のみ
- **前提の崩れ ②（merge の穴）**: `gh pr merge` が repo `permissions` の deny にも ask にも無く、**POLICY P-001「merge は常にユーザー」が機械では未強制**。さらに `git-workflow` §0.1.1 の自動マージ指定と衝突している。→ **D-20260804-main-2** として判断キューへ起票（A = `permissions.ask` へ追加 / B = deny / C = 現状維持 + §0.1.1 を life-editor 非適用と明記）
- **設計変更 2 点**: ① `/loop-triage` は**起票しない**（`issue-dispatch` が死んでおり、起票は chat-main 一元）。判定と着手順の提示までで、起票が要るものは outbox へ依頼を append ② `/loop-implement` は **draft PR を作らない**（`git push*` / `gh pr create*` が `permissions.ask` のため無人実行では必ず止まる）。完了条件は commit + PR 本文の下書きをファイル出力まで
- **配置した 4 本**: `loop-triage`（12 件 / 20 分）・`loop-implement`（5 周 / 90 分）・`loop-verify`（3 周 / 30 分・`session-verifier` の内部 2 リトライの**外側の輪**）・`loop-postmortem`（5 件 / 20 分・1 件につき 1 行）。全本 `disable-model-invocation: true` + 必須 5 見出し + 6 つ目の `## 環境の事実`（ユーザー承認）。時間上限は宣言だけでは無視された実例（494 反復の暴走）があるため `START_TS=$(date +%s)` の実測を明記
- **見出し語彙は `automation/routine-*.md` に合わせた**。親 Phase 2 で `routine-night.md` を `/loop-implement` の薄い殻に書き換えられるようにするため
- **検証**: AC 8 項目すべて機械確認（4 本存在 / 5 見出し 5-5 / `disable-model-invocation` 4-4 / 反復・時間上限 4-4 / 死んだスキルを呼び先に指名していない / 親→子の参照あり / `LC_ALL=C bash scripts/docs-lint.sh` = OK）。CI = docs-lint pass 7s + typecheck/test/build pass 3m7s。**PR #595 merged `18da6b5f`**

#### 次セッション用プロンプト（セッション 3: コンテキストコスト削減ハーネス）

```
コンテキストコスト削減ハーネスの実装セッション（Loop Engineering セッション 3/3）。
前提: PR #595 が merge 済み（18da6b5f・ループカタログ初期 4 本が main にある）。
正本 = .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md（着手時に Status を IN PROGRESS 化）。
範囲は Phase 1（計測）+ Phase 2（枠づくり）まで。Phase 3（移送）は Electron 移行完了後なので着手しない。
Phase 1 で必ず実測すること:
- 常時ロード分（CLAUDE.md + ~/.claude/CLAUDE.md + rules/ 群）の実トークン数
- 条件ロード分（skills / path-scoped rules / docs）が実際に何回・どれだけ載っているか
- 実測前に削る判断をしない（どこが重いかは推測では当たらない）
Phase 2 の枠づくりでは、ループカタログと同じ規律に従う:
- 削るのではなく「読む条件」を足す（path-scoped / 明示起動へ寄せる）
- 削った細則の分だけ「なぜ」を厚くする
- 数値・列挙の正本を 1 か所に寄せる（数値の非複製原則）
制約: Scope は計画書に宣言したパスのみ。CLAUDE.md を削るときは、その行を消したら Claude が間違うかで判断し、根拠を Worklog に残す。
既知の関連: 姉妹計画の loop-prune（増えた文書を畳むループ）は本計画の管轄。カタログは 4 本を上限にしてある。
```

#### 次セッション用プロンプト（自律運転の到達点・第 1 段の設計 — セッション 3 より先にこちら）

```
自律運転の到達点・第 1 段の設計セッション。

前提: PR #596 が merge 済みであること（未 merge なら停止して報告）。
正本 = .claude/docs/vision/plans/2026-08-06-autonomous-operation-endpoint.md（Status は既に IN PROGRESS）。
姉妹 = .claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md（ループ 4 本の定義）。

## 最初にやること: 夜間レビュー試験運用の回収

2026-08-06 23:33 JST に 1 回だけ走らせたクラウド routine（trig_018fECsiaVRLNSCFcoVMDF4q）の結果が
Notion の「Life Editor Night Review」ハブ（3b4b6365-53cc-8158-93d5-e3514ff6d9d3）にある。
同じハブの下に「Cloud Probe 2026-08-06」（環境実測）も置いてある。

1. Night Review 2026-08-06 を読み、§1-A-2 の残る未検証 = `gh auth status` の結果を確定させて計画書に追記する
2. 監査の検出内容（docs 整合 / Issue 台帳 / PR conflict / 検証準備）を裁く。起票が必要なものは chat-main が起票する
3. 実際の所要時間を Worklog に記録する（反復上限・時間上限の実測値として使う）

## 本題: 第 1 段の設計を書き直す

実測で前提が変わっている。クラウド環境には life-editor のチェックアウトも .claude/settings.json も無い（§1-A-2）。
したがって第 1 段は「ローカルの permissions を緩める」話ではなく、
ガードレールが効かない環境に GitHub の書き込み認証を置くかどうかの話になっている。

`gh auth status` の結果で分岐する:

- 認証が無かった場合: 「書く手段が無いから書けない」が構造的な安全担保になっている。
  第 1 段を進めるならこの担保を意図的に外すことになるので、外す前提条件を設計する
  （どの操作まで許すか / 認証をどう供給するか / トークンをどこに置くか）。
  トークンをプロンプトに平文で書くのは禁止（CLAUDE.md §9 の鉄則・2026-05-17 の流出未遂）
- 認証が有った場合: 柵の無い環境に既に書き込み能力がある状態。
  第 1 段の解放以前に現状が危ないので、まずそれを塞ぐ設計を先に書く

どちらでも共通で決めること:

- クラウドの routine 定義が git 管理外という穴（Risks に記載）をどうするか。
  正本を .claude/automation/ に置いて、trigger 側は clone して読むだけにする案が有力
- 夜間レビューを常設化するか（今は 1 回きり）。常設化するなら発火頻度と利用枠の消費を見てから

## 制約

- Scope は計画書の Scope 節で宣言し直す。POLICY.md には触れない（P-001 は据え置き確定）
- merge は常にこうだいさん（P-001・D-20260806-main-1 = B で再確認済み）。
  gh pr merge は permissions.ask に入れてあるので、押す前に必ず止まる
- 不可逆操作（DDL 適用・シークレット投入・force 系 git・履歴改変）は判断キューに書かず同期で確認（P-007）
- tracker（memory/ + history/）の更新を実装ブランチに載せない（D-20260801-main-1）
- クラウド実行はサブスクの利用枠を食う（別請求は無い）。試験は 1 回ずつ、繰り返し登録は結果を見てから

## セッション終了時

コスト削減ハーネス（2026-08-04-context-cost-reduction-harness.md・Loop Engineering セッション 3）向けの
プロンプトを生成すること。貼り付け用の下書きは本エントリの上のブロックにある。
```

### 2026-08-04 - Loop Engineering: 3 計画書の整合性評価 + Phase 1 インフラ配置（PR #594）

#### 概要

ユーザー持ち込みの 2 計画書（loop-catalog / context-cost-reduction-harness）と親計画（2026-07-28-loop-engineering-harness）の整合性を評価し、指示の実施順序がカタログ側の「Phase 2 前提」裁定と矛盾している点を含む 3 点をユーザーに確認。裁定（①順序 = 親 Phase 1 → カタログ → コスト → 親 Phase 2 ②Phase 0→1 昇格の前倒し確定 ③実行基盤は調査して提案）に基づき、親計画 Phase 1 のインフラを PR #594 として配置した。自動発火は D-20260804-main-1 の裁定まで無効。

#### 変更点

- **整合性評価**: 順序矛盾（カタログ = Phase 2 の前提条件）/ 1 セッションで消化できない時間ゲート 3 箇所 / 実行基盤の未指定 / plans 未配置・Branch 未記入 / MCP ツール定義仮説への deferred tools の影響、を検出して報告
- **plans/ 配置**: `2026-08-04-loop-catalog.md` + `2026-08-04-context-cost-reduction-harness.md`（Branch 記入 + Worklog に裁定記録を追記して原文どおり配置）
- **automation/ 改訂（Cloud Routine 退役）**: `routine-digest.md`（朝 06:03・dev-digest スキルの薄い外枠）+ `routine-night-safe.md`（夜 22:33・読み取り中心の監査 4 本 = docs 整合 / Issue 台帳 / PR conflict / 検証準備・書き込みは outbox 報告のみ）+ `run-routine.ps1`（headless launcher・未実測）を新設。README / routine-ids を全面書き換え、旧 night / morning プロンプトは Phase 2 改訂待ちバナー付きで凍結
- **権限の二層化**: `settings.json` の `permissions.ask` に `git push*` / `gh pr create*` を追加（merge 後は全チャットで push / PR 作成が常に確認必須になる — PR 本文に注意書き）。**この 2 件は 2026-08-10 の #618 / PR #619 で撤去**（無人レーンの担保は runner 側 settings へ分離）
- **実測補正**: セッション内 scheduled tasks（CronCreate）はセッション限定 + 繰り返し 7 日期限。親計画 §3-7 の前提を Worklog で補正し、推奨基盤 = Task Scheduler + `claude -p`（2026-07-16 朝刊プロトタイプの型）を **D-20260804-main-1** として起票
- **親計画更新**: Status 行 / Steps 6〜9 / Worklog 追記。docs-lint = OK

#### 次セッション用プロンプト（セッション 2: ループカタログ）

```
ループカタログ計画の実装セッション（Loop Engineering セッション 2/3）。
前提: PR #594 が merge 済みであること（未 merge なら停止して報告）。
正本 = .claude/docs/vision/plans/2026-08-04-loop-catalog.md（着手時に Status を IN PROGRESS 化）。
進め方は計画書 §4 のとおり:
1. ローカル実態の調査（~/.claude/skills/ の役割系・パイプライン系の中身と実運用 / リポジトリ内スキルとの責務の重なり / hooks・permissions が機械強制している範囲)
2. 調査結果から子計画書を docs/vision/plans/ に作成 → 私がレビュー
3. レビュー後にループ定義フォーマットを 1 本目（/loop-triage 推奨）で確定 → 残り（/loop-implement /loop-verify /loop-postmortem）を配置
制約: Scope = .claude/skills/loop-*/ と plans/ のみ。全ループ明示起動（disable-model-invocation）+ 反復上限宣言 + 必須 5 見出し（目標 / 完了条件 / 予算 / 停止条件 / 使ってよい道具）。既存パイプラインを呼ぶ薄い外枠にし、手順を書かない。
セッション終了時に、コスト削減ハーネス（2026-08-04-context-cost-reduction-harness.md・セッション 3）向けのプロンプトを生成すること。
```

### 2026-08-01 (2) - 判断キュー 8 件の消化と docs 反映（PR #527 merged・#524〜#528 起票）

#### 概要

巡回を 5 周した末にユーザーが判断キューへ回答を返し、溜まっていた 8 件をすべて消化した。回答は行き先が 3 通り（Issue のゲート解除 / 実装 Issue の起票 / docs への反映）に分かれるため、それぞれ実行して停止条件（#467 / #468 close + open PR 0）まで戻した。

#### 変更点

- **回答の転記**: `.claude/comm/decisions/ANSWERS.md` に 8 件（main `3dd7b511`）。うち D-20260730-mobile-1 は明示指名が無く「放置時 A」での確定なので、ユーザー回答ではない旨を行に明記
- **ゲート解除 1 件**: D-20260801-sched-1 = A（移動時にレンズを外す）を #520 にコメント。DoD 1 番目の 🛑 が外れ schedule-refine が着手可に
- **起票 2 件（B 採用 = 実装が要るもの）**: **#525** `BottomSheet` に明示的な閉じるボタン（mobile-2）／ **#526** パスワード付きノートのモバイルシートを Desktop と同じ「本文だけロック」に揃える（mobile-3）。どちらも `[mobile-refine]` 宛て
- **docs 反映 4 件 = PR #527**（merged `637a64e6`・CI 2 ゲート pass）: CLAUDE.md §9 から `[all]` prefix を廃し「起票時点で slug を 1 つに決める」へ（main-2）／ §7.4 に「tracker は実装ブランチに載せない」（main-1）／ `rules/docs-consistency.md` §3 に「enum は plans/ 由来だけ」+ 全数チェックの正しい grep（main-2）／ ClaudeDesign fan-out 計画書を COMPLETED 化して `archive/` へ `git mv` し、CLAUDE.md §6 の「追跡正本」宣言を **Epic #321 + mobile-scope.md + Issue 群**へ付け替え（tags-1）
- **自分で作った不具合を自己レビューで検出**: archive へ移した計画書の相対リンク 2 本が階層ぶんずれてリポジトリ外を指していた（`../../` のまま）。同 PR 内で修正（`e6f0b7cc`）
- **同種の既存壊れを発見 → #528**: `archive/` の 5 ファイル・6 本が同じ理由で壊れている（リンク先はすべて実在・階層だけが誤り）。根本原因は `scripts/docs-lint.sh` がリンク解決を検査していないことなので、検出の追加も DoD に入れた
- **巡回 2〜5 周目の所見**: outbox は **worktree の実体まで直接 diff** しないと未 push 分を取りこぼす（tags-docs に 4 エントリ・内容は処理済み）。PR #479 は squash merge のため `git merge-base` では未マージに見えるが、mergeCommit `ac32c7b9` が main の祖先であることを実測して着地を確認（§7.4 の「差分で判定しない」の実例）

### 2026-08-01 - open PR 巡回の完走（open PR 0 到達・Epic #290 / #321 の DoD 実測確認・#523 のレビュー検出 1 件）

#### 概要

「open PR を巡回して merge 可能なものを報告 → outbox の未処理を処理 → merge を検知したら Epic のチェックボックスと docs Status を追随」の巡回を、停止条件（#467 / #468 close + open PR 0）まで走らせた。巡回開始時の open PR 2 本はレビュー中にユーザーが merge したため、レビュー結果は merge 後の指摘として記録に残す形になった。

#### 変更点

- **停止条件の達成**: #467（Step 5-c Mobile List+FAB）・#468（Step 6 台帳タグレンズ）とも CLOSED、open PR は 0（巡回中に #521 / #522 / #523 が merge され main は `8e624422`）
- **PR レビュー 2 本**: #522（tracker 復元・docs 専用）は本文の 3 claim を `git show origin/main:` で実測照合し全一致 — 指摘なし。#523（`useGraphInteraction` の d3 sim を発火時読み取りへ）は変更自体は正しいが、**deps から `simRef.current` を落としたことでリスナーの貼り直し機会がサイズ変更時のみになる**副作用を検出（下記）
- **検出（未起票・memory「予定」に記録）**: `GraphCanvas.tsx:178` の `onSelect` は `selectedId` を掴む inline クロージャで、effect が凍結すると**選択中ノードの再クリックによる選択解除が常に効かなくなる**。従来は `simRef.current` の dep がグラフ再構築のたびに偶然貼り直していたため「たまに効く」状態だった（#523 が壊したのではなく確定化させた）。直しは #523 と同じ発想でコールバックも ref 経由の発火時読み取りにする
- **Epic / docs の追随は不要と実測**: Epic #290 は Step 2〜7 が全て [x]（PR 番号・merge commit つき）、Epic #321 は Phase 2 の 5 項目すべて [x] で残は Phase 1 の #391 のみ。mobile-scope.md・plans の Status 行も各レーンが自 PR 内で追随済みだった
- **outbox 巡回**: 全 18 ファイルを走査し、最新の未処理候補（chat-schedule-refine 2026-08-01 の起票依頼 = #520 起票済み /「記録のみ」項目 = 本人が tracker で処理済み）まで含めて**未処理ゼロ**を確認
- **残タスク**: open Issue 8 件（#507 / #509 / #511 = materials、#519 = connect、#520 = schedule、#512 / #517 = shared-fix、#372 = 将来 DDL）+ Epic #321 Phase 1 の #391
