---
name: add-ipc-channel
description: "⚠️ STALE — 起動しないこと。教えている Electron / Tauri IPC 層が実在しない。データアクセスの正本は CLAUDE.md §3.1 の DataService 境界（shared/src/services/）。"
---

> ⚠️ **STALE — この手順に従わないこと**（2026-08-10 確認）
>
> 本文が指す `electron/preload.ts` / `electron/ipc/` / `frontend/src/services/ElectronDataService.ts` は**いずれも実在しない**。同じ層を監査していた `life-editor-ipc-validator` エージェントは 2026-07-08 に retire 済み（D-20260708-main-1）。
>
> 参照すべき正本: CLAUDE.md §3.1 — フロントは `getDataService()` 経由でのみデータへ触る。**コンポーネントからの直接バックエンド呼び出しは禁止**。実装は `shared/src/services/`。
>
> 以下は書き直しか retire かの判断待ちで残している履歴。

「add-ipc-channelを起動します」と表示する。

## 必須ファイル（3点セット）

### 1. preload.ts — チャンネル許可

`electron/preload.ts` の `ALLOWED_CHANNELS` に追加:

```typescript
const ALLOWED_CHANNELS = new Set([
  // ... existing channels
  "db:newDomain:fetchAll",
  "db:newDomain:create",
  "db:newDomain:update",
  "db:newDomain:delete",
]);
```

命名規則: `db:<domain>:<action>` / `ai:<action>` / `app:<action>`

### 2. \*Handlers.ts — ハンドラ実装

`electron/ipc/` に `newDomainHandlers.ts` を作成:

```typescript
import { ipcMain } from "electron";
import type { NewDomainRepository } from "../database/newDomainRepository";

export function registerNewDomainHandlers(repo: NewDomainRepository): void {
  ipcMain.handle("db:newDomain:fetchAll", async () => {
    return repo.fetchAll();
  });

  ipcMain.handle("db:newDomain:create", async (_event, ...args) => {
    return repo.create(...args);
  });
}
```

`electron/ipc/registerAll.ts` にハンドラ登録を追加。

### 3. ElectronDataService.ts — フロントエンド呼び出し

`frontend/src/services/ElectronDataService.ts` にメソッド追加:

```typescript
async fetchNewDomains(): Promise<NewDomain[]> {
  return this.invoke('db:newDomain:fetchAll');
}

async createNewDomain(data: NewDomainInput): Promise<NewDomain> {
  return this.invoke('db:newDomain:create', data);
}
```

## 任意ファイル（必要に応じて）

### 4. DataService.ts — インターフェース定義

新メソッドのシグネチャを `DataService` インターフェースに追加。

### 5. \*Repository.ts — データアクセス

新テーブルの場合は `/db-migration` スキルを参照して Repository を作成。

## 検証チェックリスト

1. [ ] `ALLOWED_CHANNELS` にチャンネル名が追加されている
2. [ ] ハンドラが `registerAll.ts` で登録されている
3. [ ] `ElectronDataService` にメソッドが追加されている
4. [ ] `DataService` インターフェースにシグネチャがある
5. [ ] チャンネル名が3箇所で一致している（typoなし）
6. [ ] ハンドラにエラーハンドリングがある
