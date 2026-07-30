---
Status: IN PROGRESS — Step 0〜4 と 5-a / 5-d は実装済み。Step 5-b / 5-c / 6 / 7 が open（#466 / #467 / #468 / #469・Epic #290 も open）。判定 = #474（2026-07-30 実測）
Created: 2026-07-14
Owner-chat: chat-main 采配（Step 0 = schedule-redesign-step0 worktree で実施済み。Step 1 以降は Issue dispatch で分配）
Branch: claude/schedule-redesign-step0（Step 0 のみ）
---

# Plan: Schedule 再設計 — 「今日を組む場所」化

> **出自**: 2026-07-13 Cowork セッションの引き継ぎ文書（旧 `schedule-session-handoff.md`・main リポジトリに untracked で存在）を、2026-07-14 の全決定確定を受けて正式計画書化したもの。旧 handoff は本書に吸収済みで削除してよい。
> **決定状況**: 6 問回答 + GCal 路線変更 + 抽出条件（案 c）まで**全て確定済み**（2026-07-14 ユーザー承認）。実装から始められる状態。
> **対象リポジトリ**: `sunbreak-pro/life-editor`
> **姉妹文書**: `schedule-redesign.html`（朝刊様式の読み物版。人間向け・リポジトリ外。内容は本書と同一の分析 + 決定録）

---

## 1. 中心思想（確定済み）

**Schedule は「今日を見る場所」から「今日を組む場所」へ。**

- ループの中での位置づけ: **朝刊（Briefing）= 読む → Schedule = 組む → Work = 没入する → 夕刊 = 閉じる**
- 朝刊が「今日の予定の表示先」になったので、Schedule は閲覧責務を朝刊に譲り、**編集（タイムブロッキング）に特化**する（「約束」は 2026-07-16 F-4 #261 で「予定」へ表示改名）
- デザインは既存の Schedule デザインブリーフ（`.claude/docs/design/briefs/schedule.md`）と lumen トークンに従う。**エンティティ色符号は既に task=blue / routine=藍（#ebf0fe/#3b5bdb）/ event=紫（#f3e8ff/#6d28d9）と定義済み** — デザイン側は「タスクが日面に載る日」を既に待っている

---

## 2. コード調査で確定した事実（全て main のコードで裏取り済み）

### 2-1. 前回 handoff の訂正（重要）

| 前回の記述                                                                            | 実際（コードの事実）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 「Routine backfill（1週間先まで自動生成）・reconciliation・カスケード削除は実装済み」 | **カスケード削除と detachRoutine のみ配線済み**（**以下は 2026-07-14 時点の実測 = 歴史記録**。その後 `ensureRoutineItemsForDateRange` は #279 で、`reconcileRoutineScheduleItems` は #352 で配線され、残る未配線 3 関数は #352 で削除済み — 現状は Step 4 の Worklog が正）。`useScheduleItemsRoutineSync.ts` の 6 関数中、実アプリから呼ばれるのは `ensureRoutineItemsForDate`（表示中日付の materialise + 当日 diff）だけ。`backfillMissedRoutineItems` / `ensureRoutineItemsForWeek` / `ensureRoutineItemsForDateRange` / `syncScheduleItemsWithRoutines` / `reconcileRoutineScheduleItems` の **5 関数はテスト以外から未呼び出し（デッドコード）**。materialise 済み未来行への Routine 編集の一括伝播は起きない（#185 計画書の 2026-07-12 訂正とも一致） |
| 「DayFlow はタブ帯から外れている可能性 — 要確認」                                     | **DayFlow は退役済み**。live な出現は `prototype/`（出荷外パッケージ）のみ。役割は Desktop の Day ビュー（WeekTimeGrid days=1）+ 右サイドバー「今日の流れ」（AgendaList）+ Mobile の List ビューに分散吸収されている                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

> この訂正は Step 0（2026-07-14）で `tier-1-core.md` §Schedule / `briefs/schedule.md` §1 にも反映済み。

### 2-2. 設計ブリーフ（briefs/schedule.md）の課題リストの現在地

- 解決済み: 課題4（loading/error 状態 → `CalendarTab.tsx:894-914` に実装済み）・課題5（narrow の作成導線 → FAB + QuickCaptureSheet 実装済み）・課題7（週グリッドの幅制限 → max-w-3xl は撤去済み）
- 未解決: 由来可視化の磨き込み・エディタ項目不足（§4-C）

### 2-3. #185「単一アイテム型（Event）+ 繰り返し設定」の移行状況

- **準拠済み**: EventEditorPane に FrequencyEditor 統合（繰り返し設定 → 裏で Routine 生成）、シリーズ編集（Routine を patch）、`detachRoutine`（過去実績を保全して解除）、Issue 017 の相反アクション（routine 由来 = Dismiss のみ / 手動 = 削除のみ）
- **未完**: ①独立「Routines（Repeats）」タブが残存し、Routine が実装詳細として隠蔽しきれていない → **案 B で解消（§5 決定1）** ②系列伝播が「表示中日付の diff」のみ → **reconcile 配線で解消（§5 決定5）**

### 2-4. Task↔Schedule 統合はゼロ（最大のギャップ）

- `TaskNode.scheduledAt / scheduledEndAt / isAllDay` は**型・Mapper・MCP に存在するが、UI（.tsx）での出現は 0 件**
- tier-1 の **Tasks AC7**（scheduledAt → Calendar 表示・双方向）と **Schedule AC10**（ドラッグ変更 → Tasks へ双方向同期）は**未達**
- 孤立 i18n `schedulePanel`（`existingTasks / tabTask / tabEvent / tabRoutine / searchTasks` 等の孤立キー群 — 参照 0 件）が「Task/Event/Routine 一括作成パネル」構想の痕跡として残っている → 本日の Todo トレイ（§4-A-3）の種として再利用可（**2026-07-26 追記 = 歴史記録**: このキー群は PR #341 で削除済み。統合生成パネル #376 は `scheduleScreen.*` に新規キーを起こした — §4.6）
- ※「AC7」は 2 つある（Tasks の AC7 = 双方向同期 / Schedule の AC7 = CalendarTags 色。後者は CalendarTags 全撤去で形骸化 → Step 0 で Retired 化済み）。混同注意

### 2-5. その他の形骸化・未接続（コードの事実）

1. **CalendarView（カレンダー台帳）**: life-tag スコープの CRUD はあるが、**グリッド側にフィルタが一切接続されていない**（事実上の非機能）。i18n 未対応・物理削除のみ → **配線して活かす（§5 決定2）**
2. **RoutineGroup**: `frequencyType="group"` は選べるが**グループ管理 UI が存在せず**、割当対象が常に空（実質機能しない）→ **削除（§5 決定3）**
3. **リマインダー**: `reminderEnabled/reminderOffset` は型と作成 API にあるが UI 皆無（通知基盤も Phase 3 以降）→ 凍結（Step 0 で tier-1 に明記済み）
4. **MCP schedule handler**: 旧 SQLite 単一表のまま **Supabase 未接続**（全 8 handler 共通。#185 Step 6 で切り出し予定のまま）
5. **競合ルール未文書化** → **Step 0 で解消**: 正本 = `tier-1-core.md` §Schedule「競合解決ルール」（実績不可侵 / 手動編集優先 / 発火外未来行の掃除 / detachRoutine 意味論）
6. **Known Issue 009**: Mobile 月セルに dismissed イベントが残存表示
7. **tier-1-core.md の Schedule 節本体は Tauri 期の記述**（3 サブタブ Calendar/DayFlow/Routine 前提）で現行実装と乖離 → **Step 0 で現行化済み**（履歴保持 + 実測注記方式）

---

## 3. 機能仕分け（2026-07-14 決定済み）

| 判定         | 対象                                                                                                                                                                                                                                                 | 備考                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 残す・磨く   | Calendar（Month/Week/Day）・WeekTimeGrid の直接操作（クリック作成/ドラッグ/リサイズ）・右サイドバー「今日の流れ/詳細」・QuickCaptureSheet（Mobile FAB）・detachRoutine の意味論                                                                      | 「組む場所」の土台。ブリーフの「残す意匠」とも一致                    |
| 新設         | タスクの日面表示 + タイムブロッキング（§4-A）・**rightSidebar「本日の Todo」トレイ**（§5 決定6）                                                                                                                                                     | tier-1 Tasks AC7 / Schedule AC10 の本丸。DDL ゼロ                     |
| 縮小（決定） | Repeats 独立タブ → **案 B: 単一 Calendar タブ + 「繰り返しのみ表示」フィルタ + 管理シート**に畳む（#185 補遺として文書化済み — Step 0）・Mobile → **List（今日）+ FAB のみ**（Month/Timeline ビュー撤去）                                            | 「Routine = 実装詳細」を UI 構成まで貫徹。Mobile はブリーフ原文どおり |
| 配線（決定） | カレンダー台帳（CalendarView）→ **グリッドのタグフィルタとして接続**。あわせて i18n 化・ソフトデリート整合                                                                                                                                           | 直近 #239 で folder→life-tag に rebind 済み = 生かす投資判断と整合    |
| 凍結（明示） | リマインダー（型のみ）・GCal 連携（**2026-07-14 路線変更: アプリ内蔵・Claude 側ミラーとも当面しない**。tier-3 凍結のまま）                                                                                                                           | 再開条件は Step 0 で tier-1 / tier-3 に明記済み                       |
| 削除（決定） | **RoutineGroup**（group 頻度の選択肢・関連 UI/フック/サービスメソッド。**DB テーブルは DDL ルールに従い当面残置** = コード撤去のみ）・未配線生成器のうち reconcile 以外（テストごと整理）・孤立 i18n `schedulePanel`（トレイで再利用しないキーのみ） | デッドコードの潜在化を防ぐ                                            |

---

## 4. 実装する要件（優先度順）

- **A. タイムブロッキング（Task↔Schedule 双方向）** — 3 段階:
  - A-1: 読み取り表示 — `scheduledAt` を持つタスクを Week/Day/Month/Agenda に **task=blue チップ**で表示（Briefing と同じ「読み取り側から入る」進め方）
  - A-2: 書き込み — グリッド上のドラッグ/リサイズで `scheduledAt/scheduledEndAt` を更新（= Schedule AC10）
  - A-3: **「本日の Todo」トレイ（§5 決定6）** — rightSidebar に第 3 タブ「本日の Todo」。AgendaList と同じ意匠（Day flow 流用）で、①今日に配置済みのタスク ②未配置の今日候補、の 2 群を表示。完了チェックは TaskTree の完了 API を呼ぶ。タイトルクリックで Tasks セクションへジャンプ（深い編集はツリー側）。トレイ → 日面への配置で scheduledAt 書き込み
    - **抽出条件は案 c「段階式」（確定・§5-8）**: 「今日の候補に追加」= タスクに `scheduledAt=今日 + isAllDay（時刻未定）` を付与するだけ（**DDL ゼロ**）。時刻未定 = 未配置群、ドラッグで時刻を与えると配置済み群へ。朝刊ロードマップ④「宣言 intentions」実装後は宣言タスクもトレイに合流（最終形は宣言駆動）
  - **DDL ゼロ**（scheduledAt 系カラムは既存）。DataService 境界の不変式は維持
  - カレンダーブロック上のタスクは当面**読み取り + 移動のみ**（完了操作はトレイ側。TaskTree のサブツリー意味論と衝突させない）
- **B. Routine 編集の未来伝播** — **`reconcileRoutineScheduleItems` を RoutineScheduleSync に配線する（§5 決定5）**。競合解決ルールは Step 0 で文書化済み（正本 = `tier-1-core.md` §Schedule「競合解決ルール」）— これに沿ってテストを張ってから配線する
- **C. エディタの非対称解消** — EventEditorPane に日付ピッカー・終日トグルを追加（duplicate は `isAllDay/content/noteId` を引き継げるのに編集フォームで触れない非対称の解消）
- **D. MCP schedule handler の Supabase 対応** — 朝刊ロードマップ Step 2（`get_today_context`）と F の前提。#185 Step 6 の切り出し Issue を起票して並走
- **E. 小粒** — Known Issue 009（Mobile 月セルの dismissed 残存）、シリーズ編集時の「系列全体に適用されます」ヒント
- **F. Google カレンダー連携 — しない（2026-07-14 路線変更）** — 本日の Todo は**アプリ内の Task で完結**させる。アプリ内蔵の GCal 連携は tier-3 凍結のまま、一時検討した「Claude 側ミラー」案も見送り。再検討するのは朝刊ループが安定運用に入った後、ユーザーが改めて望んだ場合のみ

## 4.5 タブ構成 — 案 B に決定（§5 決定1）

- **単一 Calendar タブ化**。Repeats はツールバーの「繰り返しのみ表示」フィルタ + overflow の管理シートへ畳む。ヘッダタブ撤去
- #185 の「タブ廃止はしない」の**補遺（改訂）として Step 0 で文書化済み**（`2026-07-11-event-routine-unification.md` UX 仕様 4 補遺）
- 案 C（「今日」/「カレンダー」の 2 タブ再編）は **A-1〜A-3 が育った後に再評価**（再開条件: 本日の Todo トレイ + タスク日面表示が 1 ヶ月回った時点）

## 4.6 「本日の Todo」トレイ と 統合アイテム生成パネルの棲み分け（#376 で確定・2026-07-26）

どちらもタスクを Schedule に載せる導線だが、**答えている問いが違う**。重複ではなく直列（トレイで今日やることを決め → グリッドで時間を与える／パネルで最初から時間ごと決める、の 2 本立て）。

|              | rightSidebar「本日の Todo」トレイ（#298）                          | 統合アイテム生成パネル（#376）                                                             |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 問い         | 「今日やるのはどれか」（**宣言**）                                 | 「この日のこの時間に何を置くか」（**配置**）                                               |
| 対象日       | **今日に固定**                                                     | パネルを開いたジェスチャの対象日（ツールバー = アンカー日／空きスロット・月セル = その日） |
| 書き込む時刻 | なし（`isAllDay: true` = 時刻未定の候補・§5 決定8 の案 c staging） | あり（`scheduledAt` / `scheduledEndAt` の両方）                                            |
| 作れるもの   | 既存タスクの候補化のみ（新規作成はしない）                         | 予定の新規作成／タスクの新規作成／既存タスクの配置                                         |
| 置き場所     | 常設（rightSidebar のタブ）                                        | 一時的（ツールバー ＋／空きスロット／月セル／Mobile FAB で開くモーダル・シート）           |

- **候補プールは同一**（`pickAddableTasks` = 未配置・未完了・葉）。トレイで「今日の候補に追加」したタスクは終日候補になるため、パネルの「既存から選ぶ」一覧からは外れる — そこへ時刻を与える経路は**グリッド上の終日チップのドラッグ**（A-3 の設計どおり）
- 予定（Event）はトレイに現れない（トレイはタスク専用）。逆にパネルは予定とタスクの両方を作れる
- Schedule には**タスクの詳細エディタが無い**（task チップは読み取り専用 — #297）ため、パネルのタスクタブには予定タブのような「追加して詳細へ」の相方を置かない

### ノートタブは「作成対象」ではなく「添付」（#376 ユーザー決定 2026-07-26）

ノートは時刻を持たないので、対象日に「置く」ことができない。したがってパネルのノートタブは 3 つ目の作成対象ではなく、**作られる予定 / タスクに紐づく関連ノートを選ぶ面**とする（「会議を入れる → その議事メモも一緒に用意する」が 1 パネルで完結する）。

- ノートタブを開いても submit の対象は変わらない。パネルは直前に開いていた 予定 / タスク を `target` として覚え続け、フッターのボタンはそのまま
- 紐づけは **item link モデル**（`createItemLink(fromItemId, toItemId)` / `wiki_tag_connections`）。向きは アイテム → ノート で DailyView と同型（日付を持つ側がリンクを所有し、ノート側にはバックリンクとして出る）
- `ScheduleItem.noteId` は型にあるが **書き込み時に捨てられる**（`SupabaseDataService` が `void noteId` — events↔notes は列ではなくリンク）。この事実があるため item link 以外の選択肢は無い
- ノート一覧は Schedule ブランチに `NotesUnifiedProvider` を足さず、**ホスト側フック `web/src/schedule/useCreatePanelNotes.ts` がパネルを開いている間だけ `listNotesUnified()` で引く**。Provider はノート本体・ゴミ箱・本文の hydration まで抱え、Realtime のたび走り直すため、タイトルだけ要る picker には重すぎる（DataService は注入のまま = §3.1 維持）

#### リンクは「行ができてから」書く（#376 QA 監査で確定・2026-07-26）

**`wiki_tag_connections.from_item_id` は `items_meta` への FK で、RLS の INSERT ポリシーもその行の存在を再チェックする。生成パネルの作成経路は楽観的 id を同期で返して裏で書き込むため、「ローカル state にある」は FK 先の存在証明にならない。**作成呼び出しの直後にリンクを撃つと、リンクの INSERT がアイテム自身の INSERT より先に飛ぶ（どちらの writer も `auth.getUser()` の 1 往復から始まるが、リンク側にはその前置きが無い）。既存ノートを選んだ場合は確定で失敗し、`console.error` に飲まれてユーザーには何も出ない。

これは #371 が `shared/src/utils/pendingItemLinks.ts` に明文化した罠と同一で、`DailyView.flushPendingLinks` も「save が解決してから」しか撃たない。#376 は同じ規律を作成経路に通した:

- `useScheduleItemsAPI.createScheduleItem` の `opts.onSaved(saved | null)` — 書き込み解決時に発火
- `useTaskTreeCRUD.addNode` の `options.onSaved(node | null)` — `persistWithHistory / persistSilent → syncToDb` を経由。**undo / redo には渡さない**（redo が sync を再実行するため、渡すと同じノートを二重に紐づける）。`useTaskTreeAPI` の未ロードガードで write が捨てられた場合も `null` を返す（黙って消えた write に後続を続けさせない）
- 既存タスクの「配置」だけは待たない — プールは DB 由来なので行は既にある
- 失敗はトースト（`scheduleScreen.noteAttachFailed`）で必ず知らせる。リンクが張られるのはパネルを閉じた後で、画面上に手がかりが残らないため

pin = `shared/tests/taskTreePersistSettled.test.tsx`

---

## 5. 決定録（2026-07-14 ユーザー回答）

1. **タブ構成** = 案 B 先行。C は A-1〜A-3 後に再評価
2. **カレンダー台帳** = タグフィルタとして配線（「作っても効かない」状態の解消。Claude 推奨をユーザー確認済み扱い — 異議があれば凍結へ変更可）
3. **RoutineGroup** = 削除
4. **Mobile** = ブリーフ原文どおり List（今日）+ FAB に絞る（Month/Timeline 撤去）
5. **Routine 編集の未来伝播** = reconcile を配線する
6. **タスク操作の置き場** = ユーザー提示の 2 案から Claude が選択: **案2「Schedule の rightSidebar に本日の Todo（Day flow と同じ意匠）」を採用**。
   - 理由: ①「今日を組む場所」の主題と一致（Tasks タブへの画面遷移は組むループを切断する） ②ScheduleSidebarTabs + AgendaList という実装土台がそのまま使える ③トレイと日面が同一画面にあることが A-2/A-3（ドラッグ配置）の前提条件 ④Google カレンダー自身の UX とも同型
   - 案1 の利点は「タイトルクリックで Tasks セクションへジャンプ」するリンクとして部分採用
7. **GCal 連携はしない（2026-07-14 路線変更）** — 本日の Todo はアプリ内の Task で完結。一時検討した Claude 側ミラー案も見送り。tier-3 凍結維持
8. **本日の Todo の抽出条件 = 案 c「段階式」（確定 — 2026-07-14 Step 0 着手指示にて「そのまま採用」をユーザー承認）** — 候補追加は「scheduledAt = 今日 + 終日（時刻未定）」で表現（DDL ゼロ）。宣言（intentions）実装後に宣言タスクが合流

**全決定確定済み。仮決定は残っていない。**

---

## 6. 実装ロードマップ（決定反映済み。各 Step = 1 PR 粒度）

1. ✅ **Step 0: 文書の現行化（= 本計画書を追加した PR で実施・2026-07-14）** — 形骸 AC（旧 CalendarTags 前提の Schedule AC7/AC9）の Retired 化、前回 handoff の訂正（§2-1）を tier-1/ブリーフへ反映、競合解決ルールの文書化（tier-1 §Schedule）、**#185 補遺（Repeats タブ → 案 B）の決定記録**、RoutineGroup 削除・リマインダー凍結・GCal 見送り + 再開条件の明記
2. ✅ **Step 1: タスクの読み取り表示（A-1）— 実装済み（2026-07-15・chat-docs-workspace）** — `shared/src/components/schedule/{WeekTimeGrid,MonthGrid,AgendaList}` に task variant 追加、`CalendarTab` で scheduledAt タスクを取得して合流。**AC**: scheduledAt を設定したタスクが Week/Day/Month/今日の流れに blue チップで表示される。既知の限界: Week/Day の全日レーンは既存仕様どおり variant 非依存の描画（終日タスクは青くならない — Step 2 で variant 色を通すか要件側で明文化）
3. ⬜ **Step 2: 双方向書き込み（A-2）** — ドラッグ/リサイズ → `updateTaskNode(scheduledAt/scheduledEndAt)`。**AC**: Schedule AC10 が通る（どちらで編集しても双方に反映）
4. ⬜ **Step 3: 「本日の Todo」トレイ（A-3・決定6）** — ScheduleSidebarTabs に第 3 タブ。配置済み/未配置の 2 群、「候補に追加」= scheduledAt 今日 + 終日（案 c）、完了チェック = TaskTree API、Tasks へのジャンプリンク、トレイ → 日面配置。**AC**: 終日で追加したタスクが未配置群に現れ、日面への配置で時刻付き scheduledAt が書き込まれ、完了チェックが TaskTree に反映される
5. ✅ **Step 4: 伝播の配線 + 掃除（B・決定5）— 実装済み（2026-07-26・chat-schedule-refine / #352）** — `reconcileRoutineScheduleItems` を繰り返し設定の編集（`handleChangeRepeat` の routine 分岐）に配線し、競合ルール（tier-1 §Schedule 1-3）を vitest で pin。未配線だった 3 関数（`ensureRoutineItemsForWeek` / `backfillMissedRoutineItems` / `syncScheduleItemsWithRoutines`・起票時の「4 関数」は reconcile 込みの数で、実測では reconcile 以外は 3 本）+ `fetchLastRoutineDate` + `diffRoutineScheduleItems` の `toUpdate` バケット + RoutineGroup コード一式を削除（**DB テーブル・0008 CHECK は残置 = DDL なし**）。**AC**: Routine の頻度変更が materialise 済み未来 occurrence に伝播し、手動編集分は上書きされない（時刻 / タイトルの伝播は #279 の範囲選択ダイアログ経由 = 既存経路）
6. ⬜ **Step 5: 構成再編（決定1・4）** — 案 B（単一 Calendar タブ + 繰り返しフィルタ + 管理シート）、Mobile を List（今日）+ FAB に絞る（Month/Timeline 撤去）。i18n en/ja 同時更新。**AC**: ヘッダタブが消え、繰り返し一覧はフィルタ/シートから到達できる。Mobile は単画面 + FAB のみ
7. ⬜ **Step 6: カレンダー台帳の配線（決定2）** — グリッドにタグフィルタ（ツールバーのカレンダーチップ）、CalendarView の i18n 化・ソフトデリート整合。**AC**: カレンダー選択で Week/Month の表示が絞り込まれる
8. ⬜ **Step 7: エディタ拡充 + 小粒（C・E）** — 日付ピッカー・終日トグル・「系列全体に適用」ヒント・Issue 009
9. ⬜ **並走 α: MCP Supabase 化（D）** — Issue 起票から。朝刊ロードマップ Step 2（get_today_context / write_briefing）の起点

**共通ゲート**: DDL ゼロ（全 Step）/ shared `tsc -b` + vitest / web `tsc -b` + `vite build` / lumen トークンのみ・透明度禁止・en/ja 両 catalog / DataService 境界維持 / 実ブラウザ検証は chat-main（merge 後）

---

## 7. 参照パス（正典）

- 画面: `web/src/schedule/{ScheduleScreen,CalendarTab,CalendarView,RoutineScheduleSync}.tsx`（`RoutinesTab.tsx` は Step 5-a / #408 で退役。繰り返し一覧は rightSidebar の `RepeatListPanel`）
- 部品: `shared/src/components/schedule/`（WeekTimeGrid / MonthGrid / AgendaList / EventEditorPane / FrequencyEditor / ScheduleSidebarTabs ほか）
- 生成器: `shared/src/hooks/useScheduleItemsRoutineSync.ts` + `shared/src/utils/{routineScheduleSync,routineFrequency}.ts`
- サービス: `shared/src/services/SupabaseDataService.ts`（softDeleteRoutine / detachRoutine）
- 要件: `.claude/docs/requirements/tier-1-core.md`（Tasks AC7 / Schedule AC 群 / **競合解決ルール**）
- 決定: `.claude/CLAUDE.md` §4（#185 不変式）・`.claude/archive/2026-07-11-event-routine-unification.md`（COMPLETED・#474 で archive 移動）・`.claude/docs/design/IA.md`・`.claude/docs/design/briefs/schedule.md`
- 注意: `.claude/skills/schedule-management/` は**開発運用スキルであり本機能と無関係**（混同注意）

---

## Worklog

- 2026-07-14: **Step 0 実施（worktree schedule-redesign-step0）**。旧 handoff（`schedule-session-handoff.md`）を本計画書として正式化（案 c 確定を反映）。docs 追随: `tier-1-core.md`（Schedule Status 更新・再設計注記・backfill/reconciliation の実測訂正・AC1/AC2/AC8/AC10 注記・AC7/AC9 Retired 化・競合解決ルール新設・RoutineGroup 削除とリマインダー凍結の明記・GCal 見送り + 再開条件・Tasks AC7 未達注記）/ `2026-07-11-event-routine-unification.md`（UX 仕様 4 補遺 = 案 B タブ畳み込み・RoutineGroup 削除決定・Worklog）/ `tier-3-experimental.md`（GCal Verdict 凍結化 + 再開条件）/ `briefs/schedule.md`（backfill 訂正・RoutineGroup 削除注記）
- 2026-07-14: role-qa 監査（事実主張 全 PASS・Should 3 / Nit 2）を反映 — tier-1 の「3 サブタブ UI」行と Dependencies「Google Calendar (ICS → OAuth)」行に見送り注記を追加（現行化 sweep 漏れ）、競合解決ルール #4 に detachRoutine の S-1 意味論（生存 occurrence の `routine_item_id` NULL 化）を補記、本書 §2-4 の i18n キー個数直書きを削除（数値の非複製原則）。Nit-2（briefs/schedule.md 主要操作行の退役ファイル名参照 — 既存 stale）は次のブリーフ更新時に対応
- 2026-07-15: **Step 1 実装（chat-docs-workspace・ユーザー直接指示）**。純変換ヘルパー `shared/src/utils/taskCalendarChips.ts`（UTC ISO → ローカル date/HH:MM・終日 / 60 分デフォルト・deleted 除外・done は completed 保持・複数日は開始日のみ）+ 3 コンポーネントに `"task"` variant（blue トークン `chip-task-*` / 新設 `schedule-task-bg`・Repeat グリフ / 左バンドなし）+ `MainScreen` schedule 分岐最外に `TaskTreeProvider` + `CalendarTab` 派生層マージ（`taskchip-` prefix で select/toggle/move/resize/contextMenu 全 no-op・`rangeItems` 非混入）。i18n `scheduleScreen.originTask`（en/ja 追加済み・配線は Step 2/3 で消費予定の先行キー）。shared vitest 891 pass / shared・web tsc -b green / web vite build green。role-qa 監査 PASS（Blocker 0・終日全日レーンの色は既存パリティで Step 2 送り）。実ブラウザ検証は merge 後 chat-main
- 2026-07-26: **Step 4 実装（worktree schedule-refine・#352）**。`reconcileRoutineScheduleItems` を `useScheduleMutations.handleChangeRepeat` の routine 分岐に配線（テンプレ更新 → 可視範囲 reconcile → reload）。reconcile 本体を競合ルール準拠に改修: done / dismissed / 過去 / 手動移動（`source_date` ドリフト）に加え、**編集前テンプレート（title / startTime / endTime）と不一致 = 手動編集**の行を掃除対象から除外（時刻 null は生成デフォルト 09:00-09:30 を実効値として比較 — #279 と同じ規則）。生成側は `collectRoutineItemsForDates` に委譲して deleted/archived/hidden ガードを継承し、過去日への materialise を禁止。書き込みゼロなら `onChanged` を発火しない。**削除**: 未配線 3 関数（`ensureRoutineItemsForWeek` / `backfillMissedRoutineItems` / `syncScheduleItemsWithRoutines`）+ 専用 `fetchLastRoutineDate` + `diffRoutineScheduleItems` の `toUpdate`（#279 で適用停止済み）+ RoutineGroup 一式（型 / mapper 2 本 / DataService 6 メソッド / Supabase サービス 2 クラス / `groupForRoutine` / FrequencyEditor の group UI / i18n `frequencyGroup`・`groupsLabel` / 関連テスト）。**DDL ゼロ**のためテーブルと 0008 CHECK の `'group'` は残置 — `normaliseFrequency` が legacy 行を「発火しない routine」に正規化（throw させると routine 一覧全体が壊れるため）、`REALTIME_TABLES` も publication と一致させるため 2 テーブルを維持（lockstep テストの不変式）。新規 vitest `shared/tests/reconcileRoutine.test.tsx`（競合ルール 1-3 / 再生成 / 掃除範囲 / 変更シグナル。ケース数はテストファイルが正）。shared・web tsc -b green / web vite build green。実ブラウザ検証は merge 後 chat-main
- 2026-07-26: **Step 4 の role-qa 監査対応（同 PR 内）**。Blocker 1 件 + Should 3 件を反映。**(B-1)** 頻度タイプ切替は `{ frequencyType }` 単体で届くため、weekdays→曜日未選択（発火ゼロ）/ interval→未設定（毎日発火）という中間状態がそのまま reconcile に渡り、曜日を選ぶ前にシリーズの未来が一掃される経路があった（reconcile 配線で新たに生じたリスク）→ 純粋関数 `seedFrequencyPatch`（`utils/routineFrequency.ts`）で切替時に anchor 日の曜日 / interval=1 + 開始日を補完し、Calendar・Routines 両導線に適用。あわせて**掃除範囲を再生成範囲と対称化**（`fetchScheduleItemsByRoutineId` は日付フィルタを持たず全期間を返すため、`dateRange` 指定時は掃除も窓内に限定 — 窓外は表示時に `ensureRoutineItemsForDateRange` が拾う）。**(S-1)** Routines タブ（`RoutineEditorForm` の頻度編集）が未配線だったため配線（窓 = 今日から 6 週間 = 月グリッド最大幅）。**(S-2)** `updateRoutine` が fire-and-forget でテンプレ更新の失敗を握り潰し、失敗しても reconcile が走って「テンプレは旧頻度 / 実体は新頻度」のねじれを作り得たため、`Promise<boolean>` を返して landed=false なら reconcile を中止（既存の fire-and-forget 呼び出し側は無変更）。**(S-3)** reconcile の JSDoc が「bulkCreate の upsert / ignoreDuplicates が dismissed 日の再生成を吸収する」と書いていたが実装は plain INSERT + 事前 live pre-check（衝突時は 23505 でバッチ全体がロールバック）で真逆だったため実体に訂正。**(S-4)** rule 2 の判定に memo を含まない点を tier-1 に明記。shared vitest 1067 pass / shared・web tsc -b green / web vite build green / web lint green
- 2026-07-26: **統合アイテム生成パネル Step A 実装（worktree schedule-refine・#376）**。#299 の `EventCreateFields`（予定専用）を `shared/src/components/schedule/ItemCreatePanel.tsx` に置換し、Desktop 生成オーバーレイと Mobile QuickCaptureSheet の両方が同一パネルを描くようにした。**予定タブ** = 従来どおり（#299 の prefill / #353 の対象日行 / #354 の 2 ボタン契約をテストごと継承）。**タスクタブ** = 「新規作成」（`addNode("task", null, title, { scheduledAt, scheduledEndAt, isAllDay:false })`）と「既存から選ぶ」（`pickAddableTasks` プール + 部分一致検索 → `updateNode` で同じ配置を書き込み）の 2 ソース。タイトル / 時刻の下書きは種類タブを跨いで共有（途中で「これは予定じゃなくタスクだ」と気づいても打ち直しにならない）。検索で選択行が絞り落ちたら選択も落とす（見えないタスクを配置しない）。タスクタブに「追加して詳細へ」の相方は置かない（Schedule にタスク詳細エディタが無い — #297）。`QuickCaptureSheet` はパネルの純粋な枠に縮小し、閉じるのはホスト責務に一本化（二重クローズの排除）。i18n は `scheduleScreen.*` に新規 13 キー（en/ja）+ 孤立化した `quickAddTitle` を削除、空プール文言は `todoEmptyAddable` を再利用。**#298 トレイとの棲み分けを §4.6 に明文化**（トレイ = 宣言 / パネル = 配置）。新規 vitest `shared/tests/itemCreatePanel.test.tsx` + `quickCaptureSheet.test.tsx` 改訂。shared vitest 1117 pass / shared・web tsc -b green / web vite build green。**DDL ゼロ**。ノートタブ（新規 / 既存検索 → 作成アイテムへ `createItemLink`）は Step B の子 PR に分割。実ブラウザ検証は merge 後 chat-main
- 2026-07-27: **#407 繰り返し表示不整合の修正（worktree schedule-refine・PR #423）**。上の 2026-07-26 監査対応行にある「interval→未設定（**毎日発火**）」という中間状態の読みは**本修正で「発火しない」（fail-closed）に変更**（`shouldRoutineRunOnDate` の interval 分岐 — malformed 設定は `default` 分岐と同じく never fire。Issue 017 の暴走生成ガードと同思想）。あわせて Event→Repeats 変換の二重実行ガードを 2 層追加: サーバー側 = `convertEventToRoutine` の attach を `routine_item_id IS NULL` 条件付き UPDATE + 読み戻しにし、負けた変換は routine をロールバックして reject（ロールバック失敗も `logServiceError` で可視化）／クライアント側 = `convertingSeedsRef`（in-flight ガード・try/finally 解放）。`FrequencyEditor` の date input は空文字を emit しない（"" が永続化すると fail-closed で「発火しない」化し、#352 の reconcile が未来行を掃除してしまうため）。`seedFrequencyPatch` は "" も未設定として補修。routine 不在 fallback（Calendar / Routines 両導線）も seeding を通す
- 2026-07-26: **統合アイテム生成パネル Step B 実装（worktree schedule-refine・#376・同一 PR に同梱）**。ノートタブを追加。**作成対象は増やさず「添付」として実装**（§4.6 後半 = ユーザー決定）: パネルは直前に開いていた 予定 / タスク を `target` として保持し、ノートタブを開いてもフッターの submit は変わらない。ノートタブで「新規作成」（タイトル入力）または「既存から選ぶ」（`listNotesUnified` の一覧 + 部分一致検索）を staged し、submit 時に 4 番目の引数 `ItemCreateNoteDraft | null` として渡す。ホスト（`web/src/schedule/useCreatePanelNotes.ts`）が新規なら `createNoteUnified` で作ってから `createItemLink(itemId, noteId)` を張る（向き = アイテム → ノート・DailyView と同型）。staged なノートは 予定 / タスクタブにもチップで出す（ノートタブは 1 クリック先なので、確定の瞬間に添付が見えないのを避ける）。空タイトルは staged しない（開いて気が変わっただけで "Untitled" を作らない）。ノート一覧は Provider を足さずホストが**パネルを開いている間だけ**引く（Provider は本文 hydration とゴミ箱まで抱え Realtime のたび走り直すため、タイトルだけの picker には重い）。picker は task / note で共通の `PickerList` に括り出し、選択は現在の検索結果を通して解決（絞り落ちた行は選択も落ちる）。i18n `scheduleScreen.*` にノート系 9 キー（en/ja）追加 + `taskSource*` → `source*` に改名（task / note で共用するため）。`generateId` を shared のルート export に追加（Provider を介さず DataService に直接書くホストが ID 不変式を守れるように）。shared vitest **1124 pass** / shared・web tsc -b green / web vite build green / web lint は既存 1 件のみ（`NotesView.tsx:268`）。**DDL ゼロ**。実ブラウザ検証は merge 後 chat-main
