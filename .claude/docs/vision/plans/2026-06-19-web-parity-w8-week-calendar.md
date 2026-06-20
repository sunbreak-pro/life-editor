---
Status: IN-PROGRESS — W8-1（週グリッド描画 + 週ナビ）実装 + 機械検証 green。W8-2（クリック作成/編集）/ W8-3（ドラッグ移動・リサイズ）未着手
Created: 2026-06-19
Branch: claude/app-dev-roadmap-cdhjjz
Owner-chat: app-dev-roadmap
Parent: ./2026-06-07-web-desktop-parity-roadmap.md（W8 = Schedule カレンダー充実）
Previous: ./2026-06-18-web-parity-w7-task-detail.md（W7・#91 merged）
---

# Plan: W8 — Schedule 週ビュー時間グリッド（本格カレンダー）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の W8（Schedule 充実）子計画書。
> 現状の web Schedule は意図的に lean（routine/event/calendar の CRUD リスト + 一覧）で、**時間軸に予定を配置する週/日カレンダーが無い**。W8 は「スケジュール管理をストレスなく」の最大の伸びしろ＝**週ビュー時間グリッド**（予定を時刻位置に配置・ドラッグ移動・リサイズ）を段階実装する。
> **2層モデル**（親書）: 週時間グリッドは「複雑画面」→ web 専用 UI（Mobile は将来別の日ビュー）。ただし**時刻→ピクセルの幾何 + 週日付計算は純粋関数として shared に集約**しテスト可能にする（Mobile からも再利用可）。

---

## Context

- **動機**: タスク詳細（W7・#91）は完了。スケジュール側は list ベースのみで、1 日の予定の重なり・空き時間が一目で分からない。週グリッドで「いつ何があるか」を可視化する。
- **データ層（実測）**: `ScheduleItem`（`date`=YYYY-MM-DD / `startTime`・`endTime`=HH:MM / `isAllDay` / `completed` / `routineId` / `isDismissed`）。`useScheduleItemsContext` が `loadDateRange(start,end)` / `createScheduleItem(date,title,start,end,opts)` / `updateScheduleItem(id,{startTime,endTime,date,...})` を提供。タイムゾーン変換なし（ローカル日付）。
- **既存資産（参照のみ・移植しない）**: FROZEN な `frontend/.../Schedule/DayFlow/scheduleTimeGridLayout.ts` の time→pixel + greedy 列割当の UX を踏襲（Tauri 結合コードはコピーしない）。
- **制約**: コスト $0（DDL なし・新規依存なし）。DataService 境界（注入のみ）/ `notion-*` 厳守・主要コンテナ不透明 / 新規純粋ロジックは shared 集約。web Schedule は現状 English-only ハードコード（i18n は Settings i18n pass 後）— **W8 も English-only で一貫**させ、i18n 化は後追い。

---

## 段階構成（slices）

| Slice    | 内容                                                                                                  | 規模 | 状態 |
| -------- | --------------------------------------------------------------------------------------------------- | ---- | ---- |
| **W8-1** | 週グリッド**描画**（7日×時間軸・重なり列分割・all-day strip・週ナビ Prev/Today/Next・Refresh）read-only | M    | ✅   |
| **W8-2** | クリック作成（空きスロット click → createScheduleItem）+ イベント click → 編集（インライン/詳細）         | M    | ⬜   |
| **W8-3** | ドラッグで時間/日移動（updateScheduleItem）+ 下端リサイズで長さ変更                                      | L    | ⬜   |

各 slice は機械検証（shared build/test + web build/eslint）green を完了条件とし、レイアウト/体感は 👀 目視。

---

## Scope（触ってよいパス）

```
shared/src/utils/weekGridLayout.ts        ← 純粋: timeToMinutes / layoutDayEvents / 週日付 helper（W8-1 ✅）
shared/tests/weekGridLayout.test.ts        ← 純粋ロジック単体テスト（W8-1 ✅）
shared/src/index.ts                        ← barrel export（W8-1 ✅）
web/src/schedule/WeekGrid.tsx              ← 週グリッド UI（W8-1 描画 → W8-2/3 で interaction 追加）
web/src/MainScreen.tsx                     ← schedule セクションに <WeekGrid/> 配線（W8-1 ✅）
.claude/docs/vision/plans/2026-06-19-web-parity-w8-week-calendar.md
```

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / `shared/src/components/MasterDetail.tsx` / `web/src/notes|tasks/**` / `supabase/`（DDL なし）/ 汎用 Database（凍結）。スコープ外が要れば本書を更新してから着手。

---

## Gate（§7.3）

- 🤖 自律: 純粋幾何 + 週グリッド描画 + 配線（機械検証 build/test/eslint まで）
- 👀 目視: 週グリッドのレイアウト・重なり表示・週ナビ・（W8-2/3）作成/編集/ドラッグの体感
- 🛑 人手: PR merge

## Acceptance Criteria（機械検証可能）

- [x] `cd shared && npm run build`（tsc -b）exit 0
- [x] `cd shared && npx vitest run tests/weekGridLayout.test.ts` 全 pass（13 tests: time→min / 単一配置 / startHour offset / all-day 除外 / 最小高さ / 2件重なり2列 / 隣接非重なり / 列再利用 / 週日付 helper）
- [x] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [x] `cd web && npx eslint src/schedule/WeekGrid.tsx` 0
- [x] git diff が Scope 宣言パス内のみ（shared util/test/index + web WeekGrid/MainScreen + 本書）
- [ ] 👀 週グリッド目視（W8-1）: 今日列ハイライト / 予定が時刻位置に出る / 重なりが横並び / Prev・Today・Next で週移動 / all-day strip

## DB Migration Notes

- **なし**（W8 全 slice で DDL ゼロ。既存 `schedule_items` / `useScheduleItemsContext` のみ使用）。

---

## Risks / 留意点

- **週キャッシュの鮮度**: `ScheduleItemsProvider.items` は anchored 単日。WeekGrid は `loadDateRange` で週分を**自前キャッシュ**。下のリスト編集後は **Refresh ボタン**で再取得（W8-1）。W8-2/3 で編集経路に自動 refetch を結線する。
- **重なりレイアウト**: interval-partitioning（cluster 単位で列数を揃える）。`layoutDayEvents` に単体テスト済（列再利用・cluster 分割を検証）。
- **routine 由来イベント**: `routineId != null` は Dismiss のみ（生成器が再作成）。W8-2/3 の編集は manual イベント優先、routine は move 時の扱いを slice 着手時に決める。
- **タイムゾーン**: ローカル日付固定（`new Date(y,m-1,d)`）。UTC 変換しない（既存 S4-0 規約）。
- **i18n**: 既存 web Schedule に倣い English-only。i18n 化は Settings i18n pass で一括（無理に先行しない）。

---

## Worklog

- 2026-06-19（app-dev-roadmap・W8-1 実装）: データ層を実測（ScheduleItem / useScheduleItemsContext の loadDateRange・create・update）。純粋幾何 `weekGridLayout.ts`（timeToMinutes / layoutDayEvents = interval-partitioning 列割当 / addDays / startOfWeek / weekDates / todayLocal）を shared に新設 + 13 tests。`web/src/schedule/WeekGrid.tsx`（7日×24h グリッド・重なり列分割・all-day strip・週ナビ・Refresh・今日列ハイライト・notion-* 不透明・English-only）を新設し MainScreen の schedule セクションへ配線。検証: shared build exit 0 / weekGridLayout 13 tests pass / web build exit 0（4383 modules）/ web eslint 0。残 = W8-1 目視（👀）→ W8-2 クリック作成/編集 → W8-3 ドラッグ移動/リサイズ。
