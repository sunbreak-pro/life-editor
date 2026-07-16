# chat-docs-workspace outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-16 → @chat-main

**ループ摩擦除去の計画書を新設 → PR 化**（ユーザー直接指示・要件 6 件。`docs/vision/plans/2026-07-16-loop-friction-fixes.md`・Status: IN PROGRESS・briefing-loop の子計画）。

- **重要発見**: 手書きの朝刊・夕刊は現状不成立（Daily 本文 = 平文 textarea・`extractBriefing` = TipTap 見出しノード必須）。下記 F-1 が Step 2（MCP 書き込み）と並ぶ**ループ開通の 2 大前提**
- 決定 6 件はすべてユーザー確定済み（計画書 決定録参照）。briefing-loop に決定録 5（Claude 起動口 = 定時自動先行・アプリ内ボタンは後続候補）と Risks を追記済み。tier-3 の Analytics に「破棄しない」決定を追記済み

### 起票依頼（chat-main へ・issue-dispatch。仕様・AC の正本 = 計画書 F-1〜F-5）

1. **F-1: Daily エディタの TipTap 化**（section:materials / type:feature・**最優先**）: Notes の `RichTextEditor` を Daily に再利用・見出し 1〜3・平文の後方互換必須（読み込み時変換・編集時のみ JSON 保存）。DoD = 手書き「朝刊」「夕刊」見出しが Briefing 紙面に表示される・既存平文 Daily が壊れない
2. **F-2: 朝刊の行操作**（briefing は担当 worktree なし → 采配一任 / type:feature）: 名称の横に専用の移動ボタン（該当セクションへジャンプ）＋ 名称タップ = 完了トグル（約束は現行維持・タスク行に新設）。名称タップで移動にはしない（ユーザー指定）
3. **F-3: Note Links の rightSidebar パネル化**（section:materials / type:feature）: 本文最下部 → rightSidebar の開閉パネル（ノート一覧と共存・layout-standard v2 の構造に整合）
4. **F-4: 表示ラベル改名 タスク → Todo・約束 → 予定**（shared-fix `[all]`）: i18n en/ja catalog のみ・コード識別子/DB/SectionId は不変・docs sweep 同一 PR（docs-consistency §2）
5. **F-5: Schedule 編集の反映バグ検証**（type:bug / chat-main・playwright 実測）: カレンダーで約束の時刻変更 → 「今日の流れ」/ 朝刊への反映を実ブラウザで確認。コード読解では今日の流れは共有 provider で即時反映の作りのため要再現（再現しなければ仕様として記録 close）

補足: 2026-07-15 依頼分（Step 2 = MCP Supabase 化 + `get_today_context` / `write_briefing`、tier-1 Briefing requirements 節）は本依頼とは別に継続中です。F-1 は Step 2 と独立に着手できます。

---

## 2026-07-15 (2) → @chat-main

**briefing テーマの正本計画書を新設 → PR 化予定**（ユーザー直接指示によるユーザーとの話し合いの成果。`docs/vision/plans/2026-07-15-briefing-loop.md`・Status: ACTIVE (adopted policy)）。

- 内容: 1 日 1 周ループ（朝刊=読む → Schedule=組む → Work=没入 → 夕刊=閉じる → Claude 分析=翌朝刊）の定義・追加/改善/削除の判定基準・完成の定義（平日 5 日連続でループが回る）・決定録 4 件（夕刊 = Daily「夕刊」見出し規約 / 分析 = 定時自動路線 / 完成 = 5 日連続 / 本書 = 正本）
- CLAUDE.md §8 Tier 1 に Briefing を追記（(6)→(7)・正本ポインタ = 本計画書。tier-1-core.md の requirements 節は未作成 — 下記 2 で起票依頼）

### 起票依頼（chat-main へ・issue-dispatch）

1. **朝刊ループ Step 2: MCP schedule handler の Supabase 化 + `get_today_context` / `write_briefing` 追加**（shared-fix / type:feature）: schedule-redesign 並走 α と同一起点（#185 Step 6 の切り出しと束ねて可）。DoD = 新ツールで今日の文脈取得 + Daily への朝刊セクション書き込みが 1 周する。詳細 = briefing-loop 計画書 Steps 表
2. **tier-1-core.md に Briefing の requirements 節を追加**（shared-fix `[docs-workspace]` / type:docs）: AC は briefing-loop 計画書から導出（紙面 5 ブロック表示・extractBriefing 規約・夕刊規約）。小粒なので本チャット宛で問題なし

---

## 2026-07-15 → @chat-main

**Schedule 再設計 Step 1（A-1 タスクの読み取り表示）を実装 → PR #252・merge 待ち**（ユーザー直接指示による実装。§7.4 どおり実ブラウザ検証は merge 後に chat-main でお願いします）。

- scheduledAt タスクが Week/Day/Month/今日の流れに task=blue チップで表示（読み取り専用・DDL ゼロ）。計画書 Step 1 チェック + Worklog 追記済み
- 既知の限界: Week/Day の全日レーンは variant 非依存描画のため終日タスクはそこでは青くならない（Step 2 送り・計画書に記録済み）
- Step 2（drag-to-write）への引き継ぎ: WeekTimeGrid の task affordance 再有効化 + taskchip id を専用ハンドラへ分岐 + ローカル→UTC 逆変換が必要（詳細は PR #252 body と計画書 §6）
- 本チャットは schedule セクションの担当ではないため、Step 2 以降を schedule-refine へ振るか本チャット継続かは chat-main の采配に委ねます

---

## 2026-07-11 → @chat-main

自分宛（shared-fix `[docs-workspace]` / `[all]`）の open Issue キューをすべて処理したので報告です。**キューは #218 の 1 件のみ・残タスクなし**。

### #218（shared-fix / type:feature）— 実装 → PR 化・merge 待ち

- 日付ロールオーバー時刻（day-start hour）を daily / routine sync の「今日」キー計算に反映。
- pref 参照方法が settings 側から未共有だったため、**読み手側から契約を定義**: localStorage キー `life-editor-day-start-hour`（`life-editor-` namespace なので #216 の reset 対象に自動包含）＋ pure reader `todayDateKey()` / `getDayStartHour()`（`shared/src/utils/dateKey.ts`）＋ settings 用書き込みフック `useDayStartHourPref`（`useStartupSectionPref` と同型・barrel export 済み）。既定 0 = 現行 00:00 境界と完全一致で、settings がキーを書くまで挙動不変。
- 配線箇所: `useDailiesUnifiedAPI`（初期 selectedDate）＋ `useScheduleItemsRoutineSync` の「今日」境界 3 箇所（cleanup 保護 / backfill 終端 / reconcile 保護）。
- 検証: shared vitest 863 pass（単体テスト追加込み）/ shared tsc -b green / web build green。
- **PR #242**（Closes #218）commit c8ff758b。**merge はこうだいさんの操作。実ブラウザ検証は §7.4 に従い merge 後に chat-main でお願いします。**

### 起票依頼（chat-main へ・issue-dispatch）

1. **settings 書き込み側 UI**（section:settings / type:feature）: Settings に「日付が変わる時刻」の select（0〜23 時、既定 0）を追加し `useDayStartHourPref` に配線＋ en/ja catalog 追加。読み手側契約は PR #242 で確定済みなので配線のみ。#216 がスコープ外とした分の残り。
2. **analytics の「今日」追随の要否判断**（section:analytics）: `TodayDashboard.tsx:29` / `MobileAnalyticsView.tsx:57` / `DailyTimeline.tsx:36` が `formatDateKey(new Date())`（00:00 境界）のまま。加えて `web/src/analytics/AnalyticsScreen.tsx:74` のローカル `todayKey()` も同境界（role-qa 監査で検出した 4 箇所目）。daily と境界を揃えるなら `todayDateKey()` への置き換え計 4 箇所。採用判断は chat-main へ。

### 補足

- 着手前の main 取り込みで `.claude/CLAUDE.md` / `plans/_TEMPLATE.md` にコンフリクトが出たため解消済み（どちらも origin/main 側 = Issue 駆動 dispatch 運用が同日 SUPERSEDE 明記のため main 側を採用。マーカーは formatter に壊されたが手動除去済み）。
- #217（weekStartsOn 配線・schedule-refine 宛）も同じ「pref 参照方法待ち」状態のはず。#242 の `useDayStartHourPref` / `useStartupSectionPref` パターンが前例になる旨、schedule-refine への共有をお願いします。
