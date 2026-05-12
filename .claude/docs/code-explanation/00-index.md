# Code Explanation — Section 別マップ

このディレクトリは「画面のあのセクション」を直したいときに、どのファイル・コンポーネント・hook を触ればいいかを引くための辞書。CLAUDE.md §3 の Section Routing (6 SectionId) に沿って 1 セクション 1 ファイルでまとめる。

> ⚠️ Web 移行 (`refactor/web-first-v2` / 2026-05-04 開始) で Tauri 2 → Electron+Capacitor+Web+Supabase に大規模移行中。**フロントの React コンポーネント / Context / hook 階層はおおむね残る**が、`TauriDataService.ts` 経由の IPC 部分は書き換わる予定。各ドキュメントの「データ層 / バックエンド」節は移行 Phase 5 で再仕分け。

## セクション別

| Section ID  | ドキュメント                                       | 主な役割                                                                                |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `schedule`  | [`10-schedule.md`](./10-schedule.md)               | カレンダー / DayFlow / Tasks / Events の 4 タブ。Routine + ScheduleItems + CalendarTags |
| `materials` | [`11-materials.md`](./11-materials.md)             | Daily / Notes / Files の 3 タブ。Note ツリー + Template + WikiTags + FileExplorer       |
| `work`      | [`12-work.md`](./12-work.md)                       | Timer / History / Music の 3 タブ。Pomodoro + Audio Mixer + Playlist                    |
| `analytics` | [`13-analytics.md`](./13-analytics.md)             | Overview / Tasks / Schedule / Materials / Work / Connect の 6 タブ。集計と Recharts     |
| `connect`   | (本ファイル下部参照、Materials のサブ画面扱い)     | Note ↔ WikiTag ↔ Daily の関係グラフ                                                     |
| `settings`  | (個別ドキュメント未作成 — Settings 配下を直接読む) | テーマ / フォント / ショートカット / 同期設定                                           |

## 横串の重要な前提

- **DataService 抽象化** (CLAUDE.md §3.2): コンポーネントから `invoke()` を直呼びしない。`getDataService()` 経由。共通実装 → `frontend/src/services/{DataService.ts, TauriDataService.ts, dataServiceFactory.ts}`
- **Provider 順序** (CLAUDE.md §6.2): Desktop は ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Daily → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig → SidebarLinks。Mobile では Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig を省略 (Optional Provider)
- **Section Routing**: React Router を使わず `App.tsx::activeSection` の `switch` で切替。各 Section は単一の Top-level コンポーネント (`ScheduleSection` / `MaterialsView` / `WorkScreen` / `AnalyticsView`) を返す
- **右サイドバー**: 各 Section は `RightSidebarContext.portalTarget` に `createPortal` してサイドバーを差し込む。サイドバー切替は localStorage キー (`STORAGE_KEYS.*`) で永続化
- **タブ永続化**: 各 Section 内のタブ選択は `STORAGE_KEYS.*` で localStorage に保存 / 復元される

## Connect ビュー (Materials 配下)

`activeSection === "connect"` は `frontend/src/components/Ideas/ConnectView.tsx` を直接 mount する。Materials の WikiTag / NoteConnection のグラフビューで、本体は `frontend/src/components/Ideas/Connect/` 配下の `TagGraphView` / `ConnectPanel` / `ConnectSidebar` / `reactFlowMerge.ts` / `forceLayout.ts`。中身は Materials のデータ層 (Note / Daily / WikiTag) に依存するため、Materials を直すついでに見るのが筋。

## 触る前のチェックリスト

1. 該当セクションのドキュメントを開く
2. 「主要関数」節で対象の hook / コンポーネントを当たりつける
3. 「副作用」節で他セクション・他 Provider への波及を確認
4. 必要なら CLAUDE.md §6 (Coding Standards) と §7.2 (IPC 追加時の 4 点同期) を参照
