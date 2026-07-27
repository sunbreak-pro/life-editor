# HISTORY (chat-analytics-refine)

### 2026-07-27 - Notes folder 退役の後段と Connect の project ノード撤去（#375 / PR #405）

#### 概要

life-tags S3（#225）が Tasks 側だけ folder を撤去し、Notes 側を「意図的な過渡期非対称」として温存していた分の後始末。実データは migration 0020 で変換済みだったので、残っていたのはコードだけ。あわせて Connect グラフの `project` ノード（folder 由来）を退役させ、まとまりの表現を life-tag に一本化した。DDL 変更なし。

#### 変更点

- **型と生成導線**: `NoteNodeType = "note"` の単一値化（union 名は維持 — 再拡張が 1 行で済み、payload 行の列名としても使う）。`useNotesUnifiedAPI.createFolder` を本体・context 公開・undo ラベル i18n（en/ja lockstep）ごと撤去。プロダクション呼び出し側はゼロで、参照していたのは undoRedo の配線テスト 1 本だけだった
- **legacy 行の除外を新設**: `isLegacyNoteFolderRow` を `listNotesUnified` / `fetchDeletedNotesUnified`（Trash）/ `searchNotesUnified` / MCP `fetchLiveNotes` の 4 経路に配置。Tasks 側 `isLegacyFolderRow` と同型で、クエリ側 `.neq` を避ける（NULL note_type 行まで落ちて素のノートが消えるため）。folder を親に持つノートは孤児許容でそのまま出る。0020 は変換後の folder 行をソフトデリートで残すので、この filter が無いと **Trash に復元可能な「幽霊フォルダ」が並ぶ**
- **Connect の project 退役**: 選択肢 3 つ（種別ごと退役 / タグを project として描く / 割当ありのタグだけ project）をユーザーに提示し、**種別ごと退役**で確定。`GraphNodeType` から `project` を落とし、凡例・型フィルタ・`graph-theme` のノード色・アイコン表 4 箇所・`connect.graph.typeProject`（en/ja）を撤去。tag ノードは元から `wiki_tags` + `wiki_tag_assignments` で描かれていたので、後継はすでに存在していた形。Analytics #334（`projectTime` → `tagTime`）と同じ考え方
- **ついでに塞いだ穴**: `flattenedNotes` の再帰は「folder のときだけ潜る」だったため、folder を外すと条件が「展開中なら潜る」に広がる。対象が広がる以上 parentId のサイクルでハングし得るので visited ガードを追加（known-issues 016 と同クラス。`softDeleteNote` は元から同じガードを持っていた）
- **テスト**: 新規 6 本（mapper の legacy 判定と丸め 2 / service の folder 行除外 3 = list・孤児許容・Trash / Connect の「project ノードが無く tag ノードが後継」1）。更新 4 本（buildTagGroups は folder 除外 → parentId 非依存の確認へ、permanentDelete の subtree 2 本は親を folder から素のネストノートへ、cycle テストの型）
- **検証**: shared 145 files / 1168 tests 緑・shared / web / mcp-server の build いずれも exit 0。`npm run lint --prefix web` は `NotesView.tsx:269` で error 1 件出るが **main 時点で既存**（stash して実測確認）で本変更とは無関係
- **docs 追随**: tier-1-core の Notes 節を「過渡期注記」→「退役済み」に、`briefs/connect.md` のノード 4 種を 3 種へ、life-tags 計画の Worklog と横断後継対応行に #375 完了を記録。`briefs/materials.md` の folder 前提記述は materials レーンの持ち物なので outbox で申し送り

### 2026-07-26 - mcp-server レーン: legacy テーブル参照の解消（#360）とファイル系ツール退役（#362）

#### 概要

MCP Server の 34 ツールのうち 18 個が、0007 で DROP 済みの legacy テーブルを SQLite 経由で参照したままだった（呼べば必ず失敗する状態）。これを統合スキーマへ移行し（#360 / PR #396）、続けて UI 退役後も残っていたファイル系 7 ツールを退役させた（#362 / PR #397）。

#### 変更点

- **#360 実測**: `.from()` を使っていたのは schedule / briefing のみ（#256 で移行済）。残る tasks / notes / dailies / content / search / wikiTag は全て `better-sqlite3` の生 SQL で、SQLite パスが渡らなければ `getDb()` が例外を投げる = 実質「呼べないツール」だった
- **#360 移行**: 18 ツールを `items_meta` + `<role>_payload` へ。作法は scheduleHandlers に準拠（作成時の orphan recovery / 書き込みごとの `items_meta.updated_at` bump / ソフトデリート）。共通処理は `utils/items.ts`（meta+payload の書き込み作法）・`utils/pagination.ts`（`.range()` ページング + `.in()` チャンク）・`utils/content.ts`（jsonb ↔ TipTap 文字列）に集約
- **#360 の自己レビューで拾った穴**: 全件取得 5 箇所がページング無しで、PostgREST の 1000 行無言打ち切りに素通し（shared の `postgrestFetchAll` が明示的に対策している既知の罠を MCP 側で踏み直すところだった）。他に空パッチでの無意味な LWW cursor 前進、検索のタイトル一致経路への退役 folder 行の混入、未使用 export 1 件
- **#360 仕様変更**: `generate_content` / `format_content` の `schedule` ターゲット退役（`events_payload` に content 列が無い → 代替は `update_schedule_item` の `memo`）/ tag の `source`・`text_color` 廃止・`icon` 追加 / entity 種別は `items_meta.role` から読むので `tag_entity` の `entity_type` は任意（指定時は一致検証）/ task status はツール語彙（小文字）を維持し DB の CHECK 値（大文字）と双方向変換 / done 解除で `completed_at` を null に戻す
- **#360 付随**: `better-sqlite3` + `src/db.ts` 削除（参照ゼロ化）。`@types/node` がその推移依存だったため明示追加。`.mcp.json` の `DB_PATH` を Supabase 資格情報の `${VAR}` 参照へ差し替え（そもそも資格情報が配線されておらず、#256 以降 schedule / briefing も env 頼みだった）
- **#362**: fileHandlers.ts（274 行）+ tools.ts の 7 ツール定義・dispatch + `.mcp.json` の `FILES_ROOT_PATH` を削除。docs は tier-1 §MCP Boundary「やらない」への退役明記と AC6 撤回、tier-2 §File Explorer の MCP Coverage 更新
- **PR の積み方**: #362 を main ベースで検証しようとしたら `better-sqlite3` のネイティブビルドが Windows の node-gyp で失敗し、型検証すら通らなかった。それを外すのが #396 のため、`rebase --onto` で #396 の上に積む stacked PR に変更（base = `claude/mcp-server-360`）
- **docs 整合**: tier-1-core の MCP Server 節からツール数の直書きを撤去（数値の非複製原則）。stale だった「MCP schedule handler は旧 SQLite」注記 3 箇所を解消（#256 時点で既に古かった）
- **検証**: mcp-server `tsc --noEmit` 緑 / vitest 39 件緑（新規 3 ファイル = status 変換・jsonb 変換・ページング）/ build 緑 / stdio スモークで tools/list が 27 ツール（ファイル系 0 件）/ shared 1110 件緑 / web build 緑。**実 Supabase でのツール呼び出しは未検証**（worktree に資格情報が無い）
- **stacked PR が迷子になった（要注意の失敗）**: #396（base=main）と #397（base=`claude/mcp-server-360`）が 10 秒差で merge され、GitHub の base 自動張り替えが間に合わず **#397 は既に main 取り込み済みの中間ブランチへ merge**された。`gh pr view 397` は state=MERGED を返すのに main には 1 行も届いておらず、`git show origin/main:mcp-server/src/tools.ts | grep -c '"list_files"'` が 14 を返して発覚。`claude/mcp-server-362-relanded`（origin/main から cherry-pick・コンフリクトなし）で **PR #401** として再着地。Issue #362 は未着地のため close せず open 維持。教訓を memory `stacked-pr-base-retarget-race` に保存（既存の `push-after-merge-strands-commits` と同じ「MERGED 表示 ≠ main に存在」の家族）

### 2026-07-26 - 2 巡目の独立監査（QA follow-up コミット自体の監査）

#### 概要

各 PR の 1 コミット目は監査済みだったが、**その指摘を受けて足した 2 コミット目が未監査**だったため、そこだけを対象にアドバーサリアル監査を実施。Blocking 0 で PASS だが、「QA を通すために書いたコードが開けた新しい穴」が 1 件見つかり修正した。

#### 変更点

- **#334 / PR #359 に 1 コミット追加**: 生の分数をチャートへ渡すようにしたことで、host の `formatHours`（時を floor・分を独立に round）が **119.7 分を「1時間60分」と表示し得る**状態が露出（従来はスライスごとの `Math.round` が偶然蓋をしていた）。丸めを 1 回にまとめて先に整数化する形へ修正 — `TodayDashboard` も元から生の分数を渡していたため全 caller で直る。あわせて `TagWorkTimeBucket` を判別可能ユニオン化（"tag" スライスは型として名前を持つことが保証され、到達不能な `?? ""` を除去）、`other` スライスの描画経路に render テスト新規（recharts は jsdom 不可のため `Pie` に渡るデータを捕まえる形・repo の stub 作法に準拠）
- **#356 / PR #378 に 1 コミット追加**: `computeWorkStreak` は `today` だけ `todayCalendarKey()` に寄っていて `yesterday` が取り残されていた（挙動は同値だがコミットメッセージ・本 history の記述と食い違い）。両者を 1 回の時計読みから導出する形へ統一。`completedAt.substring(0,10)` の 2 箇所に「これは UTC プレフィックスで暦日キーではない」注記を追加（既存ズレの目印）
- **検証**: #359 側 shared build + 1091 tests + web build / #378 側 1082 tests、いずれも prettier 込みで緑
- **merge 時の注意（実測）**: 2 ブランチは `shared/src/utils/analyticsAggregation.ts` の import 帯で衝突する。#378 を先に merge → #359 を rebase → 再検証、の順が安全

### 2026-07-26 - #356 analytics「今日」境界の要否判断（暦日固定で確定・PR #378）

#### 概要

#218 で入った day-start hour（日付が変わる時刻）へ analytics の「今日」も追随させるかの判断タスク。**見送り（暦日固定）**を選び、判断根拠を Issue #356 コメントに記録したうえで、決定がコードから読めるよう対象を `todayCalendarKey()` へ統一した（挙動不変）。

#### 変更点

- **判断根拠（Issue コメント記録済み）**: (1) analytics のバケツは全部暦日キー（30 日トレンドの `setHours(0,0,0,0)` アンカー / 時間帯 × 曜日ヒートマップ / DailyTimeline の 0–24h 軸） (2) セッション側のキーも暦日のため、`todayStr` だけ `todayDateKey()` にすると pref=4 の 0–4 時の窓で深夜セッションが「今日」から外れ前日 0–4 時が混ざる（role-qa が実際に差し替えて本 PR のテスト 2 件が落ちることを実測） (3) 追随するなら比較の両側を全箇所同時に動かす必要があり別スコープ
- **`todayCalendarKey()` へ統一（#280 の既存ヘルパー・定義上同値＝挙動不変）**: Issue 記載の 4 箇所（`TodayDashboard` / `MobileAnalyticsView` / `DailyTimeline` / `AnalyticsScreen.todayKey`）+ role-qa が見つけた漏れ 2 箇所（`OverviewTab` の今日の作業時間 / `computeWorkStreak` の today。yesterday は 2 巡目の監査指摘で追随 — 時計読みも 1 回に統一）
- **決定の pin**: `shared/tests/analyticsTodayBoundary.test.tsx` 新規（pref=4・時刻 02:00 で 01:00 のセッションが「今日」に入り、前日 23:30 は入らない）。`todayCalendarKey` の doc コメントにも Analytics を利用者として明記（ヘルパー側から決定を辿れる）
- **スコープ外として切り出し**: 完了 Todo の「今日」は `completedAt.substring(0,10)` = UTC 日基準で、JST では朝 8 時までの完了が前日カウントになる既存ズレ（role-qa 検出）→ chat-main へ outbox で起票依頼
- **検証**: shared build + 1082 tests + web build + prettier 全緑。role-qa 独立監査 PASS（Blocking 0・Should-fix 4 件は全て本 PR に取り込み）。commit 8feaff19 + 追随 1 本 → PR #378（merge 待ち）

### 2026-07-26 - #334 folder 集計をタグ集計へ置換（ハング要因の構造的除去・PR #359）

#### 概要

`analyticsAggregation.ts::findRootFolder` の巡回ガード無し祖先たどり（循環 `parentId` で Analytics 画面がハング）を、ガード追加ではなく**関数ごと退役**して解消。#225 で folder ノードが消えて以来「常に空」だった Project work time チャートを、`wiki_tag_assignments` 起点のタグ別集計として実データ化した（life-tags 計画書 §Step 4 が名指ししていた後継対応）。

#### 変更点

- **`aggregateByFolder` → `aggregateWorkTimeByTag`**: assignment を `itemId` で引き当てるため祖先たどりが存在しない＝ハングの余地が構造的に消滅。unified 型（`types/wikiTagUnified.ts`）を使用（legacy `types/wikiTag.ts` の entityType 系は実データと別物・`aggregateTagByEntityType` は呼び出し元ゼロの dead）
- **集計の不変式 = スライス合計 ＝ 実測の作業時間**: 複数タグのタスクは均等割り / 上位 10 タグから溢れた分は `other` バケツ / タグ無しは `untagged` バケツ。soft delete 済みタグ・assignment と未知タグ宛ては除外。**初版は top-N 打ち切りで捨てていて宣言と矛盾（role-qa S1 検出）→ `other` 追加 + スライスごとの `Math.round` 廃止で修正**
- **`ProjectWorkTimeChart` → `TagWorkTimeChart`**: スライス色はタグ自身の色、未設定時のみ `--color-chart-cat-*` にフォールバック。`other` / `untagged` は控えめなトークン色
- **API / i18n**: `AnalyticsView` props が `tagCount`/`assignmentCount`（数値）→ `tags`/`assignments`（配列。件数はここから導出 = 数値の非複製原則）。i18n は `analytics.projectTime.*` → `analytics.tagTime.*`（en/ja lockstep・`untagged` / `other` 追加）
- **テスト**: タグ集計の属性ルール 7 件 + 循環 `parentId` で node 系集計が有限時間に返る pin（KI-016 クラスの再侵入検知）
- **docs 追随**: life-tags 計画書 :111 の analytics 後継対応に完了マーク、design brief（analytics）のチャート名・データ系統・脆い行番号参照を更新
- **検証**: shared build + 1088 tests + web build + prettier 全緑。role-qa 独立監査 PASS（Blocking 0）。commit a608eb39 + 70254d8f → PR #359（merge 待ち）
