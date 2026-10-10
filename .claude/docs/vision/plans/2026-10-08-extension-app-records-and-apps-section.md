---
Status: IN PROGRESS
Created: 2026-10-08
Updated: 2026-10-08
Branch: docs/extension-records-apps-plan
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-10-07-extension-app-gateway.md
---

# Plan: 拡張アプリの記録と一覧 — 数値の記録テーブル・Analytics の「記録」タブ・Apps セクション

> こうだいさんの 2026-10-08 の方針（D-20261008-main-1 / D-20261008-main-2）を、実装の順番と Issue の単位に落とします。窓口（鍵・CORS・仕様ファイル・偽物）は親計画書 [`2026-10-07-extension-app-gateway.md`](./2026-10-07-extension-app-gateway.md) と #2144〜#2151 が持ちます。この計画書は「窓口を通って届いた数値をどこに貯め、どこで読むか」と「拡張アプリをどこに登録し、どう一覧するか」だけを持ちます。
> Step 1 は 2026-10-08 に完了しました（PR #2158 merge）。実装の Issue は #2161〜#2168 として同日に起票済みです（§Issue）。

---

## Context

- **動機**: life-editor は「出来事を貯め、読み、次の Todo に変える」ループ（[`2026-07-15-briefing-loop.md`](./2026-07-15-briefing-loop.md)）を軸にしています。いま Claude が `get_today_context` で読める材料は、Daily の文章・Todo・予定・作業時間だけです。文章は日によってばらつくので、傾向を見つけるには数値のほうが向いています。家計簿や体重のような数値を拡張アプリで集め、life-editor に貯めて、分析の材料にします（D-20261008-main-1 Q1）。
- **役割分担**: life-editor は、帳簿を読んで明日の方針を決める本社です。拡張アプリは、現場で記録を上げるだけの支店です。支店は判断を持ちません。支店ごとに報告書の書式が違うと本社は読めないので、書式に当たる「共通の記録テーブル」を life-editor 側に 1 つ決めます（D-20261008-main-1 Q2）。
- **Briefing ループとの関係**: 同書 §2 の判定基準は「機能を足すときは 5 つの動詞のどれかに仕えるか」です。記録は「分析」（Claude が `get_week_context` で読む）に仕えます。Goals（role `goal`・#2101〜#2110）が「分析の結果を次の Todo につなぐ」配線で、この計画書は「分析の材料を太くする」配線です。
- **制約**:
  - 費用は $0 のままです。Claude API の直課金はしません。
  - 拡張アプリからの書き込みは窓口を通します（D-20261007-main-3 = A の専用 Worker、D-20261007-main-4 = B の範囲）。拡張アプリが Supabase へ直接書く形は採りません（親計画書の案 C と R9）。
  - DDL はローカルファイル先行で、`supabase db push` はこうだいさんの作業です。
  - 汎用 Database は凍結のままです（D-20260704-main-1 / D-20261007-main-1）。
  - Analytics の既存 4 タブは凍結のままです（`archive/2026-07-16-loop-friction-fixes.md` 決定 6）。この計画書が解くのは「記録」タブの分だけです（D-20261008-main-1 Q4）。
  - 拡張アプリは別リポジトリに作ります（2026-10-06 の決定・D-20261008-main-2 で切替条件つきで維持）。
- **順番**: データの仕組み（テーブル + MCP の道具）を先に作り、スマホの Claude アプリから記録を入れて使い始めます。入力専用の拡張アプリ（最初は家計簿）は、2〜3 週間使って分析が役に立つと分かってから、別リポジトリの別計画で作ります（D-20261008-main-1 Q3。Goals で決めた「データが先、画面は後」= D-20261002-briefing-3 と同じ順番）。Analytics の記録タブと Apps セクションは、こうだいさんの指定なので、この試用を待たずに作ります。
- **Non-goals**:
  - 家計簿アプリ本体は作りません（別リポジトリ・別計画）。
  - Analytics の既存タブ（概要 / Todo / 作業 / 予定）は触りません。
  - 鍵の発行と取り消しの画面は作りません（#2146 が「別 Issue」としているもの。§後続 に置きます）。
  - 記録の編集画面は作りません。記録を直すのは、それを作った拡張アプリか Claude の仕事です。life-editor の画面は読むだけです。
  - 記録にタグ・リンク・ゴミ箱は付けません。`items_meta` の外に置くためです。
  - 記録のソフトデリートはしません。消すのは自分のアプリの行だけで、消したら戻しません。
  - グラフの作り込みはしません。期間別の棒 1 枚と一覧で足ります。見栄えの良いグラフは拡張アプリ側が自分の数値で描きます。
  - 配布先のユーザーへの拡張アプリ開放は扱いません（親計画書と同じ）。

---

## 検討した代替案（必須）

| 案                                                                      | 採否 | 却下理由                                                                                                                                                                 | 復活条件                                                             |
| ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 記録を `items_meta` の外の独立テーブル 1 つ（`app_records`）に置く      | ✓    | —                                                                                                                                                                        | —                                                                    |
| `items_meta` + `records_payload` の 2 行分割にする                      | ✗    | 記録はタグ・リンク・ゴミ箱の対象にならない追記専用の行で、複合 FK の仕組みが何も買いません。0018 の timer 系と同じ判断です（`0018_timer_audio_tables.sql:10-16`）        | 記録にタグやリンクを付けたくなったとき                               |
| 凍結中の汎用 Database を解凍して家計簿を載せる                          | ✗    | D-20260704-main-1 と D-20261007-main-1 で凍結のままと決めています。利用者が列の型を定義する作りで、分析の材料にするには重すぎます                                        | 移行の完了後に、こうだいさんが改めて望んだとき                       |
| 種類ごとにテーブルを分ける（`expenses` / `weights` …）                  | ✗    | 種類が増えるたびに DDL と `db push` が要ります。種類は値（`kind`）で持てば DDL は増えません                                                                              | 1 つの種類に専用の列や集計が必要になったとき                         |
| 記録を Daily の本文に書く（夕刊の「気分: n/5」の方式）                  | ✗    | 集計と絞り込みに向きません。文章の中に数値が埋まります                                                                                                                   | なし                                                                 |
| 拡張アプリが同じ Supabase プロジェクトに、こうだいさんの JWT で直接書く | ✗    | 窓口の鍵の絞り込みが迂回されます（親計画書の案 C の却下理由・R9）。2026-10-08 のチャットで Claude が先に出した案ですが、D-20261007-main-3 の決定に合わせて取り下げました | ハンドラ共有より RLS 直結を優先すると決めたとき                      |
| 記録の表示を Analytics の「記録」タブに置く                             | ✓    | —（こうだいさん指定 = D-20261008-main-1 Q4）                                                                                                                             | —                                                                    |
| 記録の表示に専用のセクションを新設する                                  | ✗    | Analytics が凍結を一部解いて受ける、とこうだいさんが指定しました。セクションを 2 つ足すとサイドバーが太ります                                                            | Analytics の既存タブも作り直すことになり、記録と同居できないとき     |
| 拡張アプリの登録と一覧を、サイドバーの Apps セクションに置く            | ✓    | —（こうだいさん指定 = D-20261008-main-1 Q4）                                                                                                                             | —                                                                    |
| 拡張アプリの一覧を Settings の AI 連携カードに置く                      | ✗    | こうだいさんが「サイドバーに新しいタブ」と指定しました。鍵の一覧（#2146 の後続）は AI 連携カードと Apps のどちらにも置けるので、§後続 で決めます                         | Apps の行が 1〜2 件のまま増えず、セクション 1 枠が重いと分かったとき |
| 拡張アプリは別リポジトリ                                                | ✓    | —（D-20261008-main-2。2026-10-06 の決定を維持。見積もりは §リポジトリの分け方）                                                                                          | —                                                                    |
| 拡張アプリを同じリポジトリの新しいパッケージにする                      | ✗    | こうだいさんは管理を分けたい意向です。手順の差は 1 つ（窓口の仕様ファイルと偽物の取り込み）で、これは pdca-harness がどのみち要るものです                                | §リポジトリの分け方 の切替条件 (a) か (b) に当たったとき             |
| 記録の作成を life-editor の画面からもできるようにする                   | ✗    | 作成の入口が 3 つ（画面 / Claude / 拡張アプリ）になり、「支店が記録を上げる」役割分担が崩れます。スマホの Claude で足ります                                              | 2〜3 週間の試用で、Claude 経由の入力が面倒だと分かったとき           |

**チャットでの回答（2026-10-08）**: 役割分担・共通テーブル・データ先行の方向性は「その方向性で OK」。Analytics に拡張アプリからのデータの収集と一覧化を実装する。leftSidebar に拡張アプリを登録・一覧するタブを新設する。リポジトリは別々にし、手順がかなり増えるなら統合に切り替える。

---

## リポジトリの分け方（D-20261008-main-2 の判定材料）

拡張アプリ 1 本を建てるのに要る手順を数えました。

| 手順                                         | 別リポジトリ                | 同じリポジトリの新パッケージ                            |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| アプリの雛形（UI の土台・ビルド・CI）        | 要る（pdca-harness が作る） | 要る（`shared/` のトークンと認証を使い回せる）          |
| 窓口の仕様ファイルと偽物を取り込む（#2150）  | 要る                        | 要らない（同じ repo の `mcp-server/` を直接参照できる） |
| アプリごとの鍵の発行（#2146）                | 要る（🛑 こうだいさん）     | 要る（🛑 同じ）                                         |
| デプロイ（Cloudflare Workers の静的配信）    | 要る（🛑）                  | 要る（🛑）                                              |
| Apps セクションに登録（この計画書の Step 7） | 要る（画面で 1 分）         | 要る（同じ）                                            |
| life-editor 側の恒久コスト                   | なし                        | CI の `verify` ジョブにパッケージが 1 つ増える          |

差は「窓口の仕様ファイルと偽物を取り込む」1 手順だけです。しかもこの手順は、pdca-harness が無人で合否を判定するために別リポジトリでもどのみち要るものです（親計画書 §Context）。別リポジトリで手順は「かなり増え」ません。そのため、こうだいさんの意向どおり別リポジトリを維持します。

**同じリポジトリへ切り替える条件**（どちらかに当たったら判断キューへ積みます）:

- (a) 拡張アプリが life-editor の `shared/`（`lumen-*` トークン・DataService・i18n）を import したくなったとき。別リポジトリでは npm に公開しないと参照できず、公開は $0 と相性が悪いためです。
- (b) 窓口の版上げ（#2144 の semver）が月に 1 回を超え、両リポジトリを同時に変える作業が常態化したとき。

---

## 設計

### データ

2 つとも `items_meta` の外の独立テーブルです（0018 の timer 系と同じ扱い。自分の `updated_at` を持ちます）。

- **`app_records`**（数値の記録。追記専用）
  - `id`: text。`generateId("record")` の形（`record-<timestamp+counter>`。CLAUDE.md §4 の「他 `generateId(prefix)`」に従います）
  - `user_id`: uuid、`default auth.uid()`
  - `source_app`: text、not null。作成元です。値は `extension_apps.slug` か、予約語 `claude`（こうだいさんの MCP からの記録）です。窓口経由のときは、鍵のアプリの slug を Worker が強制します（#2146 / #2148 と語彙を合わせます = Step 8）
  - `external_id`: text、null 可。拡張アプリ側の参照 id で、重複防止のキーを兼ねます。`(user_id, source_app, external_id)` に、`external_id is not null` の部分 UNIQUE を張ります（D-20261007-main-6 と同じ決まり: 同じキーで中身が違えば専用の code で断ります）
  - `kind`: text、not null。記録の種類（`expense` / `weight` / `sleep` …）。語彙はアプリが決め、life-editor は検証しません。CHECK は `^[a-z][a-z0-9_]{0,31}$` だけです
  - `occurred_at`: timestamptz、not null。記録が起きた時刻です
  - `value`: numeric、not null
  - `unit`: text、null 可（`JPY` / `kg` / `min`）
  - `dims`: jsonb、not null、default `'{}'`。付随する属性（カテゴリ・店名・メモの種類）です。値は文字列・数値・真偽だけ、キーは 20 個までにし、検査は MCP のハンドラで行います（DB では jsonb object であることだけを CHECK）
  - `note`: text、null 可
  - `created_at` / `updated_at`
  - index: `(user_id, occurred_at desc)`、`(user_id, source_app)`、`(user_id, kind)`
- **`extension_apps`**（拡張アプリの台帳）
  - `slug`: text。`^[a-z][a-z0-9-]{1,31}$`。`(user_id, slug)` が主キーです。`app_records.source_app` と、窓口の鍵が指すアプリの id（#2146）は、この slug です
  - `user_id`: uuid、`default auth.uid()`
  - `name`: text、not null
  - `url`: text、null 可（公開 URL。Apps の一覧から開きます）
  - `icon`: text、null 可（アイコン名。画面側は `tagIcon.ts` の curated な集合から引き、無ければ既定のアイコンにします）
  - `description`: text、null 可
  - `sort_order`: integer、not null、default 0
  - `created_at` / `updated_at`
  - 「最後の記録」と「30 日の件数」は保存せず、`app_records` から数えます
- **RLS**: どちらも owner-only の 4 ポリシーを `(select auth.uid())` の INITPLAN 形で付けます（0018 と同じ）。
- **Realtime**: どちらも `supabase_realtime` に加えます。同期ドメインは `appRecords` と `extensionApps` の 2 つを足します（`rules/frontend.md` §Sync の「1 テーブル = 1 ドメイン」）。
- **退会とエクスポート**: `delete_my_account`（0025）の関数に 2 表の delete を足します（同じ migration で `create or replace`）。`shared/src/services/userDataExport.ts` の表の一覧に 2 表を足します。

### 書き込みと読み取りの経路

- **拡張アプリ**（支店）: 窓口（専用 Worker・アプリごとの鍵）の `create_record` / `list_records` / `delete_record` を呼びます。`source_app` は鍵のアプリの slug が強制されます。削除は自分の `source_app` の行だけです（D-20261007-main-4 = B の「自分が作った項目」に当たります）。
- **こうだいさんの Claude**（stdio と Remote MCP）: 同じ道具です。`source_app` は省略すると `claude` です。削除は全部できます（オーナーの入口のため）。
- **life-editor の画面**: DataService 経由で、記録は読むだけ、台帳（`extension_apps`）は作成・更新・削除ができます。記録の作成は画面からしません（§検討した代替案）。
- **日付の境目**: Analytics の既存の集計と同じく、`formatDateKey` / `todayCalendarKey`（「日付が変わる時刻」#373 を踏まえた関数）を使います。週の鍵は Goals の純粋関数（#2102・日曜始まり = D-20260816-briefing-1）を使い回します。MCP サーバーは shared に依存していないので、Goals と同じく同じ関数を MCP にも置き、共通の見本データで両方の答えが一致することをテストします。

### MCP の道具（`mcp-server/src/tools/record.ts` + `handlers/recordHandlers.ts`）

- `create_record({ kind, value, occurred_at?, unit?, dims?, note?, external_id?, source_app? })` → `{ id, created }`。`external_id` が同じなら同じ `id` を返し、行は増えません。中身が違えば専用の code で断ります（D-20261007-main-6 の決まりを記録にも当てます）
- `list_records({ kind?, source_app?, from?, to?, group_by?, limit? })`。`group_by` は `none` / `day` / `week` / `month` で、`none` 以外は `{ period, count, sum, avg, min, max }` の列を返します
- `delete_record({ id })`
- `list_extension_apps()` → 台帳の行に `last_record_at` と `records_30d` を添えて返します
- `get_today_context` と `get_week_context` に `records` の要約（種類ごとの `count` と `sum`）を足します。朝刊と夕刊を書く Claude が、文章と数値を同時に読めるようにするためです
- 道具は `REMOTE_TOOL_DEFINITIONS`（`mcp-server/src/remoteTools.ts`）に足します。stdio とスマホの Remote MCP の両方に届き、拡張アプリ用の道具集合（#2144 の仕様ファイル）にも含めます。足したら `cd mcp-server && npm run catalog` を回します（#1210）
- 窓口の鍵で呼ばれたときに `source_app` を強制する仕組みは、#2146 が作る「呼び出し元の識別」に乗ります。この計画書は、ハンドラが「呼び出し元のアプリ slug」を受け取れる口を用意するところまでを持ちます（Step 8）

### Analytics の「記録」タブ

- `shared/src/components/Analytics/tabs.ts` の `AnalyticsTab` に `records` を足し、`ANALYTICS_TAB_ORDER` の末尾に置きます。シェルのタブ帯（`web/src/hooks/useShellChrome.tsx`）と i18n（`analytics.tabs.records` 相当。実際のキー名は既存の catalog に合わせます）が追随します
- 本体 `RecordsTab.tsx`（shared・純粋部品）: 絞り込み行（アプリ / 種類 / 期間 = 既存の `DatePreset` を使い回す）、数字 3 つ（件数 / 合計 / 平均）、期間別の棒 1 枚（既存の `ChartCard` + `WorkTimeChart` と同じ描き方）、一覧（日時 / 種類 / 値と単位 / 属性のチップ / アプリ）。記録 0 件は既存の `AnalyticsEmptyState` の形で「スマホの Claude に『コーヒー 450 円』と言うと最初の記録が入ります」と出します
- ホスト `web/src/analytics/AnalyticsScreen.tsx`: 選択中の期間で `listAppRecords` を取り直します（Schedule タブの `scheduleRange` と同じ `useDomainLoad` の形）。`useSyncDomains` に `appRecords` と `extensionApps` を足します
- narrow: `MobileAnalyticsView` に「記録」のブロック（直近 7 日の種類ごとの合計）を足します。Consumption です。タブ帯は narrow に出ないので、記録タブそのものは wide 専用です（mobile-scope.md 行 12 と同じ扱い）
- Apps からの導線: `useShellNavigation` に `pendingRecordsSource`（絞り込みたいアプリの slug）を足し、Apps の「記録を見る」が `navigateTo("analytics")` + `setAnalyticsTab("records")` + stash で着地します（`pendingTodoSelect` と同じ形）

### Apps セクション

- `shared/src/sections.ts` に `{ id: "apps", group: "main", icon: Blocks, labelKey: "section.apps", mobileOrder: 6 }` を Analytics の後ろに足します。Settings の `mobileOrder` は 7 にします（narrow は More シート送り。固定 4 つは動かしません）
- `web/src/sectionDescriptors.tsx` に行を足します。`width: "wide"`、`narrowHeader: "none"`、body は `<AppsScreen dataService={ds} onShowRecords={…} />`。重いベンダースタックを持たないので `lazy()` にはしません（Connect と同じ判断・`lazySections.ts` は触りません）
- `web/src/apps/AppsScreen.tsx`（ホスト: 取得と `t` の解決）+ `shared/src/components/Apps/`（純粋部品）
  - 一覧のカード: アイコン / 名前 / 説明 / URL（`<a target="_blank" rel="noopener">`。Desktop は `desktop/src/main/index.ts:299,314` が `shell.openExternal` に流します）/「最後の記録: n 日前・30 日で m 件」/ ボタン「記録を見る」「編集」「削除」
  - 「+ アプリを登録」: `Modal` で slug / 名前 / URL / アイコン / 説明。slug は登録後に変えられません（`source_app` が指すため）
  - 「記録だけ届いているアプリ」: `app_records.source_app` にあって台帳に無い値（`claude` を除く）を並べ、「登録」ボタンで slug を埋めた登録 Modal を開きます。窓口の鍵で先に記録が届いた場合の拾い上げです
  - 空の状態: 役割の説明 1 段落と「+ アプリを登録」、鍵の発行手順への案内（#2146 の PR 本文が手順の正本）
  - 削除は台帳の行だけを消します。記録は残り、「記録だけ届いているアプリ」に戻ります。確認ダイアログを挟みます（#1345 と同じ側）
- narrow: 一覧と URL を開く・記録を見る、までです。登録 / 編集 / 削除は wide 専用です（Phase 1。mobile-scope.md に行 21 として足します）
- ツアー: `TOUR_SECTION_IDS` は registry から派生するので、ステップを持たないセクションは Settings のツアー一覧で `hasSteps: false` として出ます。追加の配線は要りません（Step 7 で実測します）
- ショートカット: ⌘ + 数字がセクション順に割り当てられているかを Step 7 で確かめ、既存の番号がずれるなら Apps を末尾にします

### 朝刊・夕刊への反映

画面は変えません。朝刊を書く側のプロンプト（`.claude/automation/` の定時実行の指示文。正確なファイルは着手時に確認します）に「`get_week_context` の `records` を読み、記録がある週は 1 段落で触れる」を足します。D-20260928-briefing-3 のとおり、Claude の講評はおまけなので、記録が無い週は何も出ません。

---

## Scope (Touchable Paths)

```
supabase/migrations/00NN_app_records.sql            # 番号は着手時に origin と突き合わせる（§DB Migration Notes）
shared/src/types/appRecord.ts
shared/src/types/extensionApp.ts
shared/src/services/SupabaseAppRecordsService.ts     # 記録と台帳（1 サービスにまとめてよい）
shared/src/services/appRecordMapper.ts
shared/src/services/DataService.ts
shared/src/services/dataServiceRouting.ts
shared/src/services/userDataExport.ts
shared/src/context/syncDomains.ts
shared/src/context/SyncContext.tsx                   # REALTIME_TABLES
shared/src/utils/generateId.ts                       # prefix を足す場合のみ
shared/src/sections.ts
shared/src/components/Analytics/{tabs.ts,AnalyticsView.tsx,MobileAnalyticsView.tsx,RecordsTab.tsx,index.ts}
shared/src/components/Apps/**
shared/src/i18n/locales/{ja,en}.json
shared/src/generated/mcpToolCatalog.json
shared/src/index.ts
shared/tests/**
web/src/sectionDescriptors.tsx
web/src/hooks/useShellNavigation.ts
web/src/hooks/useShellChrome.tsx
web/src/analytics/AnalyticsScreen.tsx
web/src/apps/**
web/tests/**
mcp-server/src/tools/record.ts
mcp-server/src/handlers/recordHandlers.ts
mcp-server/src/handlers/briefingHandlers.ts          # today / week context の records 要約だけ
mcp-server/src/remoteTools.ts
mcp-server/src/utils/**                              # 週の鍵の純粋関数を置く場合
mcp-server/tests/**
.claude/automation/**                                # 朝刊のプロンプトに records の 1 行を足すだけ
.claude/CLAUDE.md                                    # §4（独立テーブル 2 つ）/ §8（Analytics の記録タブ・Apps セクション）の追随だけ
.claude/docs/requirements/tier-2-supporting.md       # Apps の節を足す
.claude/docs/requirements/tier-3-experimental.md     # Analytics の Status（記録タブの分だけ解凍）
.claude/docs/requirements/mobile-scope.md            # 行 12 の更新と行 21 の追加
.claude/docs/vision/db-conventions.md                # §15 独立テーブルの規約（app_records / extension_apps）
.claude/docs/vision/plans/2026-10-08-extension-app-records-and-apps-section.md
.claude/decisions/D-20261008-main-{1,2}.md
.claude/comm/decisions/ANSWERS.md
```

触らないもの: Analytics の既存 4 タブの部品、`web/src/lazySections.ts`、`core.md`（親計画書が V3 / NG-3 を書き換えます）、`mcp-server/src/worker.ts`（鍵と CORS は #2146）、`supabase/functions/**`。

スコープ外の変更が必要になった場合は **P-008** に従い、実装せずキューか Issue 起票依頼へ積みます。

---

## Steps

Issue の起票はメインのチャットの作業です（CLAUDE.md §9）。「Issue」の列は 2026-10-08 に起票した番号です（§Issue）。

| #   | Step                                                                                                                                                  | Gate                 | Acceptance                                                                                                                                         | Issue | 依存               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------ |
| 1   | 決定の記録（D-20261008-main-1 / -2）と、この計画書の Draft                                                                                            | 🛑 PR merge          | 完了（2026-10-08・PR #2158 merge。`records.mjs check` / `docs-lint` とも緑）                                                                       | —     | —                  |
| 2   | migration `00NN_app_records.sql`（`app_records` / `extension_apps` / RLS / Realtime / `delete_my_account` の更新）                                    | 🤖 作成 / 🛑 db push | `life-editor-migration-validator` が Blocker 0。こうだいさんの `supabase db push` が通り、`list_tables` で 2 表が見える                            | #2161 | —                  |
| 3   | shared のデータ層（型・Service・mapper・routing・DataService・同期ドメイン 2 つ・`REALTIME_TABLES`・エクスポート）                                    | 🤖                   | vitest 緑。`syncDomains.test.ts` と `syncRealtimeTables.test.ts` の lockstep が緑。`life-editor-sync-auditor` が `updated_at` の扱いを確認         | #2162 | 2                  |
| 4   | MCP の道具 4 つ + `get_today_context` / `get_week_context` の `records` 要約 + catalog の再生成                                                       | 🤖                   | `toolCatalogFreshness.test.ts` 緑。`supabaseStub` で create → list → delete が緑。同じ `external_id` で 2 回呼んで行が 1 件                        | #2163 | 3（stub は並行可） |
| 5   | Remote MCP を配り直し、スマホの Claude から記録を 1 件入れる                                                                                          | 🛑 deploy / 👀       | 「コーヒー 450 円」で `app_records` に `source_app = claude` の行が 1 件入る                                                                       | #2163 | 4                  |
| 6   | Analytics の「記録」タブ（wide）と、narrow の「記録」ブロック                                                                                         | 🤖 / 👀              | 0 件で空の状態が出る。絞り込み 3 種・数字 3 つ・期間別の棒・一覧が揃う。vitest で 0 件 / 1 件 / 複数アプリの描画                                   | #2164 | 3                  |
| 7   | Apps セクション（registry + descriptor + 画面 + 登録 / 編集 / 削除 + 「記録だけ届いているアプリ」+ Analytics への導線）                               | 🤖 / 👀              | 登録 → 一覧 → 「記録を見る」で Analytics の記録タブにアプリの絞り込みつきで着地する。vitest で描画とハンドラ。ツアー一覧とショートカットが壊れない | #2165 | 3、6（導線のみ）   |
| 8   | 窓口との突き合わせ（拡張アプリ用の道具集合に record 系 4 つを含める・作成元の語彙 = `extension_apps.slug`・ハンドラが呼び出し元の slug を受け取る口） | 🤖                   | #2144 の仕様ファイルに 4 道具がある。#2146 / #2147 / #2148 に語彙の突き合わせをコメント済み                                                        | #2166 | 4、#2144           |
| 9   | 朝刊を書くプロンプトに「今週の記録の要約」を足す（画面は変えない）                                                                                    | 🤖 / 👀              | 記録がある週に、朝刊へ記録を踏まえた 1 段落が出た日が 1 日ある                                                                                     | #2167 | 4、5               |
| 10  | docs の追随（CLAUDE.md §4 / §8・tier-2 の Apps 節・tier-3 の Analytics Status・mobile-scope 行 12 / 21・db-conventions §15）                          | 🤖                   | `docs-lint` 緑                                                                                                                                     | #2168 | 6、7               |
| 11  | 実画面の確認（Desktop / Mobile、light / dark）                                                                                                        | 👀                   | メインのチャットが実ブラウザで撮影し、Issue にコメントする。記録 0 件の日・複数アプリの日・narrow の More から Apps に入る経路を撮る               | #2168 | 6、7               |

Step 6 と Step 7 は互いに独立なので、Step 3 が済めば並行できます。Step 8 は #2144 の着地を待たずに、語彙の突き合わせのコメントだけ先に出します（#2146 が鍵の保存先を決める前に、slug の語彙を合わせるためです）。

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に型・テストを回して検証します
- **👀 目視** — Claude では検証できません。こうだいさんが画面で確認します
- **🛑 人手** — DDL push / シークレット投入 / 本番デプロイ / PR merge

---

## Acceptance Criteria (機械検証可能)

- [ ] `.github/workflows/ci.yml` の `verify` ジョブの全ステップ（shared → web → desktop → mcp-server）と `docs-lint` が、各 PR で exit 0
- [ ] Supabase に `app_records` と `extension_apps` があり、どちらも RLS が有効で owner policy が 4 本、`supabase_realtime` に入っている（`list_tables` と `pg_policies` / `pg_publication_tables` で確認）
- [ ] `delete_my_account` の関数本体に 2 表の delete がある（`pg_get_functiondef` で確認）
- [ ] `supabase db diff` で local と remote の差分が 0
- [ ] 同じ `external_id` で `create_record` を 2 回呼ぶと同じ `id` が返り、行が 1 件のまま。中身が違えば専用の code が返る（vitest・`supabaseStub`）
- [ ] `list_records` の `group_by` が day / week / month で、共通の見本データに対して shared と mcp-server で同じ答えを返す。週の鍵は Goals の週の鍵と一致する（vitest）
- [ ] `shared/src/generated/mcpToolCatalog.json` に record 系 4 道具があり、`toolCatalogFreshness.test.ts` が緑
- [ ] `syncDomains.test.ts` / `syncRealtimeTables.test.ts` が 2 表込みで緑
- [ ] `web/tests/lazySectionChunks.test.ts` が緑（Apps は分割せず、Analytics は分割のまま）
- [ ] `SECTIONS` に `apps` があり、`MOBILE_SECTIONS` で More 側（`mobileOrder > 3`）に入る（vitest）
- [ ] en / ja の両 catalog に `section.apps` と記録タブの label があり、`i18nKeys.test.ts` が緑
- [ ] Apps の画面で、登録 → 一覧に出る → 「記録を見る」が Analytics の記録タブへアプリの絞り込みつきで遷移する（Testing Library で render してハンドラの引数を assert）
- [ ] 「記録だけ届いているアプリ」の行が、台帳に無い `source_app` だけを出し、`claude` を出さない（vitest）
- [ ] `userDataExport.ts` の表の一覧に 2 表がある（vitest）
- [ ] 各 PR の diff が目安の範囲内（新規行で数える = D-20260920-main-2。機能追加 500 行・修正 200 行）。超える場合は PR 本文に理由を書く
- [ ] 完了時: この計画書の Status と per-chat memory を更新し、`archive/` へ移す

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積みます。

---

## DB Migration Notes

- ファイルは `supabase/migrations/00NN_app_records.sql` の 1 本です。2 表・index・RLS・Realtime・`delete_my_account` の `create or replace` を 1 本にまとめます。
- 番号は着手時に origin/main の `supabase/migrations/` と突き合わせて決めます。2026-10-08 時点で `0034_goals.sql` が最新で、`0035` は #2118（settings）、`0036` は #2094（materials）に予約済みです。#2147（窓口の作成元と重複防止のキー）も 1 本使います。並行するレーンが同じ番号を使うと、git は MERGEABLE のまま `db push` だけが割れます（memory: migration-number-collision-across-lanes）。
- 手順は「ローカルのファイルを先に作る → こうだいさんが `supabase db push` → Claude が `list_tables` で確認」です。`apply_migration` の MCP は単独では使いません。
- `life-editor-migration-validator` と `life-editor-sync-auditor` の監査を通します。独立テーブルなので、監査の観点は 0018 の timer 系と同じです（2 行分割の規約は当てません）。
- 失敗したら、逆向きの migration を別のファイルで作ります。既存のファイルは直しません。

---

## Risks / Known Issues 参照

- **窓口との二重の identity**: #2146 が鍵の保存先を独自に決めると、アプリの id が台帳（`extension_apps.slug`）と鍵の側で 2 つになります。Step 8 のコメントを #2146 の着手前に出します。鍵の側が slug を持ち、台帳の行を指す形が目標です。
- **Analytics の凍結の一部解除**: 記録タブを作る過程で既存 4 タブに手を入れたくなります。入れません（Non-goals）。見つけた不具合は Issue に起票依頼を出します。
- **書き込みの多い表と Realtime**: 拡張アプリが記録を連続で送ると、`appRecords` ドメインが連続で動き、Analytics の記録タブが期間ぶんを取り直します。独立ドメインにしたので他の画面は動きません。1 人で使う前提では問題になりませんが、1 回の呼び出しで複数件を入れる `create_records`（複数形）は、必要になってから足します。
- **数値の精度**: `numeric` を JS の `number` に写します。金額（JPY の整数）と体重（小数 1 桁）の範囲では落ちません。15 桁を超える値は扱わないと db-conventions §15 に書きます。
- **日付の境目**: `occurred_at` は UTC の timestamptz です。日ごとの集計は「日付が変わる時刻」（#373）を踏まえた既存の関数で行います。MCP 側は `LIFE_EDITOR_TZ`（Workers は UTC 固定・CLAUDE.md §5）で日付を切るので、画面と MCP で 1 日ずれる時間帯がありえます。既存の `get_today_context` と同じ性質なので、この計画書では直しません。
- **セクションの挿入**: Apps を足すと、narrow の More シートの並びと Settings のツアー一覧の行数が変わります。ツアーのステップを持たないセクションが初めて増えるので、`TourLauncherModal` が `hasSteps: false` の行を正しく出すかを Step 7 で実測します。
- **ID 不変式**: `record-` の接頭辞は `items_meta.role` の値ではありません。`id` が role を跨いで一意という不変式は `items_meta` の中の話なので、独立テーブルの `record-` は抵触しません。CLAUDE.md §4 に 1 行足します。
- **green PRs break main when paired**: 型を足す PR（Step 3）と、その型を使うテストの PR（Step 4 / 6 / 7）が別々に merge されると壊れることがあります（memory: green-prs-break-main-when-paired）。Step 3 を先に merge してから下流を出します。
- 類似の known-issue は未確認です。着手前に `docs/known-issues/` を grep します。

---

## Issue（2026-10-08 起票済み）

chat-main が起票しました（1 Issue = 1 レーン）。各 Issue の body に、§Acceptance Criteria から該当する行を機械で確かめられる形で写してあります。#2165 は新しいセクションで担当レーンが無いため、Connect（Tag hub）をセクションごと建てた connect-refine に回しました。セクションが main に入ったら `section:apps` ラベルを作って付け替えます。

| Issue | 内容                                                                                                      | Step   | 依存                       | Gate                | 宛先                          |
| ----- | --------------------------------------------------------------------------------------------------------- | ------ | -------------------------- | ------------------- | ----------------------------- |
| #2161 | 記録テーブルと台帳の DDL（`app_records` / `extension_apps` / `delete_my_account`）                        | 2      | なし                       | 🤖 / 🛑 db push     | `[refactor-core]` area:schema |
| #2162 | shared のデータ層（型・Service・routing・同期ドメイン 2 つ・エクスポート・集計の純粋関数）                | 3      | #2161                      | 🤖                  | `[refactor-core]`             |
| #2163 | MCP の道具 4 つと today / week context の records 要約・catalog・Remote MCP の配り直しとスマホからの 1 件 | 4, 5   | #2161、#2162（見本データ） | 🤖 / 🛑 deploy / 👀 | `[mcp-tools]`                 |
| #2164 | Analytics の「記録」タブと narrow の「記録」ブロック                                                      | 6      | #2162                      | 🤖 / 👀             | `section:analytics`           |
| #2165 | Apps セクション（registry・descriptor・画面・登録 / 編集 / 削除・未登録ソース・Analytics への導線）       | 7      | #2162、#2164               | 🤖 / 👀             | `[connect-refine]`            |
| #2166 | 窓口との突き合わせ（道具集合・作成元の語彙・呼び出し元の slug の口）                                      | 8      | #2163、#2144、#2146        | 🤖                  | `[mcp-tools]`                 |
| #2167 | 朝刊のプロンプトに今週の記録の要約を足す                                                                  | 9      | #2163                      | 🤖 / 👀             | `[main]`                      |
| #2168 | docs の追随と実画面の確認                                                                                 | 10, 11 | #2164、#2165               | 🤖 / 👀             | `[main]`                      |

---

## 後続（この計画書の AC には入れない）

- **鍵の一覧と取り消しを画面に出す**（#2146 の「別 Issue」）: 置き場は Apps のカード（アプリごとに「鍵: 発行済み / 取り消す」）が自然です。#2146 が鍵の保存先を DB にするか Worker のシークレットだけにするかで作れる範囲が変わるので、#2146 の着地後に起票します。
- **最初の拡張アプリ（家計簿）**: 別リポジトリ・別計画です。着手の条件は、スマホの Claude からの記録を 2〜3 週間使って、朝刊の講評か Analytics の記録タブが役に立ったと、こうだいさんが判断したときです。
- **`create_records`（複数件）**: 拡張アプリがまとめ送りを必要としたときに足します。

---

## References

- 決定: D-20261008-main-1（役割分担・記録の置き場・順番・Analytics と Apps）、D-20261008-main-2（別リポジトリと切替条件）、D-20261007-main-1〜8（窓口）、D-20260704-main-1（汎用 Database の凍結）、D-20261002-briefing-3（データ先・画面後）、D-20260816-briefing-1（週は日曜始まり）
- 親計画書: `.claude/docs/vision/plans/2026-10-07-extension-app-gateway.md`（窓口）と、その Issue #2144〜#2151
- 軸: `.claude/docs/vision/plans/2026-07-15-briefing-loop.md` §2（判定基準）
- 前例: `supabase/migrations/0018_timer_audio_tables.sql`（独立テーブル + 自分の `updated_at`）、`shared/src/services/SupabaseTimerService.ts`、`shared/src/context/syncDomains.ts`、`web/src/sectionDescriptors.tsx`、`shared/src/components/Analytics/tabs.ts`
- 凍結の経緯: `archive/2026-07-16-loop-friction-fixes.md` 決定 6（Analytics）、`.claude/docs/requirements/tier-3-experimental.md` §Analytics
- skills: `db-migration` / `add-feature` / `add-component` / `test-writing` / `frontend-react-designer` / `docs-workflow` / `issue-dispatch`

---

## Worklog

- 2026-10-08: 初版。2026-10-08 のチャットでの方針（D-20261008-main-1 / -2）と、親計画書 `2026-10-07-extension-app-gateway.md`（PR #2137・同日 merge）の決定 D-20261007-main-1〜8 を前提に書きました。チャットで Claude が先に出した「拡張アプリは Supabase に直接書く」案は、D-20261007-main-3 と矛盾するため取り下げ、窓口経由に合わせました。Issue の起票はまだです。
- 2026-10-08（夜）: PR #2158 が merge されたので Status を IN PROGRESS にしました。Issue を #2161〜#2168 として起票し、Steps 表と §Issue の仮番号を実番号に置き換えました。宛先は N1 / N2 = `[refactor-core]`（計画時の候補 `[shared-fix]` から変更。DDL とデータ層を同じレーンで続けるため）、N5 = `[connect-refine]`（新セクションの建て方を知っているレーン）です。
