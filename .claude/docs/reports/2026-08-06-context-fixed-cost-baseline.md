# コンテキスト固定費 ベースライン計測（2026-08-06）

> **これは何か**: セッション開始時点で無条件に積まれるコンテキスト（= 固定費）の内訳を実測した結果。
> **親計画**: [`docs/vision/plans/2026-08-04-context-cost-reduction-harness.md`](../vision/plans/2026-08-04-context-cost-reduction-harness.md) Phase 1。
> **この時点では何も削っていない。** 削減は Phase 3（移行完了後）の管轄で、本書はその判断材料。
> **再測定の基準点**: 移送の前後で同じ手順を回して差分を見る。手順は §6。

---

## 1. 計測条件（再測定時に揃えるもの）

| 項目           | 値                                                                                   |
| -------------- | ------------------------------------------------------------------------------------ |
| 実施日         | 2026-08-06                                                                           |
| 機械           | Windows 11 / Git Bash / Node v24                                                     |
| リポジトリ     | `life-editor` `main` = `51e96223`                                                    |
| 計測スクリプト | [`.claude/scripts/context-cost-measure.mjs`](../../scripts/context-cost-measure.mjs) |
| トークン係数   | ASCII = 3.6 chars/token・非 ASCII = 0.9 token/char                                   |

**トークン数はすべて概算**（誤差 ±30% 程度を見込む）。用途は「どれが重いかの順位」と「再測定時の差分」であって絶対値の精度ではない。**係数を変えると過去の測定と比較できなくなる**ので、変えるときは本書に併記する。バイト数は正確なので、順位が疑わしいときはそちらを見る。

---

## 2. 結果 — 一段目（概算・全項目）

| 分類           | 意味                                               |   概算 tok |     バイト |
| -------------- | -------------------------------------------------- | ---------: | ---------: |
| **always**     | 毎セッション無条件でロードされる                   |     13,223 |     45,143 |
| **listing**    | 一覧行（name + description）だけが常時ロードされる |      6,054 |     20,890 |
| **固定費合計** | always + listing = **毎回必ず払う分**              | **19,277** | **66,033** |
| scoped         | `paths:` に一致するファイルを触った時だけ          |      5,620 |     19,288 |
| ondemand       | 明示起動・参照時だけ（スキル / エージェント本体）  |     87,680 |    304,233 |

**固定費の内訳（上位順）**:

| 概算 tok | 対象                                      | 所在           |
| -------: | ----------------------------------------- | -------------- |
|    5,357 | `.claude/CLAUDE.md`                       | プロジェクト   |
|    4,317 | `~/.claude/rules/` 常時 8 本              | **グローバル** |
|    3,006 | エージェント一覧の description 7 本       | **グローバル** |
|    2,059 | グローバルスキル一覧の description 16 本  | **グローバル** |
|    1,991 | `~/.claude/CLAUDE.md`                     | **グローバル** |
|    1,338 | output style `tone-persona`               | **グローバル** |
|      989 | プロジェクトスキル一覧の description 8 本 | プロジェクト   |
|      220 | `.claude/rules/decision-queue.md`         | プロジェクト   |

**支配項の所在はグローバル側**: プロジェクト側 5,577 tok に対しグローバル側 12,711 tok で、**固定費の約 66% がこのリポジトリの外にある**。親計画 §4 の調査表はグローバル側を対象に含めていない（→ §5-1）。

---

## 3. 結果 — 二段目（上位項目だけ節ごとに分解）

全項目の精密計測はしない（2026-08-04 裁定）。上位 4 ファイルだけ見出し単位で割った。

### 3.1 `.claude/CLAUDE.md`（5,357 tok）

|  概算 tok | 節                           |
| --------: | ---------------------------- |
| **2,192** | **§7 Development Workflows** |
|       548 | §9 Document System           |
|       436 | §4 Data Model                |
|       402 | §3 Architecture              |
|       395 | §2 Platform                  |
|       347 | §8 Feature Tier Map          |
|       328 | §6 Coding Standards          |
|       254 | 冒頭（前書き + 移行注記）    |
|       232 | §0 Meta                      |
|       120 | §5 AI Integration            |
|        99 | §1 Vision                    |

**§7 だけでファイルの 41%**。中身は開発コマンド・commit 規約・Plan Gate・worktree 運用で、そのほとんどが「特定の作業をする時だけ要る手順」（親計画 §2.1 の判断軸では skill 行き）。ただし §7.1 の検証コマンドと落とし穴（`web` の lint が `shared/` を歩かない・TypeScript の版差・jsdom にレイアウトが無い）は**知らなければ推論で埋まらない事実**なので航法側に残す。

### 3.2 口調定義が 3 か所に重複（合計 4,472 tok = 固定費の 23%）

| 概算 tok | ファイル                                  | 位置づけ（各ファイルの自己申告） |
| -------: | ----------------------------------------- | -------------------------------- |
|    2,184 | `~/.claude/rules/tone.md`                 | 「詳細版」                       |
|    1,338 | `~/.claude/output-styles/tone-persona.md` | 「実効の正本」                   |
|      950 | `~/.claude/CLAUDE.md` 口調・人格 章       | 「正本の要約（保険）」           |

**単一項目としては最大の固定費**。3 本とも常時ロードで、内容は「良い例 / 悪い例」の分量差を除けばほぼ同じ。`~/.claude/CLAUDE.md` 自身が「正本は output style、この章は保険、詳細は tone.md」と三層構造を明記しているので、**意図的な冗長化**であって事故ではない。削るなら「保険をどこまで薄くするか」の判断が要る（→ §5-2）。

### 3.3 `~/.claude/CLAUDE.md`（1,991 tok）

| 概算 tok | 節                              |
| -------: | ------------------------------- |
|      950 | 口調・人格（→ §3.2）            |
|      781 | Project Documentation Structure |
|      163 | Heavy Work Modes                |
|       56 | Code Conventions                |
|       33 | Language                        |

「Project Documentation Structure」は全プロジェクト共通のテンプレ（`.claude/` の階層・運用原則・CLAUDE.md の標準章構成）で、**life-editor では既に実体が存在し、プロジェクト側 §9 と `docs-workflow` スキルが正本になっている**。新規プロジェクトを立ち上げる時にだけ要る内容が毎セッション乗っている。

### 3.4 エージェント一覧の description（3,006 tok）

| 概算 tok | エージェント                |
| -------: | --------------------------- |
|      610 | `role-pm`                   |
|      528 | `role-qa`                   |
|      519 | `role-engineer`             |
|      485 | `multi-session-coordinator` |
|      422 | `security-reviewer`         |
|      238 | `deep-web-research`         |
|      204 | `web-researcher`            |

役割系 4 本の description は「いつ起動するか」の条件を 5 項目 + 「対象範囲」+ 「重要」注記まで書いており、1 本が本文並みの分量になっている。description は**起動判断にだけ使われる**（本体は起動時に別途読まれる）ので、条件の列挙は本文側へ移せる。`~/.claude/rules/skill-management.md` は description を「80〜150 tokens 目安」としており、**現状は 3〜4 倍**。

---

## 4. 仮説の検証結果（親計画 §4 の調査表）

| 対象              | 仮説                                   | 実測                                                                                                                              |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| CLAUDE.md         | 本体より参照先の方が重い？             | **半分あたり**。プロジェクト CLAUDE.md 5,357 tok は単体最大だが、固定費全体では 28%。参照先（大型 SSOT）は常時ロードされていない  |
| 大型 SSOT         | 読み込みが重い？                       | **固定費ではない**。移行 SSOT・`docs/` は誰も自動では読まない。読むのはセッション中の明示的な Read だけで、`ondemand` 側の話      |
| MCP サーバー      | ツール定義が毎セッション積まれる？     | **概ね解消済み**。deferred tools により名前だけ提示されスキーマは `ToolSearch` 時にロードされる（§5-3）                           |
| path-scoped rules | 実質常時ロードでは？                   | **常時ではない**。5 本 5,620 tok が `paths:` 判定で分離されており、frontend.md（2,173 tok）は `shared/src` `web/src` を触る時だけ |
| SessionStart hook | 出力がコンテキストに入る？入るなら量？ | **入っていない（0 バイト）**。ただし理由が異常 — `session-start-check.sh` が Windows で落ちている（§5-4）                         |
| skills の説明文   | 全 skill 分が常時読まれる合計量は？    | **3,048 tok**（グローバル 16 本 2,059 + プロジェクト 8 本 989）。本体 68,404 tok は起動時のみ                                     |
| memory / history  | セッション開始時に読まれる範囲は？     | **0**。`hooks/regen-index.sh` は INDEX を再生成するだけで標準出力に何も出さない。INDEX を読むのは `task-tracker` 起動時           |

---

## 5. 実測で出た申し送り（Phase 3 の判断材料）

削減方針の裁定（親計画 Step 3 = 🛑 人手）に要るもの。**計測の時点では何も決めていない**（裁定は §5-1 / §5-2 の追記を参照）。

### 5-1. グローバル資産が Scope に入っていない → **Scope に追加**（D-20260806-main-2 = A）

固定費の 66% が `~/.claude/`（実体 = 別リポジトリ `claude-dotfiles`）にある。親計画の Scope は `.claude/**` と `.mcp.json` だけなので、**このままでは支配項に手が届かなかった**。

**2026-08-06 に Scope へ追加**（D-20260806-main-2 = A・削るのは「保険」の 1 層に絞る条件つき）。PR は別リポジトリ側 = [`claude-dotfiles#13`](https://github.com/sunbreak-pro/claude-dotfiles/pull/13)。

### 5-2. 移送先の当たり（順不同）

| 対象                                       | 概算 tok | 移送先                                                                                        | 状態                     |
| ------------------------------------------ | -------: | --------------------------------------------------------------------------------------------- | ------------------------ |
| 口調定義の三重化（§3.2）                   |    4,472 | output style を正本に、「保険」の 1 層（`~/.claude/CLAUDE.md` の章）だけ撤去                  | ✅ 実施（-1,313）        |
| `~/.claude/CLAUDE.md` の docs 構造テンプレ |      781 | `project-setter` スキル（**実在しない死んだポインタだったので新規作成**）                     | ✅ 実施（+131 の一覧行） |
| `.claude/CLAUDE.md` §7 の手順部分（§3.1）  |  〜1,600 | `worktree-policy` / `git-workflow` / `docs-workflow` へ（検証コマンドと落とし穴は航法に残す） | ⬜ Phase 3（移行完了後） |
| エージェント description の起動条件列挙    |  〜1,500 | 各エージェント本体（description は判断用の 1〜2 行に）                                        | ⬜ 次回以降の棚卸し      |
| `~/.claude/rules/tone.md`                  |    2,184 | —（正本の詳細版 + サブエージェント向け要点を持つ。今回は触らない）                            | ⬜ 次回以降の棚卸し      |

いずれも **移送先が既にあるか、作れる**。「移送先が無く作る先も決まらない」に当たるものは、この計測では見つからなかった。

### 5-3. deferred tools の実測（申し送りの確認）

現行 Claude Code は MCP ツールを名前だけ提示し、スキーマは `ToolSearch` 時にロードする。本セッションでは deferred 扱いのツール名が約 150 件並び、**概算 1,000〜1,500 tok**（本文から数えた概算でディスク由来ではない）。これに MCP サーバーが自前で出す instructions（claude-in-chrome / supabase）が **概算 700 tok** 乗る。

したがって「使わない MCP サーバーを切れば大きく減る」は**現状では成立しない**。`.mcp.json` は 2 サーバー（`life-editor` は `settings.local.json` で disable 中・`supabase` のみ有効）で 877 バイト。

### 5-4. `session-start-check.sh` が Windows で落ちている（副産物・別件）

`~/dev/Claude/hooks-lib/session-start-check.sh:68` が `File: unbound variable` で exit 1 する。原因は 66 行目の

```bash
SESSION_MTIME=$(stat -f %m "${SESSION_FILE}" 2>/dev/null || stat -c %Y "${SESSION_FILE}" 2>/dev/null || echo "")
```

で、**BSD 版を先に試す形が Git Bash では裏目に出る**。GNU の `stat -f` は「ファイルシステム情報を出す」別の意味で、`%m` を引数と解釈して警告を出しつつ**対象ファイルのファイルシステム情報を標準出力に流す**。結果 `SESSION_MTIME` が `File: ".claude/comm/.session-name"` 等の文字列になり、次行の `$(( ))` が `File` を変数として評価 → `set -u` で異常終了する。

影響は**コンテキスト費用ではなく検査の欠落**: `.session-name` の妥当性・`.session-branch` との整合・dirty worktree の放置検知が、この機械では 1 つも走っていない。実体は `~/dev/Claude/hooks-lib/`（= 別リポジトリ）なので本計画の Scope 外。CLAUDE.md §9 の判定（「life-editor のコードを直せば直るか？」= No）により Issue 化もしない。**修正の当たりは `stat -c %Y` を先に試す順序入れ替え 1 行**。

---

## 6. 再測定の手順

```bash
cd <repo-root>
CLAUDE_PROJECT_DIR=$(pwd) node .claude/scripts/context-cost-measure.mjs             # 一段目（全項目）
CLAUDE_PROJECT_DIR=$(pwd) node .claude/scripts/context-cost-measure.mjs --sections  # 二段目（上位を節ごと）
CLAUDE_PROJECT_DIR=$(pwd) node .claude/scripts/context-cost-measure.mjs --json      # 差分を機械で取る場合
```

- **always / scoped の判定は機械**（rules frontmatter の `paths:` 有無）なので、ルールを増やしても分類は自動で追随する
- **ハーネス側（本体システムプロンプト・非 deferred のツール定義・組み込みスキルの説明文・MCP instructions）はディスクに無いのでスクリプトの対象外**。§5-3 のように本文から数えて本書へ手記録する
- 比較するときは §1 の係数が同じことを確認する
- **まだ merge していないグローバル側の変更を先に測るには `CLAUDE_GLOBAL_DIR` を使う**（既定は `~/.claude`）:

```bash
CLAUDE_GLOBAL_DIR=<claude-dotfiles-worktree>/claude node .claude/scripts/context-cost-measure.mjs
```

ただし worktree のブランチが `~/.claude` の実体と別のコミットを指していると、無関係な差（スキルの増減など）が総計に混ざる。**総計ではなく行単位で比較する。**

---

## 7. 本セッション自身が足した分（+186 tok）

ベースライン **19,277 tok は本セッションの変更前**の値。この計測作業自体が固定費を増やしているので、正直に記録する。

| 追加                                       |   概算 tok |
| ------------------------------------------ | ---------: |
| `.claude/CLAUDE.md` §0 の再編ポインタ 1 行 |      〜105 |
| `loop-prune` の description（一覧行）      |       〜81 |
| **計測後の固定費**                         | **19,463** |

**ハーネスはタダではない**（測る道具にも案内板にも場所代がかかる）。

## 7-2. グローバル側の第 1 回移送（-1,182 tok）

D-20260806-main-2 = A を受けて同日実施（[`claude-dotfiles#13`](https://github.com/sunbreak-pro/claude-dotfiles/pull/13)）。**merge 前の数値**なので、merge 後にこの表を実測で確定させる。

| 対象                              | 変更前 | 変更後 |       差分 |
| --------------------------------- | -----: | -----: | ---------: |
| `~/.claude/CLAUDE.md`（常時）     |  1,991 |    678 | **-1,313** |
| `project-setter` の一覧行（新規） |      0 |    131 |       +131 |
| **計**                            |        |        | **-1,182** |

- 撤去したのは口調の「保険」1 層のみ。**正本（output style 1,338）と詳細版（`rules/tone.md` 2,184）は無傷**
- docs 構造テンプレは `project-setter` スキルへ全文移送（消失ゼロ）。**このスキルは 2 か所から参照されていたのに実在しなかった**ので、死んだポインタも 2 本解消した
- **見込み固定費: 19,463 → 約 18,280**。Phase 3 の再測定はここを起点にする

---

## 8. 次にやること

- Phase 2（枠づくり）= 親計画 Step 4。移送先を先に作る（→ 親計画の Worklog）
- Phase 3（移送）= 移行（Electron + Supabase）完了後。**本書の再測定で固定費の減少を確認するのが完了条件**
- §5-1 / §5-4 はユーザー判断待ち（`comm/decisions/chat-main.md`）
