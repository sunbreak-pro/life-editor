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

## Provider 順序（依存制約）

- **Desktop**（外→内）: ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Daily → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig → SidebarLinks
- **Mobile**: ScreenLock / FileExplorer / CalendarTags / Audio / ShortcutConfig を省く（WikiTag / SidebarLinks は両方有効）
- **不変式**: 内側 Provider は外側 Context に依存可、逆は不可（例: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider）
- Mobile 省略 Provider は **Optional バリアント必須**（→ `docs/vision/coding-principles.md §4`）

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

（旧 frontend/ 内の配置表は削除済み。UndoRedo は web 未移植 — 参照は git tag `pre-tauri-removal`）

## デザイン規約（不変式）

- `lumen-*` トークン使用（色のハードコード禁止）
- **主要 UI コンテナ背景に透明度禁止**（不透明トークン使用。未定義クラスは silent fail で透明落ち）
- i18n は props 経由（部品フック内で `useTranslation()` 禁止）。文言は `react-i18next` の en / ja 両 catalog に追加
- DataService はコールバック注入（フック内で `getDataService()` 直呼び禁止）
- ジェネリクスで型外部化
- 詳細 → `docs/vision/coding-principles.md §5`

## Schedule 3 分割

- `RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider`。`useScheduleContext()` は後方互換ファサード — 新コードは個別 hook を直接使用。複数参照される部品は `Schedule/shared/` へ（背景 → `docs/vision/coding-principles.md §3`）

## Gotchas

- **IME**: keydown 処理に `e.nativeEvent.isComposing` チェック必須（日本語入力破壊防止）
- **リッチテキスト**: TipTap
- **DnD**: `@dnd-kit`。`moveNode`（並び替え）と `moveNodeInto`（階層移動）は別操作
