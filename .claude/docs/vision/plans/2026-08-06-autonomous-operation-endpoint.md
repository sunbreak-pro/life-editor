---
Status: IN PROGRESS # 2026-08-06 案 B（P-001 据え置き）で確定し機械側を反映。残 = Step 1 クラウド実測 → Step 4 第 1 段 → Step 6 第 3 段
Created: 2026-08-06
Branch: docs/autonomy-endpoint
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md
---

# Plan: 自律運転の到達点 — クラウド起動のループをどこまで解放するか

> **これは何か**: ユーザーが定めた到達点「クラウドから起動したループが、検証から解決まで自走し、次のタスクを自分で起票する」に、**どの順で・何を条件に**近づくかを決める計画書。
> **なぜ別計画書か**: ループカタログ（`2026-08-04-loop-catalog-implementation.md`）は「対話セッションで人が明示起動するループ」の話で、Scope に `settings.json` も POLICY も含めていない。無人・クラウド実行はゲートと安全網の設計そのものを変えるので、混ぜずに分ける。

---

## Context

### 到達点（ユーザー定義・2026-08-06）

クラウド起動のループが **検証から解決までを自走** し、**次のタスクを自分で起票する**。安全網は **commit 履歴からの revert**（間違えたら履歴を遡って戻すのが本人にとって一番楽）。

### 前提の補正（実測にもとづく 3 点）

到達点そのものは変えない。ただし**そこへの道筋は、ユーザーの当初の見立てと 3 点ずれている**。ずれたまま進むと、自動化したのに手作業が減らない結果になる。

**① ネックは merge ではなく、その手前の push と PR 作成**

当初の見立ては「PR の作成からマージが人手なので、そこがネック」。実測すると逆で、`gh pr merge` は**機械的には既に素通り**（deny にも ask にも無い。§1-B）。止まっているのは手前の `git push` と `gh pr create` の 2 つで、これが `permissions.ask` に入っている。無人実行では答える人がいないので、ここに当たった時点でループは必ず止まる。

**② revert はコードには効くが、DB には効かない**

`git revert` が戻せるのは**リポジトリの中身だけ**。次の 2 つは戻らない（§1-C）:

- **適用済みの DDL**（`supabase db push` したテーブル定義）— コードを戻してもテーブルは元に戻らない
- **Cloud Sync が書いたデータ** — 同期は `items_meta.updated_at` の新しい方が勝つ仕組み（LWW）なので、コードを戻しても**書かれた行は巻き戻らない**

引っ越しに例えると、荷物（コード）は運び直せるが、**部屋の間取りを壊した（DDL）のと、他人の部屋に置いてきた荷物（同期済みデータ）は戻せない**。だから「revert が安全網」と言えるのは、コードと docs だけを触った変更に限る。

**③ 自動 merge と自動 revert は対で入れる**

merge だけ自動にすると、手作業が「押す」から「壊れたのを直す」へ**移動するだけ**で総量は減らない。むしろ壊れたことに気付くのが遅れる分、悪化しうる。merge を自動化するなら、**merge 後の main を検証して赤なら自動で revert する**仕組みを同時に入れる。

---

## 1. 実測（2026-08-06・この計画の土台）

### 1-A. 「クラウド起動」の実体

`RemoteTrigger` API（claude.ai の remote triggers）で登録された **routine** が実体。現在 4 本登録されており、実測で分かったこと:

| 項目            | 実測値                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| 実行場所        | `environment_id` を持つ**クラウド環境**。この Windows 機ではない                                                      |
| セッション      | `persist_session: false` — **1 発火 = 使い捨て**。前回の状態を持ち越さない                                            |
| 使える道具      | `session_context.allowed_tools` の**明示 allowlist**（現行 4 本 = Bash/Read/Write/Edit/Glob/Grep/WebFetch/WebSearch） |
| MCP             | クラウドコネクタのみ（Notion / Google Calendar / Drive）                                                              |
| PR 関連の配線   | `autofix_on_pr_create` フラグが存在する = クラウド側に PR 作成の導線がある                                            |
| 現行 4 本の用途 | すべて Notion への文章生成。**life-editor リポジトリには 1 本も触っていない**                                         |

ここから直ちに言える制約が 2 つある:

- **ローカル固有のものは届かない**。`.claude/comm/outbox/` も worktree もこの Windows 機のファイルなので、クラウド環境からは見えない。判断キュー（`decisions/`）も同じ。**チャット間の連絡は git を経由する形に置き換える必要がある**
- **`allowed_tools` は `permissions` とは別の関門**。現行 4 本の allowlist には `Task`（サブエージェント）も `Skill` も入っていない。この 2 つが使えないと、`/loop-implement` は `role-engineer` も `session-verifier` も呼べない = **カタログのループはそのままでは無人で回らない**

> **未検証（Step 1 で実測する）**: ① クラウド環境に life-editor のチェックアウトがあるか ② リポジトリの `.claude/settings.json` の `permissions` がクラウド側でも効くか ③ 新規 trigger の `allowed_tools` に `Task` / `Skill` を宣言できるか。**この 3 つが割れると設計が変わる**ので、他のどの Step よりも先に測る。
>
> **なぜ Step 1 が 🛑 人手なのか**: この 3 点は既存 trigger の設定を読むだけでは分からず、**使い捨ての trigger を 1 本作って実際に走らせる**しかない。クラウド実行は外向きかつ課金される操作なので、Claude の判断だけでは実行しない。測り方は「`claude/*` に空コミットを 1 つ push して、リポジトリが見えるか・push が通るか・`Task` が呼べるかを報告させるだけの捨て routine」を 1 回 `run` して、結果を確認したら削除する形を想定している。

### 1-B. ゲートの実測

| 層                               | 実測値                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| repo `permissions.deny`（27 件） | main / master への push 全形・force 系・`reset --hard`・`branch -D`・`checkout main`・`rm -rf .git*`・`supabase db reset` |
| repo `permissions.ask`（2 件）   | `Bash(git push*)` / `Bash(gh pr create*)` — **ここが無人実行の壁**                                                        |
| repo `permissions.allow`         | 空                                                                                                                        |
| global `~/.claude/settings.json` | `allow: Bash(*)` + `defaultMode: auto` — 既定で素通り                                                                     |
| `gh pr merge`                    | **deny にも ask にも無い**。機械では止まらない                                                                            |

つまり **P-001「merge は常にユーザー」は文章だけで守られている**。加えて `git-workflow` §0.1.1（2026-07-29 ユーザー指定・全プロジェクト共通）は「conflict なし + role-qa 通過なら確認を挟まず自動マージ」と書いており、**P-001 と正面から矛盾している**。この矛盾は D-20260804-main-2 として起票済みで、本計画はその裁定を前提にする。

### 1-C. revert が効く範囲

| 対象                      | `git revert` で戻るか | 理由                                                                |
| ------------------------- | --------------------- | ------------------------------------------------------------------- |
| コード・docs              | **戻る**              | リポジトリの中身そのもの                                            |
| 適用済み migration（DDL） | **戻らない**          | テーブル定義は DB 側の状態。打ち消す migration を別途書く必要がある |
| Cloud Sync が書いたデータ | **戻らない**          | LWW（`items_meta.updated_at` の新しい方が勝つ）— 巻き戻り概念が無い |

→ **自動 merge の対象から、migration を含む PR を機械的に除外する**（§3 第 2 段の条件）。

---

## 2. 設計方針

1. **段階解放**。1 段ずつ解き、実測してから次へ。まとめて解かない
2. **自動 merge と自動 revert は対**。片方だけ入れない
3. **P-001 の改訂は明示的に行う**。なし崩しに緩めない — 「実質もう自動だから」で既成事実にしない
4. **不可逆なものは段階解放の対象外**。DDL 適用・シークレット投入・履歴改変・force 系 git は、どの段でも人の手番のまま（P-007）
5. **クラウドとローカルの連絡は git を通す**。outbox / decisions はローカルファイルなのでクラウドからは書けない（§1-A）。無人ループの報告先は Issue コメントか PR 本文にする

---

## 3. ゲートの段階解放 — **第 1 段と第 3 段の 2 段で確定**

| 段          | 解放するもの                                       | 解放の前提条件                                                    | 安全網                                             |
| ----------- | -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| **第 1 段** | `claude/*` ブランチへの push + **draft** PR の作成 | §1-A の未検証 3 点が測れている / deny 27 件は据え置き             | main に届かない。draft なので誤って merge されない |
| ~~第 2 段~~ | ~~機械判定つきの自動 merge~~                       | **開けない**（2026-08-06 ユーザー裁定 D-20260806-main-1 = B。§4） | —                                                  |
| **第 3 段** | merge 後の main 検証 → 赤なら自動 revert           | 検証が緑 / 赤を機械的に出せる（CI の結論をそのまま使う）          | revert 自体は打ち消しコミットなので不可逆でない    |

第 2 段が閉じたので、**merge は常に人が押す**。第 3 段はその後の安全網として単独で価値がある（人が押した後で main が赤くなったら自動で戻す）ので、第 2 段の前提としてではなく独立に進める。

**どの段でも解放しないもの**: DDL 適用（`supabase db push`）・シークレット投入・`--force` 系・`reset --hard`・`branch -D`・main への直 push・`gh pr merge`。これは P-007 の不可逆操作か P-001 の管轄なので段階解放の枠外。

---

## 4. P-001 の扱い — **案 B（据え置き）で確定**（2026-08-06 ユーザー裁定 D-20260806-main-1）

現行のまま維持する:

> **P-001** merge と main への取り込みは常にこうだいさんが行う。自動化がどれだけ安定しても解除しない

**確定した内容**:

- P-001 は文言どおり据え置く。**第 2 段（条件つき自動 merge）は開けない**
- 機械側を文章に合わせる: `permissions.ask` に `Bash(gh pr merge*)` を追加し、P-001 を機械でも担保する
- `git-workflow` §0.1.1（PR の自動マージ・「全プロジェクト共通」）は **life-editor 非適用**と CLAUDE.md §7.2 に明記する
- → あわせて **D-20260804-main-2 も A + C で同時決着**（案 B の定義がそのまま両者を含むため）

**却下した案 A（条件つき解除）の記録**: 「conflict なし + CI 全緑 + role-qa Blocking ゼロ + migration を含まない + 自動 revert 稼働」の 5 条件つきで自動 merge を許す案。第 1 段を解放すれば残る人手は **merge ボタン 1 動作だけ**になるので、**その 1 動作を消すために自動 revert の仕組みを丸ごと用意する取引**が割に合わないと判断した。

**この確定により §3 の到達点は 2 段まで**になる（第 1 段 + 第 3 段）。第 3 段（merge 後の main 検証 → 赤なら自動 revert）は第 2 段の前提としてではなく、**人が merge した後の安全網**として単独で価値があるので残す。

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-08-06-autonomous-operation-endpoint.md
.claude/comm/decisions/chat-main.md          # 判断キューへの起票 / 回答済みエントリの削除（単一書込者 = chat-main）
.claude/comm/decisions/ANSWERS.md            # 回答の転記のみ（既存行は消さない — 監査ログを兼ねる）
.claude/settings.json                        # 案 B 確定後に追加（permissions.ask への 1 行のみ）
.claude/CLAUDE.md                            # 同上（§7.2 に git-workflow §0.1.1 非適用の明記）
```

**`POLICY.md` / `automation/` / `skills/` には触れない**。P-001 は据え置き確定なので `POLICY.md` の書き換えは不要（§4）。第 1 段・第 3 段の実装は段ごとに別ブランチで行う（Scope はそのとき宣言し直す）。

> Scope 拡張の記録（2026-08-06）: 起草時は `settings.json` / `CLAUDE.md` を除外していた（「実装は裁定が下りてから」）。同日 D-20260806-main-1 に案 B の回答が出たため、**その裁定が直接命じる 2 行だけ**を本ブランチに含めるよう拡張した。第 1 段・第 3 段の実装は含めない。

---

## Steps

| #     | Step                                                                         | Gate    | Acceptance                                                                           |
| ----- | ---------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 1     | §1-A の未検証 3 点をクラウドで実測（checkout / permissions / allowed_tools） | 🛑 人手 | 3 点の結論が §1-A に追記され、割れた前提があれば §3 が補正されている                 |
| 2     | P-001 改訂案（案 A / 案 B）を判断キューへ起票                                | 🤖 自律 | `decisions/chat-main.md` に D-20260806-main-1 — **完了**                             |
| 3     | 裁定の反映（案 B = 据え置き）                                                | 🤖 自律 | `permissions.ask` に `Bash(gh pr merge*)` + CLAUDE.md §7.2 に非適用の明記 — **完了** |
| 4     | 第 1 段の実装（`claude/*` push + draft PR 作成の解放）                       | 🛑 人手 | `permissions` の変更をユーザーが承認。deny 27 件が減っていないこと                   |
| 5     | 第 1 段を 1〜2 週間試験運用し、実測を Worklog に追記                         | 👀 目視 | 無人実行で実際に draft PR が出た件数・止まった件数が記録される                       |
| 6     | 第 3 段の実装（merge 後 main 検証 → 赤なら自動 revert）                      | 🛑 人手 | 意図的に赤いコミットを入れて、自動 revert が実際に発火することを実証                 |
| ~~7~~ | ~~第 2 段の可否裁定~~                                                        | —       | **不要**（D-20260806-main-1 = B で第 2 段は開けないと確定）                          |

**Step 1 と Step 4 の順序**: Step 1（クラウド実測）が済むまで Step 4 には進まない。クラウドから repo が見えない・`permissions` が効かない・`Task` が呼べない、のどれかが黒なら第 1 段の設計自体が変わるため。

---

## Acceptance Criteria (機械検証可能)

- [ ] §1-A の未検証 3 点に「実測した結論」が書かれている（「たぶん」で終わっていない）
- [x] §3 の各段に、解放するものと安全網が 1 対 1 で対応して書かれている
- [x] P-001 の扱いが `decisions/chat-main.md` に起票され、`ANSWERS.md` に回答が転記されている
- [x] `.claude/settings.json` の `permissions.ask` に `Bash(gh pr merge*)` がある（P-001 の機械担保）
- [x] `permissions.deny` が 27 件のまま減っていない（締める方向にしか触っていない）
- [x] CLAUDE.md に `git-workflow` §0.1.1 が life-editor 非適用である旨が書かれている
- [x] 本書の Scope に `POLICY.md` が**含まれていない**（P-001 は据え置きのため書き換え不要）
- [x] `LC_ALL=C bash scripts/docs-lint.sh` が緑

---

## Risks

- **クラウド環境でカタログのループが動かない**（§1-A）— `Task` / `Skill` が使えないと `/loop-implement` は成立しない。Step 1 でここが黒なら、**無人実行用に「サブエージェントを使わない版」を別途書く**必要があり、カタログの「薄い外枠」方針と衝突する。その場合は本計画を分割して再設計する
- **自動 revert が頻発する**— 頻発するなら「そもそも merge の判断が早すぎる」サイン。第 3 段を入れた後は revert 発生率を実測し、一定を超えたら自動化ではなく merge 前の検証を厚くする方へ倒す
- **P-001 をなし崩しに緩める**— 本計画の最大のリスク。据え置きが確定した今も、`git-workflow` §0.1.1 は**グローバル側では「全プロジェクト共通」と書かれたまま**である。塞いだのは repo 側（CLAUDE.md §7.2 + `permissions.ask`）だけなので、**グローバル定義を読んだ Claude が life-editor 以外で自動 merge する余地は残っている**。他プロジェクトでも止めたいなら `~/.claude/skills/git-workflow/SKILL.md` 側の改訂が別途必要（本計画の Scope 外・ユーザー判断）
- **クラウド実行は「別請求ゼロ・利用枠は消費」**（2026-08-06 実測 — 既存 trigger の `api_token_hint` が空 = API キー従量ではなくサブスク側で走る）。**「完成までコスト $0」の方針とは衝突しない**が、普段の Claude Code と同じ利用枠を食う。無人ループを常時回すと枠を先に使い切って**対話セッションが遅くなる / 止まる**ため、第 1 段の試験運用では発火頻度と 1 回あたりの消費を実測してから常設化する

---

## References

- 親計画: `.claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md`（§1-B 死んだスキル / §1-C permissions の実測がここの土台）
- 祖父計画: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md`（Phase 2 = 実装レーン自走。本計画はその前提整備）
- 判断キュー: `.claude/comm/decisions/POLICY.md`（P-001 / P-007）・`.claude/comm/decisions/chat-main.md`（D-20260804-main-2）
- 既存の無人ルーチン: `.claude/automation/routine-night-safe.md` / `routine-digest.md`（ローカル発火・書き込みは outbox のみ）
- Sync の LWW モデル: `.claude/docs/vision/db-conventions.md` §10（§1-C の根拠）

---

## Worklog

- 2026-08-06 (2): [chat-main] **案 B（P-001 据え置き）で確定**（D-20260806-main-1・D-20260804-main-2 は A + C で同時決着 = 案 B の定義に含まれるため）。裁定が直接命じる 2 行だけを反映 — `permissions.ask` に `Bash(gh pr merge*)` を追加（deny 27 件は不変・締める方向のみ）+ CLAUDE.md §7.2 に `git-workflow` §0.1.1 の life-editor 非適用を明記。**第 2 段（条件つき自動 merge）は開かない**ので Step 7 を削除し、到達点を第 1 段 + 第 3 段の 2 段に縮小。残るリスクとして、**グローバルの `git-workflow` §0.1.1 は「全プロジェクト共通」のまま**であり、塞いだのは repo 側だけである点を Risks に明記
- 2026-08-06: [chat-main] 起草。`RemoteTrigger list` でクラウド routine 4 本の実体を実測し、§1-A を確定（クラウド環境で実行 / `persist_session: false` / `allowed_tools` の明示 allowlist / MCP はクラウドコネクタのみ / 現行 4 本は life-editor リポジトリに触れていない）。ここから **ローカルの outbox・decisions・worktree はクラウドから見えない**ことと、**`allowed_tools` に `Task` / `Skill` が無いとカタログのループが無人で回らない**ことを導出。未検証 3 点（クラウドに checkout があるか / repo の `permissions` が効くか / `Task`・`Skill` を宣言できるか）を Step 1 に切り出した
