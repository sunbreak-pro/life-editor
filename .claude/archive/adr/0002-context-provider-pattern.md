# ADR-0002: Context/Provider パターン標準化（Pattern A）

## Status: Accepted (Updated: 2026-04-14)

## Date: 2026-04-05

## Context

コードベースに複数の異なる Context/Provider パターンが混在していた。新規追加時にどのパターンに従うべきか不明確で、一貫性が欠けていた。

## Decision

**Pattern A（3ファイル構成）** を標準とする:

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

## Exceptions

以下の条件を**すべて**満たす場合、単一ファイル構成を許容する:

- 他の Provider がこの Context に依存しない
- ContextValue 型が他の Context ファイルから参照されない
- 実装が自己完結している（単純な状態 + フック）

現在の例外: `ToastContext`（UIフィードバック専用）、`AnalyticsFilterContext`（Analytics セクション内ローカル）

## Consequences

- 新規 Context 追加時の手順が明確
- 全ての Context が同一パターンで予測可能
- consumer hook は `createContextHook` 経由で型安全
- 小規模な自己完結 Context は単一ファイルで簡潔に記述可能
