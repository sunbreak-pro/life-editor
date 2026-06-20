---
Status: In Progress（コア Steps 1–6 実装完了・検証中 / Step 7 DnD は W8+ へ送り）
Created: 2026-06-19
Branch: feat/w8-schedule-calendar
Owner-chat: main（起草は web-w6-master-detail。実装着手で main が引き取り）
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-18-web-parity-w7-task-detail.md
---

# Plan: Web/Mobile セクション内部深化 第3弾（W8・Schedule カレンダー充実 / 週・日タイムグリッド）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の子計画書（W8）。
> W6（Notes 3ペイン）/ W7（Tasks 詳細）でセクション本体の情報密度を上げてきた。本書は
> **2層モデルの「複雑画面」の代表格 = Schedule カレンダー**を扱う。`schedule_items`（`date` +
> `HH:MM` start/end を持つ）を**週/日タイムグリッド**で可視化し、広幅はマウス操作のグリッド、
> 狭幅はタップ前提のアジェンダ（+ `BottomSheet` 編集）に**割り切って分割**する。

---

## Context

- **動機**: Schedule は web 移植時に **lean な lists** で止まっている。`ScheduleItemsView` は単一 `date` の schedule_items を**時刻順リスト**で出すだけで、旧 Desktop のような**週ビュー・時間グリッド・イベント DnD** が無い（W6/W7 計画書で繰り返し W8 送りと明記）。`ScheduleItem` は既に `date`(YYYY-MM-DD) / `startTime` / `endTime`(HH:MM) / `isAllDay` / `completed` を持つので、**データ追加なしでグリッド可視化できる**。
- **到達基準**: 広幅で**週（7日）タイムグリッド**に schedule_items が時刻位置で並び、クリックで選択・編集できる。狭幅は**1日アジェンダ**（時刻順リスト）+ タップで編集シート。曜日/日のナビ（前後移動・今日へ）。**ピクセル一致は求めない**（親書 Context 方針 2）。
- **制約**:
  - コスト $0 厳守（**DDL なし**・新規依存なし。`@dnd-kit` は既存依存・`useMediaQuery`/`BottomSheet`/`MasterDetail` も既存）。
  - 既存の不変式を維持: DataService 境界（§3.1/§6.4・`createScheduleItem`/`updateScheduleItem` はコールバック注入）、Provider ネスト順（§6.2・Schedule trio = Routine→ScheduleItems→CalendarTags）、section ルーティングは `useState`（§3.2）、新規 UI は `shared/src/components/` 集約（§6）、`notion-*` 厳守・主要 UI 背景に透明度禁止、i18n は props 注入（shared 内 `useTranslation()` 直呼び禁止）。
  - **2層モデルの「複雑画面 → 分割」**: 全幅1コンポーネントで完全レスポンシブ化はしない。広幅グリッドと狭幅アジェンダは別レイアウトに割り切る（親書 §中核設計）。
- **Non-goals**:
  - **Routine 生成ロジック / `RoutineScheduleSync` の作り替え**（W8 は生成済 schedule_items の*可視化*に徹する。生成は S4-5 の既存実装をそのまま使う）。
  - **イベント DnD（時間グリッド上のドラッグでリスケ）は本書では任意の最終ステップ**にとどめ、リスク次第で W8+ へ送れる構造にする（コア = グリッド表示 + クリック編集）。
  - 月ビュー / 終日イベントの複雑なレーン詰め / 重なりイベントの高度なカラム分割（最小限の素朴な重なり処理で可。高度化は W8+）。
  - `frontend/`（FROZEN）/ `desktop/` / `mobile/` 包装の改変。Routine UI（`ScheduleView` の routine CRUD）/ `CalendarView`（folder-scoped calendars）/ Tasks / Notes 等**他セクション**の改変。
  - 汎用 Database（凍結継続）。

---

## 中核設計：共有タイムグリッド + 2層分割（広幅グリッド / 狭幅アジェンダ）

| 幅               | レイアウト                                                                                                                                                                                  | 編集                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **広幅（≥ md）** | **週タイムグリッド**（左=時刻軸 / 上=曜日ヘッダ / セル=時間スロット）。schedule_items を `startTime`/`endTime` から算出した top/height で絶対配置。終日（`isAllDay`）は最上段の全日レーン。 | イベントクリックで選択 → 右ペイン or インライン編集（title/time/complete）。任意ステップで**ドラッグして時間移動** |
| **狭幅（< md）** | **1日アジェンダ**（選択日の schedule_items を時刻順リスト）。日ナビ（< 今日 >）。                                                                                                           | タップで `BottomSheet` 編集（既存 `ScheduleItemsView` の編集 UI を流用）                                           |

- **共有プリミティブ（純粋表示・DataService 非依存）** `shared/src/components/schedule/`（サブバレル）:
  - `WeekTimeGrid`（または `TimeGrid`）— props: `weekStart: string`(YYYY-MM-DD) / `items: ScheduleItemLike[]` / `onSelectItem(id)` / `onMoveItem?(id, nextStart, nextEnd)`（DnD・任意）/ `hourRange?`（既定 0–24 か業務時間）/ ラベル群（曜日名・時刻書式は props 注入）。レイアウト計算（`HH:MM`→分→top/height）は**純関数に外出し**して unit test 可能にする（`scheduleGridLayout.ts`）。
  - 終日レーン・重なりの素朴な横詰めは純関数側に集約。
- **位置計算は純関数**: `minutesFromMidnight(hhmm)` / `layoutDayItems(items, hourRange)` → `{ id, topPct, heightPct, column, columns }[]`。**DnD なしでも完結**し、test はこの純関数 + 描画の最小确認に絞る（W6/W7 同様に matchMedia モックで広狭を固定）。
- **web 採用（パイロット）**: `web/src/schedule/` に `ScheduleCalendarView`（新規）を追加し、`useScheduleItemsContext` から週/日の items を供給。広幅=`WeekTimeGrid`、狭幅=既存アジェンダ（`ScheduleItemsView` の表示部を流用 or 薄いラッパ）。ラベル/曜日名/時刻書式は web 側が `t()`/`Intl` で解決し props 注入。**`schedule_items` の CRUD ロジック・`RoutineScheduleSync` は無改変**。
- **デザインシステム再利用**: `useMediaQuery`（W5）/ `BottomSheet`（W3）/ 必要なら `MasterDetail`（W6・週グリッド=master / イベント詳細=detail として再利用可）/ `cn` / `@dnd-kit`（既存）。新設はタイムグリッド部品 + レイアウト純関数のみ。

---

## Scope (Touchable Paths)

```
shared/src/components/schedule/WeekTimeGrid.tsx     ← 新設（週/日タイムグリッドの純粋表示）
shared/src/components/schedule/index.ts             ← サブバレル（Analytics/Connect と同流儀）
shared/src/components/index.ts                      ← サブバレル re-export 追加
shared/src/utils/scheduleGridLayout.ts              ← 新設（HH:MM→top/height・重なり詰めの純関数）
shared/tests/scheduleGridLayout.test.ts             ← 新設（レイアウト純関数の unit test）
shared/tests/weekTimeGrid.test.tsx                  ← 新設（広幅グリッド描画 / イベントクリックの最小 test）
shared/src/i18n/locales/en.json                     ← schedule カレンダー用コピー（曜日略称 / 今日 / 終日 等）
shared/src/i18n/locales/ja.json                     ← 同上（両 catalog 同キー）
web/src/schedule/ScheduleCalendarView.tsx           ← 新設（広幅グリッド / 狭幅アジェンダの採用・schedule_items 配線）
web/src/MainScreen.tsx                              ← Schedule セクションに ScheduleCalendarView を差し込む配線のみ
.claude/docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md
.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md  ← W8 参照を1行追記
```

スコープ外の変更が必要になったら、本計画書を更新してから着手する（更新せず広げない）。

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / Tasks・Notes・他セクション / `ScheduleView.tsx`（routine CRUD・無改変）/ `CalendarView.tsx`（無改変）/ `RoutineScheduleSync.tsx`（生成ロジック・無改変）/ `useScheduleItemsAPI` 等の CRUD 本体（**読み出し + 既存 update のみ**使用）/ `MasterDetail.tsx`（W6・無改変で再利用）/ `supabase/`（DDL なし）。

---

## Steps

| #   | Step                                                                                                             | Gate    | Acceptance                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 1   | レイアウト純関数 `scheduleGridLayout.ts`（`HH:MM`→分→top/height・素朴な重なり詰め）                              | 🤖 自律 | `cd shared && npm run build` exit 0             |
| 2   | `WeekTimeGrid` 新設（時刻軸 + 曜日ヘッダ + 絶対配置イベント・終日レーン・`notion-*`・props 注入）                | 🤖 自律 | `cd shared && npm run build` exit 0             |
| 3   | サブバレル + barrel export 追加                                                                                  | 🤖 自律 | `cd shared && npm run build` exit 0             |
| 4   | i18n: 曜日略称 / 今日 / 終日 / 空状態 等を en/ja 両 catalog に追加                                               | 🤖 自律 | 両ファイル同キー存在・`npm run build` exit 0    |
| 5   | 最小 test（レイアウト純関数の unit + `WeekTimeGrid` 描画/クリックの最小描画）                                    | 🤖 自律 | `cd shared && npm run test` 全 pass             |
| 6   | web `ScheduleCalendarView` 採用（広幅=グリッド / 狭幅=アジェンダ + 編集シート・schedule_items 配線・i18n props） | 🤖 自律 | `cd web && npm run build` exit 0                |
| 7   | （任意）イベント DnD でリスケ（`@dnd-kit`・`onMoveItem`→`updateScheduleItem`）。リスク高なら W8+ へ送る          | 🤖 自律 | `cd web && npm run build` exit 0 / 該当 test 緑 |
| 8   | レスポンシブ/操作感の目視（広幅週グリッド・狭幅アジェンダ + 日ナビ・イベント編集・(任意)DnD）                    | 👀 目視 | 主要動線を手で1周（広幅/狭幅とも）              |
| 9   | Draft PR → レビュー → main merge                                                                                 | 🛑 人手 | PR レビュー & merge ボタン                      |

### Gate 凡例

- **🤖 自律** — Claude 完結。後追い検証（tsc / test）で品質担保。Stop hook で型崩壊検出。
- **👀 目視** — レイアウト/体感は Claude では検証不能。ユーザーが画面で確認。
- **🛑 人手** — PR merge はユーザー操作必須。

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build`（tsc -b）exit 0
- [ ] `cd shared && npm run test`（vitest）全 pass（`scheduleGridLayout` の unit + `WeekTimeGrid` の最小 test 含む）
- [ ] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [ ] `cd frontend && npm run build`（旧 Tauri 非破壊の担保・並立期間中）exit 0
- [ ] `shared/src/i18n/locales/en.json` と `ja.json` で新規コピーキーが**両方**に存在
- [x] PR diff が ±1100 行程度（当初 ±600 想定を上方修正。2026-06-20 実測 ~1107 行。複雑画面本体 = 週グリッド部品 + 日アジェンダ + 編集 + 純関数エンジン + 19 test + 二言語 i18n。**DnD なしでこの規模**＝複雑画面の妥当な本体。scope creep ではない＝下記「Scope 宣言パス内のみ」で担保。ユーザー承認済み 1 PR）
- [ ] git diff が Scope 宣言パス内のみ（Stop hook が scope drift 警告を出さない）

---

## DB Migration Notes

- **なし**（DDL ゼロ。`schedule_items` の既存フィールド `date` / `startTime` / `endTime` / `isAllDay` をそのまま可視化。リスケも既存 `updateScheduleItem` で `startTime`/`endTime` を書き換えるのみ）。

---

## Risks / Known Issues 参照

- **2層モデルの逸脱**: 週グリッドと日アジェンダを1コンポーネントに無理に統合すると分岐だらけで破綻する（親書 §中核設計の警告）。→ 広幅/狭幅を**別レイアウトに割り切る**（`useMediaQuery` で出し分け）。共有は部品（`WeekTimeGrid`）と純関数（レイアウト計算）に集約。
- **時刻計算の取り違え**: `HH:MM` ↔ 分 ↔ px(%) の変換は**純関数に外出し**して unit test で固める（DST/UTC は持ち込まない — schedule_items は local `date` + `HH:MM` 文字列。`CalendarView` の「UTC 持ち込まない」教訓と同じ）。
- **DnD のリスク**: 時間グリッド上の DnD は当たり判定・スナップ（15分刻み等）・スクロール追従で複雑化しやすい。→ **コア（表示 + クリック編集）と分離**し、DnD は Step 7（任意）。リスクが出たら W8+ へ送り、コアだけ先に merge できる構造にする。
- **重なりイベント**: 同時間帯の重なりは本書では**素朴な横カラム詰め**（最小実装）に留める。高度なレーン最適化は W8+。
- **Provider 依存**: schedule_items は `ScheduleItemsProvider`（§6.2 で Routine の内側）配下でのみ読める。`ScheduleCalendarView` は既存の Provider ネストの内側に置く（MainScreen の現配線を踏襲・Provider 順序は不変）。
- 着手前に `.claude/docs/known-issues/INDEX.md` を `schedule` / `calendar` / `grid` / `time` / `dnd` で grep。

---

## References

- 親ロードマップ: `./2026-06-07-web-desktop-parity-roadmap.md`（W0〜W7・2層モデル・棚卸し。Schedule=週ビュー等の "何を作り何を作らないか" は section-unification の棚卸し結論を参照）
- 直前: `./2026-06-18-web-parity-w7-task-detail.md`（Tasks 詳細・`MasterDetail` 第2採用）/ `./2026-06-16-web-parity-w6-detail-panel.md`（`MasterDetail` プリミティブ）
- 移行 SSOT: `../../../2026-05-04-cross-platform-migration.md`
- frontend 規約: `../../../rules/frontend.md`（Schedule 3分割 / Provider 順序 / `notion-*` / i18n / IME）
- 設計原則: `../coding-principles.md`（部品共通 / 画面分岐の2層モデル — 複雑画面は分割）
- 参照実装（FROZEN・読むだけ）: `frontend/` の旧 Schedule 週グリッド / 時間グリッド（Tauri 依存・移植しない・仕様参照のみ）
- 既存 web: `web/src/schedule/ScheduleItemsView.tsx`（狭幅アジェンダ + 編集 UI の流用元）/ `shared/src/types/schedule.ts`（`ScheduleItem`）
- related skills: `lead-pipeline`（ティア判定 — 重想定）/ `role-pm → role-engineer → role-qa` / `git-orchestrator`

---

## Worklog

- 2026-06-20（app-dev-roadmap チャット・W8-1 web-first 実装 + 重複 doc 統合）: 本書（web-w6-master-detail チャット起草・#94 で main 入り）と並行して、app-dev-roadmap チャットが別 doc `web-parity-w8-week-calendar.md` を起こし **W8-1 を web-first で実装**していた（PR #93 が HTML レポートのみで早期 squash マージされ、後続コミットが main へ未反映だったのを本セッションで発見・回収）。重複 doc は本書へ統合し削除。**実装の実体**: `shared/src/utils/weekGridLayout.ts`（純関数 = `timeToMinutes` / `layoutDayEvents` interval-partitioning 重なり列分割 / 週日付 helper・13 tests）+ `web/src/schedule/WeekGrid.tsx`（7日×24h 時間グリッド・絶対配置・all-day strip・週ナビ・今日列ハイライト・notion-* 不透明・English-only）+ MainScreen 配線。検証 = shared build / 13 tests / web build(4383 modules) / web eslint いずれも exit 0。**本計画との差分（要追認）**: ① 純関数名は計画の `scheduleGridLayout.ts` ではなく `weekGridLayout.ts`、② グリッドは計画の shared `WeekTimeGrid` ではなく **web 限定 `WeekGrid`**（既存 web schedule views と同位置）で 2層モデルの shared 集約は未達、③ 狭幅アジェンダ + `useMediaQuery` 出し分け未実装（広幅グリッドのみ）、④ DnD（Step 7）未着手。→ **W8-2（クリック作成/編集）→ W8-3（DnD 移動/リサイズ）** を続行予定。shared `WeekTimeGrid` 化（2層 responsive）は W8 内のリファクタ候補として残す。
- 2026-06-19（起草）: W7（Tasks 詳細）完了を受け、W8 を「Schedule カレンダー充実」に確定。`ScheduleItem` が既に `date` + `HH:MM` を持つため **DDL ゼロでグリッド可視化可能**と確認。2層モデルの複雑画面として**広幅=週タイムグリッド / 狭幅=日アジェンダ**に割り切り。コア（表示 + クリック編集）と **DnD（任意・Step 7）を分離**し、DnD はリスク次第で W8+ へ送れる構造に。位置計算は純関数（`scheduleGridLayout.ts`）に外出しして unit test で固める。Routine 生成（`RoutineScheduleSync`）・`ScheduleView`・`CalendarView` は無改変。本書は計画のみ（実装は次セッション）。
- 2026-06-20（実装・main 引取）: コア **Steps 1–6 実装完了**（worktree `feat/w8-schedule-calendar`）。
  - `shared/src/utils/scheduleGridLayout.ts` — `minutesFromMidnight` / `layoutDayItems`（素朴な横カラム詰め・%ベース top/height）/ ローカル日付キー演算（`addDaysKey`/`startOfWeekKey`/`weekDayKeys`・**UTC 不持込**: `new Date(y,m-1,d)` のみ）。
  - `shared/src/components/schedule/WeekTimeGrid.tsx` — 時刻軸 + 曜日ヘッダ + 終日レーン + 絶対配置イベント。純粋表示（DataService/i18n 非依存・ラベルと書式は props 注入）・`notion-*` のみ・`days={1}` で日ビューに縮退可。サブバレル + `components/index.ts` バレル追記。
  - i18n: `scheduleCalendar` namespace（曜日略称 / 終日 / 今日 / 前後ナビ / 空 / 編集ラベル = 21 キー）を en/ja **両 catalog** に追加。
  - test: `scheduleGridLayout.test.ts`（純関数 unit・overlap/clamp/日付境界）+ `weekTimeGrid.test.tsx`（描画 / クリック / 終日 / `days={1}`）= 計 19。**shared 全 462 passed**。
  - web `ScheduleCalendarView.tsx` — `useMediaQuery` で出し分け（広幅=`WeekTimeGrid` + 右ペイン編集 / 狭幅=日アジェンダ + `BottomSheet` 編集）。週/日ナビ・今日。`loadDateRange` で可視週を**読取**、編集は既存 `updateScheduleItem`/`toggleComplete` + 楽観 patch（**CRUD 改変なし**）。`MainScreen` schedule セクションに配線（Provider 順序不変）。
  - 検証: shared build / web build / frontend build いずれも exit 0、web eslint 0 error（残 1 warning は既存 `DebouncedTextInput.tsx`・無関係）。**Step 7 DnD は W8+ へ送り**（コアを先に出せる構造）。
  - ⚠️ diff **1107 行**（AC「±600 行」超過。DnD 無しでも複雑画面本体が大。スコープ外変更ゼロ）。受容 or 「WeekTimeGrid+純関数+test」/「web 採用」の 2 PR 分割を要ユーザー判断。
  - 残: 👀 目視（Step 8）/ 🛑 Draft PR → merge（Step 9・PR 未作成）。
