---
Status: Draft
Created: 2026-10-03
Branch: docs/briefing-goal-todo-plan-2035
Owner-chat: briefing-refine
Parent: .claude/docs/vision/plans/2026-07-15-briefing-loop.md
---

# Plan: Briefing の作り直し — 目標と Todo をつなぐ朝刊・夕刊

> #2035 のステップ 5 です。決定の正本は台帳の D-20260928-briefing-4（コンセプトと Q&A の全体）と、D-20260928-briefing-1 / -2 / -3、D-20261002-briefing-1〜3（このあと追加する回答）です。画面の正本は Claude Design のプロジェクト（§デザイン）で、依頼文は `.claude/docs/design/briefs/briefing.md` です。この計画書は、それを実装の順番と Issue の単位に落とします。

---

## Context

- **動機**: 朝刊の宣言と目標は書くだけで手応えが無く、夕刊には毎日書きたくなる引きがありません（D-20260928-briefing-1）。そこで、目標を Todo とつないで達成を自動で判定し、朝に立てたものが夜に進み、夜に書いたものが翌朝に返ってくる往復を作ります（D-20260928-briefing-4）。
- **制約**:
  - コストは $0 のままです。Claude API の直課金はしません。
  - Claude を繋いでいない人でも全部が埋まる画面にします。Claude の講評はおまけです（D-20260928-briefing-3）。
  - 順番は「データの仕組みが先、画面はデザインの案に合わせて後」です（D-20261002-briefing-3）。デザインの案は 2026-10-02 に届いています。
  - DDL の適用（`supabase db push`）はこうだいさんの作業です。
- **Non-goals**:
  - 朝刊と夕刊のタブは統合しません。今のタブのまま中身を作り直します。
  - 夕刊の「その日のデータから作る問いかけ」と「日中のメモを集める」は入れません（D-20260928-briefing-4 で不採用）。
  - Briefing の右パネル「今日の Todo」は、予定済みの部分も含めて今のまま残します（D-20261002-briefing-2）。
  - 過去の宣言のデータは消しません。画面から入力欄を外すだけです。

---

## デザイン

- **Claude Design のプロジェクト**: https://claude.ai/design/p/d6a4900c-9586-421c-84bc-8a63d7df1f94 （`Briefing Redesign.dc.html` が一覧、`BriefingScreen.dc.html` が各画面の本体）
- **画面の一覧**: 朝刊 M1〜M8、夕刊 E1〜E8、Connect の「目標と Todo」タブ C1〜C6、つなぐ画面 L1〜L4、期間末と見せ分け P1 / P2 / S1 / S2 です。Desktop と Mobile、light と dark が揃っています。
- **色**: 新しい色はありません。達成 = `chip-mint-bg` / `chip-mint-fg` / `accent-secondary`、未達 = `briefing-shu-subtle` / `briefing-shu`、前日までの進み = `text-tertiary` です。値はすべて `shared/src/styles/tokens.css` と一致しました（2026-10-03 確認）。

デザインと決めた仕様の食い違いは、次のように扱います。

| デザインの描き方                                     | 実装での扱い                                                                                                  | 理由                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 独立した「Todo を編集」の画面で目標を選ぶ（L3 / L4） | Schedule の Todo 詳細パネル（`TodoDetailPanel` の slot）と作成パネル（`ItemCreatePanel`）に目標を選ぶ欄を足す | アプリで Todo の詳細を開ける場所は Schedule の詳細パネルだけです（#1153）。2 つ目の編集画面を作らないためです |
| 期間末のふり返りの「あとで聞く」                     | 保存せず、次に Briefing を開いたときにまた聞く                                                                | 「後回しにした」状態を保存する場所を増やさないためです                                                        |
| 「達成が外れました」のチップ（S1 / S2）              | その操作をした画面の中だけで出す（保存しない）                                                                | 外れた理由は操作の直後にしか意味がないためです。前の状態を保存する列を作りません                              |
| 右パネル「今日の Todo」の「予定済み」を消す提案      | 消さない                                                                                                      | D-20261002-briefing-2 で残すと決めました                                                                      |

---

## 検討した代替案（必須）

| 案                                                                                 | 採否 | 却下理由                                                                                                                                                            | 復活条件                                                     |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 目標を新しい role `goal` のアイテムにし、Todo とのつながりは専用の表に持つ         | ✓    | —                                                                                                                                                                   | —                                                            |
| 目標は今の予約ノート `note-goals` の本文に置いたまま、Todo とのつながりだけを足す  | ✗    | 本文の中の 1 行には id が無く、Todo と多対多でつなげません。並び順・親の目標・期間末の判断も本文では持てません                                                      | 目標の機能をやめて、文章として書くだけに戻すとき             |
| 目標 ↔ Todo のつながりを、今のアイテム間リンクの表 `wiki_tag_connections` に入れる | ✗    | どんな種類のアイテムどうしでもつながる表なので、目標のつながりがノートのリンクと同じチップとして Connect やリンク一覧に混ざります。種類の取り違えも DB で防げません | つながりの種類を列で区別する仕組みが、その表に入ったとき     |
| 達成を DB の関数やトリガーで計算して列に保存する                                   | ✗    | Todo の完了・削除・つなぎ替えのたびに計算し直すトリガーが要り、同期の時刻（LWW の cursor）の扱いが複雑になります                                                    | 目標の数が増えて、画面での計算が遅くなったとき               |
| 出来事の「一言」を Daily 本文の見出しの節に書く                                    | ✗    | どの行への一言かを本文の中で表す決まりが要り、Daily を開くと内部の書式がそのまま見えてしまいます                                                                    | Daily の本文に、表示されない属性を持たせる仕組みができたとき |

**ask-user での回答（2026-10-02〜03）**: 一日の締めくくりは夕刊に残す（D-20261002-briefing-1）／ Briefing の右パネル「今日の Todo」は予定済みも含めて残す（D-20261002-briefing-2）／ データを先に作り、画面はデザインに合わせて後で作る（D-20261002-briefing-3）。

---

## 設計

### データ

- **目標のアイテム**: `items_meta.role` に `goal` を足します。今の role の CHECK は名前の無いインライン制約です（`0008_data_unification_schema.sql:80`）。なので、migration では `pg_constraint` から実際の制約名を引いて差し替えます。
- **`goals_payload`**（1 目標 = meta 1 行 + payload 1 行。2 行に分ける今の決まりに従います）
  - `period_kind`: `year` / `month` / `week`
  - `period_key`: `YYYY` / `YYYY-MM` / 週の初日の `YYYY-MM-DD`（週は日曜始まり = D-20260816-briefing-1）
  - `title` と `sort_order`
  - `parent_goal_id`: 上の階層の目標です。1 つの目標の親は 1 つだけで、年 → 月 → 週の順だけを許します。
  - `manual_achieved_at`: 手で達成にした時刻です。手で付けられるのは、未接続のときか、期間末のふり返りで「達成にする」を選んだときだけです。
  - `period_end_decision`: `carried` / `dropped` / `achieved`。`decided_at` も持ちます。
  - `carried_from_goal_id`: 持ち越した元の目標です。
  - `legacy_key`: 今の `note-goals` から移したときの節の鍵です。同じものを二重に移さないために使います。
- **`goal_todo_links`**: 目標と Todo の多対多です。`(goal_id, 'goal')` と `(todo_id, 'task')` を `items_meta(id, role)` への複合 FK にして、種類の取り違えを DB で防ぎます。ソフトデリートで、生きている行だけに部分 UNIQUE を張ります。
- **`dailies_payload` に 2 列**: `evening_published_at`（夕刊を発行した時刻）と `evening_notes`（出来事の行に足した一言。行の鍵 `todo:<id>` / `session:<id>` / `event:<id>` → 文）です。
- **号数と連続日数**: 夕刊の節に「気分: n/5」の行がある Daily を数えて出します。保存先は要りません。今までの日も数に入ります。
- **明日の自分へ**: 今の「明日のフォーカス」と同じ保存先（予約ノート `note-focus` の翌日の節）をそのまま使い、名前と置き場所だけを変えます。
- **RLS と Realtime**: 新しい表は全部 owner-only の RLS を付け、`supabase_realtime` に加えます。同期のドメインには `goals` を足します。

### 達成の判定（画面と MCP で同じ答えを返す）

- **週の目標**: つないだ Todo のうち削除されていないものが 1 件以上あり、全部が完了していると達成です。
- **月・年の目標**: 下の目標と直接つないだ Todo を合わせて 1 件以上あり、下の目標はすべて達成、Todo はすべて完了のとき達成です。
- **未接続**: 下の目標も、削除されていない Todo も 1 つも無い目標です。`manual_achieved_at` があれば達成です。
- **期間末の手での達成**: `period_end_decision = achieved` は、つながりの状態にかかわらず達成として扱います。
- **サブタスク**: 数えるのは直接つないだ Todo だけです。子の Todo は数えません。UI からは子の Todo を作れないためです（#418）。
- **置き場**: shared に純粋な関数として置きます。MCP サーバーは shared に依存していない（`mcp-server/package.json`）ので、MCP にも同じ関数を置きます。共通の見本データ（JSON）に対して両方の答えが一致するかを、両方のテストで確かめます。

### 今の目標の文章の移し替え

- 今の期間（今週・今月・今年）の `note-goals` の節にある行を、1 行 = 1 目標として移します。1 期間 3 つを超える分は移さず、Toast で知らせます。移した直後は Todo が無いので未接続になります。
- 過去の期間の節は、ノートのまま履歴として残します。ノートは消しません。
- 移すのはアプリの側で、Briefing を開いたときに 1 回だけです。`legacy_key` が既にあれば何もしません。

### MCP

- 増やす道具は 5 つです。`list_goals`（期間を指定でき、進み具合と達成の状態も返す）、`create_goal`、`update_goal`（題・親・並び・手での達成・期間末の判断）、`link_goal_todo`、`unlink_goal_todo` です。
- 既存の道具では、`get_today_context` と `get_week_context` が目標と進み具合を返すようにします。`delete_*` と `restore_item` / `list_trash` も、目標を扱えるようにします。
- 1 期間 3 つまでの上限は MCP の道具でも守ります。道具を足したら `cd mcp-server && npm run catalog` を回します。

---

## Scope (Touchable Paths)

```
supabase/migrations/0032_goals.sql
shared/src/types/goal.ts
shared/src/services/**            # Goals の DataService・mapper・ルーティング
shared/src/context/SyncContext.tsx
shared/src/context/syncDomains.ts
shared/src/components/briefing/**
shared/src/components/items/itemRole.ts
shared/src/components/schedule/ItemCreatePanel.tsx
shared/src/components/TodoDetailPanel.tsx
shared/src/services/userDataExport.ts
shared/src/i18n/locales/{ja,en}.json
shared/src/generated/mcpToolCatalog.json
shared/tests/**
web/src/briefing/**
web/src/connect/**
web/src/schedule/ScheduleTodoDetail.tsx
web/src/schedule/useCreatePanelNotes.ts
web/src/hooks/useShellNavigation.ts
web/src/hooks/useShellChrome.tsx
web/src/MainScreen.tsx
web/src/sectionDescriptors.tsx
web/tests/**
mcp-server/src/**
mcp-server/tests/**
.claude/CLAUDE.md                                   # §4 の role 一覧と §8 の追随だけ
.claude/docs/requirements/tier-1-core.md            # §Briefing の追随だけ
.claude/docs/requirements/mobile-scope.md           # #3 / #18 / #20 と新しい行
.claude/docs/vision/db-conventions.md               # 新しい表の追記だけ
.claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md
.claude/decisions/**                                # supersede の双方向リンクの追記だけ
```

Issue ごとの触ってよい範囲は、この中から各 Issue の本文で絞ります。

---

## Steps

Issue の起票はメインのチャットの作業です（CLAUDE.md §9）。下の「Issue 案」は起票の依頼に使う単位で、番号は起票後に Worklog へ書きます。

| #   | Step                                                                                                                    | Gate                 | Acceptance                                                                                                                     | Issue 案   | 依存    |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- |
| 1   | migration `0032_goals.sql`（role `goal`・`goals_payload`・`goal_todo_links`・`dailies_payload` の 2 列・RLS・Realtime） | 🤖 作成 / 🛑 db push | `life-editor-migration-validator` が Blocker 0。こうだいさんの `supabase db push` が通り、`list_tables` で 2 表と 2 列が見える | A          | —       |
| 2   | role の一覧の追随（`itemRole.ts`・`syncDomains.ts`・`userDataExport.ts`・MCP の `ItemRole` / trash / item link）        | 🤖                   | 全ゲート緑。`syncDomains.test.ts` と `syncRealtimeTables.test.ts` が緑                                                         | A に含める | 1       |
| 3   | Goals の DataService（CRUD・つなぐ / 外す・期間で引く）と mapper・Realtime ドメイン                                     | 🤖                   | `updated_at` の bump を `life-editor-sync-auditor` が確認。vitest 緑                                                           | B          | 1       |
| 4   | 達成の判定と期間の鍵の純粋関数（shared）と、共通の見本データ                                                            | 🤖                   | 達成・未達・未接続・期間末の判断・削除済み Todo・子 Todo の各場合が vitest で緑                                                | C          | —       |
| 5   | MCP の道具 5 つと、`get_today_context` / `get_week_context` の追随・catalog の再生成                                    | 🤖                   | `toolCatalogFreshness.test.ts` が緑。共通の見本データで shared と同じ答え                                                      | D          | 3, 4    |
| 6   | `note-goals` の今の期間を目標に移す（1 回だけ・二重に移さない）                                                         | 🤖                   | 2 回開いても目標が増えないことを vitest で確認                                                                                 | E          | 3       |
| 7   | 朝刊の作り直し（ゆうべの自分から・目標・目標の印・期間末のふり返り・宣言を外す）                                        | 🤖 / 👀              | デザイン M1〜M8 と P1 / P2 の要素が揃う。空の状態で講評が出ない                                                                | F          | 3, 4, 6 |
| 8   | 夕刊の作り直し（号数と連続・発行・今日進んだ目標・今日の出来事と一言・明日の予定に置く・明日の自分へ・Daily に移動）    | 🤖 / 👀              | デザイン E1〜E8 の要素が揃う。★で発行時刻が保存される                                                                          | G          | 3, 4    |
| 9   | Connect に「タグ / 目標と Todo」のタブを足し、目標の木と右パネルを作る                                                  | 🤖 / 👀              | デザイン C1〜C6 の要素が揃う。今の Connect の件数表示がタブ化で消えない                                                        | H          | 3, 4    |
| 10  | つなぐ画面（目標の側から）と、Todo の詳細パネル・作成パネルの目標の欄                                                   | 🤖 / 👀              | デザイン L1〜L4 の要素が揃う。保存前に変わる数字を出す                                                                         | I          | 3, 4    |
| 11  | docs の追随（CLAUDE.md §4 の role 一覧・tier-1 §Briefing・mobile-scope・db-conventions）と、古い決定の supersede        | 🤖                   | `docs-lint` 緑。D-20260815-briefing-1〜4・D-20260818-briefing-1 に `superseded-by` が付く                                      | J          | 7, 8    |
| 12  | 実画面での確認（Desktop / Mobile、light / dark）                                                                        | 👀                   | メインのチャットが実ブラウザで撮影し、デザインと見比べる                                                                       | J に含める | 7〜10   |

画面の Step（7〜10）は互いに独立しているので、データの Step（1〜6）が済めば並行して進められます。

---

## Acceptance Criteria (機械検証可能)

- [ ] `.github/workflows/ci.yml` の `verify` ジョブの全ステップ（shared → web → desktop → mcp-server）と `docs-lint` が、各 PR で exit 0
- [ ] Supabase に `goals_payload` と `goal_todo_links` があり、`items_meta` の role の CHECK が `goal` を含む（`list_tables` と `pg_constraint` で確認）
- [ ] `supabase db diff` で local と remote の差分が 0
- [ ] 達成の判定の vitest が shared と mcp-server の両方で、同じ見本データに対して緑
- [ ] `note-goals` の移し替えを 2 回走らせても、目標の件数が増えない（vitest）
- [ ] 朝刊・夕刊・Connect の新しいブロックが、Claude の講評が無い状態でも空欄の枠を出さない（vitest で講評なしの描画を確認）
- [ ] 各 PR の diff が目安の範囲内（機能追加 500 行・修正 200 行）。超える場合は PR 本文に理由を書く
- [ ] 完了時: この計画書の Status と per-chat memory を更新し、`archive/` へ移す

AC を満たせない見込みになったら、自分で免除せず P-008 に従ってキューへ積みます。

---

## DB Migration Notes

- ファイルは `supabase/migrations/0032_goals.sql` です（今の最新は 0031。0013 は欠番のまま埋めません）。
- 並行するレーンが同じ番号を使っていないかを、PR を出す前に origin/main と突き合わせます。
- 手順は「ローカルのファイルを先に作る → こうだいさんが `supabase db push`」です。`apply_migration` の MCP は単独では使いません。
- 失敗したら、逆向きの migration を別のファイルで作ります。既存のファイルは直しません。

---

## Risks / Known Issues 参照

- **role の制約名**: 今の CHECK は名前の無いインライン制約で、名前は推測です。migration の中で `pg_constraint` から引きます。
- **同期の全件取り直し**: 知らない role が来ると、全部のアイテムのドメインを取り直す作りです（`syncDomains.ts:134`）。role を足す PR と、`ITEMS_META_ROLE_DOMAIN` を足す PR は同じにします。
- **緑の PR 2 本が組み合わさって main を壊す**: 新しい型を足す PR と、その型を使うテストの PR が別々に merge されると壊れることがあります（memory: green-prs-break-main-when-paired）。Step 2〜3 は依存の順に出します。
- **Connect のタブ化**: タブ帯が出ると見出しが件数の代わりにタブになり、今の件数表示が消えます（`MainScreen.tsx:246`）。Step 9 で件数の置き場を決めます。

---

## References

- 決定: D-20260928-briefing-1〜4、D-20261002-briefing-1〜3、D-20260816-briefing-1（週は日曜始まり）
- 親計画書: `.claude/docs/vision/plans/2026-07-15-briefing-loop.md`
- 棚卸しと比較: `.claude/docs/reports/2026-09-28-briefing-concept.html`
- デザインの依頼文: `.claude/docs/design/briefs/briefing.md`
- skills: `db-migration` / `add-feature` / `add-component` / `test-writing` / `frontend-react-designer`

---

## Worklog

- 2026-10-03: 初版。D-20260928-briefing-1〜4 と 2026-10-02〜03 の回答、Claude Design の案（2026-10-02）をもとに書きました。Issue の起票はメインのチャットへ依頼します。
