# chat-analytics-refine outbox

## 2026-07-11 — #182 追修正 PR #198 / #181 analytics 行チェック済み・検証知見 2 点

#182（Today カード折返し）は #180 の 1000px 化だけでは ja 値（「2時間30分」等 6 文字以上）が 4px 不足で折返し継続 → TodayDashboard を WeeklySummary と同じ SummaryRow 行レイアウトへ統一（PR #198・merge 待ち）。#181 の analytics 行は実測（タブ帯左端 x=294 が schedule/materials と一致）でチェック済み。

他 worktree に有用な検証知見:

1. **playwright の認証ゲートは Sign up で使い捨てアカウント即作成が確立運用**（メール確認なし・即ログイン）。今回作成分 = `e2e-analytics-refine-1783735818892@example.com`（削除はユーザー判断）
2. **実データが要るレイアウトのストレスケース**（例: 長い ja 時間文字列）は、ログイン画面のまま vite dev の実 TSX を `/@fs/` dynamic import して実 CSS 上に mount する component-graph harness で計測可能（スクリプトは私のセッション scratchpad `harness*.mjs` 参照・使い捨て）
3. **layout-standard 向け**: 1440px viewport では rightSidebar（Details）展開時に中央カラム実効幅が 802px まで縮む（`max-w-lumen-data` 1000px は非成立）。v2 幅切替タブの実測基準を決める際は「パネル開閉 × viewport」の組合せで最狭 802px 帯を想定に含めるのを推奨

vitest フルスイートは playwright / build と並走させると timeout フレークが出る（auth-impl チャットの記録と同現象・単独実行では 768 全通過）。

## 2026-07-11 — v2 adoption 第 1 便（内部タイトル撤去）+ layout-standard / chat-main への依頼

#196 merge を受けて analytics の v2 adoption in-scope 分を実施（PR は本 outbox 追記と同便）: AnalyticsView の内部 h2 タイトル行を撤去し、期間セレクタを HeaderTabs `trailing` へ移設（#196 既知の「内部タイトル併存」解消）。

**→ layout-standard 宛（shell 協調が必要な残り 2 点・いずれも MainScreen = 貴レーン専有のため提案のみ）:**

1. **タブ帯の SectionHeader 統合（v2 §1）**: analytics のタブ state は現在 shared の AnalyticsView 内部（useState）。materials 方式で MainScreen へ lift するなら、AnalyticsView 側に controlled-tab props（`activeTab` / `onTabChange` 追加・省略時は現行の内部 state 継続 = 後方互換）を私のレーンで先行実装できます。API 形の希望があれば outbox で返してください
2. **narrow 時の二重 chrome**: analytics narrow は PageContainer(reading) × AnalyticsView 内部（gutter + max-w-lumen-data + overflow-y-auto）が入れ子になり、gutter 二重（実効幅 ≈672px）+ スクロールコンテナ二重の状態です。提案 = MainScreen の analytics を ownsFullBleed から外し wide→`data` variant / narrow→`reading` に振り、AnalyticsView の内部 width/gutter/scroll chrome を撤去して PageContainer に一本化（shared 側の撤去は私が実施・MainScreen 側と同一 PR にするか 2 PR 連続にするかは貴レーンの判断に合わせます）

**→ chat-main 宛（playwright 起動 = chat-main のみ決定に従い依頼）:**

- 本 adoption PR merge 後の analytics runtime 確認をスモーク巡回に含めてください: (a) 標準ヘッダー「分析」とタブ帯の二重タイトルが解消されている (b) タブ行右端に期間セレクタが乗っている (c) wide/narrow × パネル開閉でカード列の折返し・console error なし（#182 再発監視。narrow は上記の既知二重 gutter があるため「壊れていないこと」基準で）

## 2026-07-11 — v2 adoption 第 2 便（controlled-tab props 実装済み）+ Issue #208 起票

main（#202 post-v2 policy）取り込み後、v2 adoption を追跡する **section:analytics Issue #208** を自己起票（親計画 Step 2 の adoption Issue が未起票だったため §9 ルールで analytics 側が起票）。

**→ layout-standard 宛（前便 依頼 1 の続報・受け口を先行実装しました）:**

- **タブ帯統合の controlled-tab props を `AnalyticsView` に実装済み**（後方互換）。API 形は前便提案どおり: `activeTab?: AnalyticsTab`（`"overview" | "tasks" | "work" | "schedule"`）/ `onTabChange?: (tab: AnalyticsTab) => void`。**両方省略時は現行の内部 state 継続**（全既存呼び出し = web `AnalyticsScreen` / shared テストは省略のため無変更）。materials 方式で MainScreen へ tab state を lift する際は、この 2 props に接続 → 併せて私のレーンで AnalyticsView 内の in-body `HeaderTabs` を撤去します（MainScreen 側 PR と同一便 or 連続便、どちらでも合わせます）。API 変更希望があれば outbox で返してください
- shared build / test・web build は本便で pass 確認済み

## 2026-07-11 — v2 §1 タブ帯 lift 完了（PR #235）

analytics の v2 §1 adoption（タブ帯を標準 SectionHeader へ lift）を **PR #235** で実装。schedule **#205** の作法（refine レーンが自セクションの MainScreen 最小配線を行い layout-standard へ告知）に倣いました（前便までの「layout-standard 待ち」は #205 の実運用を見て自レーン完結へ切替）。

**→ layout-standard 宛（MainScreen 最小配線の告知・単一書込者は貴レーンのため）:**

- `web/src/MainScreen.tsx` に analytics 分の最小配線を追加しました: `analyticsTab` state / `sectionHeader` switch の `section === "analytics"` 分岐（materials・schedule と同じ tabs-as-title・`divider={false}`）/ analytics body で `AnalyticsScreen` に `tab`/`onTabChange` を配線。shell 部品（SectionHeader / HeaderTabs / AppShell / PageContainer）は無改変で、materials/schedule と同型のため競合は無い想定です。異論があれば outbox へどうぞ。
- 併せて shared 側で AnalyticsView の in-body `HeaderTabs` を controlled 時に撤去（期間セレクタのみ data 列右端に残置・uncontrolled は後方互換維持）。タブ順は `ANALYTICS_TAB_ORDER` として `@life-editor/shared` から公開（SSOT・shell 側と二重定義しない）。

**→ chat-main 宛（runtime 確認依頼・playwright は chat-main のみ §7.4）:**

- PR #235 merge 後、analytics の runtime 確認をスモーク巡回に含めてください: (a) wide で標準ヘッダーのタブ帯がセクションタイトルを兼ね「分析」の二重タイトルが無い (b) タブ切替が効く・アクティブ下線が出る (c) 期間セレクタが data 列右端に乗る (d) rightSidebar パネル開閉でヘッダー不動・カード列折返し正常・console error 無し（#182 再発監視）。narrow は MobileAnalyticsView（タブ無し単一スクロール）で従来どおり。

## Task tracker note

- Issue #208（v2 adoption・section:analytics）／ 検証: `cd shared && npm run build && npm run test`・`cd web && npm run build` pass。runtime は chat-main 依頼済み
- 2026-07-11 第 3 便: §1 タブ帯 lift = PR #235（shared 846/846 test + web build pass）。§4 は §5 fluid 統一で moot。残り = chat-main runtime のみ
- 2026-07-11 追補（PR #235 に同梱）: `AnalyticsScreen.tsx` の既存 lint エラー `react-hooks/set-state-in-effect`（範囲取得 effect 内の同期 `setScheduleLoading(true)`）を解消 — loading フラグ設定を `handleScheduleRangeChange` コールバックへ移設（挙動同一・再レンダリング 1 回減）。ユーザー直指示で着手（§9 の worktree 直指示ルート）。**→ chat-main / all 向け FYI**: `eslint-plugin-react-hooks@7` の `set-state-in-effect` は他セクションの effect（loading フラグを effect 冒頭で立てる同型パターン）にも残っている可能性あり。リポジトリ全体の lint sweep 候補として頭出しします（起票判断は chat-main）

## 2026-07-26 — #334 / #356 実装完了（PR #359 / #378・merge 待ち）+ 起票依頼 1 件

キュー 2 件を 1 Issue = 1 ブランチ = 1 PR で処理。いずれも role-qa 独立監査で PASS（Blocking 0）、指摘は全て PR に取り込み済み。

**#334（PR #359 · `claude/analytics-refine-334`）— folder 集計をタグ集計へ置換**

`findRootFolder` の無ガード climb を「ガードを足す」ではなく**関数ごと退役**し、`wiki_tag_assignments` 起点の `aggregateWorkTimeByTag` に置換（life-tags 計画書 §Step 4 が名指ししていた後継対応。同計画書 :111 に完了マーク済み）。祖先たどりが消えたのでハングの余地は構造的に消滅。`ProjectWorkTimeChart` → `TagWorkTimeChart`、i18n は `analytics.projectTime.*` → `analytics.tagTime.*`。

他レーンに効きそうな知見 3 点:

1. **legacy `types/wikiTag.ts`（entityType 持ち）と unified `types/wikiTagUnified.ts`（itemId ベース）の取り違えに注意**。実データ（`listAllWikiTagsUnified` / `listAllTagAssignments`）は unified 系。既存の `aggregateTagByEntityType` は legacy 型のまま**呼び出し元ゼロの dead**（テストだけ生存）で、Connect 側がタグ集計を作るときは unified で書き直す前提のほうが安全
2. **円グラフで上位 N 打ち切りをするなら、溢れた分は「その他」に畳んで捨てないこと**。recharts の `percent` は表示中スライスの合計で割るため、捨てた分だけ残りの割合が水増しされる（QA 検出 → `other` バケツを追加して修正）。スライスごとの `Math.round` も合計をずらすので生値を渡す
3. `AnalyticsView` の props が `tagCount` / `assignmentCount`（数値 2 つ）→ `tags` / `assignments`（配列）に変わりました。他レーンから AnalyticsView を mount している箇所があれば追随が要ります（現状は web host と shared テスト 1 本のみ）

**#356（PR #378 · `claude/analytics-refine-356`）— 「今日」境界は暦日で確定（見送り判断）**

day-start hour への追随は**見送り**。理由と実測は Issue #356 のコメントに記録済み（要点 = analytics のバケツは全部暦日キーで、片側だけ `todayDateKey()` にすると深夜のセッションが「今日」から外れる）。判断をコードに残すため、対象を `todayCalendarKey()`（#280 の既存ヘルパー・定義上同値＝挙動不変）へ統一し、決定を pin するテストを追加しました。Issue が挙げた 4 箇所に加え `OverviewTab` と `computeWorkStreak` も同種の today だったので同時に揃えています。

**→ chat-main 宛（起票依頼・section:analytics / type:bug 相当）**

- **完了 Todo の「今日」判定が UTC 日基準になっている**（本 PR 群以前からの既存ズレ・今回は意図的にスコープ外）: `TodayDashboard` / `MobileAnalyticsView` / `aggregateTaskCompletionTrend` は `completedAt.substring(0, 10)` で比較しているが、`completedAt` は `toISOString()` 由来の UTC 文字列（`useTaskTreeCRUD.ts` で生成）。JST では朝 8 時までに完了した Todo が前日にカウントされる。バケツのキー側はローカル暦日なので、引き当てキーだけ UTC という非対称。直すなら「ローカル暦日キーに揃える」で、完了トレンドの過去データの見え方が変わる点の確認が要ります

**→ chat-main 宛（実ブラウザ確認・PR merge 後）**

- #359: タグ別ドーナツの (a) タグ自前色が `--color-chart-cat-*` と近い場合のスライス見分け (b) 最大 12 スライス時の外周ラベルの重なり (c)「タグなし」「その他のタグ」スライスの見え方。**実データはタグ 4 件 / assignment 1 件**（life-tags 計画書 §A の実測値）なので、当面は「タグなし」がほぼ全周のはずです。タグを何件か付けてからのほうが評価しやすいです
- #378: 挙動不変のため runtime 確認は不要（build / テストのみで足ります）

**注記**: 両 PR とも GitHub の docs-lint チェックは赤くなります。原因は main 由来の別件（`2026-06-19-step1-desktop-daily-driver.md` の Status enum 違反 1 行）で、本 PR 群とは無関係です。`web` の eslint も `web/src/notes/NotesView.tsx:291` の `react-hooks/static-components` が main 時点から既存（materials / notes レーン領分）。

---

## 2026-07-26 — mcp-server レーン（#360 / #362）

**#360（PR #396 · `claude/mcp-server-360`）— DROP 済み legacy テーブル参照の解消**

MCP の 34 ツールのうち 18 個が、0007 で消えた `tasks` / `notes` / `dailies` / `schedule_items` を `better-sqlite3` 経由で見たままでした。SQLite パスが渡らないと `getDb()` が例外を投げるので、実質「呼べないツール」が半分以上あった状態です。統合スキーマ（`items_meta` + `<role>_payload`）へ移行し、`better-sqlite3` と `src/db.ts` は参照ゼロになったので削除しました。

**#362（PR #397 · `claude/mcp-server-362`）— ファイル系 7 ツールの退役**

こうだいさんの判断（選択肢 1 = 退役）に沿って、`fileHandlers.ts` + tools.ts の登録 + `.mcp.json` の `FILES_ROOT_PATH` を撤去しました。

**⚠️ merge 順序（重要）: #396 → #397**

#397 は #396 の上に積んだ stacked PR です（base = `claude/mcp-server-360`）。#396 を merge すると GitHub が #397 の base を自動で main に切り替えます。逆順・並行 merge はしないでください。

こうなった理由: main の mcp-server は `better-sqlite3` に依存していて、Windows 機では `node-gyp` のネイティブビルドが失敗し **型検証すら通りません**（`npm install` が exit 1）。それを取り除くのが #396 なので、#362 単独では検証不能でした。

他レーンに効きそうな知見 3 点:

1. **PostgREST の 1000 行無言打ち切りは、shared の外でも同じ顔で待っている**。`shared/src/services/postgrestFetchAll.ts` が対策済みの既知の罠ですが、MCP 側は素通しで書き始めていて自己レビューで 5 箇所拾いました。新しく Supabase を叩くコードを別パッケージに書くときは、コレクション全件読みに必ずページングを通してください（MCP 用に `mcp-server/src/utils/pagination.ts` を新設。中身は shared 版と同じ思想）
2. **`content_json`（jsonb）は PostgREST の `ilike` が使えない**。notes / dailies の本文検索はプレーンテキストを抽出して in-app 照合に切り替えました。旧実装は TipTap の生 JSON に LIKE をかけていたので `"paragraph"` のようなノード名にもヒットしていました。同じ列を検索対象にする箇所があれば同様の注意が要ります
3. **`wiki_tag_assignments` の legacy / unified の差は MCP 側にも残っていた**: legacy は `(entity_id, entity_type, source)`、現行は `item_id` → `items_meta` 参照 + ソフトデリートで、種別は `items_meta.role` から引きます。`uq_wta_item_tag` が LIVE 行だけを制約するため、再タグ付けは insert ではなく**ゴミ箱の assignment を復活させる**必要があります（重複 insert すると unique 制約に当たる）

**→ chat-main 宛（PR merge 後の実データ確認）**

- **#396 merge 後に実 Supabase でツール疎通を確認してほしい**（`list_tasks` / `get_task_tree` / `search_all` あたり）。この worktree に資格情報が無く、型検証・単体テスト・stdio スモーク（tools/list）までしか到達できていません。tier-1-core の AC2 / AC9 に対応します
- その際 `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` をシェル環境に export する必要があります。`.mcp.json` は `${VAR}` 参照だけを持ちます（平文は置いていません）。**#256 の時点から資格情報が `.mcp.json` に配線されていなかった**ので、schedule / briefing も同じ前提で動いていたはずです

**注記**: `tier-1-core.md` §MCP Server からツール数の直書きを撤去しました（数値の非複製原則）。併せて「MCP schedule handler は旧 SQLite のまま」という stale 注記 3 箇所を解消しています（#256 の時点で既に古い記述でした）。

**⚠️ 追記（同日）: PR #397 は MERGED 表示だが main に届いていない → 再着地 PR #401**

上の「merge 順序」の注意が現実になりました。#396（09:40:00）と #397（09:40:10）が 10 秒差で merge され、GitHub の base 自動張り替えが間に合わず、**#397 は既に main 取り込み済みの `claude/mcp-server-360` に対して merge** されました。行き先が袋小路なので main には 1 行も届いていません。

```
$ git show origin/main:mcp-server/src/tools.ts | grep -c '"list_files"|"read_file"|...'
  14    # 7 ツール × (スキーマ + dispatch) が残存
$ git ls-tree origin/main --name-only mcp-server/src/handlers/fileHandlers.ts
  mcp-server/src/handlers/fileHandlers.ts   # 消えていない
```

- **#360 は正常着地**（base=main だったため）→ Issue #360 close 済み
- **#362 は未着地** → `claude/mcp-server-362-relanded` に cherry-pick して **PR #401** を作成（差分は #397 と同一・コンフリクトなし・検証は tsc 緑 / vitest 39 件緑 / build 緑 / stdio 27 ツール）。Issue #362 は open 維持（#401 merge で close します）
- #397 merge 後に push してしまい同じく main へ届いていなかった task-tracker の記録コミットも #401 に同梱しました

**他レーンへの一般化**: `baseRefName` が main 以外の PR の MERGED は「その base ブランチに入った」しか意味しません。stacked PR を出すときは「base 側 merge → 張り替えを待つ → 後続 merge」の順が必要で、着地確認は PR state ではなく**内容の実測**（`git ls-tree origin/main` / `git show origin/main:<file> | grep`）で行ってください。既知の `push-after-merge-strands-commits`（merge 後 push は届かない）と同じ「MERGED 表示 ≠ main に存在」の家族です。
