---
Status: COMPLETED # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: 2026-07-25
Branch: refactor/code-reduction
Owner-chat: code-reduction
Parent: (なし)
Previous: `.claude/docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md`
---

# Plan: Code Reduction — 安全に削除できるコードの棚卸し

> **本計画書は監査結果の台帳であり、削除はまだ 1 行も実行していない。** 各行は「候補」であって承認済みではない。
> 実行は Step 表の Gate に従って段階的に行う。

---

## Context

- **動機**: Tauri → Electron/Supabase 移行と `frontend/` 削除（#197）を経て、どこからも参照されない残骸が各層に溜まっている。実測で **約 26,000 行**が削除候補として残っていることが判明した。放置すると grep のノイズ源になり、Claude が「生きているコード」と誤認して参照する事故につながる。
- **制約**: コスト $0 厳守 / DDL は 🛑 人手ゲート（`supabase db push`）/ 他 worktree と同一ファイルを触らない / 凍結機能（汎用 Database）は「退役」ではないため削除は git 復元のみが退路
- **Non-goals**:
  - DB オブジェクト（テーブル / カラム）の DROP — 本計画では**候補の記録のみ**。実行は別 PR + 🛑 人手
  - `.claude/archive/` および docs の履歴記述の削除（意図的な歴史保全）
  - `mcp-server/` の退役判断（Tier 1 機能。別 Issue 案件 — §Flagged 参照）
  - リファクタリング的な重複統合のうち、挙動がドリフトしているもの（§C は候補提示のみ）

### 監査方法と信頼性

6 本のサブエージェントで観点別にファンアウトし、**全ての採用値をメイン側で grep / node スクリプトで再実測**した（`rules/docs-consistency.md` §5 準拠）。再実測で棄却した誤報告を §D に記録する。本文の行数は全てメイン実測値。

---

## Scope (Touchable Paths)

このプランで変更してよいパスを宣言する。宣言外へ広げる場合は先に本ファイルを更新する。

```
shared/src/services/DataService.ts
shared/src/services/noteLinkMapper.ts
shared/src/services/SupabaseDataService.ts      # 上記に伴う import / re-export 行のみ
shared/src/types/{sync,database,fileExplorer,diagnostics,schedule,sound}.ts
shared/src/utils/{sortTaskNodes,walkAncestors,analyticsAggregation}.ts
shared/src/components/MasterDetail.tsx
shared/src/components/index.ts                   # barrel 行のみ
shared/src/components/Connect/graph/graphStorage.ts
shared/src/hooks/useScheduleItemsRoutineSync.ts
shared/src/index.ts                              # barrel 行のみ
shared/src/i18n/locales/{en,ja}.json
shared/tests/{masterDetail,walkAncestors,noteLinkMapper}.test.*
web/src/components/{DebouncedTextInput.tsx,TreeNodeIndent.tsx,treeCollision.ts}
web/src/assets/**
web/public/icons.svg
{shared,web}/package.json                        # 未使用依存の削除のみ
prototype/**
weekly-news-digest/**
scripts/loop-engine/**
mobile/android/app/src/{test,androidTest}/**
.claude/hooks/stop-check.sh
.claude/settings.json                            # Stop hook 登録行のみ
.gitignore
.claude/docs/vision/plans/2026-07-25-code-reduction.md
```

**スコープ外（触らない）**: `supabase/**`、`mcp-server/**`、`.claude/archive/**`、`.claude/docs/requirements/**`、`desktop/**`、`resources/**`

---

## A. 削除候補チェックリスト（純粋削除・lines-per-risk 降順）

リスク重み: 低=1 / 中=2 / 高=3。比 = 削除行数 ÷ 重み。**`DYNAMIC-REF` は動的文字列経由でしか参照され得ない項目**（import グラフに映らないため §B に再掲）。

- [ ] **A1** `prototype/` 全ツリー（42 ファイル）— 削除 **20,889 行** / 参照: コード・CI・package.json いずれも **none found**（`.claude/archive/02_実装計画書_プロトタイプ環境.md:22` 等の docs のみ）/ リスク **中**（`prototype/_artifacts/*.tsx` 5,804 行が 4 本の archived 要件定義書から「凍結原本」として参照されている。git 履歴には残る）/ 比 10444
- [ ] **A2** `shared/src/i18n/locales/{en,ja}.json` — 完全死亡している 50 個のトップレベル namespace（1,046 キー）— 削除 **3,190 行**（en 1,595 × 2。ja は行番号までロックステップ一致）/ 参照: **none found**（434 ソースファイル全文に対する部分文字列一致で 0 ヒット）/ リスク **中**（キー漏れは「クラッシュせず生キー文字列が表示される」degraded UI。en/ja を同時に切らないと片側ドリフトが無検出で発生）/ 比 1595 — **`DYNAMIC-REF`**
- [ ] **A3** `shared/src/services/DataService.ts` — インターフェース 276 メソッドのうち**参照 0 の 142 メソッド**が占める **258 行**（全 842 行）/ 参照: **none found**（`grep -F -o` による部分文字列一致でも 0。実装も呼び出しも無い）/ リスク **低**（`SupabaseDataService` は `implements` せず `new Proxy({}, …) as unknown as DataService` で返すため型適合検査が走らない = 宣言を消しても実装側は壊れない）/ 比 258
- [ ] **A4** `shared/src/utils/analyticsAggregation.ts` L654-749 / L755-787 / L840-900 — `aggregateNoteCreationByDay` `aggregateDailyActivity` `aggregateNotesByFolder` `aggregateTagUsage` `computeTagConnectionStats` + 付随型 — 削除 **193 行**（全 900 行）/ 参照: **none found**（自身の宣言行のみ）/ リスク **低**（L789-838 の `aggregateTagByEntityType` は `shared/tests/analyticsAggregation.test.ts:8,161` から生きているので残す）/ 比 193
- [ ] **A5** `web/src/components/{DebouncedTextInput.tsx,TreeNodeIndent.tsx,treeCollision.ts}` — 削除 **143 行**（81 + 42 + 20）/ 参照: 3 本とも **none found**（ファイル冒頭のコメントは "Notes + Tasks import this" と主張するが、実際は `web/src/notes/NotesView.tsx:545` が `pointerWithin` を、`web/src/tasks/KanbanView.tsx:398` が `closestCorners` をインラインで使っている）/ リスク **低** / 比 143
- [ ] **A6** `shared/src/types/sync.ts` 全 108 行 + `DataService.ts:65` の import + `:835-840` の `// Sync` ブロック — 削除 **約 114 行** / 参照: `SyncResult` / `SyncStatus` のみが `DataService.ts:65,837-840` から使われており、その 6 行を同時に消せば残りは孤立 / リスク **低**（旧 D1 バッチ同期プロトコル。`shared/src/context/SyncContextValue.ts:6-11` が「D1 エンジンは意図的に復活させない」と明記、現行は Supabase Realtime）/ 比 114
- [ ] **A7** `shared/src/components/MasterDetail.tsx`(106) + `shared/tests/masterDetail.test.tsx`(83) + `shared/src/components/index.ts:50-53` — 削除 **約 191 行** / 参照: barrel とテストのみ。**`web/` 側の consumer は none found** / リスク **中**（「幅切替タブ廃止 → 全画面 wide 統一」で孤立した responsive プリミティブ。layout v2 が再採用しないことを確認してから消す）/ 比 96
- [ ] **A8** `shared/src/types/database.ts` 全 94 行 + `DataService.ts:56-63` import + `:717-755` `// Databases` 13 メソッド — 削除 **約 141 行** / 参照: `DataService.ts` のみ。`shared/src/index.ts` は再 export しておらず、`SupabaseDataService.ts` に "database" は 0 ヒット / リスク **中**（汎用 Database は**凍結であって退役ではない**。Supabase テーブルは未作成なので DDL リスクは無い。復活時は git 復元）/ 比 71 — 関連: A9
- [ ] **A9** `shared/src/i18n/locales/{en,ja}.json` `"database"` namespace（en L2579-2640）— 削除 **124 行**（62 × 2、50 キー）/ 参照: **none found** / リスク **中**（凍結機能。復活時は再翻訳が必要）/ 比 62 — **`DYNAMIC-REF`**・A8 と同 PR で
- [ ] **A10** `weekly-news-digest/ROUTINE.md` — 削除 **63 行** / 参照: **none found**（リポジトリ全体で自分自身のみ）/ リスク **低**（ファイル自身の `:14` が「Notion 上の正本はハブページ、本ファイルは控え」と宣言している = 正本は外部）/ 比 63
- [ ] **A11** `shared/src/services/noteLinkMapper.ts` 全 122 行（+ 同名テスト）— 削除 **122 行 +** / 参照: `SupabaseDataService.ts:53-55`(import) / `:569`(`_unused_mapper` マーカー) / `:2357-2358`(re-export) / `shared/tests/noteLinkMapper.test.ts` — **同時に消す必要あり** / リスク **中**（対象テーブル `public.note_links` は `supabase/migrations/0007_drop_legacy_item_tables.sql:76` で DROP 済み。関連 DataService メソッドは全て `_pendingDuRewrite` の throw スタブ）/ 比 61
- [ ] **A12** `scripts/loop-engine/{loop.sh,run-once.sh,PROMPT.md,TODO.md}` — 削除 **250 行** / 参照: CI・npm script・他シェルから **none found**（`.claude/memory/chat-main.md:44` に「実ループ本走は未実施」と記録）/ リスク **中**（`check.sh` 71 行は shared+web のビルド/テストゲートとして手動実行され得るので**残す**。`PROMPT.md:17` は削除済み `frontend/` を指しており既に壊れている）/ 比 125 — **`DYNAMIC-REF`**（人が `bash` で叩く以外の到達経路が無い）
- [ ] **A13** `mobile/android/app/src/{androidTest,test}/java/com/getcapacitor/myapp/Example*Test.java` — 削除 **44 行**（26 + 18）/ 参照: **none found**（`.gradle` / `.xml` から名指しされていない）/ リスク **低**（`cap add android` の雛形。パッケージ名 `com.getcapacitor.myapp` はアプリの `com.lifeeditor.app` と不一致。再生成可能）/ 比 44
- [ ] **A14** `shared/src/types/diagnostics.ts` 全 27 行 + `DataService.ts:27-30` import + `:695-701` `// Diagnostics` + `:713-716` `// Updater` — 削除 **約 38 行** / 参照: **none found**（`IpcChannelMetrics` は Tauri IPC チャネル計測用）/ リスク **低**（`desktop/` の `electron-updater` は `DataService` を経由しないため無関係）/ 比 38
- [ ] **A15** `shared/src/utils/walkAncestors.ts`(20) + `shared/tests/walkAncestors.test.ts`(53) — 削除 **73 行** / 参照: テストのみ、barrel 未登録 / リスク **中**（テストの docstring が「KI-016 バグクラスの canonical な visited-Set ガード」と位置づけており、意図的な参照実装の可能性がある。消す前に意図確認）/ 比 37
- [ ] **A16** `shared/src/types/fileExplorer.ts` 全 13 行 + `DataService.ts:55` import + `:813-826`(`// Files`) + `:828-833`(`// Copy`) — 削除 **約 33 行** / 参照: 上記 DataService の死にブロックのみ / リスク **低**（File Explorer は退役済み。**`mcp-server/src/handlers/fileHandlers.ts` の同名 `FileEntry` は別物で LIVE — 触らない**）/ 比 33
- [ ] **A17** `shared/src/utils/sortTaskNodes.ts` 全 58 行 + `shared/src/index.ts:355-359` — 削除 **約 62 行** / 参照: barrel のみ（`SortDirection` の一見生きている参照は `shared/src/types/database.ts:89` との**名前衝突**で、こちらを指してはいない）/ リスク **中**（`2026-07-11-life-tags-unification.md:108` が folder 退役作業の対象として名指ししている。当該レーンと調整してから）/ 比 31
- [ ] **A18** `.claude/hooks/stop-check.sh` 全 60 行 + `.claude/settings.json` の Stop 登録 — 削除 **約 64 行** / 参照: `.claude/settings.json:9` / `.claude/CLAUDE.md:100` / `_TEMPLATE.md:13` / リスク **中**（**削除より修理が本筋**: `:22` が `ROOT="/Users/newlife/dev/apps/life-editor"` をハードコードし CLAUDE.md §7.3 の「全 hook は `${CLAUDE_PROJECT_DIR}` 相対」記述と矛盾、`:31` の `grep -E '^frontend/'` は削除済みディレクトリを見ているため**現状 100% no-op**。docs は「稼働中の品質ゲート」と宣伝している）/ 比 32 — **`DYNAMIC-REF`**
- [ ] **A19** `shared/src/types/schedule.ts:24-46` `RoutineStats` + `shared/src/index.ts:51` — 削除 **24 行** / 参照: barrel のみ / リスク **低**（純粋な型。削除はコンパイラが検査）/ 比 24
- [ ] **A20** `shared/src/components/Connect/graph/graphStorage.ts:21-29` `loadPositions` — 削除 **9 行** / 参照: **none found** / リスク **低**（`savePositions` は生きているため「書くが誰も読まない」状態が露呈する。**削除とは別に Issue 化推奨** — グラフのノード位置が復元されないバグの疑い）/ 比 9
- [ ] **A21** `.gitignore:60-64`（`:55-59` と**バイト単位で重複**した outbox ブロック）+ `:86-88`（`# Tauri` / `src-tauri/target/` / `src-tauri/gen/`）— 削除 **8 行** / 参照: n/a / リスク **低** / 比 8
- [ ] **A22** `shared/src/types/sound.ts:16-21` `SoundSettingsMap` — 削除 **6 行** / 参照: **none found** / リスク **低** / 比 6
- [ ] **A23** `{shared,web}/package.json` の `d3-ease` + `@types/d3-ease` — 削除 **4 行**（`shared/package.json:23,40` / `web/package.json:30,44`）/ 参照: **none found**（生きているのは `d3-force` `d3-quadtree` `d3-selection` `d3-zoom` の 4 つのみ。`recharts` は自前の `victory-vendor` から d3 を引くのでトップレベル依存は不要）/ リスク **低** / 比 4
- [ ] **A24** `shared/src/hooks/useScheduleItemsRoutineSync.ts:75-78` `RoutineSyncResolved` — 削除 **4 行** / 参照: **none found** / リスク **低** / 比 4
- [ ] **A25** `web/src/assets/{hero.png,react.svg,vite.svg}` + `web/public/icons.svg` — 削除 **4 ファイル / 約 31 KB**（行数ではない）/ 参照: **none found**（`new URL()` 等の動的 import も無し）/ リスク **低**（Vite scaffold の残骸。`web/public/favicon.svg` は `web/index.html:5` から生きているので**残す**。`web/src/assets/` は空になるのでディレクトリごと消せる）/ 比 —
- [ ] **A26** ルート `package.json:11` の `typescript` devDependency — 削除 **1 行**（+ lock 27 行）/ 参照: **none found**（ルート `tsconfig.json` が無い / ルート script は `npm --prefix web` への proxy のみ / CI はルートで install しない）/ リスク **中**（エディタの tsserver フォールバックとして機能している可能性。IDE 動作を目視確認してから）/ 比 0.5

**A 小計: 約 26,000 行**（うち `prototype/` が 20,889 行 = 8 割。`prototype/` を除くと **約 5,100 行**、うち i18n が 3,314 行）

---

## B. `DYNAMIC-REF` — 動的文字列でしか参照され得ない項目（要・個別判断）

import グラフに映らないため「参照 none found」の証拠能力が弱い。**A の該当項目を再掲 + 追加調査分**。

- [ ] **B1** i18n 完全死亡 50 namespace（= A2、3,190 行）— 内訳上位: `tips`(699行×2) / `mobile`(139×2) / `database`(62×2) / `calendar`(52×2) / `ideas`(50×2) / `blockMenu`(48×2) / `music`(36×2) / `sidebarLinks`(26×2) / `files`(25×2) / `errors`(23×2) / `screenLock`(22×2) — 全て削除済み `frontend/` からそのまま移植された残骸
- [ ] **B2** `settings.claude.*`（en L70-284）— 削除 **430 行**（215 × 2、117 キー）/ 参照: **none found** / リスク **中**（生きている `settings` namespace の内部にあるため、ブロック削除ではなくキー単位編集になる）
- [ ] **B3** `schedule.*` namespace（en L1004-1089）— 76 キー中 **生きているのは `schedule.complete` の 1 個のみ** / 削除 **約 170 行** / リスク **中**（生きている Schedule 画面は `scheduleScreen.*` / `scheduleCalendar.*` を使う。**namespace 名が生存セクション名と衝突するので機械的な一括削除は危険**）
- [ ] **B4** 生存 namespace 内の孤児キー（`settings` 183/253・`analytics` 63/155・`work` 31/62・`trash` 15/37・`connect` 14/61・`materials` 4/71 ほか）— 合計 **約 500 キー / 約 1,000 行** / リスク **中**（キー単位編集。ブロック削除不可）
- [ ] **B5** **削除してはいけない動的キー 11 個**（誤削除防止のため明記）: `section.{tasks,daily,notes,tags}` は `web/src/MainScreen.tsx:230,277` の ``t(`section.${tab}`)`` から、`scheduleCalendar.weekday{Sun..Sat}` 7 個は `web/src/schedule/scheduleLabels.ts:17` の ``t(`scheduleCalendar.weekday${d}`)`` から到達する。**単純 grep では孤児に見える**
- [ ] **B5b** **i18next の複数形サフィックス規則**（削除スクリプトを書く前に必読）— `t("x.y", { count: n })` は実際には `x.y_one` / `x.y_other` を引く。つまり**リテラル文字列 grep では `_one` / `_other` 付きのキーが常に孤児に見える**。本リポジトリで該当するのは `connect.graph.match_one` / `match_other`（en L923-924）の 2 個だけで、ベースキー `connect.graph.match` の呼び出しも **none found** なので**これは真の孤児**（B4 の `connect` 14/61 に計上済み）。`count` オプション付き呼び出しは `scheduleScreen.moreCount` / `materials.tasks.taskCount` / `materials.tags.tagsCount` / `connect.graph.viewBacklinks` の 4 箇所あるが、いずれもサフィックス付きの派生キーをカタログに持たないため影響なし
- [ ] **B5c** 動的キー 5 箇所のうち `web/src/MainScreen.tsx:230,277,292,411` は `{ defaultValue: tab }` を渡している = キーを消しても生キーではなく id 文字列（`tasks` 等）が表示される。`web/src/schedule/scheduleLabels.ts:17` だけは `defaultValue` なしなので、**weekday 7 キーの誤削除は生キー露出に直結する**
- [ ] **B6** `analytics.tabs.{time,materials,connect}` — 3 キー / 削除 **6 行** / `ANALYTICS_TAB_ORDER`（`shared/src/components/Analytics/AnalyticsView.tsx:42`）は `overview|tasks|work|schedule` の 4 つのみなので、この 3 つは動的展開でも到達しない = **真の孤児**
- [ ] **B7** SectionId レジストリ — **削除対象なし**。`shared/src/sections.ts` の 7 件（`schedule` `materials` `connect` `work` `analytics` `settings` `trash`）は全て `web/src/MainScreen.tsx` に描画分岐があり、nav / mobileOrder（0-6・欠番重複なし）にも載っている。退役した `terminal` / `fileExplorer` / 凍結 `database` は**既にレジストリから除去済み**。`shared/src/types/taskTree.ts:7` は型のみの再 export で二重定義なし
- [ ] **B8** DB カラム — `routines_payload` の DU-A 系 8 カラム（`frequency` `interval` `weekdays_json` `end_at` `template_*` 4 種）/ `tasks_payload.folder_type` / `tasks_payload.{start_at,due_at}` / 5 テーブルの `version` カラム。**全て SELECT 文字列には載っているが、書き込みは literal `null`（または定数 1）でドメイン型に露出しない** = 「参照されているように見えて実質未使用」/ リスク **中〜高**（`routineMapper.ts:113-118` が「DU-D で契約統合するまでの read-only プレースホルダ」と明記 = 意図的な予約。`version` は CLAUDE.md §3.3 が「旧 Tauri 時代の遺物で未使用」と認めているが、消すには全 mapper の write 行を編集する必要がある）→ **本 PR ではスコープ外。DDL は 🛑 人手**

---

## C. 重複統合候補（純粋削除ではない・要リコンサイル）

- [ ] **C1** `items_meta` 行型 / patch 型 / カラム文字列の **5 重複** — `shared/src/services/{notesUnifiedMapper,routineMapper,dailiesUnifiedMapper,scheduleItemMapper}.ts` を `taskMapper.ts` の `ItemsMetaRow` に寄せる — 削減 **68〜100 行** / リスク **低**（5 本は `role` リテラルを除いてバイト一致、カラム文字列も完全一致）— **`DYNAMIC-REF`**（`ITEMS_META_*_COLUMNS` は PostgREST に渡す生カラム名文字列）
- [ ] **C2** Recharts の grid/axis/tooltip 定型 — `shared/src/components/Analytics/` の 9 チャート → `ChartFrame` 抽出 — 削減 **110〜140 行** / リスク **中**（末尾の `<Tooltip formatter>` がチャート毎に異なる。`formatter` と margin を props で受ける必要あり = 純粋削除ではない）
- [ ] **C3** `isDescendantOf` のバイト一致ツイン — `shared/src/hooks/useNoteTreeMovement.ts:17-50` を `shared/src/utils/getDescendantTasks.ts:50-84` にジェネリック化して統合 — 削減 **34 行** / リスク **低**（ただし `shared/tests/useNoteTreeMovement.cycle.test.ts:2` が名前で import しているので再 export か import 差し替えが必須。怠ると KI-016 の循環テストが無言で無効化される）
- [ ] **C4** `YYYY-MM-DD` 自前フォーマッタ 4 コピー — `web/src/analytics/AnalyticsScreen.tsx:67-76` / `web/src/daily/DailyView.tsx:41-53` / `web/src/schedule/scheduleLabels.ts:59-66` / `shared/src/hooks/useScheduleItemsAPI.ts:51-57` — 削減 **38 行** / リスク **中**（4 本とも生の `new Date()` から「今日」を出しており **day-start-hour ロールオーバー設定（#218）を無視している**。`todayDateKey()` に差し替えると深夜 2 時のエントリが前日に移る = 挙動変更。`formatDateKey(new Date())` なら挙動保存。呼び出し元ごとに判断）
- [ ] **C5** スタイル定数の重複 — `FOCUS_RING`(9 箇所) / `FIELD`(4) / `STATUS_ICON`(3) / `STATUS_ORDER`(2) / `statusLabel` switch(2) — 削減 **約 47 行** / リスク **中** — **`DYNAMIC-REF`**（Tailwind クラス文字列。`web/src/index.css:14` が `@source ../../shared/src` を宣言しているため、web↔shared 間で文字列を移すと生成されるユーティリティが変わり得る）
- [ ] **C6** `formatDateKey` の名前衝突 — `shared/src/utils/dateKey.ts:6`（`Date` 1 引数）と `shared/src/utils/scheduleGridLayout.ts:226`（y/m/d 3 引数）。**削減 0 行だが C4 の前提条件**。ルート barrel が公開しているのは後者のみ / リスク **低**（先にリネーム）
- [ ] **C7** `SelectedNodeCard.tsx:108-125` と `mobile/NodeDetailSheet.tsx:104-119` の `submitLink` 13 行一致 → `resolveLinkTarget()` 抽出 — 削減 **13 行** / リスク **低**
- [ ] **C8** `SegmentedControl.tsx:42-55` と `SegmentedToggle.tsx:45-58` のキーボードハンドラ 14 行 — 削減 **14 行** / リスク **中**（ARIA ロールが意図的に別（tablist/tab vs radiogroup/radio）なのでハンドラのみ抽出可・コンポーネント統合は不可）
- [ ] **C9** ~~`useNoteTreeMovement` / `useTaskTreeMovement` の統合（約 150 行）~~ — **非推奨**。`useTaskTreeMovement.ts:107-108` にはソフト削除ノードの移動拒否ガードがあり note 側には無い、かつ親型チェックが反転している。統合すると note の移動セマンティクスが無言で変わる / リスク **高**
- [ ] **C10** ~~`web/src/wikitag/LinkPanel.tsx:55-80` を Connect 側の実装に寄せる~~ — **非推奨**。英語ハードコード文字列（`:60`,`:69`）・既リンクガード欠落・`onCreateLink` コールバックではなく直接 `wiki.createItemLink` 呼び出しと 3 点ドリフト。統合前に i18n とガードの同等化が必要 / リスク **高**

---

## D. 再実測で棄却した報告（採用禁止）

サブエージェント一次報告に含まれていたが、メイン実測で**偽と判明**した項目。同じ誤りを繰り返さないため記録する。

- ❌ **`web/src/wikitag/TagPill.tsx`(61 行) は「参照 none found」→ 誤り**。`web/src/wikitag/TagPicker.tsx:7,140` が import して描画している。**削除不可**
- ❌ **「i18n 孤児は約 645 キー」→ 過小**。実測 1,568 キー（動的到達 11 を引いて約 1,557）
- ❌ **「i18n 総キー数 2,051 / 完全死亡 58 namespace / 1,188 キー」→ 不正確**。実測は **2,056 キー / 50 namespace / 1,046 キー**
- ❌ **「DataService の未参照メソッドは 134」→ 不正確**。実測 **142**（`grep -F -o` の部分一致で甘めに数えた保守側の値なので、真の死骸は 142 以上）
- ❌ **`prototype/` 15,085 行 → 誤り**（自分の初回計測が `xargs` のバッチ分割で切れていた）。正: **20,889 行 / 42 ファイル**

---

## Flagged — 削除候補ではないが要対応（別 Issue）

- ⚠️ **`supabase/migrations/0020_life_tags_folder_migration.sql:55-100` の `life_tags_migration_log`**（14 カラム / 5 index / 4 RLS）— コード参照は **none found** だが、`:52-54` が「folder→tag / 新規タグ / 作成 assignment / notes の re-root 退避先はここにしか無い」と宣言するロールバック台帳。**アプリから見えないのは設計通り。絶対に DROP しない**
- ⚠️ **`mcp-server/` が DROP 済みテーブルを叩いている** — `FROM schedule_items`(15) / `FROM tasks`(12) / `FROM notes`(9) / `FROM dailies`(5) の計 41 文。これらは全て `supabase/migrations/0007_drop_legacy_item_tables.sql:71-79` で DROP 済み。`mcp-server/src/db.ts:1` は `better-sqlite3` でローカル `.db` を見ているため「動くが実データと乖離」。**デッドコードではなくバックエンド乖離。Tier 1 機能なので削除せず Issue 化**
- ⚠️ **MCP のファイル系 7 ツール**（`list_files` `read_file` `write_file` `create_directory` `rename_file` `delete_file` `search_files`・約 200 行）— File Explorer 機能は退役したが、MCP ツールは UI ではなく Claude Code に対する提供なので自動退役しない。**ユーザー判断待ち**
- ⚠️ **`.claude/docs/requirements/tier-1-core.md:270-332`（Database 章 63 行）** — `.claude/CLAUDE.md:114` が「requirements 本体は保持」と明記しているため**削除しない**。ただし `:274` が削除済みの `frontend/src/components/Database/` と `src-tauri/.../database_commands.rs` を指しているので、`rules/docs-consistency.md` §2 に従い「retired」注記を足すのが正しい対応
- ⚠️ **`.claude/docs/requirements/tier-2-supporting.md:209`** — `src-tauri/src/commands/{files,attachment}_commands.rs` を退役注記なしで参照。`scripts/docs-lint.sh` の検査対象外（相対リンク存在 / `notion-`・`ink-` トークン / plan Status enum のみ）なので機械検出されない
- ⚠️ **削除しないこと（誤爆注意）**: `shared/tests/sections.test.ts:30` の `expect(SECTION_IDS).not.toContain("terminal")`（退役の回帰ガード）/ `shared/src/utils/platform.ts:34 isNativeMobile`（`mobile/README.md:70` が Mobile 省略 Provider のゲートとして文書化）/ `shared/src/hooks/useDayStartHour.ts`（PR #242 で読み取り側だけ着地・設定 UI 配線は後続 Issue）/ `@tiptap/core` `@tiptap/pm`（`@tiptap/react` の peerDependency）

---

## Steps

| #   | Step                                                                                       | Gate    | Acceptance                                                                       |
| --- | ------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| 1   | A3/A6/A14/A16 — DataService 死にブロック + 付随 3 型ファイル                               | 🤖 自律 | `cd shared && npm run build` exit 0 / `cd web && npm run build` exit 0           |
| 2   | A4/A5/A19/A20/A22/A24 — 未参照シンボル・web 死にファイル                                   | 🤖 自律 | 同上 + `cd shared && npm run test` 全 pass                                       |
| 3   | A11 — `noteLinkMapper` + SupabaseDataService の import/re-export/テスト                    | 🤖 自律 | 同上（テストファイルも同時削除するため test 数の減少を確認）                     |
| 4   | A7/A15/A17 — 他レーンと調整が要る 3 件                                                     | 👀 目視 | layout v2 / life-tags レーンに影響なしをユーザーが確認                           |
| 5   | A8+A9 — 凍結 Database の型 + i18n                                                          | 👀 目視 | ビルド 2 種 exit 0 + 「凍結解除予定なし」をユーザーが確認                        |
| 6   | A2/B1 — i18n 完全死亡 50 namespace 一括削除                                                | 🤖 自律 | ビルド 2 種 exit 0 + en/ja のキー数が一致（下記スクリプト）                      |
| 7   | B2/B3/B4/B6 — namespace 内の孤児キー（キー単位編集）                                       | 👀 目視 | 同上 + 主要画面に生キー文字列が出ないことを chat-main が実ブラウザで確認         |
| 8   | A10/A12/A13/A21/A23/A25 — リポジトリ周辺の残骸                                             | 🤖 自律 | `cd web && npm run build` exit 0 / CI 緑                                         |
| 9   | A18 — `stop-check.sh` は削除ではなく修理（`${CLAUDE_PROJECT_DIR}` 相対 + shared/web 対象） | 🛑 人手 | ユーザーが `.claude/settings.json` の方針を決定                                  |
| 10  | A1 — `prototype/` 全削除                                                                   | 🛑 人手 | ユーザーが「ClaudeDesign fan-out で置換済み・凍結原本は git 履歴で足りる」と判断 |
| 11  | A26 — ルート `typescript` devDep                                                           | 👀 目視 | IDE の型補完が壊れないことをユーザーが確認                                       |
| 12  | C1/C3/C6/C7 — 低リスクな重複統合                                                           | 🤖 自律 | ビルド 2 種 exit 0 + `cd shared && npm run test` 全 pass                         |
| 13  | C2/C4/C5/C8 — 要判断の重複統合                                                             | 👀 目視 | 挙動変更の有無をユーザーが確認（特に C4 の day-start-hour）                      |
| 14  | Flagged 群の Issue 起票                                                                    | 🛑 人手 | chat-main が `issue-dispatch` で起票                                             |

### Gate 凡例

- **🤖 自律** — Claude が完結。型検査 / テストで品質担保
- **👀 目視** — Claude では検証不能（UI 表示 / 他レーンとの整合 / 凍結解除意図）
- **🛑 人手** — ユーザー操作・判断必須（大量削除の承認 / hook 方針 / Issue 起票）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` exit 0（型エラー 0）
- [ ] `cd web && npm run build` exit 0（型エラー 0）
- [ ] `cd shared && npm run test` 全 pass（削除したテストを除き、既存の pass 数が減っていない）
- [ ] `bash scripts/docs-lint.sh` exit 0 — ⚠️ **2026-07-25 時点で既に FAILED**。原因は本計画と無関係の既存違反 1 件（`2026-06-19-step1-desktop-daily-driver.md` の Status 行に enum 外の説明文が付いている）。本計画の着手前か同 PR で先に直すこと
- [ ] i18n の en/ja 対称性が維持されている: `node -e "const f=r=>{const o=require('./shared/src/i18n/locales/'+r+'.json');const a=[];(function w(x,p){for(const k in x){const q=p?p+'.'+k:k;x[k]&&typeof x[k]=='object'?w(x[k],q):a.push(q)}})(o,'');return a.sort()};const e=f('en'),j=f('ja');if(JSON.stringify(e)!==JSON.stringify(j))process.exit(1);console.log('symmetric',e.length)"` exit 0
- [ ] 削除後に `git grep -n "terminal\|fileExplorer\|src-tauri" -- shared/src web/src` が退役ガードテスト（`shared/tests/sections.test.ts:30`）と移植元コメント以外にヒットしない
- [ ] `git grep -c "TagPill" -- web/src` が 0 に**ならない**（D の誤削除ガード）
- [ ] 各 Step の PR diff が削除 100% であること（追加行 0 — リファクタでない純粋削除 Step 1-11 に限る）: `git diff --numstat main...HEAD | awk '{a+=$1} END {exit a>0}'`
- [ ] 完了・退役・supersede 時: 本 plan と per-chat memory の Status を更新した

---

## DB Migration Notes

**本計画に DDL は含まない。** §B8 と Flagged で挙げた DB オブジェクトは候補の記録のみで、実行は別 PR とする。

実行する場合の手順（MANDATORY）:

1. `supabase migration new <name>` でローカルファイル作成（Claude 実行可）
2. Claude が SQL を記入
3. **ユーザーが** `supabase db push`（**`apply_migration` MCP の単独使用禁止** = schema drift 確定）
4. 適用後、Claude が `list_tables` で確認

- `supabase/migrations/0007_drop_legacy_item_tables.sql:16-22` に「非タイムスタンプ命名（`0001..`）が原因で `supabase db push` が無言 no-op になった」履歴がある。**適用されたことを確認してから次に進む**
- `.mcp.json` の Supabase MCP は `--read-only` 構成

---

## Risks / Known Issues 参照

- 最大のリスクは **i18n**: 削除漏れではなく「動的に組み立てられるキーを静的 grep で孤児と誤判定して消す」方向。B5 の 11 キーが実例。クラッシュせず生キー表示になるだけなので **CI では検出できない**（Step 7 が 👀 目視な理由）
- 二番目は **他レーンとの競合**: A7（layout v2）/ A17（life-tags 統合）/ A20（Connect グラフ）は進行中レーンのファイルに触る。着手前に `gh issue list --label section:<id> --state open` と `--label shared-fix` を確認する（CLAUDE.md §7.4）
- 本監査で新規に判明した**バグ候補**（削除とは別に Issue 化）: (1) `savePositions` は書くが `loadPositions` を誰も呼ばない = Connect グラフのノード位置が復元されない疑い、(2) `stop-check.sh` が 100% no-op なのに docs は稼働中と記述、(3) `mcp-server` が DROP 済みテーブルを参照
- `docs/known-issues/INDEX.md` を grep して類似事例を確認すること（特に KI-016 = 循環参照ガード。C3 がこのテストを無効化し得る）

---

## References

- SSOT: `.claude/2026-05-04-cross-platform-migration.md`（移行 Phase・退役判断）
- vision: `.claude/docs/vision/coding-principles.md` / `.claude/docs/vision/db-conventions.md` §10
- 規約: `.claude/rules/docs-consistency.md`（§1 数値の非複製 / §2 改名・退役 sweep / §5 サブエージェント実測必須則）
- 前フェーズ: `.claude/docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md`
- 関連レーン: `2026-07-11-life-tags-unification.md`(A17) / `2026-07-11-layout-standard-v2.md`(A7) / `2026-07-04-claudedesign-screen-design-fanout.md`(A1)
- related skills: `session-verifier`（各 Step の検証）/ `issue-dispatch`（Flagged の起票 — chat-main 専用）

---

## Worklog

- **2026-07-25** — 監査実施（削除は未実行）。6 観点でサブエージェントをファンアウトし、全採用値をメインで再実測。実測により一次報告から 5 件の誤りを棄却（§D）。特に `TagPill` は「参照なし」と報告されたが実際は `TagPicker` が使用しており、そのまま採用していれば動作中のコンポーネントを削除していた。`rules/docs-consistency.md` §5 の実測必須則が機能した実例として記録する。
- **2026-07-25（実行）** — 全 Step 実行完了。PR 対応: Steps 1-3 + A19 = #338/#339・tracker = #340/#343・Steps 6+8 = #341/#342・Step 10(A1) = #344・Step 5(A8+A9) = #345・Step 4(A7/A17) = #346・Step 11(A26) = #347・Step 7(B2/B3/B4/B6) = #348・Step 9(A18) = #349・Step 12(C1/C3/C6/C7) = #350・Step 13(C2/C4/C5/C8) = #351 — 全て 2026-07-25 に merge 済み。役割変更・非実行の記録: A15（walkAncestors）は削除ではなく PR #333 で `useTaskTreeDeletion` に配線され SUPERSEDED / A18 は削除ではなく修理（未追跡ファイル検知 + node_modules 未導入ガード付きで復活）/ C9・C10 は計画どおり非推奨のまま非実行 / §B8 の DB カラム・DDL は計画どおりスコープ外のまま未実行。role-qa 敵対監査 2 本（削除系 6 PR / リファクタ系 2 PR）PASS・Blocker 0。
- **2026-07-25（実測訂正 — outbox 報告の転記）** — C4: 「4 コピー」のうち実行時点の生存は 2 のみ（scheduleLabels は shared 移設済み・useScheduleItemsAPI は todayCalendarKey 化済み）。C6: 「root barrel が公開するのは 3 引数版のみ」は逆 — root barrel が公開するのは dateKey の 1 引数版で、3 引数版は schedule サブ barrel のみ（外部消費者ゼロ）。なお main では `export *` 連鎖で 2 系統が root barrel に流入し 1 引数版が勝つ状態だったため、リネームは潜在バグ除去を兼ねた。C2: ChartFrame 抽出は recharts の child-type フィルタと相性が悪く prop 定数方式で実施・対象チャートは 9 ではなく 10（ProjectWorkTimeChart 含む）。A21: 「削除 8 行」は実測 9 行（`# Tauri` ブロック直前の空行を含めて削除）。Step 7 実測: 削除 552 キー / en・ja 各 −715 行（materials は計画の 4 → 13。B5b の `materials.tags.tagsCount` は画面刷新で呼び出し元消滅）。B5 の `section.tags` は現状どの動的経路からも到達不能（保護は安全側の誤りとして維持）。
- **2026-07-26（COMPLETED 化・chat-main）** — Step 14（Flagged 群の Issue 起票）完了: mcp-server DROP 済みテーブル参照 = #360 / Connect 位置復元の要否 = #361 / MCP ファイル系ツール退役判断 = #362 / docs 追随 sweep = #363 / web eslint CI = #364。Acceptance Criteria は各 Step PR の CI（shared/web build + vitest + en/ja 対称性スクリプト）で担保・Step 7 の実ブラウザ目視（生キー露出チェック）のみ chat-main の実測バックログに残存。本ファイルは code-reduction worktree（dev クローン）に git 未追跡のまま残っていたものを chat-main が回収し、Status: COMPLETED で `archive/` へ収録した（PR #377 同梱）。
