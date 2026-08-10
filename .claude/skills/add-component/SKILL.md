---
name: add-component
description: コンポーネント・Context・Provider 作成パターン。Use when creating new React components, contexts, or providers. Triggers include new component, new context, new provider, new section, new view.
---

「add-componentを起動します」と表示する。

## パターン 1: シンプルコンポーネント（UI only）

`frontend/src/components/` にファイルを作成:

```typescript
import { useTranslation } from 'react-i18next';

type Props = {
  title: string;
  onAction: () => void;
};

export function MyComponent({ title, onAction }: Props) {
  const { t } = useTranslation();
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <button onClick={onAction}>{t('common.action')}</button>
    </div>
  );
}
```

- named export を使う（default export 不可）
- ファイル名: PascalCase（`MyComponent.tsx`）
- i18n テキストは `en.json` / `ja.json` 両方に追加

## パターン 2: Context + Provider

参照パターン: `frontend/src/context/CalendarContext.tsx`

### 2a. カスタムフックを作成

```typescript
// frontend/src/hooks/useNewDomain.ts
export function useNewDomain() {
  const [items, setItems] = useState<Item[]>([]);
  // ... state & effects
  return { items, addItem, removeItem };
}
```

### 2b. Context + Provider を作成

```typescript
// frontend/src/context/NewDomainContext.tsx
import { createContext, type ReactNode } from 'react';
import { useNewDomain } from '../hooks/useNewDomain';

export type NewDomainContextValue = ReturnType<typeof useNewDomain>;

export const NewDomainContext = createContext<NewDomainContextValue | null>(null);

export function NewDomainProvider({ children }: { children: ReactNode }) {
  const value = useNewDomain();
  return (
    <NewDomainContext.Provider value={value}>
      {children}
    </NewDomainContext.Provider>
  );
}
```

### 2c. Consumer フックを作成

```typescript
export function useNewDomainContext() {
  const ctx = useContext(NewDomainContext);
  if (!ctx)
    throw new Error(
      "useNewDomainContext must be used within NewDomainProvider",
    );
  return ctx;
}
```

### 2d. Provider を登録

1. `frontend/src/main.tsx` — Provider stack に追加（順序に注意）
2. `frontend/src/test/renderWithProviders.tsx` — テスト用Providerにも追加

## パターン 3: セクション/ビュー追加

1. `frontend/src/components/` にビューコンポーネントを作成
2. `App.tsx` の `activeSection` 型にセクション名を追加
3. `App.tsx` の `MainContent` 内の条件分岐に追加
4. `Sidebar` にナビゲーション項目を追加
5. i18n のロケールファイルにラベルを追加

## チェックリスト

- [ ] named export を使っている
- [ ] Context の型は `ReturnType<typeof useHook>` パターン
- [ ] Provider を `main.tsx` と `renderWithProviders.tsx` の両方に追加
- [ ] i18n テキストが en/ja 両方にある
