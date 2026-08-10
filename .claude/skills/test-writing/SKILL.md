---
name: test-writing
description: "⚠️ STALE — 起動しないこと。frontend/ 前提でヘルパも実在しない。テストの書き方は shared/tests/ と web/tests/ の既存テストに倣い、コマンドは CLAUDE.md §7.1 を見る。"
---

> ⚠️ **STALE — この手順に従わないこと**（2026-08-10 確認）
>
> 本文が指す `frontend/src/` も `shared/src/test/renderWithProviders` / `mockDataService` も**実在しない**（repo 全体で 0 件）。`cd frontend && npm run test` も存在しないコマンド。
>
> 参照すべき正本: 実テストは `shared/tests/*.test.ts(x)` と `web/tests/`（既存に倣う）/ コマンドは CLAUDE.md §7.1（`cd shared && npm run test` / `cd web && npm run test`）/ **`web/tests/` は jsdom にレイアウトが無く要素の座標が全て 0** になる制約も §7.1 に記載。
>
> 以下は書き直しか retire かの判断待ちで残している履歴。

「test-writingを起動します」と表示する。

## セットアップ

テストファイルはソースと同じディレクトリに配置（コロケーション）:

```
frontend/src/hooks/
├── useMyHook.ts
└── useMyHook.test.ts
```

### DataService モック

```typescript
import { createMockDataService } from "../test/mockDataService";
import { setDataServiceForTest } from "../services/dataServiceFactory";

beforeEach(() => {
  const mockService = createMockDataService();
  setDataServiceForTest(mockService);
});
```

新メソッドを追加した場合、`mockDataService.ts` にもモックを追加する。

## パターン 1: Hook テスト

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";

describe("useMyHook", () => {
  it("should fetch items on mount", async () => {
    const mockService = createMockDataService();
    mockService.fetchItems.mockResolvedValue([{ id: "1", name: "test" }]);
    setDataServiceForTest(mockService);

    const { result } = renderHook(() => useMyHook());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
  });

  it("should add item", async () => {
    const { result } = renderHook(() => useMyHook());

    await act(async () => {
      await result.current.addItem("new item");
    });

    expect(mockService.createItem).toHaveBeenCalledWith("new item");
  });
});
```

## パターン 2: コンポーネントテスト

```typescript
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';

describe('MyComponent', () => {
  it('should render title', () => {
    renderWithProviders(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithProviders(<MyComponent onAction={onAction} />);

    await user.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

Context に依存するコンポーネントは `renderWithProviders` でラップすること。

## パターン 3: 純粋関数テスト

```typescript
import { formatDuration } from "./timerUtils";

describe("formatDuration", () => {
  it("should format seconds to mm:ss", () => {
    expect(formatDuration(90)).toBe("01:30");
    expect(formatDuration(0)).toBe("00:00");
  });
});
```

## 実行コマンド

```bash
cd frontend && npm run test              # 全テスト
cd frontend && npx vitest run src/path/to/File.test.tsx  # 単一ファイル
cd frontend && npm run test:watch        # ウォッチモード
```

## ルール

- `vi.fn()` / `vi.mock()` を使う（jest ではなく vitest）
- 非同期処理: `waitFor` で状態変化を待つ
- ユーザー操作: `@testing-library/user-event` を使う
- DOM検索: `getByRole` > `getByText` > `getByTestId` の優先順位
