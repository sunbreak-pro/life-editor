---
Status: SUPERSEDED — Web 移行に一本化（2026-06-07）で凍結後、UI/デザインの追跡正本は ClaudeDesign fan-out 計画（2026-07-04-claudedesign-screen-design-fanout.md）へ一本化。Work(#50/#51)/Materials(#53) 完了分は温存、Schedule/Settings は着手せず。archive 済
Created: 2026-06-05
Branch: (section ごとに分割。例 feat/work-section-mobile-unify)
Owner-chat: main
Parent: (none)
Previous: (none)
---

# Plan: Mobile 基準のセクション横断デザイン統一（段階実装）

> ⚠️ **FROZEN（2026-06-07）**: Web 移行に一本化したため本レーンは凍結。`frontend/` は移行 Phase 5 で破棄予定で、本計画の統一成果（Work/Materials）は `web/`+`shared/` に伝播しない。**Work(#50/#51) / Materials(#53) は完了として温存、Schedule / Settings は着手しない**。Schedule 節（§Phase 2）の設計は破棄せず「web 移植時の "何を作り何を作らないか" 仕様の参照元」として保全。横断ロードマップ・次アクションの追跡正本は ClaudeDesign fan-out 計画 [`2026-07-04-claudedesign-screen-design-fanout.md`](../docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md) へ一本化した（旧 `2026-06-07-web-desktop-parity-roadmap.md` は archive 済で参照専用）。

> 本計画書は **master プラン**。Mobile / Desktop の UI/UX を「Mobile を正」として統一する作業を、
> **セクション単位（1 section = 1 phase = 1 PR）で段階的に**進めるための全体設計と各フェーズの枠を定義する。
> 各フェーズ着手時に、本書の該当セクション節を詳細化（または子計画書へ分割）してから実装する。
> **一括実装はしない**（認知負荷とデグレリスクの抑制）。

---

## Context

- **動機**: Mobile 版と Desktop 版で UI/UX が「完全コンポーネント分割」になっており（`main.tsx` が `isTauriMobile()` で `App`/`Layout` と `MobileApp`/`MobileLayout` を出し分け、Tailwind ブレークポイント不使用）、画面ごとに世界観が揃っていない。背景色トークン自体は既に共通（`notion-*` / CSS変数 / `data-theme`）なので、本質的な差は **レイアウト構造**。
- **到達イメージ**: 「Desktop の UI を開発ツールで Mobile サイズに縮小したら、現状の Mobile と同じレイアウトになる」状態。**Mobile を正（到達点）とし、Desktop を寄せる**。
- **制約**:
  - Desktop 全体は別途リファクタ進行中 → **触る範囲はセクション単位に限定**し、他セクションには波及させない
  - コスト $0（完成まで）
  - CLAUDE.md §7.4 worktree 規約（1 chat = 1 worktree = 1 branch）。**各フェーズは専用 worktree + feature ブランチ**で実施
  - Mobile 既存実装の **デグレ 0** が最優先（現状画面と 1px も変えない）
- **Non-goals**:
  - 単一レスポンシブ実装（1 コンポーネントがブレークポイントで変形）への全面移行は **今回やらない**。当面は `variant` prop によるコンポーネント内分岐で「見た目の統一」を実現する
  - Connect / Analytics セクションの統一（後述。Mobile に「正」が無いため対象外）
  - テーマトークン（色）の再設計（既に共通のため不要）

---

## 対象セクションと段階（Phase）

Section は §3.2 の 6 つ（schedule / materials / connect / work / analytics / settings）。
**Mobile に実装があるのは 4 つ**（schedule / work / materials / settings）。Connect / Analytics は Desktop 専用で Mobile 側に「正」が無いため、本統一の **対象外**（現状維持。将来別計画）。

| Phase | Section             | Mobile（正）の実装                             | Desktop の実装                                                                          | 状態                               |
| ----- | ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| 1     | **Work**            | `MobileWorkView` + `Mobile/*`                  | `WorkScreen` + `Work/*`                                                                 | **設計済**（§Phase 1）             |
| 2     | **Schedule**        | `MobileCalendarView` + `Mobile/schedule/*`     | `ScheduleList/ScheduleSection`（実入口・4タブ）+ `Tasks/Schedule/*`（子部品 + shared/） | **設計済**（§Phase 2、2026-06-07） |
| 3     | **Materials**       | `DailyView`/`NotesView` + `Mobile/materials/*` | Materials 系（`Ideas/*` 等）                                                            | 未設計（着手時に詳細化）           |
| 4     | **Settings**        | `MobileSettingsView` + `Mobile/settings/*`     | `Settings/*`                                                                            | 未設計（着手時に詳細化）           |
| —     | Connect / Analytics | （なし）                                       | `ConnectView` / `AnalyticsView`                                                         | **対象外**（Mobile 不在）          |

### 推奨順序と根拠

1. **Phase 1 = Work を先行（パイロット）**。理由: 既に詳細設計済み・規模が小さく・共通化パターンの検証に最適。ここで「統一プレイブック」を確立する。
2. Phase 2 以降の順序（Schedule / Materials / Settings）は **ユーザー優先度で調整可**。Schedule を先にしたい場合は Phase 2↔1 入替も可（ただし Work は設計済みのため最初に通すのが効率的）。
3. 各 Phase は**独立した PR**。前 Phase 完了（main merge）後に次へ。

> **決定が必要な点（各 Phase 着手時）**: そのセクションで「Desktop 専用だが Mobile に無い機能」をどう扱うか（削除 / Desktop だけ残す / 共通化）。Work では「History・Music・FREE は削除、旧 TaskSelector は Desktop 維持」と決定済（§Phase 1）。Schedule/Materials/Settings は着手時に同様の棚卸しを行う。

---

## 統一プレイブック（全 Phase 共通の型）

各セクションは以下の手順を踏む。Work（Phase 1）で具体化し、以降のセクションはこの型を流用する。

1. **棚卸し**: 対象セクションの Mobile 実装（正）と Desktop 実装を読み、機能差分を表化。Desktop 専用機能の「削除 / Desktop 維持 / 共通化」をユーザーと合意。
2. **共有部品抽出**: Mobile 実装中のインライン表示部品を、プラットフォーム非依存な共有ディレクトリ（例 `<Section>/view/`）へ切り出す（props 駆動・context 非依存なものから）。
3. **統一 View 新設**: `<SectionView variant="mobile" | "desktop">` を作成。`variant` で吸収する差は最小限に保つ:
   | 観点                     | mobile                                 | desktop                                        |
   | ------------------------ | -------------------------------------- | ---------------------------------------------- |
   | ルート余白               | 現状の className を変えない（デグレ0） | `mx-auto max-w-*` で中央寄せ・hover 追加       |
   | モーダル/シート host     | View 内（現状維持） or 各 host         | App グローバル等、二重表示を避ける配置         |
   | サイドバー/設定          | Mobile は drawer（現状維持）           | `RightSidebarContext.portalTarget` へ portal   |
   | プラットフォーム専用機能 | （Mobile 仕様）                        | variant 分岐で維持 or 撤去（棚卸し結果に従う） |
4. **配線**: `App.tsx`（desktop）と `MobileApp.tsx`（mobile）の該当 `case` を統一 View に差し替え。
5. **撤去**: 棚卸しで「削除」と決めた Desktop 専用コンポーネント / 機能を除去。barrel（`index.ts`）整合を同一 PR で完結。
6. **i18n**: 共有 View が使うキーを en/ja 両方に追補（fallback 依存の解消）。
7. **検証ゲート**: `npm run build` exit 0 → `npm run lint` → `npx vitest run` → **Mobile デグレ0 目視** + **Desktop 統一 目視**。

### 共通の注意点（Work 調査で判明・全 Phase で再確認）

- **孤児コンポーネント**: `Mobile/<section>/` 等に import 0 件の旧抽出物が眠っている可能性あり（Work では `Mobile/work/` に 4 ファイルあった）。**現在画面に出ているインライン版を正**とし、孤児は採用せず破棄。
- **完了モーダル等の二重表示**: 統一 View 内とグローバル host の両方でレンダリングすると重複する。配置を片方に決める。
- **barrel 割れ**: `index.ts` の export 差し替えと import 元の修正は同一 PR・同一セッションで完結（途中でビルドが割れる）。

---

## Phase 1 — Work（設計済・パイロット）

### Scope (Touchable Paths)

```
frontend/src/components/Work/**
frontend/src/components/Mobile/MobileWorkView.tsx
frontend/src/components/Mobile/work/**
frontend/src/App.tsx
frontend/src/MobileApp.tsx
frontend/src/i18n/locales/en.json
frontend/src/i18n/locales/ja.json
.claude/docs/vision/plans/2026-06-05-mobile-first-section-unification.md
```

**触らない**: `context/TimerContext.tsx` / `timerReducer.ts` / `TimerContextValue.ts` / `providers/**` / `Settings/**` / `Layout/**`

### 合意済みの方針（Work 固有）

- Mobile を正、Desktop を寄せる
- Desktop の **History タブ / Music タブ（音楽機能）は削除**
- タスクセレクタ: **Desktop だけ旧セレクタ（インライン新規作成・フォルダ階層）を残す**（variant 分岐。mobile=ボトムシート / desktop=旧ドロップダウン）
- **FREE ストップウォッチは削除**（唯一の起動口が `WorkScreen` 内ボタンのみ。削除で到達不能になるが Mobile に無いので方針通り。`TimerContext` の FREE ロジックは休眠保持＝変更しない）

### 設計の要点

- **共有 `WorkView.tsx`（`variant` prop）**: 現行インライン `MobileWorkView` 本体を移植。表示部品（`SessionTabs`/`ActiveTaskChip`/`TimerArc`/`SessionDots`/`ControlDock`）を `Work/view/` に抽出。
  - 完了モーダル: **mobile variant のみ** View 内で描画（簡易シート）。Desktop は既存の App グローバル `SessionCompletionModal`（リッチ版）を維持（二重表示回避）。
  - タスク選択: mobile=`ActiveTaskChip`+ボトムシート / desktop=旧 `TaskSelector`（`timer.openForTask`＝準備のみの Desktop 挙動を維持）。
  - 右サイドバー: desktop variant のみ `RightSidebarContext.portalTarget` に `WorkSidebarInfo` を `createPortal`。
- **History/Music 削除**: `WorkScreen.tsx` / `WorkHistoryContent.tsx` / `WorkMusicContent.tsx` を削除。`WorkSidebarInfo.tsx` は **Now Playing（Section 1）+ audio 依存のみ削除**、Pomodoro/Work Time は維持（Mobile は元々 `audio=null` で Now Playing 非表示＝デグレ0）。
- **FREE 削除**: `WorkScreen` 削除で起動口・`FreeSessionSaveDialog` host が同時消滅。移設不要（`pendingFreeSave` が立たなくなる）。`TimerContext` は無変更。
- **孤立許容**: `Work/Music/*` / `PlaylistSelectPopover` / `TimerCircularProgress` / `TimerDisplay` / `TodaySessionSummary` は参照 0 になるが物理削除は別 PR（Desktop 全体リファクタ進行中のため）。旧 `TaskSelector` は Desktop で現役継続。

### Steps

| #   | Step                                                                                                                         | Gate    | Acceptance                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------- |
| 1   | `Work/view/` に共有部品抽出（TimerComponents/WorkTaskSelector/SessionCompletionSheet/folderPath）+ 孤児 `Mobile/work/*` 削除 | 🤖 自律 | `npm run build` exit 0                  |
| 2   | `Work/WorkView.tsx` 新設（`variant` prop。未配線）                                                                           | 🤖 自律 | `npm run build` exit 0                  |
| 3   | Mobile 配線（`MobileApp` → `WorkView variant=mobile`、`MobileWorkView` 削除）                                                | 🤖→👀   | build 緑 + **Mobile 現状完全一致 目視** |
| 4   | Desktop 配線（`App` → `WorkView variant=desktop`、`WorkScreen` 削除、barrel 更新）                                           | 🤖→👀   | build 緑 + **Desktop 目視**             |
| 5   | `WorkSidebarInfo` から Now Playing 削除                                                                                      | 🤖→👀   | build 緑 + 右サイドバー/drawer 目視     |
| 6   | History/Music 削除 + i18n 追補（en/ja）                                                                                      | 🤖 自律 | build 緑 + lint 緑                      |
| 7   | 検証（build/lint/vitest + 目視）                                                                                             | 👀 目視 | 下記 Acceptance 全項目                  |
| 8   | PR 作成 → main merge                                                                                                         | 🛑 人手 | レビュー & merge                        |

### Acceptance Criteria（Phase 1）

- [ ] `cd frontend && npm run build` exit 0
- [ ] `cd frontend && npm run lint` 警告 0（未使用 import 残存なし）
- [ ] `cd frontend && npx vitest run` 緑（WorkScreen/MobileWorkView 依存テストは無い＝grep 確認済）
- [ ] 👀 Mobile: Work 画面が現行と視覚的に完全一致。drawer 設定が Pomodoro/WorkTime のみ。完了モーダル従来通り
- [ ] 👀 Desktop: タイマー中心 UI（中央寄せ）/ History・Music タブ無し / 右サイドバー Pomodoro/WorkTime のみ / 旧 TaskSelector 動作 / WORK 完了で完了モーダルが**1つだけ** / FREE ボタン消滅

### リスク（Phase 1）

1. Mobile デグレ（孤児版採用で見た目変化）→ 現行インライン版を正とする
2. 二重モーダル（desktop variant で完了モーダル描画）→ mobile 限定を厳守、目視で 1 個確認
3. barrel 割れ → `Work/index.ts` 差し替えと App import を同一 PR で
4. Desktop タスク完了導線の縮小（旧「Complete Task」常時ボタン廃止 → 完了モーダル経由のみ。Mobile 準拠の許容変更）

---

## Phase 2 — Schedule（設計済・2026-06-07 詳細化）

> 棚卸し（role-pm + Explore）とユーザー合意の結果を反映。**スコープは「見た目統一のみ」**（データ経路・DnD 機構は Non-goal）。Schedule は Work より格段に複雑（Desktop 4タブ vs Mobile 2サブタブ）のため、削除/維持を明確に確定済み。

### Scope (Touchable Paths)

```
frontend/src/components/ScheduleList/**                  ← Desktop 実入口（4タブ ScheduleSection）
frontend/src/components/Tasks/Schedule/**                ← Desktop 子部品 + shared/
frontend/src/components/Mobile/MobileCalendarView.tsx
frontend/src/components/Mobile/MobileCalendarStrip.tsx
frontend/src/components/Mobile/MobileScheduleItemForm.tsx
frontend/src/components/Mobile/schedule/**
frontend/src/App.tsx / frontend/src/MobileApp.tsx        ← 配線
frontend/src/hooks/useScheduleContext.ts                 ← CalendarTags 依存除去
frontend/src/i18n/locales/en.json / ja.json
.claude/docs/vision/plans/2026-06-05-mobile-first-section-unification.md
```

**触らない**: `context/**`（Provider 本体）/ `providers/**`（順序 §6.2）/ `services/**`（DataService 境界）/ DB・migration / 他セクション / **Routine 再設計（別フェーズ）**

### 合意済みの方針（Schedule 固有）

- Mobile を正、Desktop を寄せる。**見た目統一のみ**（Mobile の getDataService 直呼び = known-issue 009 構図、DnD 機構の差は触らない）
- **削除する**:
  - 週ビュー（`WeeklyTimeGrid`）
  - Dual Column（DayFlow の今日・明日 2 列表示）
  - CalendarTags（`CalendarTagsPanel` + `useScheduleContext` からの `useCalendarTagsContext` 依存 + Events タブのタグフィルタ/タグ別グループ化）
  - 検索（Events タブの searchQuery）
- **Desktop variant で維持する**: Events タブ / Tasks タブ / DayFlow フィルタ6タブ / 高度操作（ブロックリサイズ・Role 変換・タスクからタイマー起動・ルーチングループ枠・祝日色・ホバープレビュー）
- **Routine 管理**: 現状の Desktop `RoutineManagementOverlay` は**一旦 Desktop variant 維持**。Routine を Events 派生系として再定義し 1 から UI/UX を作り直す再設計は**別フェーズ**（本計画 Phase 外。将来 `2026-NN-routine-events-derived-redesign.md`）。CLAUDE.md §4.3 DU-F 方針と整合
- **CalendarTags 削除の副次効果**: `useScheduleContext()` の**非 optional** `useCalendarTagsContext()` 依存が消え、Mobile（CalendarTagsProvider 非 mount）でのクラッシュ経路が**根本解消**。optional hook 化は不要に

### 設計の要点

- **共有 `ScheduleView.tsx`（`variant` prop）**: Mobile の Monthly / DayFlow を共通核に。表示部品を `Schedule/view/`（または `Tasks/Schedule/view/`）へ抽出（props 駆動・context 非依存なものから）。
  - mobile variant: 現行 `MobileCalendarView` 本体を移植（デグレ0。シート3段階・スワイプ・Calendar Strip はそのまま）
  - desktop variant: Monthly/DayFlow を Mobile レイアウトに寄せつつ、Events/Tasks タブ・高度操作を variant 分岐で温存。右サイドバーは `RightSidebarContext.portalTarget` へ portal（Work と同方式）
- **DnD**: variant ごとに既存機構を維持（mobile=`useMobileLongPressDrag` / desktop=`@dnd-kit`）。機構統一は Non-goal
- **CalendarTags 撤去**: `useScheduleContext` から依存除去 → `CalendarTagsPanel` 削除 → Events タブのタグ機能削除。参照元を grep で全把握してから（known-issue 015 透明落ち注意）

### Steps

| #   | Step                                                                                        | Gate    | Acceptance                              |
| --- | ------------------------------------------------------------------------------------------- | ------- | --------------------------------------- |
| 1   | 棚卸し詳細化 + 削除対象（週/Dual Column/CalendarTags/検索）の参照元 grep 確定               | 🤖 自律 | 影響範囲リスト化                        |
| 2   | `Schedule/view/` に共有部品抽出（孤児コンポーネント破棄）                                   | 🤖 自律 | `npm run build` exit 0                  |
| 3   | `ScheduleView.tsx` 新設（`variant` prop・未配線）                                           | 🤖 自律 | build 緑                                |
| 4   | Mobile 配線（`MobileApp` → `ScheduleView variant=mobile`、`MobileCalendarView` 置換）       | 🤖→👀   | build 緑 + **Mobile 現状完全一致 目視** |
| 5   | Desktop 配線（`App` → `ScheduleView variant=desktop`、`ScheduleSection` 置換、barrel 更新） | 🤖→👀   | build 緑 + **Desktop 目視**             |
| 6   | 削除実施（週ビュー / Dual Column / CalendarTags + `useScheduleContext` 依存除去 / 検索）    | 🤖→👀   | build 緑 + 目視                         |
| 7   | i18n 追補（en/ja）+ barrel 整合                                                             | 🤖 自律 | build 緑 + lint 緑                      |
| 8   | 検証（build / lint / vitest + 目視）                                                        | 👀 目視 | 下記 Acceptance 全項目                  |
| 9   | PR 作成 → main merge                                                                        | 🛑 人手 | レビュー & merge                        |

### Acceptance Criteria（Phase 2）

- [ ] `cd frontend && npm run build` exit 0
- [ ] `cd frontend && npm run lint` 警告増なし（main baseline と同等）
- [ ] `cd frontend && npx vitest run` 緑
- [ ] 👀 Mobile: Schedule 画面（Monthly/DayFlow・シート・スワイプ）が現行と視覚的に完全一致
- [ ] 👀 Desktop: Monthly/DayFlow が Mobile レイアウト（中央寄せ縮小版）/ 週ビュー・Dual Column・CalendarTags・検索が消滅 / Events・Tasks タブ動作 / Routine 管理動作 / 高度操作（リサイズ等）維持

### リスク（Phase 2）

1. **CalendarTags 削除の参照漏れ** → `useScheduleContext` / Events タブ / 色分け / Provider を grep 徹底。削除で Mobile クラッシュ経路が消えるのは利得
2. **巨大ファイルの barrel 割れ**（`CalendarView` 38KB / `OneDaySchedule` 43KB / `ScheduleTimeGrid` 31KB）→ export 差し替えと import 修正を同一 PR で完結
3. **Mobile デグレ**（孤児版採用で見た目変化）→ 現行インライン版を正とする
4. **3分割 Provider 依存**: ScheduleItems / Routine は両環境で安全（Mobile も mount）。問題は CalendarTags だけ → 削除で解決
5. **データ経路非対称（known-issue 009）** → 見た目統一に限定し一本化しない（Non-goal 厳守）

### 別フェーズへの申し送り（Routine 再設計）

- 現状 Desktop `RoutineManagementOverlay` を Events 派生 UI に置換する再設計は本 Phase 外。Phase 2 完了後に専用計画書で着手。それまで Routine 管理は Desktop variant で現役維持（作成手段を絶やさない）。

## Phase 3 — Materials（**完了**: 統一作業不要 → dead code 整理のみ）

**結論**: Materials は **既に共有済み**のため、本計画の「統一作業（共有 View 新設・variant 分岐・配線差し替え）は不要\*\*。残作業は「Mobile 専用で誰からも import されていない dead code の削除」だけだった。軽い整理で完了。

- **正（共有実装）**: `Ideas/DailyView` / `Ideas/NotesView`（+ 各 Sidebar / TipTap）は **Desktop（`App.tsx`）と Mobile（`MobileApp.tsx`）で既に共有済み**。`MobileApp.tsx::case "materials"` は `materialsSubTab` に応じて共有 `DailyView` / `NotesView` を直接レンダリングしている（Mobile 専用ビューは経由しない）。
- **Files タブ（Desktop 維持）**: Desktop の Materials には FileExplorer 系（`Materials/FileExplorer*`）の Files タブがある。これは Mobile に「正」が無い Desktop 専用機能のため **削除せず Desktop に維持**（本フェーズでは一切触らない）。
- **削除した dead code（6 ファイル）**: 旧 Mobile 専用の Daily/Notes ビュー実装。共有化によって到達不能になり、`App.tsx` / `MobileApp.tsx` / `Ideas/*` を含む 6 ファイル"以外"のどこからも import されていないことを grep で確認済（6 ファイルは相互参照のみの閉じたクラスタ）。
  - `Mobile/MobileDailyView.tsx`
  - `Mobile/MobileNoteView.tsx`
  - `Mobile/materials/MobileNoteTree.tsx`
  - `Mobile/materials/MobileNoteTreeItem.tsx`
  - `Mobile/materials/MobileNoteTagsBar.tsx`
  - `Mobile/materials/MobileTagPicker.tsx`（削除で `Mobile/materials/` ディレクトリも空になり消滅）

### Acceptance Criteria（Phase 3）

- [x] 6 ファイルが 6 ファイル"以外"から import 0 件（grep 確認）
- [x] `cd frontend && npm run build` exit 0（参照切れ・型エラー 0）
- [x] `cd frontend && npm run lint` 新規警告 0（main baseline と同一の 99 problems。削除起因の増減なし）
- [x] Files タブ（FileExplorer 系）は Desktop に維持＝未変更

## Phase 4 — Settings（未設計・着手時に詳細化）

- **正**: `MobileSettingsView` + `Mobile/settings/*`（`MobileSettingsPrimitives` / `MobileTimerSection` / `MobileNotificationsSection` / `MobileFontSizeSection` / `MobileTrashSection`）
- **Desktop**: `Settings/*`
- **着手時にやること**: 設定項目の網羅性（Desktop にしか無い設定の扱い）。`ThemeContext` 等への波及を避ける。
- Gate/Acceptance/Scope は着手時に追記。

---

## 全体 Acceptance（master）

- [ ] 各 Phase が独立 PR で main へ merge 済み
- [ ] 各 Phase 完了時、Mobile デグレ 0（目視）
- [ ] 各 Phase 完了時、Desktop が当該セクションで Mobile レイアウトに一致（中央寄せ縮小版）
- [ ] 統一プレイブックが Work で確立され、以降のセクションで再利用されている

---

## DB Migration Notes

なし（本統一は UI レイヤーのみ。DB スキーマ・DataService 境界は不変）。

---

## Risks / Known Issues 参照

- 着手前に `.claude/docs/known-issues/INDEX.md` を grep（特に「透明落ち」「Provider 順序」「i18n fallback」関連）
- §6.4 規約: 主要 UI コンテナ背景に透明度禁止 / 共有コンポーネントは i18n を props 経由（`view/` は feature-local のため現状 `useTranslation` 内包を許容＝デグレ0 優先）

---

## References

- セクション別 要件定義 / UIUX 設計: `03`〜`10`（`03_要件定義書_Schedule` 〜 `10_UIUX設計書_Settings`）。共通トークンは `07 §1`
- 移行 SSOT: `2026-05-04-cross-platform-migration.md`
- worktree 規約: `2026-05-24-multi-chat-worktree-policy.md`（CLAUDE.md §7.4）
- related skills: `frontend-react-designer`（デザイン判断）/ `add-component`（配置）/ `lead-pipeline`（采配）

---

## Worklog

- 2026-06-05: 初版。スコープを「Work のみ」から「Mobile 実装のある 4 セクションをセクション単位で段階実装」へ拡張。Phase 1 = Work を設計済みパイロットとして詳細化。Connect/Analytics は Mobile 不在のため対象外と判断。実装は未着手（本書は計画のみ）。
- 2026-06-07: **Phase 3（Materials）完了**。調査の結果、Daily/Notes ビュー（`Ideas/DailyView` / `Ideas/NotesView` + 各 Sidebar / TipTap）は Desktop/Mobile で既に共有済みと判明 → 統一作業は不要。残った Mobile 専用 dead code 6 ファイル（`MobileDailyView` / `MobileNoteView` / `materials/MobileNoteTree` / `MobileNoteTreeItem` / `MobileNoteTagsBar` / `MobileTagPicker`、いずれも外部 import 0）を `git rm` で削除（`Mobile/materials/` ディレクトリも消滅）。Files タブ（Desktop の FileExplorer 系）は維持。`npm run build` exit 0 / lint は main baseline と同一の 99 problems（増減なし）。専用 worktree `feat/materials-section-cleanup` で実施。
- 2026-06-07: **Phase 2（Schedule）着手・設計確定**。role-pm + Explore で棚卸し → ユーザー合意でスコープ確定。実入口が `ScheduleList/ScheduleSection`（計画書の `Tasks/Schedule/*` 想定はズレ）と判明し表を訂正。**削除**: 週ビュー / Dual Column / CalendarTags / 検索。**Desktop variant 維持**: Events・Tasks タブ / フィルタ6タブ / 高度操作。**Routine 管理は一旦維持**し、Events 派生系への再設計は別フェーズへ切り出し（CLAUDE.md §4.3 DU-F 整合）。スコープは「見た目統一のみ」（データ経路・DnD 機構は Non-goal）。CalendarTags 削除で `useScheduleContext` の非 optional CalendarTags 依存が消え Mobile クラッシュ経路が根本解消。実装は未着手（Scope/Steps/Acceptance/リスクを §Phase 2 に詳細化済み）。
- 2026-06-07: **FROZEN（Web 移行に一本化）**。2 レーン衝突調査（frontend 見た目統一 vs Web 移行）の結果、`frontend/` は移行 Phase 5 で破棄予定で、本計画の統一成果が `web/`+`shared/` に 1 行も伝播していないと判明 → ユーザー判断で **Web 移行を主軸に一本化**。本レーンは Schedule 以降を凍結し、Work/Materials は完了として温存。Schedule の設計（§Phase 2 の削除/維持の棚卸し）は破棄せず「web 移植時の仕様参照元」として保全する。横断ロードマップ・次アクションは統合 SSOT [`2026-06-07-web-desktop-parity-roadmap.md`](../../../archive/2026-06-07-web-desktop-parity-roadmap.md) が正本。
