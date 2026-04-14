# Plan: Capacitor iOS スタンドアロンアプリ

**Status:** PLANNED
**Created:** 2026-04-14
**Task:** Capacitor iOS App（MEMORY.md）
**Project:** /Users/newlife/dev/apps/notion-timer
**Supersedes:** `2026-03-16-mobile-phase3-offline-standalone.md`（Phase 3 の方針を Capacitor に変更）

---

## Context

Life Editor のモバイル版をデスクトップ Electron バックエンドから独立させ、iOS 端末のみでスタンドアロン動作させる。既存のモバイルUI（11コンポーネント）と DataService 抽象化をそのまま活用し、Capacitor で WKWebView ラップする。

**Why:** 現在のモバイルは Desktop Electron → Hono server → SQLite に依存。外出先ではデスクトップ不要で使いたい。
**How to apply:** `OfflineDataService` をフォークし、REST 依存を除去した `StandaloneDataService` を作成。将来のクラウド同期は SyncQueue 再有効化で対応可能な設計とする。

---

## Phase 1: Capacitor スタンドアロン iOS App

### [ ] Step 1: Capacitor プロジェクト初期化

**目的**: Capacitor CLI セットアップ + iOS プロジェクト生成

1. ルート `package.json` に依存追加:

   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   ```

2. `capacitor.config.ts` を **プロジェクトルート** に作成:

   ```typescript
   import type { CapacitorConfig } from "@capacitor/core";

   const config: CapacitorConfig = {
     appId: "com.lifeEditor.app",
     appName: "Life Editor",
     webDir: "frontend/dist",
     server: {
       androidScheme: "https",
     },
   };

   export default config;
   ```

3. iOS プロジェクト生成:
   ```bash
   cd frontend && npm run build && cd ..
   npx cap add ios
   npx cap sync
   ```

**新規ファイル**:

- `capacitor.config.ts`
- `ios/` (自動生成)

**変更ファイル**:

- `package.json` (dependencies追加)
- `.gitignore` (ios/App/Podfile.lock 等の追加検討)

---

### [ ] Step 2: StandaloneDataService 作成

**目的**: REST 依存を除去し、IndexedDB を主ストアとする DataService 実装

**ソースファイル**: `frontend/src/services/OfflineDataService.ts` (1,877行) をフォーク

**設計方針**:

| OfflineDataService のパターン                    | StandaloneDataService での変更                                    |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `withFallback(store, restCall, idbFallback)`     | `idbFallback` のみ実行（REST 不要）                               |
| `this.rest.fetchXxx()`                           | 削除。IndexedDB から直接読み取り                                  |
| `this.syncQueue.enqueue()`                       | **残す**（Phase 2 で再有効化するため）。ただし `flush()` は no-op |
| `performIncrementalSync()` / `performFullSync()` | 削除（同期先なし）                                                |
| `this.rest = new RestDataService()`              | 削除                                                              |
| `notSupported()` 呼び出し（91メソッド）          | そのまま維持                                                      |

**具体的な変更パターン**:

```typescript
// Before (OfflineDataService)
fetchTaskTree(): Promise<TaskNode[]> {
  return this.withFallback("tasks",
    async () => {
      const result = await this.rest.fetchTaskTree();
      // ... update cache
      return result;
    },
    () => this.getAllFromStore<TaskNode>("tasks", (t) => !t.isDeleted),
  );
}

// After (StandaloneDataService)
async fetchTaskTree(): Promise<TaskNode[]> {
  return this.getAllFromStore<TaskNode>("tasks", (t) => !t.isDeleted);
}
```

```typescript
// Before (OfflineDataService)
async createTask(node: TaskNode): Promise<TaskNode> {
  const db = await getOfflineDb();
  await db.put("tasks", node as unknown as Record<string, unknown>);
  await this.syncQueue.enqueue("task", node.id, "create", node);
  try {
    const result = await this.rest.createTask(node);
    await db.put("tasks", result as unknown as Record<string, unknown>);
    return result;
  } catch {
    return node;
  }
}

// After (StandaloneDataService)
async createTask(node: TaskNode): Promise<TaskNode> {
  const db = await getOfflineDb();
  await db.put("tasks", node as unknown as Record<string, unknown>);
  // SyncQueue enqueue は残す（Phase 2 で flush 先をクラウドに向ける）
  await this.syncQueue.enqueue("task", node.id, "create", node);
  return node;
}
```

**SyncQueue の扱い（クラウド同期見込み設計）**:

- `SyncQueue` のインスタンスは保持する
- `enqueue()` は呼び続ける（IndexedDB の `syncQueue` ストアに蓄積）
- `flush()` は呼ばない（Phase 2 で `apiFetch` の向き先をクラウドURLに変更して再有効化）
- `setConflictHandler()` はそのまま設定（Phase 2 で必要）

**新規ファイル**: `frontend/src/services/StandaloneDataService.ts`（~800-900行）
**変更ファイル**: `frontend/src/services/dataServiceFactory.ts`

```typescript
// dataServiceFactory.ts に追加
import { Capacitor } from "@capacitor/core";
import { StandaloneDataService } from "./StandaloneDataService";

export function isCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  return isCapacitor(); // 将来: || isStandalonePWA()
}

export function getDataService(): DataService {
  if (testOverride) return testOverride;
  if (!instance) {
    if (isElectron()) {
      instance = new ElectronDataService();
    } else if (isStandalone()) {
      instance = new StandaloneDataService();
    } else {
      instance = new OfflineDataService();
    }
  }
  return instance;
}
```

---

### [ ] Step 3: モバイルアプリのスタンドアロン化

**目的**: ConnectionSetup / WebSocket 接続をスタンドアロンモードで無効化

#### 3a. `MobileApp.tsx` の変更

```typescript
// Before
const [connected, setConnected] = useState(isApiConfigured());
// ...
if (!connected) {
  return <ConnectionSetup onConnected={() => setConnected(true)} />;
}

// After
import { isStandalone } from "./services/dataServiceFactory";

const isStandaloneMode = isStandalone();
const [connected, setConnected] = useState(
  isStandaloneMode || isApiConfigured(),
);
// ...
if (!connected) {
  return <ConnectionSetup onConnected={() => setConnected(true)} />;
}
```

#### 3b. `useRealtimeSync.ts` の変更

```typescript
// connect() 関数の先頭に追加
const connect = useCallback(() => {
  const baseUrl = getApiBaseUrl();
  const token = getApiToken();
  if (!baseUrl || !token) {
    // スタンドアロンモード: WebSocket 不要、disconnected のまま
    return;
  }
  // ... 既存のWebSocket接続ロジック
}, [scheduleReconnect]);
```

- `getApiBaseUrl()` が空（スタンドアロン時は localStorage に設定なし）なので、既存の `if (!baseUrl || !token) return;` ガードで自然に no-op になる
- **変更不要の可能性あり** — 動作確認して判断

#### 3c. `useOnlineStatus.ts` の変更

```typescript
// checkHealth の変更
const checkHealth = useCallback(async () => {
  if (isStandalone()) {
    setOnlineStatus("offline"); // スタンドアロンでは常に "offline"
    return;
  }
  // ... 既存のヘルスチェック
}, []);
```

- `triggerSync` もスタンドアロンモードでは no-op にする
- または `onlineStatus` を "standalone" に拡張（UIの表示改善）

#### 3d. `MobileSettingsView.tsx` の変更

- "接続解除" ボタンをスタンドアロンモードで非表示にする
- サーバー接続情報セクションを非表示にする

**変更ファイル**:

- `frontend/src/MobileApp.tsx`
- `frontend/src/hooks/useOnlineStatus.ts`
- `frontend/src/components/Mobile/MobileSettingsView.tsx`
- `frontend/src/hooks/useRealtimeSync.ts`（変更不要の可能性あり）

---

### [ ] Step 4: IndexedDB スキーマの拡充

**目的**: スタンドアロンで必要な全エンティティを IndexedDB に格納可能にする

現在の `indexedDb.ts` のストア:

- `tasks`, `memos`, `notes`, `scheduleItems`, `routines`, `wikiTags`
- `wikiTagAssignments`, `wikiTagConnections`, `noteConnections`
- `timeMemos`, `calendars`, `syncMeta`, `syncQueue`

**不足している可能性のあるストア**（StandaloneDataService の実装時に確認）:

- `routineTags` — ルーティンのタグ
- `routineTagAssignments` — ルーティンとタグの紐付け
- `routineGroups` — ルーティングループ
- `calendarTags` — カレンダータグ
- `calendarTagAssignments` — カレンダータグの紐付け
- `timerSettings` — タイマー設定（単一レコード）
- `timerSessions` — タイマーセッション履歴
- `pomodoroPresets` — ポモドーロプリセット
- `soundSettings` — サウンド設定

**DB_VERSION** のインクリメントが必要。

**変更ファイル**: `frontend/src/db/indexedDb.ts`

---

### [ ] Step 5: iOS ビルド & テスト

1. Xcode でプロジェクト設定:
   - Bundle ID: `com.lifeEditor.app`
   - Signing Team: Personal Team
   - Deployment Target: iOS 16.0+

2. Capacitor プラグイン追加:

   ```bash
   npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
   ```

3. テスト項目:
   - [ ] iOS シミュレータで起動、4タブ表示
   - [ ] ConnectionSetup なしで直接メイン画面
   - [ ] タスク CRUD → アプリ再起動 → データ永続化確認
   - [ ] メモ作成（TipTap エディタ）→ 再起動 → 内容確認
   - [ ] ノート作成・フォルダ作成
   - [ ] スケジュール作成・表示
   - [ ] ルーティン作成
   - [ ] タイマー/ポモドーロ動作
   - [ ] Safe area / ノッチ / ホームインジケーター
   - [ ] キーボード表示時のレイアウト
   - [ ] 実機（iPhone）でのタッチ・スクロール

**新規ファイル**:

- `frontend/package.json` に Capacitor プラグイン追加

---

### [ ] Step 6: ネイティブ強化（任意）

- `@capacitor-community/sqlite` でネイティブ SQLite に切替
  - IndexedDB より安定（WKWebView のストレージ制限回避）
  - `electron/database/migrations.ts` のスキーマを再利用可能
  - **ただし**: 全メソッドが async になるためラッパー必要
- `@capacitor/haptics` — タッチフィードバック
- `@capacitor/app` — バックグラウンド/フォアグラウンド検出
- アプリアイコン・スプラッシュスクリーン: `@capacitor/assets`

---

## Phase 2: クラウド同期（将来 — 別プランで詳細化）

### 概要設計（ここでは方針のみ）

```
Phase 2 アーキテクチャ:
┌──────────────────┐     ┌──────────────────┐
│ Capacitor iOS    │     │ Desktop Electron  │
│ StandaloneDS     │     │ ElectronDS        │
│ + SyncQueue      │     │ + SyncQueue(new)  │
│ + IndexedDB      │     │ + SQLite          │
└────────┬─────────┘     └────────┬──────────┘
         │                        │
         └────────┬───────────────┘
                  │ REST API
         ┌────────▼──────────┐
         │ Cloud Backend     │
         │ Hono + Turso/D1   │
         │ (electron/server  │
         │  routes を流用)   │
         └───────────────────┘
```

**再利用可能な既存資産**:

- `SyncQueue.ts` — バッチ処理（50件）、指数バックオフ、キュー圧縮、競合解決 → `flush()` の向き先をクラウドURLに変更するだけ
- `electron/server/routes/` — 15ファイルの REST API → そのままクラウドにデプロイ
- `syncOperations.ts` — `performFullSync()` / `performIncrementalSync()` → クラウドAPI向けに流用

**Step 2 の SyncQueue 設計が Phase 2 を見込んでいる理由**:

1. `enqueue()` を呼び続けているため、スタンドアロン中の変更が全て `syncQueue` ストアに蓄積
2. Phase 2 で `apiFetch` の baseUrl をクラウドURLに設定し `flush()` を呼べば、蓄積済み変更が一括同期
3. `conflictHandler` も既に設定済みなので、同期時の競合はサーバー優先で自動解決

---

## 影響ファイル一覧

| ファイル                                                | 操作         | 備考                                          |
| ------------------------------------------------------- | ------------ | --------------------------------------------- |
| `capacitor.config.ts`                                   | 新規         | Capacitor 設定                                |
| `ios/`                                                  | 新規（自動） | Xcode プロジェクト                            |
| `frontend/src/services/StandaloneDataService.ts`        | 新規         | ~800-900行                                    |
| `frontend/src/services/dataServiceFactory.ts`           | 変更         | `isCapacitor()` + `isStandalone()` + 分岐追加 |
| `frontend/src/MobileApp.tsx`                            | 変更         | スタンドアロン判定で ConnectionSetup スキップ |
| `frontend/src/hooks/useOnlineStatus.ts`                 | 変更         | スタンドアロンモード対応                      |
| `frontend/src/hooks/useRealtimeSync.ts`                 | 確認         | 既存ガードで no-op の可能性（変更不要かも）   |
| `frontend/src/components/Mobile/MobileSettingsView.tsx` | 変更         | 接続解除ボタン非表示                          |
| `frontend/src/db/indexedDb.ts`                          | 変更         | ストア追加 + DB_VERSION インクリメント        |
| `package.json`                                          | 変更         | Capacitor 依存追加                            |
| `frontend/package.json`                                 | 変更         | Capacitor プラグイン追加                      |
| `.gitignore`                                            | 変更         | iOS ビルド成果物除外                          |

---

## Verification

- [ ] `cd frontend && npm run build` 成功
- [ ] `npx cap sync` 成功
- [ ] iOS シミュレータで起動 → 4タブ表示
- [ ] ConnectionSetup なしで直接メイン画面に遷移
- [ ] タスク CRUD → アプリ再起動 → データ永続化
- [ ] メモ（TipTap）作成・編集 → 永続化
- [ ] ノート作成 → 永続化
- [ ] スケジュール作成・表示
- [ ] タイマー/ポモドーロ動作
- [ ] 実機（iPhone）でタッチ操作・スクロール確認
- [ ] WebSocket エラーが出ないこと（スタンドアロンでは接続しない）
