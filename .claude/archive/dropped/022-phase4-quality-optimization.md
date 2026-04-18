---
Status: DROPPED (Phase C, 2026-04-18)
Created: 2026-02-22
Depends: 021-phase3-architecture-improvement (also DROPPED)
Drop reason: Electron アーキテクチャ前提の品質改善案。Tauri 2.0 migration で対象コードが消失、3 ヶ月放置 (commit 1 件)。現在の品質改善課題は要件定義 (tier-1/2 Known Issues) と 保留 5 件 (I-1 / S-4 等) で管理する方針へ移行。
---

# 022: Phase 4 — 品質向上・長期（MEDIUM）

## 概要・背景

Phase 1〜3 でセキュリティ・整合性・アーキテクチャを改善した後、
長期的な品質向上と技術的負債の解消を行う。クエリのページネーション、
customSound の SQLite 移行、N+1 クエリ解消、DataService キャッシュ層の追加を対象とする。

## 対象問題

| #   | 問題                         | 深刻度 | ファイル                                       |
| --- | ---------------------------- | ------ | ---------------------------------------------- |
| 1   | タイマーセッション無制限取得 | MEDIUM | `electron/database/timerRepository.ts`         |
| 2   | customSound の SQLite 移行   | MEDIUM | `electron/database/customSoundRepository.ts`   |
| 3   | N+1 クエリパターン           | MEDIUM | `electron/database/*.ts`                       |
| 4   | DataService キャッシュ層     | MEDIUM | `frontend/src/services/ElectronDataService.ts` |

---

## タスク一覧

### Task 1: クエリのページネーション

**対象ファイル:**

- `electron/database/timerRepository.ts`
- `electron/ipc/timerHandlers.ts`
- `frontend/src/services/DataService.ts`
- `frontend/src/services/ElectronDataService.ts`
- `frontend/src/components/Analytics/AnalyticsView.tsx`

**現状の問題:**
`timerRepository.fetchSessions()` に `LIMIT` がなく、長期使用で全セッション（数万件）を
一度に返却。Analytics 表示で不要な過去データまで取得しパフォーマンスが低下する。

**実装内容:**

1. `timerRepository.ts` にページネーション対応メソッドを追加:

   ```typescript
   fetchSessionsPaginated(params: {
     startDate?: string;
     endDate?: string;
     taskId?: string;
     limit?: number;
     offset?: number;
   }): { sessions: TimerSession[]; total: number } {
     const conditions: string[] = [];
     const binds: Record<string, unknown> = {};

     if (params.startDate) {
       conditions.push('started_at >= @startDate');
       binds.startDate = params.startDate;
     }
     if (params.endDate) {
       conditions.push('started_at <= @endDate');
       binds.endDate = params.endDate;
     }
     if (params.taskId) {
       conditions.push('task_id = @taskId');
       binds.taskId = params.taskId;
     }

     const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
     const limit = params.limit ?? 1000;
     const offset = params.offset ?? 0;

     const total = db.prepare(`SELECT COUNT(*) as cnt FROM timer_sessions ${where}`)
       .get(binds) as { cnt: number };
     const sessions = db.prepare(
       `SELECT * FROM timer_sessions ${where} ORDER BY started_at DESC LIMIT @limit OFFSET @offset`
     ).all({ ...binds, limit, offset });

     return { sessions: sessions.map(fromRow), total: total.cnt };
   }
   ```

2. 日付範囲ベースの取得メソッドを追加（Analytics 用）:

   ```typescript
   fetchSessionsInRange(startDate: string, endDate: string): TimerSession[] {
     return db.prepare(
       `SELECT * FROM timer_sessions WHERE started_at >= ? AND started_at <= ? ORDER BY started_at DESC`
     ).all(startDate, endDate).map(fromRow);
   }
   ```

3. IPC ハンドラに新チャネルを追加:
   - `timer:fetchSessionsInRange` → `fetchSessionsInRange`
   - 既存の `timer:fetchSessions` は後方互換のため残す（将来的に deprecated）

4. DataService インターフェースに新メソッド追加:

   ```typescript
   fetchTimerSessionsInRange(startDate: string, endDate: string): Promise<TimerSession[]>;
   ```

5. `AnalyticsView.tsx` を修正:
   - 選択中の期間（week/month/year）に応じて日付範囲を計算
   - `fetchTimerSessionsInRange` を使用
   - 全件取得 → 範囲取得に切替

**テスト:**

- 10,000 件のセッションデータで `fetchSessionsInRange` が 100ms 以内に返ること
- 日付範囲外のセッションが返却されないこと

---

### Task 2: customSound の SQLite 移行

**対象ファイル:**

- `electron/database/customSoundRepository.ts`（全面書き換え）
- `electron/database/migrations.ts`（V26 追加）
- `electron/ipc/customSoundHandlers.ts`

**現状の問題:**
他の全エンティティが SQLite を使う中、customSound のみ JSON ファイル + ファイルシステムで管理。
トランザクション保護なし。`withWriteLock` は単純なフラグで非同期操作に対して不十分。

**実装内容:**

1. V26 マイグレーションで custom_sounds テーブルを作成:

   ```sql
   CREATE TABLE custom_sounds (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     file_name TEXT NOT NULL,
     mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
     file_size INTEGER NOT NULL DEFAULT 0,
     duration REAL,
     is_deleted INTEGER NOT NULL DEFAULT 0,
     deleted_at TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX idx_custom_sounds_deleted ON custom_sounds(is_deleted);
   ```

   注: 音声バイナリデータは引き続きファイルシステムに保存（SQLite BLOB は
   大きなファイルに不向き）。メタデータのみ SQLite に移行。

2. マイグレーション時に既存 `_meta.json` データを SQLite にインポート:

   ```typescript
   function migrateV26(db: Database.Database): void {
     const migrate = db.transaction(() => {
       db.exec(`CREATE TABLE custom_sounds (...)`);

       // 既存 JSON メタデータの移行
       const metaPath = path.join(CUSTOM_SOUNDS_DIR, "_meta.json");
       if (fs.existsSync(metaPath)) {
         const metas = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
         const insert = db.prepare(
           `INSERT OR IGNORE INTO custom_sounds (...) VALUES (...)`,
         );
         for (const meta of metas) {
           insert.run(meta);
         }
         // 移行成功後にバックアップ
         fs.renameSync(metaPath, metaPath + ".migrated");
       }
     });
     migrate();
     db.pragma("user_version = 26");
   }
   ```

3. `customSoundRepository.ts` を SQLite ベースに書き換え:
   - `loadMetas()` / `writeMetas()` → `db.prepare().all()` / `db.prepare().run()`
   - `withWriteLock` → SQLite のトランザクションに依拠
   - `saveBlob` / `loadBlob` はファイルシステムのまま（ID 検証は Phase 1 で対応済み）
   - `permanentDelete` は DB レコード削除 + ファイル削除をトランザクション内で実行

4. `customSoundHandlers.ts` の更新:
   - `db` パラメータを受け取るように変更
   - Repository 作成時に `db` を渡す

5. カスタムサウンドの入力検証を追加（Phase 1 で未対応だった部分）:

   ```typescript
   const MAX_SOUND_SIZE = 50 * 1024 * 1024; // 50MB
   const ALLOWED_MIME_TYPES = [
     "audio/mpeg",
     "audio/wav",
     "audio/ogg",
     "audio/mp4",
     "audio/webm",
   ];

   function validateCustomSound(
     data: Buffer,
     meta: Partial<CustomSoundMeta>,
   ): void {
     if (data.length > MAX_SOUND_SIZE) {
       throw new Error(`Sound file too large: ${data.length} bytes`);
     }
     if (meta.mimeType && !ALLOWED_MIME_TYPES.includes(meta.mimeType)) {
       throw new Error(`Unsupported MIME type: ${meta.mimeType}`);
     }
   }
   ```

**テスト:**

- 既存 JSON データが SQLite に正しく移行されること
- `_meta.json.migrated` バックアップが作成されること
- CRUD 操作が SQLite 経由で正しく動作すること
- 50MB 超のファイル → エラー
- 不正 MIME タイプ → エラー

---

### Task 3: N+1 クエリパターンの解消

**対象ファイル:**

- `electron/database/noteRepository.ts`
- `electron/database/memoRepository.ts`
- `electron/database/routineRepository.ts`
- `electron/database/calendarRepository.ts`
- `electron/database/playlistRepository.ts`
- `electron/database/scheduleItemRepository.ts`

**現状の問題:**
ほぼ全リポジトリの `create()` / `update()` で INSERT/UPDATE 後に即座に
`SELECT * FROM table WHERE id = ?` を実行して同じレコードを取得。

例（`noteRepository.ts`）:

```typescript
create(id, title) {
  db.prepare('INSERT INTO notes (...) VALUES (...)').run({ id, title, ... });
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id);  // 不要な SELECT
}
```

**実装内容:**

1. **方針:** INSERT/UPDATE のパラメータから返却値を構築し、SELECT を省略。

2. 共通パターン:

   ```typescript
   create(id: string, title: string): Note {
     const now = new Date().toISOString();
     const note: Note = {
       id, title, content: '', isPinned: false,
       isDeleted: false, deletedAt: null,
       createdAt: now, updatedAt: now,
     };
     db.prepare('INSERT INTO notes (...) VALUES (...)').run(toRow(note));
     return note; // SELECT 不要
   }
   ```

3. **例外:** `update()` でデフォルト値やトリガーがある場合は SELECT を維持。
   具体的には:
   - `timerRepository.ts` の `startSession()`: `id` が AUTOINCREMENT のため
     `lastInsertRowid` から取得する必要あり
   - `soundPresets` の `create()`: 同上

4. Phase 3 の baseRepository（Task 4）と連携:
   - `createBaseRepository` の `create()` メソッドが既に N+1 解消済みの設計なので、
     Phase 3 完了後のリポジトリは自動的に解消される
   - Phase 3 未完了のリポジトリは個別に修正

**テスト:**

- create() の返却値が DB の実データと一致すること
- SQLite の `changes()` が 1 であること（INSERT 成功の確認）

---

### Task 4: DataService キャッシュ層の追加

**対象ファイル:**

- `frontend/src/services/ElectronDataService.ts`
- `frontend/src/services/DataService.ts`（インターフェース変更なし）

**現状の問題:**
`ElectronDataService` が 489 行の純粋な IPC パススルー。
同一データの繰り返し取得にキャッシュが効かず、毎回 IPC 通信が発生。

**実装内容:**

1. IPC キャッシュ層を作成:

   ```typescript
   // frontend/src/services/ipcCache.ts
   type CacheEntry<T> = {
     data: T;
     timestamp: number;
     ttl: number;
   };

   class IPCCache {
     private cache = new Map<string, CacheEntry<unknown>>();

     get<T>(key: string): T | null {
       const entry = this.cache.get(key);
       if (!entry) return null;
       if (Date.now() - entry.timestamp > entry.ttl) {
         this.cache.delete(key);
         return null;
       }
       return entry.data as T;
     }

     set<T>(key: string, data: T, ttl: number): void {
       this.cache.set(key, { data, timestamp: Date.now(), ttl });
     }

     invalidate(pattern: string): void {
       for (const key of this.cache.keys()) {
         if (key.startsWith(pattern)) {
           this.cache.delete(key);
         }
       }
     }

     clear(): void {
       this.cache.clear();
     }
   }
   ```

2. キャッシュ対象の選定:

   ```
   長TTL（60秒）— 変更頻度が低いデータ:
   ├── fetchTimerSettings
   ├── fetchPomodoroPresets
   ├── fetchSoundTagDefinitions
   ├── fetchRoutineTagDefinitions
   └── fetchCalendars

   短TTL（10秒）— 変更頻度が中程度のデータ:
   ├── fetchAllSounds
   ├── fetchAllRoutines
   └── fetchAllNotes

   キャッシュなし — リアルタイム性が必要:
   ├── fetchTimerSessions（Analytics）
   ├── fetchTaskNodes（Undo/Redo 連動）
   └── 全 write 操作
   ```

3. Write 操作時の自動キャッシュ無効化:

   ```typescript
   async createNote(id: string, title: string): Promise<Note> {
     const result = await invoke<Note>('db:note:create', id, title);
     this.cache.invalidate('notes:');
     return result;
   }
   ```

4. `ElectronDataService` にキャッシュを統合:

   ```typescript
   class ElectronDataService implements DataService {
     private cache = new IPCCache();

     async fetchTimerSettings(): Promise<TimerSettings> {
       const cached = this.cache.get<TimerSettings>("timer:settings");
       if (cached) return cached;
       const result = await invoke<TimerSettings>("timer:fetchSettings");
       this.cache.set("timer:settings", result, 60000);
       return result;
     }
     // ...
   }
   ```

5. リクエストバッチングの検討（将来拡張):
   - 短期間に同一チャネルへの複数リクエストがあった場合にバッチ化
   - Phase 4 では設計のみ、実装は需要に応じて

**テスト:**

- 同一データの 2 回目取得が IPC を呼ばないこと
- Write 操作後のキャッシュ無効化 → 次回 fetch で最新データが返ること
- TTL 経過後のキャッシュ自動無効化

---

## 影響範囲

| レイヤー              | 変更ファイル数 | 新規ファイル数          |
| --------------------- | -------------- | ----------------------- |
| Electron (DB)         | 8              | 1（マイグレーション内） |
| Electron (IPC)        | 2              | 0                       |
| Frontend (services)   | 1              | 1                       |
| Frontend (components) | 1              | 0                       |

## 技術的考慮事項

- **customSound 移行の安全性:** `_meta.json` をリネーム（削除ではなく）して移行履歴を残す。
  問題発生時は手動で `.migrated` を `.json` に戻してロールバック可能
- **キャッシュの一貫性:** Undo/Redo 操作はキャッシュをバイパスするため、
  UndoRedo コンテキストのアクション実行後にキャッシュを全クリアする
- **N+1 解消と AUTOINCREMENT:** `lastInsertRowid` は better-sqlite3 の
  `RunResult.lastInsertRowid` で取得可能。INTEGER PRIMARY KEY のテーブルのみ注意
- **ページネーション導入の段階性:** まず Analytics（Timer Sessions）のみ対応。
  他のエンティティ（Tasks, Notes 等）は現状 1000 件以下の想定のため後回し
- **マイグレーションバージョン:** Phase 1 で V22、Phase 2 で V23〜V25 を使用する前提。
  Phase 4 は V26 から開始
