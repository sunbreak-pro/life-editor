# 026: コンポーネント共通化リファクタリング

**Status**: PLANNED
**Created**: 2026-03-09

---

## 概要

コードベース全体に散在するUI コンポーネント・フック・Context の重複パターンを共通化し、保守性と一貫性を向上させる。

### 対象範囲

- タグ管理 UI（TagsTabView, SoundTagManager, RoutineTagManager）
- データフック（useNotes, useMemos, useRoutines）
- Context/Provider パターン（NoteContext, MemoContext, WikiTagContext）

### 対象外

- ドメイン固有ロジック（タスクツリー操作、タイマー制御等）
- Electron/IPC レイヤー
- 既存の shared コンポーネント（ColorPicker, ConfirmDialog 等）の変更

---

## 分析結果: 重複パターン一覧

### UIコンポーネント重複

| #   | パターン                | 重複箇所                                                                                    | 概要                                               |
| --- | ----------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Modal (overlay+card)    | `RoutineEditDialog.tsx:56-157`, `CalendarCreateDialog.tsx:40-112`, `SessionCompletionModal` | fixed overlay + カード + ヘッダー + ボタン群の構造 |
| 2   | EmptyState              | `NoteList.tsx:105-108`, `TagsTabView.tsx:232-236`, `TrashView.tsx:145-154` 等               | アイコン + メッセージのセンタリング表示            |
| 3   | IconButton/HoverActions | 16ファイルで `opacity-0 group-hover:opacity-100` パターン                                   | ホバー時に表示されるアクションボタン群             |
| 4   | InlineEditField         | `TagsTabView.tsx:120-150`, `SoundTagManager` の editingId+input+Check/X ボタン              | インライン編集の入力+確定/キャンセルボタン         |
| 5   | ConfirmDeleteInline     | `TagsTabView.tsx:152-172`, `SoundTagManager:108-125`                                        | インライン削除確認 UI                              |
| 6   | TagListItem             | TagsTabView, SoundTagManager, RoutineTagManager                                             | 3状態（表示/編集/削除確認）リストアイテム          |
| 7   | CreateItemForm          | `TagsTabView.tsx:78-109`, SoundTagManager                                                   | name+color+作成ボタンのフォーム                    |
| 8   | Dropdown/Popover        | `MemoDateList.tsx:39-107`, `SortDropdown.tsx`                                               | click-outside 付きドロップダウン                   |
| 9   | (reserved)              | —                                                                                           | —                                                  |

### フック重複

| #   | パターン               | 重複箇所                                                                     | 概要                                                         |
| --- | ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | useDataFetch           | `useNotes.ts:16-29`, `useMemos.ts:17-32`, `useRoutines.ts:14-31` 等（5箇所） | `cancelled` フラグ付きフェッチ + useEffect                   |
| 2   | useInlineEdit          | `TagsTabView.tsx:19-38`, SoundTagManager                                     | editingId/editName/startEdit/saveEdit 状態管理               |
| 3   | useSoftDeletion        | `useNotes.ts:160-278`, useMemos, useRoutines                                 | softDelete+restore+permanentDelete+loadDeleted               |
| 4   | useConfirmState        | `TagsTabView.tsx:22`, SoundTagManager                                        | deleteConfirmId 管理                                         |
| 5   | capturePartialPrevious | `useNotes.ts:113-117`, useRoutines 等                                        | undo/redo 用 previous value キャプチャ（ユーティリティ関数） |

### Context 重複

| #   | パターン           | 重複箇所                                                   | 概要                                                |
| --- | ------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| 1   | createDataProvider | `NoteContext.tsx`, `MemoContext.tsx`, `WikiTagContext.tsx` | `createContext(null)` + Provider + useHook パターン |

---

## Phase 1: 共有UIプリミティブ

### 作成ファイル

#### `frontend/src/components/shared/Modal.tsx`

汎用モーダルコンポーネント（Composition 型）。

```typescript
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

**重複元:** RoutineEditDialog.tsx:56-157, CalendarCreateDialog.tsx:40-112, SessionCompletionModal

#### `frontend/src/components/shared/EmptyState.tsx`

空状態表示コンポーネント。

```typescript
export interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  description?: string;
  action?: React.ReactNode;
}
```

**重複元:** NoteList.tsx:105-108, TagsTabView.tsx:232-236, TrashView.tsx:145-154

#### `frontend/src/components/shared/IconButton.tsx`

アイコンボタンコンポーネント。

```typescript
export interface IconButtonProps {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline" | "solid";
  className?: string;
}
```

#### `frontend/src/components/shared/HoverActions.tsx`

ホバー時表示アクション群。

```typescript
export interface HoverActionsProps {
  children: React.ReactNode;
  className?: string;
}
```

**重複元:** 16ファイルの `opacity-0 group-hover:opacity-100` パターン

**期待削減:** ~80行

---

## Phase 2: リスト操作系コンポーネント

### 作成ファイル

#### `frontend/src/components/shared/InlineEditField.tsx`

インライン編集フィールド（input + Check/X ボタン）。

```typescript
export interface InlineEditFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}
```

**重複元:** TagsTabView.tsx:120-150, SoundTagManager

#### `frontend/src/components/shared/ConfirmDeleteInline.tsx`

インライン削除確認UI。

```typescript
export interface ConfirmDeleteInlineProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**重複元:** TagsTabView.tsx:152-172, SoundTagManager:108-125

#### `frontend/src/components/shared/TagListItem.tsx`

3状態（表示/編集/削除確認）リストアイテム。

```typescript
export interface TagListItemProps<T> {
  tag: T;
  getLabel: (tag: T) => string;
  getColor?: (tag: T) => string;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  renderExtra?: (tag: T) => React.ReactNode;
}
```

**重複元:** TagsTabView, SoundTagManager, RoutineTagManager

#### `frontend/src/components/shared/CreateItemForm.tsx`

新規アイテム作成フォーム（name + color + create ボタン）。

```typescript
export interface CreateItemFormProps {
  name: string;
  onNameChange: (name: string) => void;
  color?: string;
  onColorChange?: (color: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  showColorPicker?: boolean;
}
```

**重複元:** TagsTabView.tsx:78-109, SoundTagManager

**期待削減:** ~150行

---

## Phase 3: 共有フック抽出

### 作成ファイル

#### `frontend/src/hooks/useDataFetch.ts`

```typescript
export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  options?: {
    deps?: React.DependencyList;
    onError?: (error: unknown) => void;
  },
): { data: T | undefined; loading: boolean; refetch: () => Promise<void> };
```

**重複元:** useNotes.ts:16-29, useMemos.ts:17-32, useRoutines.ts:14-31 等（5箇所）

#### `frontend/src/hooks/useInlineEdit.ts`

```typescript
export function useInlineEdit<T extends { id: string }>(options: {
  onSave: (id: string, newValue: string) => Promise<void>;
}): {
  editingId: string | null;
  editValue: string;
  startEdit: (item: T, currentValue: string) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
  setEditValue: (value: string) => void;
};
```

**重複元:** TagsTabView.tsx:19-38, SoundTagManager

#### `frontend/src/hooks/useSoftDeletion.ts`

```typescript
export function useSoftDeletion<T extends { id: string }>(operations: {
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  loadDeleted: () => Promise<T[]>;
}): {
  deletedItems: T[];
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  refreshDeleted: () => Promise<void>;
};
```

**重複元:** useNotes.ts:160-278, useMemos, useRoutines

#### `frontend/src/hooks/useConfirmState.ts`

```typescript
export function useConfirmState(): {
  confirmId: string | null;
  requestConfirm: (id: string) => void;
  cancelConfirm: () => void;
  isConfirming: (id: string) => boolean;
};
```

**重複元:** TagsTabView.tsx:22, SoundTagManager

#### `frontend/src/utils/capturePartialPrevious.ts`（ユーティリティ関数）

```typescript
export function capturePartialPrevious<T>(
  current: T,
  keys: (keyof T)[],
): Partial<T>;
```

**重複元:** useNotes.ts:113-117, useRoutines

**期待削減:** ~200行

---

## Phase 4: Context ファクトリ

### 作成ファイル

#### `frontend/src/context/createDataProvider.ts`

```typescript
export function createDataProvider<T>(
  useHook: () => T,
  displayName: string,
): {
  Provider: React.FC<{ children: React.ReactNode }>;
  useContext: () => T;
};
```

**重複元:** NoteContext.tsx, MemoContext.tsx, WikiTagContext.tsx

**期待削減:** 各 Context ファイルが ~30行 → ~5行（~75行削減）

---

## Phase 5: 既存コード移行

### Phase 5a: TagsTabView 移行

TagsTabView.tsx を Phase 1-3 の共通コンポーネント/フックで書き直す。

- InlineEditField, ConfirmDeleteInline, TagListItem, CreateItemForm を使用
- useInlineEdit, useConfirmState フックを使用
- **241行 → ~80行**

### Phase 5b: SoundTagManager 移行

SoundTagManager を同様に移行。

- **~195行 → ~60行**

### Phase 5c: RoutineTagManager 移行

RoutineTagManager を同様に移行。

### Phase 5d: useNotes 移行

useDataFetch, useSoftDeletion を使用してリファクタリング。

- **321行 → ~200行**

### Phase 5e: useMemos, useRoutines 移行

useNotes と同様のパターンで移行。

### Phase 5f: Context 移行

NoteContext, MemoContext, WikiTagContext を createDataProvider で書き直す。

---

## 期待効果

| 項目           | 数値       |
| -------------- | ---------- |
| 新規コード     | ~310行     |
| 移行による削減 | ~980行     |
| **純削減**     | **~670行** |

### 主要ファイルの削減例

| ファイル            | Before | After  |
| ------------------- | ------ | ------ |
| TagsTabView.tsx     | 241行  | ~80行  |
| SoundTagManager.tsx | ~195行 | ~60行  |
| useNotes.ts         | 321行  | ~200行 |

---

## 検証方法

各 Phase 完了後に以下を実行:

```bash
cd frontend && npx tsc --noEmit    # 型チェック
cd frontend && npm run lint         # ESLint
cd frontend && npm run test         # テスト
```

### 移行時の確認事項

- [ ] 既存の動作が変わらないこと（手動確認）
- [ ] IME 対応が維持されていること（日本語入力テスト）
- [ ] Undo/Redo が正しく動作すること
- [ ] ソフトデリート→復元→完全削除のフローが維持されていること
- [ ] 不要なインポート・エクスポートが残っていないこと
