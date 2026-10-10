---
Status: IN PROGRESS — Step 1（計画書の merge = PR #2175）済み。Step 2 は migration `0039_note_table_items.sql` の PR を open（こうだいさんの `db push` 待ち）
Created: 2026-10-10
Branch: claude/materials-table-items-plan-2094
Owner-chat: materials-refine
---

# Plan: ノートの表を独立したアイテムにして、タグを付けられるようにする（#2094）

> こうだいさんの回答 D-20260927-materials-1（2026-10-03 = A「表を独立したアイテムにする」）を、DDL・データの流れ・実装の順番に落とします。
> この計画書は 2026-10-10 に PR #2175 の merge で確定しました。§計画の承認で確かめたいこと の Q1・Q2 は推奨どおり（ノートの表だけ / タグを初めて付けたときだけアイテムにする）です。

---

## Context

- **動機**: #2011 で表に名前を付けられるようにしました。タグは付けられません。タグの割り当て（`wiki_tag_assignments`）は `items_meta.id` を参照しますが、ノート本文の中の表はアイテムではないためです。D-20260927-materials-1 で「表を独立したアイテムにし、Connect のタグ別一覧・`search_by_tag`・MCP から、ほかのタグ付きアイテムと同じように引けるようにする」と決まりました。
- **制約**:
  - 表の中身（セル）の正本はノート本文（TipTap の JSON）のままにします。アイテム側にセルを写すと正本が 2 つになり、片方だけ直ったときにずれるためです。
  - `items_meta` の role を 1 つ足すため、CLAUDE.md §4 の「5 role」前提が変わります（Plan Gate の対象）。
  - DDL はローカルのファイルを先に作り、`supabase db push` はこうだいさんの作業です（`apply_migration` の MCP は使いません）。
  - コストは $0 のままです。新しい外部サービスは使いません。
- **Non-goals**:
  - Daily の本文の中の表（Daily も同じエディタで表を作れます）。理由は §計画の承認で確かめたいこと の Q1 に書きました。
  - 表のセルの検索（全文検索の対象に表の中身を足すこと）。
  - 表を本文の外に出して単独で編集する画面。表はノートの中で編集し、Connect からはノートを開きます。
  - 名前のない表の自動のアイテム化（下の §データの流れ）。

---

## 検討した代替案（必須）

| 案                                                                                                                                                 | 採否 | 却下理由                                                                                                                                                    | 復活条件                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A: 表を `items_meta` の新しい role `table` にし、本文の表ノードは `tableId` 属性でそのアイテムを指す。アイテムになるのはタグを初めて付けたときだけ | ✓    | —                                                                                                                                                           | —                                                                              |
| A': 表ノードを保存するたびに、本文の全部の表をアイテムにする                                                                                       | ✗    | ノートの保存のたびに本文の全表を数えて items_meta と突き合わせる処理が要り、タグを付けない表まで行が増える。既存の表の backfill（全ノートの書き換え）も要る | タグ以外の目的（表の一覧画面など）で、全部の表がアイテムである必要が出たとき   |
| B: 表ノードの属性に WikiTag の id の配列を持つ                                                                                                     | ✗    | D-20260927-materials-1 で却下済み。Connect と `search_by_tag` に出ず、タグ削除時の後始末も要る                                                              | 同決定の復活条件（DDL と backfill のコストが利点を上回ると実測で分かったとき） |
| C: 表にタグを付けない                                                                                                                              | ✗    | D-20260927-materials-1 で却下済み                                                                                                                           | 同上                                                                           |
| D: セルの中身も payload に写す                                                                                                                     | ✗    | 正本が 2 つになる。表を直すたびに両方へ書く必要があり、片方の失敗でずれる                                                                                   | 表の中身を MCP や検索から本文を開かずに読む必要が出たとき                      |

---

## 設計

### データの持ち方

- **role**: `items_meta.role` に `'table'` を足します。`items_meta_role_check` を張り直す形は `0034_goals.sql` の DO ブロックと同じです。
- **id**: `table-<timestamp+counter>`（CLAUDE.md §4 の ID 不変式。`generateId("table")`）。
- **名前**: `items_meta.title` に表の名前（#2011 の `name` 属性）を写します。`items_meta.title` は `not null default ''`（0008）なので、名前のない表は `''` を保存し、画面と MCP は `''` のときに「名前のない表」と出します。
- **payload**: `tables_payload` を作ります。持つのは親のノートだけです。

  | 列                 | 型                                                     | 説明                 |
  | ------------------ | ------------------------------------------------------ | -------------------- |
  | `item_id`          | text, PK, `items_meta(id)` を参照（on delete cascade） | 表のアイテムの id    |
  | `user_id`          | uuid, 既定 `auth.uid()`                                | RLS 用               |
  | `parent_note_id`   | text, not null                                         | 表が入っているノート |
  | `parent_note_role` | text, `generated always as ('note') stored`            | 複合 FK 用の固定値   |

  `(parent_note_id, parent_note_role)` は `items_meta(id, role)` を複合 FK で参照します（on delete no action。DB-Q3 の「物理削除は子から先」に従います）。

- **タグ**: `wiki_tag_assignments` は role を区別しないので、DDL を変えずに表の id へタグを付けられます（`shared/src/services/wikiTagAssignmentMapper.ts:11-13`）。
- **RLS / Realtime / 退会**: `0034_goals.sql` と同じ形です。initplan 形式の owner-only ポリシー、`supabase_realtime` への追加、`delete_my_account()` の作り直しを 1 本の migration に入れます。

### データの流れ

- **アイテムになるとき**: 表の操作パネル（`web/src/notes/TableControls.tsx`）に「タグ」のボタンを足します。表に `tableId` が無いときに初めてタグを付けると、次の順で動きます。
  1. `items_meta` に role `table` の行と `tables_payload` の行を作る。
  2. 表ノードの `tableId` 属性にその id を入れる（本文の変更として、いつもの自動保存で保存される）。
  3. `wiki_tag_assignments` に行を足す。

  1 が失敗したら 2 と 3 は動かしません。2 の保存が失敗したときは、次の保存で表の id がそろうまで、アイテムは本文から指されないまま残ります。これは下の「本文から消えた表」の掃除で拾います。

- **既存の表と `generate_content` の表**: `tableId` 属性は既定値 `null` で足します。属性の無い表はそのまま開けます（`tableNodes.ts:23-29` の注記どおり、既定値の無い属性は文書全体を弾くため、既定値は必須です）。backfill はしません。
- **名前を変えたとき**: 表に `tableId` があるときだけ、ノートの保存のあとに `items_meta.title` を新しい名前にそろえます。
- **本文から消えた表**: ノートの保存のあとに、本文にある `tableId` の集合と、そのノートを親に持つ表のアイテムの集合を比べます。本文に無いアイテムはソフトデリートし、本文に戻ったアイテム（Undo など）は復元します。リンクの掃除（`syncSavedBody`）と同じ場所で動かします。
- **コピーと貼り付け**: 貼り付けた表から `tableId` を外します（ProseMirror の `transformPasted`）。外さないと、2 つの表が同じアイテムを指し、片方を消したときにもう片方のタグまで消えるためです。
- **ノートの削除と復元**: 表のアイテムはゴミ箱に単独では出しません。Connect と MCP は、親のノートが削除されている表を一覧から外します（読むときに親の `is_deleted` を見る）。ノートを復元すれば、表もそのまま戻ります。ノートを完全に削除するときは、表のアイテムを先に物理削除します（DB-Q3）。

### 画面と MCP

- **Connect**: `shared/src/components/items/itemRole.ts` の `ITEM_ROLE_ORDER` に `table` を足し、アイコン・色・ラベルを決めます。`web/src/connect/ConnectScreen.tsx` に表の読み込みを 1 本足します。行を押すと親のノートを開きます（routine の行と同じ `navigateId` の形）。
- **同期**: `shared/src/context/syncDomains.ts` の `ITEMS_META_ROLE_DOMAIN` に `table: "notes"` を足し、`tables_payload` を `REALTIME_TABLES` と対応表に足します。role を足す PR と `ITEMS_META_ROLE_DOMAIN` を足す PR は同じにします。知らない role は全部のドメインの取り直しになるためです（`syncDomains.ts` の注記）。
- **MCP**: `mcp-server/src/tools/wikiTag.ts` の `tag_entity` と `search_by_tag` の `entity_type` に `table` を足します。`search_by_tag` は表の行に親のノートの id と題を添えて返します。ツールの正本は `remoteTools.ts` 側にあるので、Remote MCP にも同時に届きます。終わったら `cd mcp-server && npm run catalog` を回します。
- **書き出し**: `shared/src/services/userDataExport.ts` に `tables_payload` を足します。

---

## 計画の承認で確かめたいこと

merge をもって推奨どおりで確定とします。

- **Q1: Daily の本文の中の表も対象にするか** — 推奨は「ノートだけ」です。親が 1 種類なら、複合 FK の固定値（`parent_note_role = 'note'`）で親の存在を DB が守れます。Daily も対象にすると、親の role が 2 通りになり、生成列で固定できません。Daily の表は今までどおりタグなしで使えます。復活条件は、Daily の表にタグを付けたいと分かったときで、そのときは `parent_daily_id` の列を別に足します。
- **Q2: アイテムになるのはタグを初めて付けたときだけでよいか** — 推奨は「はい」です（§検討した代替案 の A と A'）。タグの無い表は Connect にも MCP にも出ません。

---

## Scope (Touchable Paths)

```
supabase/migrations/0039_note_table_items.sql        # Step 2
shared/src/types/table.ts                            # Step 3
shared/src/services/**                               # Step 3（mapper・DataService・書き出し）
shared/src/context/syncDomains.ts                    # Step 2
shared/src/context/SyncContext.tsx                   # Step 2（REALTIME_TABLES）
shared/src/components/items/itemRole.ts              # Step 5
shared/src/components/TagHub/**                      # Step 5
shared/src/i18n/locales/{ja,en}.json                 # Step 4, 5
web/src/notes/tableNodes.ts                          # Step 4
web/src/notes/TableControls.tsx                      # Step 4
web/src/notes/**（保存後の掃除の配線）               # Step 4
web/src/connect/ConnectScreen.tsx                    # Step 5
web/src/hooks/useShellNavigation.ts                  # Step 5
mcp-server/src/**                                    # Step 2（role の一覧）, Step 6
shared/src/generated/mcpToolCatalog.json             # Step 6（npm run catalog）
shared/tests/** / web/tests/** / mcp-server/tests/** # 各 Step
CLAUDE.md §4 / .claude/docs/vision/db-conventions.md / .claude/docs/requirements/tier-2-supporting.md  # Step 7
.claude/docs/vision/plans/2026-10-10-note-table-items.md
```

スコープの外の変更が要るときは **P-008** に従います。実装せずにキュー（`comm/decisions/chat-materials-refine.md`）へ積み、この計画を続けます。

---

## Steps

| #   | Step                                                                                                                                                                                         | Gate              | Acceptance                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | この計画書の merge                                                                                                                                                                           | 🛑 人手           | PR が merge される                                                                                                                                                 |
| 2   | migration（role・`tables_payload`・RLS・Realtime・`delete_my_account`）と、role の一覧（`mcp-server/src/utils/items.ts` の `ItemRole`・`syncDomains.ts`・`REALTIME_TABLES`）を同じ PR で更新 | 🤖 / 🛑 `db push` | `syncDomains.test.ts`・`syncRealtimeTables.test.ts` が緑。`life-editor-migration-validator` の監査が通る。push のあと `list_tables` に `tables_payload` が出る     |
| 3   | shared の型・mapper・DataService（表のアイテムを作る / 名前をそろえる / ソフトデリートと復元 / 親ノートごとの一覧 / タグ別の一覧）                                                           | 🤖                | mapper の 3 関数と DataService の各メソッドが vitest で緑。`life-editor-sync-auditor` の監査が通る                                                                 |
| 4   | エディタ（`tableId` 属性・貼り付けで外す・操作パネルのタグ・保存後の掃除と名前の同期）                                                                                                       | 🤖                | 属性の無い表と `generate_content` の表が開ける（vitest）。貼り付けた表に `tableId` が無い。本文から消した表のアイテムがソフトデリートされ、Undo で戻すと復元される |
| 5   | Connect（role の追加・表の読み込み・親ノートを開く）                                                                                                                                         | 🤖                | タグ別の一覧に表が出て、押すと親のノートが開く（vitest）。親が削除済みの表は出ない                                                                                 |
| 6   | MCP（`tag_entity` / `search_by_tag` の `table`・`npm run catalog`）                                                                                                                          | 🤖                | mcp-server の vitest と `toolCatalogFreshness.test.ts` が緑                                                                                                        |
| 7   | docs の追随（CLAUDE.md §4 の role の一覧・db-conventions・tier-2 §WikiTags）                                                                                                                 | 🤖                | `docs-lint` が緑                                                                                                                                                   |
| 8   | 実画面での確認（Desktop / Mobile、light / dark）                                                                                                                                             | 👀                | メインのチャットが実ブラウザで、表にタグを付ける → Connect に出る → 押すとノートが開く、を確かめる                                                                 |

Step 2 の merge は、こうだいさんの `db push` のあとにします。アプリの mapper と MCP は列を名前で select するので、push より先に merge すると読み込みが落ちるためです。Step 3〜6 は Step 2 の後に順に進めます。

### Gate 凡例

- **🤖 自律** — Claude が完結し、応答の前に型検査とテストを回します。
- **👀 目視** — 画面の見え方は Claude では確かめられないので、メインのチャットが実ブラウザで見ます。
- **🛑 人手** — こうだいさんの操作が要ります（`db push`・PR の merge）。

---

## Acceptance Criteria (機械検証可能)

- [ ] CI の `verify` ジョブの全ステップと `docs-lint` がローカルで緑（各 Step の PR）。
- [ ] `tableId` 属性の無い表を含むノートが、属性の追加の後も同じ文書として開ける（vitest）。
- [ ] 表にタグを付けると、`items_meta` に role `table` の行、`tables_payload` に親ノートの行、`wiki_tag_assignments` に行ができる（vitest、DataService のスタブで呼び先を確かめる）。
- [ ] `search_by_tag` が表を返し、行に親のノートの id が入る（mcp-server の vitest）。
- [ ] 親のノートが削除済みの表は、Connect にも `search_by_tag` にも出ない（vitest）。
- [ ] 各 PR の diff が目安の 500 行以内。超えるなら PR 本文に理由を書く。
- [ ] 完了時に、この計画書の Status と per-chat の memory を更新する。

AC を満たせない見込みになったら、自分で免除せず **P-008** に従いキューへ積みます。

---

## DB Migration Notes

- ファイルは `supabase/migrations/0039_note_table_items.sql` の 1 本です。role の CHECK の張り直し・`tables_payload`・RLS・Realtime・`delete_my_account` の `create or replace` を 1 本にまとめます。
- 番号は着手時に origin/main の `supabase/migrations/` と突き合わせて決めます。2026-10-10 時点の最新は `0035_dailies_morning_comment.sql` です。`2026-10-08-extension-app-records-and-apps-section.md` は「0035 = #2118、0036 = #2094」と予約していますが、0035 は #2107 が使いました。#2118 と 0036 を取り合うおそれがあります。2026-10-10 時点では、open の PR に migration を足すものはありません。Step 2 の PR を開く直前にもう一度確かめます（memory: migration-number-collision-across-lanes）。
- **2026-10-10 の着手時に 0039 に決めました**。origin/main には 0037（#2118）と 0038（#2147）が先に入っていました。0036 を使うと「番号は 0038 より前、実際に流れるのは後」という食い違いになります。素の CLI は止まり、`npm run db:push` は `--include-all` を付けるので順番を無視して流します（`supabase/scripts/db-push.sh`）。db-conventions §13 の「新しい DDL は常に末尾の次の番号を取る」に従いました。0036 は欠番のまま埋めません（§13 に追記済み）。
- 手順は「ローカルのファイルを先に作る → こうだいさんが `supabase db push` → Claude が `list_tables` で確かめる」です。
- 失敗したら、逆向きの migration を別のファイルで作ります。既存のファイルは直しません。逆向きでは `tables_payload` を落とし、role の CHECK から `'table'` を外します。`'table'` の行が残っていると CHECK を張り直せないので、先に表のアイテムを消します。

---

## Risks / Known Issues 参照

- **知らないノードと属性**: `enableContentCheck: true` のエディタは、スキーマに無いものが 1 つあると文書全体を弾き、空の本文で自動保存が上書きします（`web/src/notes/tableNodes.ts:23-29`）。`tableId` は既定値つきの属性として足し、属性の無い文書の読み込みを vitest で固定します。
- **2 つの書き込みの間の失敗**: アイテムの作成と本文の保存は同時に入りません。本文が保存されなかったアイテムは、どの本文からも指されないまま残ります。保存後の掃除が「親ノートを持つのに本文に無いアイテム」をソフトデリートするので、次の保存で片付きます。
- **同期の全件取り直し**: 知らない role が来ると全部のドメインを取り直します（`syncDomains.ts`）。role の追加と `ITEMS_META_ROLE_DOMAIN` の追加は同じ PR にします。
- **migration の番号の衝突**: §DB Migration Notes のとおりです。

---

## References

- 決定: `.claude/decisions/D-20260927-materials-1.md`
- 前例: `supabase/migrations/0034_goals.sql`（role の追加・複合 FK・RLS・Realtime・退会）と、その PR の分け方（#2111 → #2113 → #2116 → #2126 → #2129）
- 規約: `.claude/docs/vision/db-conventions.md` §10、CLAUDE.md §4
- 関連: #2011（表の名前）
- skills: `db-migration`, `add-feature`, `test-writing`

---

## Worklog

- 2026-10-10: Draft を書きました。下調べは `0034_goals.sql`・`tableNodes.ts`・`wikiTagAssignmentMapper.ts`・`ConnectScreen.tsx`・`mcp-server/src/tools/wikiTag.ts`・`tiptapJsonBuilder.ts` を読んで行いました。
- 2026-10-10: PR #2175 の merge で確定しました。Step 2 に着手しました。migration は 0039 にしました（§DB Migration Notes）。`delete_my_account()` を作り直すと `userDataExport.test.ts` が書き出しの表の一覧と突き合わせるため、Step 3 に置いていた `userDataExport.ts` への `tables_payload` の追加を Step 2 の PR に前倒ししました（0034 の PR と同じ形です）。
- 2026-10-10: 後の Step への申し送りです。`list_trash`（`mcp-server/src/handlers/trashHandlers.ts`）は role を指定しないと全部の role を返すので、Step 4 で表のアイテムをソフトデリートし始めると、ゴミ箱の一覧に表が単独で出ます。§データの流れ の「ゴミ箱に単独では出さない」を守るため、Step 4 か Step 6 で `list_trash` から `table` を外します。
- 2026-10-10: migration の監査（`life-editor-migration-validator`）は must-fix なしでした。指摘を受けて、名前のない表の `title` を `null` から `''` に直しました（`items_meta.title` は not null）。Step 3 への申し送りが 2 つあります。1 つ目は、表のアイテムが 1 つでもあるノートを物理削除すると複合 FK（NO ACTION）が 23503 で断るので、`permanentDeleteNoteUnified` とノートの子階層の削除で、表のアイテムを先に消す処理を入れることです。2 つ目は、書き込み用の型から生成列 `parent_note_role` を外すことです（db-conventions §10.3）。
