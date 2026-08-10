---
paths:
  - "shared/src/**"
  - "web/src/**"
---

# Frontend 実装規約（path-scoped rule）

> CLAUDE.md §6 の詳細。`shared/` / `web/` のファイルを扱う時のみ自動ロードされる。
> 作成手順は `add-component` スキル、デザイン判断は `frontend-react-designer` スキル（rules = 不変式と表、skills = 手順）。

## UI 2 層モデル（W0 2026-06-07 確定 = 案 A）

- 新規 UI は `shared/src/components/`（部品層）に集約し、画面層は `web/src/`。Web / Electron / Capacitor の 3 配布形態が同一ソースを共用する（デザインシステム + `lumen-*` トークン + i18n en/ja catalog も `shared/` 側）。詳細 → `docs/vision/coding-principles.md §6`。旧 `frontend/`（Tauri 時代）は 2026-07-11 削除済み（#197・復元 = git tag `pre-tauri-removal`）

## 命名（プロジェクト固有のみ）

- Context Value 型は PascalCase ファイル名: `AudioContextValue.ts`。他は一般的 TS/React 慣習（コンポーネント PascalCase / フック `use`+camelCase / 定数 SCREAMING_SNAKE_CASE）

## Sync の再取得はドメイン単位（#499）

Realtime の変更通知は**ドメインごとのカウンタ**（`shared/src/context/syncDomains.ts` の tasks / notes / dailies / schedule / tags / calendars / timer / audio）に振り分けられる。データを読む effect は `useSyncDomains("notes", …)` で**自分が読むドメインを全部宣言**し、その戻り値を deps に入れる。

- **申告漏れは無言の stale になる**（更新が来ず、ユーザーに直す手段がない）。1 つの effect が複数ドメインを読むなら全部並べる。過剰宣言は余計な fetch 1 回で済むので、迷ったら足す側に倒す
- 新しいテーブルを `REALTIME_TABLES` に足したら `syncDomains.ts` の対応表にも足す（`syncDomains.test.ts` の lockstep が落ちる）
- 読み取りメソッドの中で書き込まない。`fetchTimerSettings` が「無ければ作る」upsert を毎回投げていたため、ノート編集が `timer_settings` に POST していた（#499 の実測）

## Provider 順序（依存制約）

一本鎖ではなく **2 階建て**: 常時マウントの**グローバル層**と、section switch の内側で入れ替わる**セクション層**。実際のネストはコードが正（`web/src/main.tsx` + `web/src/MainScreen.tsx`）。

- **グローバル層**（外→内）: I18n → Theme（`main.tsx`）→ Toast → Sync → UndoRedo（`UndoRedoHost` 経由）→ ShortcutConfig → Timer → Audio → RightSidebar（`MainScreen.tsx`）
- **セクション層**（section switch の内側。セクションごとに独立した鎖で、横並びの兄弟関係）:
  - Materials: WikiTagsUnified → TaskTree / NotesUnified / DailiesUnified
  - Schedule: Calendar → Routine → ScheduleItems
  - Analytics: AnalyticsFilter（`components/Analytics/AnalyticsView.tsx` 内）
- **不変式**: 内側 Provider は外側 Context に依存可、逆は不可（例: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider）
- **セクション層 gotcha**: セクション層 Provider は画面遷移で unmount するが、グローバル層は生き残る。グローバル層に状態を預ける機能は unmount 跨ぎの整合を自前で守ること（実例 = `TaskTreeContext.tsx` の unmount 時 UndoRedo stack clear）
- **Mobile 省略ガードは配線済み**（#320）: web ホスト（`web/src/MainScreen.tsx` の ShortcutConfigHost）が `isNativeMobile()`（`utils/platform.ts`）で native mobile 時に ShortcutConfig Provider を省略する（一覧は CLAUDE.md §2 が正）。Audio は Provider 維持（完了チャイム維持 = `docs/requirements/mobile-scope.md` #10/#11）で Ambient mixer UI のみ `WorkScreen.tsx` 側で native 省略。省略 Provider は Optional バリアント必須（→ `docs/vision/coding-principles.md §4`）— 消費側は null ガードで no-op にする

## Pattern A（Context/Provider 標準 — 3 ファイル）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider / Context / type を export。例外: 他 Provider が依存しない自己完結なら単一ファイル可（例 `ToastContext`）。

## 共有コンポーネント配置（shared/ 内）

| 種別          | 配置先                            |
| ------------- | --------------------------------- |
| 共有 UI       | `shared/src/components/`          |
| 共有フック    | `shared/src/hooks/`               |
| Context       | `shared/src/context/`             |
| 共有型        | `shared/src/types/`               |
| Schedule 共通 | `shared/src/components/schedule/` |

（旧 frontend/ 内の配置表は削除済み。UndoRedo は #304 で web 移植済み — `web/src/UndoRedoHost.tsx` / `HeaderUndoRedo.tsx` + `shared/src/utils/undoRedo/`）

## デザイン規約（不変式）

- `lumen-*` トークン使用（色のハードコード禁止）
- **主要 UI コンテナ背景に透明度禁止**（不透明トークン使用。未定義クラスは silent fail で透明落ち）
- i18n は props 経由（部品フック内で `useTranslation()` 禁止）。文言は `react-i18next` の en / ja 両 catalog に追加
- DataService はコールバック注入（フック内で `getDataService()` 直呼び禁止）
- ジェネリクスで型外部化
- 詳細 → `docs/vision/coding-principles.md §5`

## Schedule Provider 分割

- 現行は `CalendarProvider` → `RoutineProvider` → `ScheduleItemsProvider`（外→内）。`CalendarTagsProvider` は DU-F Step 3-5 で撤去済み（tag/link は `WikiTagsUnified` が引き継ぎ）、後方互換ファサード `useScheduleContext()` も現存しない — 個別 hook を直接使用する。複数参照される部品は `shared/src/components/schedule/` へ（背景 → `docs/vision/coding-principles.md §3`）

## テスト環境の制約（座標に依存する入力経路を作らない）

jsdom にレイアウトが無い（座標がすべて 0）という環境の事実の正本は **CLAUDE.md §7.1**。`shared/tests/` も同じで、`elementFromPoint` は null・画面座標を文書位置へ戻す経路（ProseMirror の `posAtCoords` と、その上に載る `handleClickOn` / `handleClick`）は検証できない。

- 規約: UI の入力経路は座標に依存しない形で組む — DOM イベント + `closest("[data-…]")` で対象を引く（実例 = `web/src/notes/itemLinkNode.ts` の `handleDOMEvents.click`）

## Gotchas

- **IME**: keydown 処理に `e.nativeEvent.isComposing` チェック必須（日本語入力破壊防止）
- **リッチテキスト**: TipTap
- **DnD**: `@dnd-kit`。ツリーの入れ子は #418 で退役（2026-07-27 ユーザー判断）。`moveNode` は同一階層の並び替え専用で、親を変える API（旧 `moveNodeInto`）は Tasks / Notes とも存在しない
