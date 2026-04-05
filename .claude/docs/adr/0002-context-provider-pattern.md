# ADR-0002: Context/Provider パターン標準化（Pattern A）

## Status: Accepted

## Date: 2026-04-05

## Context

コードベースに4種類の異なる Context/Provider パターンが混在していた。新規追加時にどのパターンに従うべきか不明確で、一貫性が欠けていた。

## Decision

**Pattern A** を全 Context/Provider の標準とする。3ファイル構成:

```
context/FooContextValue.ts  → 型定義 + createContext
context/FooContext.tsx       → Provider component
hooks/useFooContext.ts       → consumer hook（createContextHook使用）
```

### ContextValue.ts

- interface または `ReturnType<typeof useHook>` で型を定義
- `createContext<T | null>(null)` でContext作成
- 型と Context を named export

### Context.tsx

- Provider component のみ
- フック呼び出し + useMemo でvalue合成
- ContextValue.ts から Context を import

### useFooContext.ts

- `createContextHook(FooContext, "useFooContext")` で consumer hook 作成
- ContextValue.ts から Context を import

### context/index.ts

- 各Contextに対して Provider, Context, ContextValue type を export

## Consequences

- 新規 Context 追加時の手順が明確
- 全ての Context が同一パターンで予測可能
- consumer hook は常に `createContextHook` 経由で型安全
