# Plan: Mobile Schedule & Work — デザイン準拠リデザイン

> Status: **COMPLETED** · 2026-04-18 実装。コード実装 / 自動検証完了。手動 UI 検証（iPhone シミュレータ / Tauri build）は MEMORY.md 予定に移送。

## Context

- Claude Design (claude.ai/design) から配布された `index.html` バンドル（`life-editor-mobile-calendar-work-redesign`）を基に、モバイル版 Schedule（旧 Calendar）と Work の UI/UX を刷新する。
- バンドルの chat transcript で明示されているユーザー要望（作者本人）:
  1. Calendar 各 DayCell に**アイテム名（chip）をインライン表示**し、タップで**下からスワイプアップするボトムシート**に日別アジェンダを出す
  2. chip 名が長くてもグリッド列幅が崩れない（ellipsis truncation）
  3. Day cell の幅が chip 長で不均等になる問題の修正（`min-width: 0` + 親 flex 制約）
  4. Schedule には Calendar / Dayflow の 2 サブタブ。Dayflow は **デスクトップ相当のタイムグリッド**を 1 カラムで縦スクロール
  5. タブは 4 つに統合: **Schedule / Work / Materials / Settings**（「Calendar」タブ廃止、Schedule 配下で Calendar + Dayflow 統合）
  6. Work は集中 / 休憩 / 長休憩のセグメント、アクティブタスクチップ、大きな数字とリング、セッションドット、再生コントロールドックに再構成
- 現状のモバイル実装（`components/Mobile/*`、`Layout/MobileLayout.tsx`）は dot インジケーターのみで、chip インライン表示も bottom sheet も timegrid も無い。Work も従来型ポモドーロ UI。
- スコープ: ユーザー回答により **Calendar + Dayflow + Work 全部を 1 PR で実装**、アンビエント音楽カードは省略（AudioProvider がモバイル未対応のため CLAUDE.md §5 Platform Strategy 改定を要する別タスク）。
- 非目標: AudioProvider のモバイル追加、Settings / Materials 画面の再設計、ダークモード配色の微調整（既存 token を使えば自動追随）、haptics / pull-to-refresh / 仮想化などの未スコープ改善。

---

## Design → Code マッピング

### Color tokens

設計原本は light テーマ固定だが、本アプリは dark/light 両対応のため Notion token に寄せる + chip 専用 token を追加:

| 設計値                                  | 既存 token or 新規 token                             |
| --------------------------------------- | ---------------------------------------------------- |
| `#2eaadc` accent                        | `--color-notion-accent`（既存）                      |
| `#18181b` text                          | `--color-notion-text-primary`（既存）                |
| `#71717a` text2                         | `--color-notion-text-secondary`（既存）              |
| `#a1a1aa` text3                         | `--color-notion-text-secondary` + `opacity-60`       |
| `#dbe1ea` border                        | `--color-notion-border`（既存）                      |
| `#eef2f7` bg2                           | `--color-notion-bg-secondary`（既存）                |
| `#ebf0fe` / `#3b5bdb` routine           | **新規**: `--color-chip-routine-bg` / `-fg` / `-dot` |
| `#f3e8ff` / `#6d28d9` / `#8b5cf6` event | **新規**: `--color-chip-event-bg` / `-fg` / `-dot`   |
| `#e0f4fb` / `#0e7490` task              | **新規**: `--color-chip-task-bg` / `-fg` / `-dot`    |
| `#ef4444` sun / `#f87171` sat           | Tailwind の `red-500` / `red-400` を直指定           |

### Item kind discriminator

フロント側 1 次元に正規化する `DayItem` を作る:

```ts
type DayItem =
  | {
      kind: "routine";
      id: string;
      title: string;
      start: string;
      end: string;
      completed: boolean;
      source: ScheduleItem;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      start: string;
      end: string;
      completed: boolean;
      isAllDay: boolean;
      source: ScheduleItem;
    }
  | {
      kind: "task";
      id: string;
      title: string;
      start?: string;
      end?: string;
      status: TaskNode["status"];
      source: TaskNode;
    };
```

判定ルール:

- `ScheduleItem.routineId` が truthy → `routine`
- それ以外の `ScheduleItem` → `event`
- `TaskNode.scheduledAt` がある → `task`

### Sheet geometry（ビューポート相対）

- collapsed: `viewport - topOffset ≈ 38%`（設計 728px 中 286px = ~39%）
- expanded: `viewport ≈ 78%`（設計 728px 中 588px = ~80%）
- `min-h-[38dvh]` / `max-h-[80dvh]` を使い safe-area 込みで動的計算

---

## Steps

1. [ ] **タブ名の刷新**
   - `MobileTab` の `"calendar"` を `"schedule"` に変更（型 + `MobileApp.tsx` switch + `MobileLayout.tsx` tabs 配列 + アイコン: `Calendar` → `CalendarDays` はそのまま、ラベル i18n を `mobile.tabs.schedule`）
   - タブ順を **Schedule / Work / Materials / Settings** に並び替え（設計準拠）

2. [ ] **Chip kind 用デザイン token 追加**
   - `frontend/src/index.css` の `@theme` / `[data-theme="dark"]` に `--color-chip-routine-*` / `-event-*` / `-task-*` を 3 ペア追加（light/dark）
   - Tailwind arbitrary value で `bg-[var(--color-chip-routine-bg)]` 等と参照、または `tailwind.config` の color extend に追加

3. [ ] **共通ユーティリティの切り出し**
   - `frontend/src/components/Mobile/schedule/dayItem.ts`（新規）に `DayItem` 型 + `buildDayItems(scheduleItems, tasks, dateStr)` + `buildMonthItemMap(...)` を実装。純関数、テスト可能

4. [ ] **`MobileEventChip` コンポーネント（新規）**
   - `components/Mobile/schedule/MobileEventChip.tsx`
   - props: `{ item: DayItem; dimmed?: boolean; compact?: boolean }`
   - 4px dot + truncated title（`flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`）
   - kind 別の bg/fg/dot を token 経由で取る

5. [ ] **`MobileMonthlyCalendar` を全面書き換え**
   - `components/Mobile/MobileCalendarView.tsx` 内の同名コンポーネントを差し替え
   - day cell: `box-sizing: border-box`, `min-width: 0`, `max-width: 100%`, `width: 100%`, `overflow: hidden`, 右下 0.5px border、`min-height: ~78px`
   - 日付行: 左に `1 日` のとき `MMM` ラベル、右に日付。今日は accent 丸塗り、選択日は accent リング（`box-shadow: inset 0 0 0 1.5px accent`）+ 薄 tint bg
   - 土曜 / 日曜の色分け（red-400 / red-500）
   - chip は最大 3 件、以降は `+N 件` フォールバック
   - Month ヘッダーに search / today / prev / next ボタン（既存の 2 ボタンから拡張）
   - データソース: 既存 `monthItems` を `buildMonthItemMap` で `Map<dateStr, DayItem[]>` に整形してから渡す。現状 dot 用の `itemCountByDate` / `taskCountByDate` を置換

6. [ ] **`MobileDaySheet` コンポーネント（新規 / ボトムシート）**
   - `components/Mobile/schedule/MobileDaySheet.tsx`
   - props: `{ dateStr; items: DayItem[]; expanded; onToggle; onCollapse; onExpand; onEditItem; onToggleComplete; onToggleTask }`
   - `position: absolute; left: 0; right: 0; bottom: 0` で カレンダー grid の上に被せる（`MobileCalendarView` のレイアウトを relative コンテナに変更）
   - 高さ: `baseH = expanded ? 80dvh : 38dvh` を state drag 中は追従。`transition: height 280ms cubic-bezier(.2,.8,.2,1)`（drag 中のみ off）
   - drag handle: 36×5 の pill。touch + mouse 両対応。`|dy| > 40` で expand/collapse 切替
   - ヘッダー: `{day}` 大 + 曜日色 + 件数 + 「編集」ボタン（既存 edit フロー流用）
   - タイムライン行: `{start}/{end}` カラム + color rail + カード（check box + icon + title + kind ラベル）
   - データ: 渡された `items` を `start` 昇順で表示。`task` と `routine/event` の toggle は別 handler

7. [ ] **`MobileCalendarView` をシートベースに再構成**
   - Dayflow / Monthly サブタブ切替は維持
   - Monthly モード時:
     - 上: 月ヘッダー（MobileMonthlyCalendar）
     - 中: grid のみ（現状の下に並ぶ Day 一覧は削除 — MobileDaySheet に吸収）
     - 下: `MobileDaySheet` を overlay
   - FAB 位置: `bottom = sheetExpanded ? 100px : (collapsedSheetHeight + 16px)` として `transition: bottom 280ms`
   - Dayflow モード時は下記 Step 8 の `MobileDayflowGrid` に切替

8. [ ] **`MobileDayflowGrid` コンポーネント（新規 / タイムグリッド）**
   - `components/Mobile/schedule/MobileDayflowGrid.tsx`
   - 定数: `HOUR_PX = 54`, `DAY_START = 5`, `DAY_END = 24`
   - 描画: `position: relative; height = (DAY_END - DAY_START) * HOUR_PX`、1 時間ごとに絶対配置の `borderTop` + 時刻ラベル、30 分ごとに `border-top: 0.5px dashed`
   - イベントブロック: `top = ((startMin - DAY_START*60) / 60) * HOUR_PX`, `height = max(22, ((end-start)/60) * HOUR_PX - 2)`, 左 3px rail（kind 色）、`overflow: hidden` + title ellipsis
   - 今のライン: `isToday` のみ描画。赤丸 + 赤横線。`nowMin` は 1 分ごとに state 更新（`setInterval` cleanup 付き）
   - auto-scroll: マウント時と日付切替時に current hour（today）または 8:00（other）へスクロール
   - props: `{ dateStr; items: DayItem[]; onEditItem }`

9. [ ] **Dayflow の週ストリップ刷新**
   - 既存 `MobileCalendarStrip` を拡張: 設計準拠の circle（選択=accent 塗り、today=accent 枠）+ 日付下の小ドット（件数 > 0 のとき）
   - 週ヘッダーを `Dayflow` 時は「{月}月{日}日 + 曜日 + TODAY バッジ + prev/今日/next」に置換（設計 `DayflowHeader`）。Monthly 時は既存月ヘッダーを使用

10. [ ] **`MobileWorkView` を全面書き換え**
    - 新規サブコンポーネント（同一ファイル内でも分割ファイルでも可。読みやすさ優先で分割推奨）:
      - `WorkSessionTabs`: `WORK` / `BREAK` / `LONG_BREAK` を `集中` / `休憩` / `長休憩`（duration 表記付き）のセグメントに。背景 pill、active = 白背景 + shadow
      - `WorkActiveTaskChip`: 大きめカード。左アクセントバー（4px）、上に `取り組み中` ラベル、タスク名 ellipsis、任意 project サブテキスト、右に chevron
      - `WorkTimerRing`: SVG 280px、二重 stroke + `linearGradient` + `blur(8px)` halo（`running` 時のみ opacity 1）
      - `WorkSessionDots`: `targetSessions` ドット。done は幅 18px の rounded rect、未完は 6px dot
      - `WorkControlDock`: Reset（左）/ Play-Pause（中央 76px, 色は sessionColor）/ Skip（右）。Skip は `WORK` 中なら `dismissCompletionModal + startRest`、それ以外は 1 セッション進める挙動
    - アンビエント音楽カードは **描画しない**（今回スコープ外）。空領域は `flex` の spacing で埋める
    - 既存 `MobileSessionCompletionModal` と `MobileTaskSelector` はそのまま流用
    - Timer context は既存 `useTimerContext()` のインターフェースで足りる（`activeTask` / `isRunning` / `sessionType` / `remainingSeconds` / `progress` / `completedSessions` / `targetSessions` / `start` / `pause` / `reset`）

11. [ ] **i18n キー追加**
    - `frontend/src/i18n/locales/en.json` と `ja.json` 両方に追加:
      - `mobile.tabs.schedule`
      - `mobile.schedule.subTab.calendar` / `subTab.dayflow`
      - `mobile.schedule.daySheet.edit` / `daySheet.empty` / `daySheet.todayPrefix`
      - `mobile.schedule.dayflow.today` / `dayflow.prev` / `dayflow.next` / `dayflow.now`
      - `mobile.work.session.work` / `session.break` / `session.longBreak`
      - `mobile.work.sessionLabel.work`（中央の「集中セッション」表記）
      - `mobile.work.activeTaskLabel`（`取り組み中`）
      - `mobile.work.sessionDots.progress`（`今日 {{done}} / {{total}} セッション完了`）
      - `mobile.work.controls.reset` / `controls.skip`
    - 既存 `mobile.tabs.calendar` は **削除**（unused 化）
    - **運用ルール遵守**: 新規 UI テキストは必ず en/ja 両方に入れる（CLAUDE.md §9.5）

12. [ ] **Known Issues / 動作検証**
    - Verification セクションの手順を全部踏む
    - Blocking/Important バグが見つかったら Fix してから commit

13. [ ] **`.claude/CLAUDE.md` §13 Roadmap 更新**
    - 「進行中」に本プランを追加 or 直近完了へ
    - Feature Tier Map §11 の Schedule / Work 欄に対応する詳細要件リンクがあれば更新

---

## Files

| File                                                                | Operation      | Notes                                                                                                                         |
| ------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/Layout/MobileLayout.tsx`                   | Edit           | `MobileTab` 型 `"calendar"` → `"schedule"`、tabs 配列のラベル/順序、i18n キー                                                 |
| `frontend/src/MobileApp.tsx`                                        | Edit           | switch 分岐 `"calendar"` → `"schedule"`、初期 activeTab は `"schedule"` に                                                    |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`             | Edit（大改修） | Monthly を DaySheet ベースに再構成、Dayflow を新 timegrid に差替、FAB 位置 transition、`MobileMonthlyCalendar` 中身全書き換え |
| `frontend/src/components/Mobile/MobileCalendarStrip.tsx`            | Edit           | 円形デートセル + ドット、週ヘッダー                                                                                           |
| `frontend/src/components/Mobile/MobileWorkView.tsx`                 | Edit（大改修） | SessionTabs / ActiveTaskChip / TimerRing / SessionDots / ControlDock サブコンポーネント化、ambient card なし                  |
| `frontend/src/components/Mobile/schedule/MobileEventChip.tsx`       | Create         | kind 別色付き chip（dot + ellipsis title）                                                                                    |
| `frontend/src/components/Mobile/schedule/MobileDaySheet.tsx`        | Create         | drag handle + 高さアニメ + タイムライン行リスト                                                                               |
| `frontend/src/components/Mobile/schedule/MobileDayflowGrid.tsx`     | Create         | hour lines + event blocks + now line + auto-scroll                                                                            |
| `frontend/src/components/Mobile/schedule/dayItem.ts`                | Create         | `DayItem` 型 + 変換関数（Schedule / Task → 統一）                                                                             |
| `frontend/src/components/Mobile/schedule/dayItem.test.ts`           | Create         | 変換関数のユニットテスト（`routine` / `event` / `task` / all-day 判定）                                                       |
| `frontend/src/index.css`                                            | Edit           | `@theme` と `[data-theme="dark"]` に chip kind 9 変数追加                                                                     |
| `frontend/src/i18n/locales/en.json`                                 | Edit           | §11 のキー追加、`mobile.tabs.calendar` 削除                                                                                   |
| `frontend/src/i18n/locales/ja.json`                                 | Edit           | §11 のキー追加、`mobile.tabs.calendar` 削除                                                                                   |
| `.claude/CLAUDE.md`                                                 | Edit           | §13 Roadmap に進捗反映                                                                                                        |
| `.claude/feature_plans/2026-04-18-mobile-schedule-work-redesign.md` | Create         | 本プランのコピー（plan-mode-quality.md ルール）                                                                               |

---

## 参照すべき既存実装

- `frontend/src/context/TimerContextValue.ts:1-52` — Timer context の I/F。Work redesign はこれで過不足なし
- `frontend/src/components/Mobile/MobileCalendarView.tsx:47-139` — `SwipeableItem` は DaySheet の行で再利用可能
- `frontend/src/components/Mobile/MobileScheduleItemForm.tsx` — 既存 form モーダル、`onSave` / `onDelete` の I/F はそのまま流用
- `frontend/src/services/DataService.ts` — `fetchScheduleItemsByDateRange` / `fetchTaskTree` / `toggleScheduleItemComplete` / `softDeleteScheduleItem` は既存、追加 IPC 不要
- `frontend/src/hooks/useServiceErrorHandler.ts` — エラー handling は既存パターン踏襲
- `frontend/src/context/SyncContext.tsx` — `syncVersion` watch で再読込するパターンは維持

---

## Verification

承認後、以下を順に確認:

- [ ] `cd frontend && npm run test` が pass（既存テスト + 新規 `dayItem.test.ts`）
- [ ] `cd frontend && npx tsc --noEmit` が警告/エラーなし
- [ ] `cargo tauri dev` でモバイル設定（`isTauriMobile()` を一時的に true にする or iPhone シミュレータ）で起動し、以下を目視:
  - [ ] タブバー順が **Schedule / Work / Materials / Settings** になっている
  - [ ] Schedule > Calendar: 月グリッドの各 DayCell に chip が最大 3 件表示され、4 件以上は `+N 件` が出る
  - [ ] 長いタイトル（全角 10 文字以上）でも列幅が崩れず、`…` で省略される（Sunday 列が他より広くならない）
  - [ ] 今日のセルは accent 塗りの丸、選択日は accent リング + 薄 tint bg
  - [ ] 日付タップ → 下からボトムシートが出る。ドラッグで expand / collapse（±40px しきい値）、タップで toggle
  - [ ] 完了トグル（チェックボックス）が schedule / task の両方で動く
  - [ ] FAB 位置がシート展開/縮小に応じてスムーズに移動（280ms ease）
  - [ ] Schedule > Dayflow: 時刻グリッドが 5:00〜24:00 で表示、イベントブロックが時間どおりの位置 / 長さで描画
  - [ ] 今日のビューで赤い now ライン + 丸が現在時刻に出現、1 分ごとに位置更新
  - [ ] 週ストリップの選択日が accent 塗り、today が accent 枠、件数ドットが下に付く
  - [ ] 日付 prev/next で timegrid が切替、今日ボタンで戻れる、auto-scroll が効く
  - [ ] Work 画面: 上に `Focus` 見出し、セッション pill、アクティブタスクチップ、280px リング + halo、セッションドット、コントロールドック（Reset / Play-Pause / Skip）
  - [ ] pill で `集中` / `休憩` / `長休憩` 切替すると timer 設定が追随
  - [ ] Play ↔ Pause で halo の opacity が変わる
  - [ ] Skip が適切に動作する（WORK 終了時の自動ブレーク挙動）
- [ ] dark テーマ切替時も chip / timegrid が見やすい（chip token の dark 値を確認）
- [ ] i18n: EN / JA 切替で全ラベルが対応（missing key 警告が出ない）

Blocking / Important のバグはこの段階でまとめて fix、commit は verification が全通してから。

---

## ロールアウトの注意

- 旧 dot インジケーター利用コード（`itemCountByDate` / `taskCountByDate`）は DayItem ベースに置換されるため、外部から参照している箇所がないことを grep で確認してから削除
- 既存 `mobile.tabs.calendar` を削除する前に i18n 参照が残っていないことを `grep -r "mobile.tabs.calendar"` で確認
- MobileCalendarView は `absolute` 配置が増えるため親が `position: relative` + `overflow: hidden` を持つこと（`MobileLayout` の main は既に overflow-y-auto なのでラッパー div を追加）
