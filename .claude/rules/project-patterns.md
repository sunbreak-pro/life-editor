# Project Patterns

## 共有コンポーネント配置規約

| 種別                 | 配置先                            | 例                            |
| -------------------- | --------------------------------- | ----------------------------- |
| 共有UIコンポーネント | `frontend/src/components/shared/` | `Modal.tsx`, `IconButton.tsx` |
| 共有フック           | `frontend/src/hooks/`             | `useInlineEdit.ts`            |
| Context              | `frontend/src/context/`           | `createDataProvider.ts`       |
| 共有型定義           | `frontend/src/types/`             | `shared.ts`                   |

## 共有コンポーネント設計

- Tailwind のデザイントークン（`notion-*`）使用、ハードコード禁止
- i18n テキストは props で受け取る（コンポーネント内で `useTranslation()` を呼ばない）
- サイズバリエーション: `size?: 'sm' | 'md' | 'lg'`
- IME 対応: `e.nativeEvent.isComposing` チェック必須

## 共有フック設計

- ジェネリクスでエンティティ型を外部化: `useDataFetch<T>(fetcher)`
- DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）
- UndoRedo 統合は `push` 関数を引数で受け取る

## レイヤー別リファクタリング注意

- **Repository**: prepared statements の再利用維持、`rowToModel` パターン
- **IPC**: チャンネル名変更時は3点セット更新（preload / Handlers / ElectronDataService）
- **DataService**: インターフェース → 実装 → モックの順で変更
