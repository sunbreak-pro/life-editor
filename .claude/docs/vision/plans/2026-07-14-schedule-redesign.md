---
Status: IN PROGRESS
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
- 朝刊が「今日の約束の表示先」になったので、Schedule は閲覧責務を朝刊に譲り、**編集（タイムブロッキング）に特化**する
- デザインは既存の Schedule デザインブリーフ（`.claude/docs/design/briefs/schedule.md`）と lumen トークンに従う。**エンティティ色符号は既に task=blue / routine=藍（#ebf0fe/#3b5bdb）/ event=紫（#f3e8ff/#6d28d9）と定義済み** — デザイン側は「タスクが日面に載る日」を既に待っている

---

## 2. コード調査で確定した事実（全て main のコードで裏取り済み）

### 2-1. 前回 handoff の訂正（重要）

| 前回の記述                                                                            | 実際（コードの事実）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 「Routine backfill（1週間先まで自動生成）・reconciliation・カスケード削除は実装済み」 | **カスケード削除と detachRoutine のみ配線済み**。`useScheduleItemsRoutineSync.ts` の 6 関数中、実アプリから呼ばれるのは `ensureRoutineItemsForDate`（表示中日付の materialise + 当日 diff）だけ。`backfillMissedRoutineItems` / `ensureRoutineItemsForWeek` / `ensureRoutineItemsForDateRange` / `syncScheduleItemsWithRoutines` / `reconcileRoutineScheduleItems` の **5 関数はテスト以外から未呼び出し（デッドコード）**。materialise 済み未来行への Routine 編集の一括伝播は起きない（#185 計画書の 2026-07-12 訂正とも一致） |
| 「DayFlow はタブ帯から外れている可能性 — 要確認」                                     | **DayFlow は退役済み**。live な出現は `prototype/`（出荷外パッケージ）のみ。役割は Desktop の Day ビュー（WeekTimeGrid days=1）+ 右サイドバー「今日の流れ」（AgendaList）+ Mobile の List ビューに分散吸収されている                                                                                                                                                                                                                                                                                                             |

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
- 孤立 i18n `schedulePanel`（en/ja に `existingTasks / tabTask / tabEvent / tabRoutine / searchTasks` 等の孤立キー群 — 参照 0 件・個数はコードが正）が「Task/Event/Routine 一括作成パネル」構想の痕跡として残っている → 本日の Todo トレイ（§4-A-3）の種として再利用可
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

| 判定         | 対象                                                                                                                                                                                                                                                          | 備考                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 残す・磨く   | Calendar（Month/Week/Day）・WeekTimeGrid の直接操作（クリック作成/ドラッグ/リサイズ）・右サイドバー「今日の流れ/詳細」・QuickCaptureSheet（Mobile FAB）・detachRoutine の意味論                                                                               | 「組む場所」の土台。ブリーフの「残す意匠」とも一致                    |
| 新設         | タスクの日面表示 + タイムブロッキング（§4-A）・**rightSidebar「本日の Todo」トレイ**（§5 決定6）                                                                                                                                                              | tier-1 Tasks AC7 / Schedule AC10 の本丸。DDL ゼロ                     |
| 縮小（決定） | Repeats 独立タブ → **案 B: 単一 Calendar タブ + 「繰り返しのみ表示」フィルタ + 管理シート**に畳む（#185 補遺として文書化済み — Step 0）・Mobile → **List（今日）+ FAB のみ**（Month/Timeline ビュー撤去）                                                     | 「Routine = 実装詳細」を UI 構成まで貫徹。Mobile はブリーフ原文どおり |
| 配線（決定） | カレンダー台帳（CalendarView）→ **グリッドのタグフィルタとして接続**。あわせて i18n 化・ソフトデリート整合                                                                                                                                                    | 直近 #239 で folder→life-tag に rebind 済み = 生かす投資判断と整合    |
| 凍結（明示） | リマインダー（型のみ）・GCal 連携（**2026-07-14 路線変更: アプリ内蔵・Claude 側ミラーとも当面しない**。tier-3 凍結のまま）                                                                                                                                    | 再開条件は Step 0 で tier-1 / tier-3 に明記済み                       |
| 削除（決定） | **RoutineGroup**（group 頻度の選択肢・関連 UI/フック/サービスメソッド。**DB テーブルは DDL ルールに従い当面残置** = コード撤去のみ）・未配線生成器のうち reconcile 以外の 4 関数（テストごと整理）・孤立 i18n `schedulePanel`（トレイで再利用しないキーのみ） | デッドコードの潜在化を防ぐ                                            |

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
2. ⬜ **Step 1: タスクの読み取り表示（A-1）** — `shared/src/components/schedule/{WeekTimeGrid,MonthGrid,AgendaList}` に task variant 追加、`CalendarTab` で scheduledAt タスクを取得して合流。**AC**: scheduledAt を設定したタスクが Week/Day/Month/今日の流れに blue チップで表示される
3. ⬜ **Step 2: 双方向書き込み（A-2）** — ドラッグ/リサイズ → `updateTaskNode(scheduledAt/scheduledEndAt)`。**AC**: Schedule AC10 が通る（どちらで編集しても双方に反映）
4. ⬜ **Step 3: 「本日の Todo」トレイ（A-3・決定6）** — ScheduleSidebarTabs に第 3 タブ。配置済み/未配置の 2 群、「候補に追加」= scheduledAt 今日 + 終日（案 c）、完了チェック = TaskTree API、Tasks へのジャンプリンク、トレイ → 日面配置。**AC**: 終日で追加したタスクが未配置群に現れ、日面への配置で時刻付き scheduledAt が書き込まれ、完了チェックが TaskTree に反映される
5. ⬜ **Step 4: 伝播の配線 + 掃除（B・決定5）** — `reconcileRoutineScheduleItems` を配線、競合ルール（tier-1 §Schedule）のテストを追加。reconcile 以外の未配線 4 関数と RoutineGroup コードを削除（**DB テーブルは残置 = DDL なし**）。**AC**: Routine の時刻/頻度変更が materialise 済み未来 occurrence に伝播し、手動編集分は上書きされない
6. ⬜ **Step 5: 構成再編（決定1・4）** — 案 B（単一 Calendar タブ + 繰り返しフィルタ + 管理シート）、Mobile を List（今日）+ FAB に絞る（Month/Timeline 撤去）。i18n en/ja 同時更新。**AC**: ヘッダタブが消え、繰り返し一覧はフィルタ/シートから到達できる。Mobile は単画面 + FAB のみ
7. ⬜ **Step 6: カレンダー台帳の配線（決定2）** — グリッドにタグフィルタ（ツールバーのカレンダーチップ）、CalendarView の i18n 化・ソフトデリート整合。**AC**: カレンダー選択で Week/Month の表示が絞り込まれる
8. ⬜ **Step 7: エディタ拡充 + 小粒（C・E）** — 日付ピッカー・終日トグル・「系列全体に適用」ヒント・Issue 009
9. ⬜ **並走 α: MCP Supabase 化（D）** — Issue 起票から。朝刊ロードマップ Step 2（get_today_context / write_briefing）の起点

**共通ゲート**: DDL ゼロ（全 Step）/ shared `tsc -b` + vitest / web `tsc -b` + `vite build` / lumen トークンのみ・透明度禁止・en/ja 両 catalog / DataService 境界維持 / 実ブラウザ検証は chat-main（merge 後）

---

## 7. 参照パス（正典）

- 画面: `web/src/schedule/{ScheduleScreen,CalendarTab,RoutinesTab,CalendarView,RoutineScheduleSync}.tsx`
- 部品: `shared/src/components/schedule/`（WeekTimeGrid / MonthGrid / AgendaList / EventEditorPane / FrequencyEditor / ScheduleSidebarTabs ほか）
- 生成器: `shared/src/hooks/useScheduleItemsRoutineSync.ts` + `shared/src/utils/{routineScheduleSync,routineFrequency}.ts`
- サービス: `shared/src/services/SupabaseDataService.ts`（softDeleteRoutine / detachRoutine）
- 要件: `.claude/docs/requirements/tier-1-core.md`（Tasks AC7 / Schedule AC 群 / **競合解決ルール**）
- 決定: `.claude/CLAUDE.md` §4（#185 不変式）・`.claude/docs/vision/plans/2026-07-11-event-routine-unification.md`・`.claude/docs/design/IA.md`・`.claude/docs/design/briefs/schedule.md`
- 注意: `.claude/skills/schedule-management/` は**開発運用スキルであり本機能と無関係**（混同注意）

---

## Worklog

- 2026-07-14: **Step 0 実施（worktree schedule-redesign-step0）**。旧 handoff（`schedule-session-handoff.md`）を本計画書として正式化（案 c 確定を反映）。docs 追随: `tier-1-core.md`（Schedule Status 更新・再設計注記・backfill/reconciliation の実測訂正・AC1/AC2/AC8/AC10 注記・AC7/AC9 Retired 化・競合解決ルール新設・RoutineGroup 削除とリマインダー凍結の明記・GCal 見送り + 再開条件・Tasks AC7 未達注記）/ `2026-07-11-event-routine-unification.md`（UX 仕様 4 補遺 = 案 B タブ畳み込み・RoutineGroup 削除決定・Worklog）/ `tier-3-experimental.md`（GCal Verdict 凍結化 + 再開条件）/ `briefs/schedule.md`（backfill 訂正・RoutineGroup 削除注記）
- 2026-07-14: role-qa 監査（事実主張 全 PASS・Should 3 / Nit 2）を反映 — tier-1 の「3 サブタブ UI」行と Dependencies「Google Calendar (ICS → OAuth)」行に見送り注記を追加（現行化 sweep 漏れ）、競合解決ルール #4 に detachRoutine の S-1 意味論（生存 occurrence の `routine_item_id` NULL 化）を補記、本書 §2-4 の i18n キー個数直書きを削除（数値の非複製原則）。Nit-2（briefs/schedule.md 主要操作行の退役ファイル名参照 — 既存 stale）は次のブリーフ更新時に対応
