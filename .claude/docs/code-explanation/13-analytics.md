# Analytics セクション

`activeSection === "analytics"` で表示される画面。**6 タブの集計ダッシュボード**。Recharts ベース。

## 概要

| Analytics タブ | 中身                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| **Overview**   | 全体ダッシュボード (ストリーク / 週次サマリ / 今日 / ヒートマップ)          |
| **Tasks**      | タスク完了率 / 滞留チャート / プロジェクト別作業時間                        |
| **Schedule**   | 予定の完了率 / 時間帯分布 / ルーチン達成率                                  |
| **Materials**  | ノート作成トレンド / フォルダ別ノート数                                     |
| **Work**       | ポモドーロ作業時間 / 休憩バランス / 作業時間ヒートマップ / 日次タイムライン |
| **Connect**    | WikiTag 使用率 / タグ↔エンティティ分布 / タグ接続サマリ                     |

> Tier 3 (CLAUDE.md §8) で「凍結」扱いの機能だが、現状コードは生きている。集計ロジックは純粋関数として `utils/analyticsAggregation.ts` に分離されており、UI 側は Recharts で描画するだけのことが多い。

## A. ルートとタブ切替

| 役割             | パス                                                            | 何をしている                                                                                                          |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Section 親       | `frontend/src/components/Analytics/AnalyticsView.tsx`           | 6 タブ切替 + `AnalyticsFilterProvider` を mount。`readyTab` で 1 frame 遅延 (Recharts ResponsiveContainer の測定対策) |
| Section 差し込み | `frontend/src/App.tsx` (`case "analytics":`)                    | サイドナビ選択時の lazy mount (`Suspense`)                                                                            |
| 右サイドバー     | `frontend/src/components/Analytics/AnalyticsSidebarContent.tsx` | 期間 / フィルタ操作                                                                                                   |

## B. タブ別の画面コンポーネント

### Overview タブ

| ファイル                                                     | 役割                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `frontend/src/components/Analytics/OverviewTab.tsx`          | Overview 本体 (`useNoteContext` / `useRoutineContext` / `useWikiTags`) |
| `frontend/src/components/Analytics/TodayDashboard.tsx`       | 今日の作業ダッシュボード                                               |
| `frontend/src/components/Analytics/WeeklySummary.tsx`        | 週次サマリ                                                             |
| `frontend/src/components/Analytics/StreakDisplay.tsx`        | 連続日数表示                                                           |
| `frontend/src/components/Analytics/DailyActivityHeatmap.tsx` | 日次アクティビティのヒートマップ                                       |

### Tasks タブ

| ファイル                                                     | 役割                              |
| ------------------------------------------------------------ | --------------------------------- |
| `frontend/src/components/Analytics/TasksTab.tsx`             | Tasks 本体 (`useAnalyticsFilter`) |
| `frontend/src/components/Analytics/TaskCompletionTrend.tsx`  | タスク完了トレンド                |
| `frontend/src/components/Analytics/TaskStagnationChart.tsx`  | タスク滞留チャート                |
| `frontend/src/components/Analytics/TaskWorkTimeChart.tsx`    | タスク別作業時間                  |
| `frontend/src/components/Analytics/ProjectWorkTimeChart.tsx` | プロジェクト別作業時間            |

### Schedule タブ

| ファイル                                                       | 役割                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `frontend/src/components/Analytics/ScheduleTab.tsx`            | Schedule 本体 (`useRoutineContext` + `getDataService().*` で schedule_items を直接取得) |
| `frontend/src/components/Analytics/EventCompletionTrend.tsx`   | 予定完了トレンド                                                                        |
| `frontend/src/components/Analytics/EventTimeDistribution.tsx`  | 予定時間帯分布                                                                          |
| `frontend/src/components/Analytics/RoutineCompletionChart.tsx` | ルーチン達成率                                                                          |

### Materials タブ

| ファイル                                                   | 役割                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `frontend/src/components/Analytics/MaterialsTab.tsx`       | Materials 本体 (`useNoteContext` / `useDailyContext`) |
| `frontend/src/components/Analytics/NoteCreationTrend.tsx`  | ノート作成トレンド                                    |
| `frontend/src/components/Analytics/NotesByFolderChart.tsx` | フォルダ別ノート数                                    |

### Work タブ (= TimeTab)

| ファイル                                                       | 役割                                             |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `frontend/src/components/Analytics/TimeTab.tsx`                | Work 本体 (`AnalyticsView` で `sessions` を渡す) |
| `frontend/src/components/Analytics/WorkTimeChart.tsx`          | 作業時間チャート (`Period` 切替)                 |
| `frontend/src/components/Analytics/WorkTimeHeatmap.tsx`        | 作業時間ヒートマップ                             |
| `frontend/src/components/Analytics/WorkBreakBalance.tsx`       | 作業 / 休憩バランス                              |
| `frontend/src/components/Analytics/DailyTimeline.tsx`          | 日次タイムライン                                 |
| `frontend/src/components/Analytics/PomodoroCompletionRate.tsx` | ポモドーロ完了率                                 |
| `frontend/src/components/Analytics/PeriodSelector.tsx`         | `Period = day / week / month` 切替               |

### Connect タブ

| ファイル                                                     | 役割                          |
| ------------------------------------------------------------ | ----------------------------- |
| `frontend/src/components/Analytics/ConnectTab.tsx`           | Connect 本体 (`useWikiTags`)  |
| `frontend/src/components/Analytics/TagUsageChart.tsx`        | タグ使用率                    |
| `frontend/src/components/Analytics/TagEntityTypeChart.tsx`   | タグ ↔ エンティティタイプ分布 |
| `frontend/src/components/Analytics/TagConnectionSummary.tsx` | タグ接続サマリ                |

### 共通

| ファイル                                                  | 役割                       |
| --------------------------------------------------------- | -------------------------- |
| `frontend/src/components/Analytics/AnalyticsStatCard.tsx` | 集計カード (数値 + ラベル) |

## C. 状態管理 (Context / Provider)

| Context                  | 値定義 / Provider                                 | 役割                                                                                      |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AnalyticsFilterContext` | `frontend/src/context/AnalyticsFilterContext.tsx` | 期間プリセット (`DatePreset = 7d / 30d / thisMonth / 3m / all`) + カスタム期間 + フィルタ |

`AnalyticsView` 配下でのみ mount される (Provider 順序の外側にいる Analytics 専用)。各タブは `useAnalyticsFilter()` でフィルタ値を読む。

`AnalyticsView` 自体は他セクションの Context にぶら下がる:

- `useTaskTreeContext` (`nodes` — タスクツリー)
- `useNoteContext` / `useDailyContext` (Materials タブ)
- `useRoutineContext` (Schedule / Overview タブ)
- `useWikiTags` (Connect / Overview タブ)
- `timer_sessions` は `getDataService().fetchTimerSessions()` を `useEffect` で直接取得 (Provider なし)

## D. Hooks

Analytics 専用の hook は最小限。集計ロジックは純粋関数で `utils/` に分離されている。

| Hook                    | 何を返す                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `useAnalyticsFilter`    | `AnalyticsFilterContextValue` (期間 / フィルタ)                     |
| `useScheduleItemsStats` | `frontend/src/hooks/useScheduleItemsStats.ts` (Schedule タブの一部) |

## E. データ層 / バックエンド / 集計

| 役割                         | パス                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| DataService インターフェース | `frontend/src/services/DataService.ts`                                         |
| Tauri 実装                   | `frontend/src/services/TauriDataService.ts`                                    |
| Rust コマンド                | (専用なし。`timer_commands.rs` / `task_commands.rs` 等を間接的に消費)          |
| **集計ロジック (純粋関数)**  | `frontend/src/utils/analyticsAggregation.ts`                                   |
| 集計テスト                   | `frontend/src/utils/analyticsAggregation.test.ts`                              |
| 型                           | `frontend/src/types/timer.ts` / `taskTree.ts` / `routine.ts` / `wikiTag.ts` 等 |

## F. 主要関数 / メソッド

- `AnalyticsView.tsx::AnalyticsView` — 6 タブの親。`readyTab` を `requestAnimationFrame` で 1 frame 遅延させて Recharts の `ResponsiveContainer` が -1 dimension にならないようにしている (`ResponsiveContainer` の measurement quirks 対策)
- `AnalyticsView.tsx::taskNameMap` — `nodes` から `id → title` の Map を memoize して Work タブの `TimeTab` に渡す
- `AnalyticsFilterContext.tsx::AnalyticsFilterProvider` — `datePreset` / `customStart` / `customEnd` / `filterText` などを保持。`{from, to}` を派生
- `AnalyticsFilterContext.tsx::useAnalyticsFilter` — 各タブから呼ばれる
- `analyticsAggregation.ts::computeTagConnectionStats` (および他の集計関数群) — タグ接続 / セッション集計 / タスク滞留などの計算。純粋関数 + Vitest でテスト
- `OverviewTab.tsx::OverviewTab` — Notes / Routines / WikiTags / Sessions / Nodes を集約して `TodayDashboard` / `WeeklySummary` / `StreakDisplay` / `DailyActivityHeatmap` に流す
- `TimeTab.tsx::TimeTab` — `sessions` と `taskNameMap` を子チャートに流す。`Period` 切替で集計粒度を変える
- `ScheduleTab.tsx::ScheduleTab` — `useRoutineContext` でルーチン取得、`getDataService().*` で `schedule_items` を `useEffect` で取得して集計

## G. 副作用 / 注意点

- **集計は純粋関数 (`utils/analyticsAggregation.ts`)**。UI を変えるならまず `*.test.ts` を確認、ロジックを変えるなら必ずテストを更新
- **`AnalyticsView` は Materials / Schedule / Work の Context にぶら下がる**。Note / Daily / Routine / WikiTag のシグネチャを変えると壊れやすい。逆に Analytics 側で型を変えてはいけない (上流の SSOT を保つ)
- **Recharts の `ResponsiveContainer` 測定対策で `readyTab` を 1 frame 遅延**。タブ切替時にチャートが空になるのはこのため。タブ切替時のフラッシュを直すときはこの effect を確認
- **`timer_sessions` は `useEffect` で全件 load**。件数が増えると Analytics 起動が重くなる可能性 (将来は delta / pagination 検討)
- **Analytics は Cloud Sync 非対象**。Note / Daily / Tasks 等の上流データが同期される結果として、複数端末で同じ集計が見える
- **Tier 3 で凍結**: 仕様変更は本来発生しないはず。バグ修正以外で大きく触る前に、CLAUDE.md §8 と移行プランを確認
- **Web 移行**: Recharts はそのまま動く。`getDataService().fetchTimerSessions()` 部分だけ Supabase / IndexedDB 経由に置き換えが予想される
