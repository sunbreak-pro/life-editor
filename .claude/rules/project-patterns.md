# Project Patterns

## 共有コンポーネント配置規約

| 種別                         | 配置先                                           | 例                               |
| ---------------------------- | ------------------------------------------------ | -------------------------------- |
| 共有UIコンポーネント         | `frontend/src/components/shared/`                | `Modal.tsx`, `IconButton.tsx`    |
| 共有フック                   | `frontend/src/hooks/`                            | `useInlineEdit.ts`               |
| Context (型 + createContext) | `frontend/src/context/FooContextValue.ts`        | `TimerContextValue.ts`           |
| Context (Provider)           | `frontend/src/context/FooContext.tsx`            | `TimerContext.tsx`               |
| Consumer hook                | `frontend/src/hooks/useFooContext.ts`            | `useTimerContext.ts`             |
| 共有型定義                   | `frontend/src/types/`                            | `shared.ts`                      |
| Schedule共通コンポーネント   | `frontend/src/components/Tasks/Schedule/shared/` | `RoleSwitcher.tsx`               |
| UndoRedo ロジック            | `frontend/src/utils/undoRedo/`                   | `UndoRedoManager.ts`, `types.ts` |

## 共有コンポーネント設計

- Tailwind のデザイントークン（`notion-*`）使用、ハードコード禁止
- i18n テキストは props で受け取る（コンポーネント内で `useTranslation()` を呼ばない）
- サイズバリエーション: `size?: 'sm' | 'md' | 'lg'`
- IME 対応: `e.nativeEvent.isComposing` チェック必須

## 共有フック設計

- ジェネリクスでエンティティ型を外部化: `useDataFetch<T>(fetcher)`
- DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）
- UndoRedo 統合は `push` 関数を引数で受け取る

## Context/Provider パターン（Pattern A — ADR-0002）

新しい Context/Provider 作成時は必ず以下の3ファイル構成:

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider component（フック呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

### バレルexport

`context/index.ts` に以下を追加:

```typescript
export { FooProvider } from "./FooContext";
export { FooContext } from "./FooContextValue";
export type { FooContextValue } from "./FooContextValue";
```

### Schedule 共通コンポーネント（ADR-0004）

Calendar / DayFlow / Routine の2つ以上から参照されるコンポーネントは `Tasks/Schedule/shared/` に配置

## レイヤー別リファクタリング注意

- **Repository**: prepared statements の再利用維持、`rowToModel` パターン
- **IPC**: チャンネル名変更時は3点セット更新（preload / Handlers / ElectronDataService）
- **DataService**: インターフェース → 実装 → モックの順で変更
