---
Status: Draft
Created: 2026-10-07
Branch: docs/extension-gateway-plan-2127
Owner-chat: main
---

# Plan: 拡張アプリ用の窓口

> 材料の出どころ = pdca-harness の引き継ぎ文書（`sunbreak-pro/pdca-harness` の `docs/handoff/2026-10-06-life-editor-extension-gateway.md`、Basis = life-editor `fdc31a5c`）。依頼 = Issue #2127。
> この計画書は **Draft**。判断キュー D-20261007-main-1〜3 に答えが付くまで、実装・Scope の確定・Steps 2 以降の着手はしない（P-005 / P-008）。引き継ぎ文書の行番号は 2026-10-06 時点の読み取りで、本計画書で `path:line` を引いた箇所は 2026-10-07 に実物で確かめた。

---

## Context

- **動機**: こうだいさんは、life-editor とは別のリポジトリに「拡張アプリ」を足していく。最初はサブスク管理の SubscRecorder。どれも無人の開発ループ pdca-harness で作る。拡張アプリが life-editor のデータ（予定・Todo・Note など）を読み書きするための、拡張アプリ専用の受け口（窓口）が要る。
- **なぜ窓口の出来が拡張アプリの出来を決めるか**: pdca-harness は無人の環境に life-editor の資格情報を置かず、本物の代わりの偽物（モック）に対してだけ合否を判定する。SubscRecorder は偽物が本物と違う形を受け付けたため、判定が全部通ったのに本物につながらなかった。違いの例: `memo` を `note` と呼んでいた / 条件つきの必須（`is_all_day` でなければ時刻が要る）が偽物に無かった / 認証と CORS が偽物に無かった。窓口の仕様が機械で読めて、本物と同じに振る舞う公式の偽物があれば、この食い違いは起きない。
- **制約**:
  - 費用は $0。Worker は Durable Objects と KV を使わない（`mcp-server/wrangler.jsonc:12-17`）。
  - pdca-harness は life-editor のリポジトリ・Supabase スキーマ・本番データに触らない。窓口は life-editor の通常の進め方（chat-main・worktree・本テンプレート・Issue）で作る。
  - DDL はローカルファイル先行 → こうだいさんが `supabase db push`。シークレット投入・本番デプロイ・PR の merge も人手（Gate 🛑）。
  - 現状の入口は共有の合言葉 1 本で、持つ人はオーナーの全データを読み書きできる。このリスクは D-20260909-mcp-mobile-1 で受け入れ済みで、OAuth 案の復活条件に「トークン共有では権限分離が要ると分かった時」がある。拡張アプリの窓口はこの条件に当たるかを判定する場面である。
- **2026-10-06 に決まったこと**（こうだいさん回答・引き継ぎ文書 §9.1）:
  - 拡張アプリは別リポジトリに作り、窓口を通してつなぐ。life-editor の画面の中で動くプラグインにはしない。
  - 使うのはこうだいさん 1 人。拡張アプリは公開して使う。そのため、鍵をブラウザに置かずに使える道が必須。配布先の利用者は使わないので、ユーザーごとの OAuth は要らない。
  - 達成の確認は life-editor の確認専用アカウントで行う。
  - SubscRecorder の life-editor 連携は、窓口と公式の偽物ができてから作り直す。
  - NG-3 と V3 の読み替えは、判断材料をまとめてからこうだいさんが決める（→ D-20261007-main-1）。
- **Non-goals**:
  - life-editor の画面の中で動くプラグイン機構は作らない。
  - ユーザーごとの OAuth と、配布先の利用者への拡張アプリ開放は扱わない（復活条件 = D-20260909-mcp-mobile-1 の「サインアップ開放ユーザーに MCP を出す時」）。
  - SubscRecorder 固有の 2 点（知らせを「終日の予定」にするか通知付きにするか / 毎月・毎年の更新を繰り返しで表せない問題）は窓口の対象外。窓口ができたあと、pdca-harness の新しい目標として別 Issue にする。
  - 汎用 Database は凍結のまま（D-20260704-main-1）。拡張アプリのために解凍しない。
  - レート制限は D-20261007-main-7 の回答まで範囲に入れない（既定の仮置き = 対象外）。

---

## 検討した代替案（必須）

窓口の置き場（引き継ぎ文書 §8.2）。採否は D-20261007-main-3 の回答を待って埋める。下表の「仮の推し」は chat-main の提案で、決定ではない。

| 案                                                | 採否             | 却下理由 / 長所と短所                                                                                                                                                                                                                                                                             | 復活条件 / 改める決まり                             |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| B. 専用の Worker を別に立て、ハンドラだけ共有する | 仮の推し（未決） | 長所: オーナーのスマホ用の入口と分けられ、鍵・CORS・取り消しを拡張アプリ向けに作れる。短所: 配布とシークレットが 2 つになる。改める決まり = `.claude/CLAUDE.md` §5「入口は 2 本」が 3 本になる。                                                                                                  | —                                                   |
| A. 今の Remote MCP を広げる                       | 未決             | 長所: ハンドラと検査を共有でき、偽物との一致も取りやすい。短所: スマホのコネクタと同じ Worker に鍵と権限の仕組みと CORS を足すので、公開面が広がり、拡張アプリ用の変更がスマホ側を壊しうる。                                                                                                      | B で配布・シークレットの 2 重管理が重いと分かった時 |
| C. Supabase Edge Function の HTTP API             | 未決             | 長所: ユーザーの JWT で動き RLS がそのまま効く。CORS の前例がある（`supabase/functions/delete-account/index.ts:33-37`）。短所: MCP のハンドラと検査を共有しにくく仕様が 2 つに割れる。JWT のままだと PostgREST への直接書き込みで鍵の絞り込みが迂回される。改める決まり = §5「ハンドラは 1 本」。 | ハンドラ共有より RLS 直結を優先すると決めた時       |
| D. 拡張アプリ側に中継を置く                       | 未決             | 長所: life-editor 側の変更が小さい。短所: 拡張アプリごとにサーバーが要り、サーバーを持たない SubscRecorder の形と合わない。                                                                                                                                                                       | 拡張アプリが自前のサーバーを持つ前提になった時      |

- 窓口を MCP（JSON-RPC）の形で出すか、普通の HTTP API の形で出すかも、D-20261007-main-3 で一緒に決める。仮の推しは MCP の形のまま（ハンドラ・検査・偽物の一致を既存の仕組みで取れるため）。
- ブラウザだけで動く拡張アプリの鍵の置き方（R4）の 2 候補は、置き場の案にかかわらず比べる:
  - ログイン交換: 拡張アプリの画面でこうだいさんが life-editor にログインし、窓口がその JWT を確かめて、アプリ用の範囲つきの短い鍵に交換する。
  - 中継: 鍵を持つ中継を置く（案 D と同じ）。
  - JWT をそのまま窓口の認証に使う形は、同じ JWT で PostgREST に直接書けるため、鍵の絞り込みが迂回される。採るなら R9 の約束で補う。

---

## Scope (Touchable Paths)

**置き場が決まるまで確定しない**（D-20261007-main-3）。下は、採る案に合わせて選ぶ候補のパス。この Draft を書く作業自体が触るのは、計画書・判断キュー・決定記録だけである。

```
.claude/docs/vision/plans/2026-10-07-extension-app-gateway.md
.claude/comm/decisions/chat-main.md          # 問いを積む
.claude/decisions/D-20261007-main-<n>.md      # 回答後に昇格
.claude/CLAUDE.md                             # §2 §5 の入口の記述（採った案に合わせて）
.claude/docs/requirements/tier-1-core.md      # MCP Server の節（stdio 専用の記述が実態とずれている）
.claude/docs/vision/core.md                   # NG-3 / V3 を読み替える場合のみ
--- 以下は D-20261007-main-1〜3 の回答後 ---
mcp-server/src/worker.ts                      # 認証・CORS・呼び出し元の識別・経路
mcp-server/src/remoteTools.ts                 # 拡張アプリ用の道具集合
mcp-server/src/registry.ts                    # 失敗の code・道具ごとの許可・structuredContent
mcp-server/src/tools/{schedule,todo,note,wikiTag}.ts
mcp-server/src/handlers/*Handlers.ts          # 重複防止のキー・外部の参照 id・作成元
mcp-server/src/utils/items.ts                 # insertItem に作成元を通す
mcp-server/src/supabase.ts                    # アプリごと・ユーザーごとの資格情報にする場合
mcp-server/wrangler.jsonc
.github/workflows/deploy-mcp.yml
mcp-server/scripts/dump-tool-catalog.mjs      # 仕様ファイルの書き出しを足す場合
mcp-server/tests/{worker,remoteRegistry,toolRegistry,writeContract,silentDrops,toolCatalogFreshness}.test.ts
supabase/migrations/0035_<name>.sql           # DDL を足す場合（番号は着手時に origin と突き合わせる）
supabase/functions/<new>/index.ts             # 案 C の場合
shared/src/components/SettingsAiIntegration.tsx   # 拡張アプリの一覧と取り消しを画面に出す場合
web/src/settings/SettingsScreen.tsx
```

スコープ外の変更が必要になった場合は **P-008** に従い、実装せずキューか Issue 起票依頼へ積む。

---

## Steps

| #   | Step                                                                                                              | Gate    | Acceptance                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| 1   | D-20261007-main-1〜3 に回答をもらい、決定記録を残し、代替案の表と Scope を確定する                                | 🛑 人手 | `.claude/decisions/` に D-20261007-main-1〜3 があり、代替案の表の「未決」が 0 件      |
| 2   | 拡張アプリ用の道具集合と、仕様ファイル・版の決まりを作る（R1）                                                    | 🤖 自律 | R1 のテスト緑 / 仕様ファイルの鮮度テスト緑                                            |
| 3   | 公式の偽物と、偽物と本物のハンドラをそろえるテストを作る（R2）                                                    | 🤖 自律 | 一致のテストが CI で緑                                                                |
| 4   | 拡張アプリごとの鍵と範囲（R3）と、ブラウザからの道（R4）、確認専用アカウントへの道（R8）を作る                    | 🤖 自律 | R3・R4・R8 のテスト緑                                                                 |
| 5   | 重複防止のキーと作成元（R5・R6）の DDL を書き、こうだいさんが push する（D-20261007-main-5 が列を採った場合のみ） | 🛑 人手 | `supabase db push` が通り、RLS のゲートが緑                                           |
| 6   | 冪等・作成元・失敗の code（R5〜R7）をハンドラに入れる                                                             | 🤖 自律 | R5〜R7 のテスト緑                                                                     |
| 7   | シークレットを入れて本番に配る                                                                                    | 🛑 人手 | 本番の `/health` が応え、範囲外の道具が拒否される                                     |
| 8   | 仕様ファイルと偽物を版つきで main に置き、場所と版を pdca-harness 側に知らせる（R1・R2 の公開）                   | 🤖 自律 | ファイルが main にあり、先頭に窓口の版と commit があり、一致のテストが緑              |
| 9   | 窓口を迂回しない約束（R9）を決定記録に残す                                                                        | 🤖 自律 | `.claude/decisions/` に R9 の記録があり、`bumpMeta` と後始末の 2 約束を名指ししている |

本物までつなぐ確認は pdca-harness 側の新しい目標で行う。この計画書の Steps には入れない。

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に型・テストを回して検証する
- **👀 目視** — Claude では検証不能。こうだいさんが画面で確認
- **🛑 人手** — DDL push / シークレット投入 / 本番デプロイ / PR merge

---

## Acceptance Criteria (機械検証可能)

窓口の実装 PR 群の必要条件。道具の数・名前は数えず、コード（`mcp-server/src/remoteTools.ts`）を正とする。

- [ ] CI の `verify` ジョブ（shared → web → desktop → mcp-server）と `docs-lint` ジョブが緑
- [ ] **R1** 仕様ファイルの正しい例を `validateToolArgs` とハンドラの検査に流して合格し、誤った例を流して不合格になる。仕様ファイルが再生成した結果と一致する（鮮度テスト）
- [ ] **R1** 条件つきの必須（`is_all_day` でなければ `start_time`・`end_time` が要る。`mcp-server/src/tools/schedule.ts:75-79` のコメントが「スキーマの `required` では書けない」としている規則）が、仕様ファイルに機械で読める形で入っている
- [ ] **R2** 偽物と本物のハンドラに同じ入力を流し、成功・失敗の形と認証・404・405・CORS の扱いがそろう。偽物は Node だけで、ネットワークと資格情報なしに立つ。偽物が受けた呼び出しを返す道と記録を消す道がある
- [ ] **R3** 範囲外の道具を呼ぶと拒否される。取り消した鍵が拒否される。鍵の接頭辞が見分けられる形になっている
- [ ] **R4** 許すオリジンからの OPTIONS に 204 と `Access-Control-Allow-Origin` が返り、許さないオリジンには付かない。窓口の鍵がブラウザ向けの JS に載らない設計になっている（D-20261007-main-3 の回答に沿う）
- [ ] **R5** 同じ重複防止のキーで作成を 2 回呼ぶと同じ id が返り、`items_meta` の行が 1 件のまま（`tests/supabaseStub.ts` で確かめる）。同じキーで中身が違うときと、ソフトデリート済みのときの挙動は D-20261007-main-6 の回答どおり
- [ ] **R6**（D-20261007-main-5 が列を採った場合）別のアプリの鍵で作った項目を更新・削除しようとすると拒否される
- [ ] **R7** 引数の誤り・認証の失敗・見つからない、の 3 つで、決めた code が返る
- [ ] **R8** 確認専用アカウントに向いた鍵で作った項目が、オーナーのデータに現れない。本番の項目をまとめて消す道具を公開面に出していない（`mcp-server/src/remoteTools.ts:35-37` の考え方）
- [ ] `shared/src/generated/mcpToolCatalog.json` の再生成漏れがない（`mcp-server/tests/toolCatalogFreshness.test.ts` が緑）
- [ ] 秘密を `wrangler.jsonc` とフロントエンドに書いていない。`hooks/pre-commit-mcp-check.sh` が通る
- [ ] PR diff の目安は新規行で数える（D-20260920-main-2）。1 PR が Steps の 1 行に収まる
- [ ] 完了・退役・supersede 時: この計画書と per-chat memory の Status を更新した

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積む。

---

## DB Migration Notes

D-20261007-main-5（作成元の印）と D-20261007-main-6（重複防止のキーの置き場）の回答しだいで DDL が要る。要る場合のみ以下に従う。

- **重複防止のキー**: 候補は一意制約つきの列か表。キーから id を決める形は `.claude/CLAUDE.md` §4 の ID 不変式（`generateId(prefix)`）から外れるので採らない見込み。Worker は KV と Durable Objects を使わないため、ほかの置き場はない。
- **作成元**: 列で持つ前例は `wiki_tag_connections.origin`（`supabase/migrations/0023_wiki_tag_connections_origin.sql`）。タグで代用すると、作成とタグ付けの 2 回の呼び出しのあいだで落ちたときに、印のない項目が残る。
- 番号は着手時点で origin の `supabase/migrations/` と突き合わせて決める（並行レーンが同じ番号を切ると、git は MERGEABLE のまま `db push` だけが割れる）。
- 手順: `supabase migration new` → SQL を記入（Claude）→ **こうだいさんが `supabase db push`** → Claude が `list_tables` で確認。`apply_migration` MCP の単独使用は禁止。
- RLS（持ち主だけを通す）と Realtime publication、`life-editor-migration-validator` / `life-editor-sync-auditor` の監査を通す。
- ロールバックは逆向きの migration を別ファイルで作る。

---

## Risks / Known Issues 参照

- **鍵の漏れ**: 拡張アプリを公開して使うので、鍵がブラウザに載ると全データに届く。R3（範囲を絞る）と R4（ブラウザに鍵を置かない）が対策。D-20260909-mcp-mobile-1 の合言葉は今のまま 1 本で、本番の合言葉を長いものへ差し替える提案が #1994 のコメントにある。実施済みかは未確認。
- **迂回**: anon key は公開値で、ユーザーのログインを持つアプリは窓口を通らずに PostgREST へ書ける（`supabase/README.md:9-13`）。迂回すると、payload の作成失敗時の meta 削除（`mcp-server/src/utils/items.ts` の後始末）と `bumpMeta`（同ファイル `:116-133`）の 2 つの約束が守られない。life-editor 側は R9 で決定記録に残し、守らせるのは pdca-harness の契約と検証役。
- **移行中の破壊的変更**: 他プロジェクトに依存されると、道具名・引数名の変更が及ぶ（`.claude/docs/reports/2026-09-20-life-editor-as-dev-backbone.html:130`）。道具名と引数名は過去に変わっている（例: `toggle_schedule_complete` → `set_schedule_complete`）。窓口の版と、壊れる変更での版上げが R1 の中身。
- **承認済み契約の固定**: pdca-harness は承認した契約を固定する。窓口が変わると、新しい目標か契約の改訂（1 目標 2 回まで・Steps 3 の予定）が要る。
- **条件つきの必須の写し漏れ**: `required` だけを読んで偽物を作ると、SubscRecorder と同じ食い違いが起きる。R1 と R2 の AC で潰す。
- **文書のずれ**: `.claude/docs/requirements/tier-1-core.md` の MCP Server の節は「local stdio 専用」のままで、Remote MCP 併設後の実態と合っていない。Scope に含めて直す。
- 類似の known-issue は未確認。着手前に `docs/known-issues/` を grep する。

---

## Issue の下書き（起票は chat-main・Step 1 の回答後）

起票前なので番号は付けない。ラベルは `shared-fix` ではなく mcp / 窓口に当たる routing を `docs-workflow` スキルで確認してから付ける。AC は各 Issue の body に機械検証可能な形で書く（上の Acceptance Criteria から該当行を移す）。

| 仮題                                                                                         | 対応 Step | 依存          | 起票の条件                        |
| -------------------------------------------------------------------------------------------- | --------- | ------------- | --------------------------------- |
| 拡張アプリ用の窓口: 道具集合・仕様ファイル・版（R1）                                         | 2         | Step 1        | D-1〜3 回答後                     |
| 拡張アプリ用の窓口: 公式の偽物と一致テスト（R2）                                             | 3         | #R1           | 同上                              |
| 拡張アプリ用の窓口: アプリごとの鍵・範囲・ブラウザからの道・確認専用アカウント（R3・R4・R8） | 4         | #R1           | D-3 の置き場の回答後              |
| 拡張アプリ用の窓口: 重複防止のキーと作成元の DDL（R5・R6）🛑 db push                         | 5         | D-5・D-6 回答 | DDL を採る場合のみ                |
| 拡張アプリ用の窓口: 冪等・作成元・失敗の code をハンドラへ（R5〜R7）                         | 6         | #R1・DDL      | 同上                              |
| 拡張アプリ用の窓口: 本番デプロイとシークレット投入 🛑                                        | 7         | Step 4・6     | 実装完了後                        |
| 拡張アプリ用の窓口: 仕様ファイルと偽物を版つきで公開し、pdca-harness へ知らせる（R1・R2）    | 8         | Step 3・7     | 実装完了後                        |
| 窓口を迂回しない約束の決定記録と tier-1-core.md の訂正（R9）                                 | 9         | Step 1        | D-1〜3 回答後・実装と並行してよい |

---

## References

- 引き継ぎ文書: `sunbreak-pro/pdca-harness` の `docs/handoff/2026-10-06-life-editor-extension-gateway.md`（読む用の要約 = 同リポジトリ `docs/reports/2026-10-06-life-editor-handoff.html`）
- 先行の議論: `.claude/decisions/D-20260909-mcp-mobile-1.md`、`.claude/docs/reports/2026-09-20-life-editor-as-dev-backbone.html`、`.claude/docs/reports/2026-09-23-product-audit.html`
- 入口の実装: `mcp-server/src/worker.ts`、`mcp-server/src/remoteTools.ts`、`mcp-server/src/registry.ts`、`mcp-server/src/tools/schedule.ts`、`mcp-server/src/handlers/scheduleHandlers.ts`、`mcp-server/src/utils/verification.ts`
- Non-goals: `.claude/docs/vision/core.md` §4（NG-1 / NG-3）と V3
- related skills: `db-migration`、`add-feature`、`test-writing`、`docs-workflow`、`issue-dispatch`

---

## Worklog

- 2026-10-07: 引き継ぎ文書を読み、引用元（`worker.ts` の合言葉認証と 405、`wrangler.jsonc` の KV / Durable Objects 不使用、`schedule.ts` の条件つき必須、`delete-account` の CORS、`items.ts` の `bumpMeta`）を実物で確かめて Draft を書いた。問い 1〜8 を判断キューに積んだ（D-20261007-main-1〜8）。
- 引き継ぎ文書との差分の記録: 引き継ぎ文書 §6.3 の「`tools/list` は outputSchema を返さない」は `mcp-server/src/registry.ts:32-36` で確認済み（name / description / inputSchema のみ）。
