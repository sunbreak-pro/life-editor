---
Status: PLANNED
Created: 2026-02-22
---

# 019: Phase 1 — セキュリティ・即時対応（CRITICAL）

## 概要・背景

コードレビュー（`code-review-report.md`）で発見された深刻度 CRITICAL / HIGH のセキュリティ脆弱性と
データ消失リスクを持つ問題の即時修正。ユーザーデータの保全に直結するため最優先で対処する。

## 対象問題

| # | 問題 | 深刻度 | ファイル |
|---|------|--------|----------|
| 1 | パストラバーサル | HIGH | `electron/database/customSoundRepository.ts` |
| 2 | schedule_items FK 参照先消失 | CRITICAL | `electron/database/migrations.ts` |
| 3 | 楽観的更新のロールバック欠如 | CRITICAL | `frontend/src/hooks/useNotes.ts` 他 |
| 4 | タイマーセッション等のサイレントエラー | CRITICAL | `frontend/src/context/TimerContext.tsx` 他 |

---

## タスク一覧

### Task 1: パストラバーサル修正（customSoundRepository）

**対象ファイル:** `electron/database/customSoundRepository.ts`

**現状の問題:**
`saveBlob(id, data)`, `loadBlob(id)`, `permanentDelete(id)` で `id` をそのまま
`path.join(CUSTOM_SOUNDS_DIR, id)` に使用。`../../etc/passwd` 等で任意ファイル操作可能。

**実装内容:**

1. ID バリデーション関数を追加:
   ```typescript
   function validateSoundId(id: string): void {
     if (!/^[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9]+)?$/.test(id)) {
       throw new Error(`Invalid sound ID: ${id}`);
     }
   }
   ```
2. `saveBlob`, `loadBlob`, `permanentDelete` の先頭で `validateSoundId(id)` を呼び出す
3. 追加の安全策: `path.join` 後に `path.resolve` の結果が `CUSTOM_SOUNDS_DIR` 配下であることを検証
   ```typescript
   function safeFilePath(id: string): string {
     validateSoundId(id);
     const resolved = path.resolve(CUSTOM_SOUNDS_DIR, id);
     if (!resolved.startsWith(path.resolve(CUSTOM_SOUNDS_DIR) + path.sep)) {
       throw new Error(`Path traversal detected: ${id}`);
     }
     return resolved;
   }
   ```
4. `saveMeta` にも ID 検証を追加（meta.id フィールド）

**テスト:**
- 正常 ID（`custom-sound-abc123`）→ 正常動作
- 不正 ID（`../../etc/passwd`, `../`, `. .`, 空文字）→ エラー throw

---

### Task 2: schedule_items の FK 参照先修正

**対象ファイル:** `electron/database/migrations.ts`

**現状の問題:**
V17 で `schedule_items.template_id` に `routine_templates` テーブルへの FK を設定。
V20 で `routine_templates` テーブルを DROP。FK 参照先が消失。
SQLite は FK 不整合を起動時にチェックしない（`PRAGMA foreign_keys=ON` でも）ため、
`template_id` を持つレコードが INSERT されると実行時エラーになる。

**実装内容:**

1. 新マイグレーション V22 を追加:
   ```typescript
   function migrateV22(db: Database.Database): void {
     const migrate = db.transaction(() => {
       // schedule_items を再作成し template_id の FK を削除
       db.exec(`
         CREATE TABLE schedule_items_new (
           id TEXT PRIMARY KEY,
           date TEXT NOT NULL,
           title TEXT NOT NULL,
           start_time TEXT NOT NULL,
           end_time TEXT NOT NULL,
           completed INTEGER NOT NULL DEFAULT 0,
           completed_at TEXT,
           routine_id TEXT,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL
         );
         INSERT INTO schedule_items_new (id, date, title, start_time, end_time, completed, completed_at, routine_id, created_at, updated_at)
           SELECT id, date, title, start_time, end_time, completed, completed_at, routine_id, created_at, updated_at FROM schedule_items;
         DROP TABLE schedule_items;
         ALTER TABLE schedule_items_new RENAME TO schedule_items;
         CREATE INDEX idx_si_date ON schedule_items(date);
         CREATE INDEX idx_si_routine ON schedule_items(routine_id);
       `);
     });
     migrate();
     db.pragma("user_version = 22");
   }
   ```
2. `runMigrations` に V22 のチェックを追加
3. `dataIOHandlers.ts` の import/export から `template_id` フィールドを除去
4. `db.ts` の V19 re-run フォールバックから `routine_templates` 関連コードを削除

**テスト:**
- V21 → V22 マイグレーション後に `schedule_items` の FK 整合性確認
- `PRAGMA foreign_key_check(schedule_items)` がエラーなしであること

---

### Task 3: 楽観的更新のロールバック実装

**対象ファイル:**
- `frontend/src/hooks/useNotes.ts`
- `frontend/src/hooks/useMemos.ts`
- `frontend/src/hooks/usePlaylistData.ts`
- `frontend/src/hooks/useRoutines.ts`
- `frontend/src/hooks/useScheduleItems.ts`

**現状の問題:**
UI 状態を先に更新し、DataService 呼び出しが失敗しても UI をロールバックしない。
ユーザーは成功したと思うが DB にデータがない状態が発生する。

**実装内容:**

1. 共通ヘルパーを作成（`frontend/src/utils/optimisticUpdate.ts`）:
   ```typescript
   type OptimisticOptions<T> = {
     setState: React.Dispatch<React.SetStateAction<T>>;
     optimistic: (prev: T) => T;  // 楽観的更新
     persist: () => Promise<void>; // DB 永続化
     onError?: (error: unknown) => void;
   };

   async function optimisticUpdate<T>(options: OptimisticOptions<T>): Promise<void> {
     const { setState, optimistic, persist, onError } = options;
     let snapshot: T | undefined;

     setState((prev) => {
       snapshot = prev;  // ロールバック用スナップショット保存
       return optimistic(prev);
     });

     try {
       await persist();
     } catch (error) {
       // ロールバック
       if (snapshot !== undefined) {
         setState(snapshot);
       }
       onError?.(error);
     }
   }
   ```

2. 各フックの create/update/delete 操作をこのヘルパーで置換。
   例（`useNotes.ts` の `createNote`）:
   ```typescript
   // Before:
   setNotes((prev) => [newNote, ...prev]);
   getDataService().createNote(id, title).catch(logError);

   // After:
   await optimisticUpdate({
     setState: setNotes,
     optimistic: (prev) => [newNote, ...prev],
     persist: () => getDataService().createNote(id, title),
     onError: (e) => {
       logServiceError("Notes", "create", e);
       setError("ノートの作成に失敗しました");
     },
   });
   ```

3. 各フックに `error` state を追加し、エラー発生時にユーザーへ通知可能にする

**テスト:**
- DataService の mock で reject → state がロールバックされること
- DataService の mock で resolve → state が維持されること

---

### Task 4: サイレントエラーの修正

**対象ファイル:**
- `frontend/src/context/TimerContext.tsx`
- `frontend/src/hooks/usePlaylistData.ts`
- `frontend/src/hooks/useMemos.ts`
- `frontend/src/hooks/useNotes.ts`

**現状の問題:**
- `TimerContext.tsx`: `endTimerSession` の失敗が `console.warn` のみ → 作業記録消失
- `usePlaylistData.ts`: `.catch(() => {})` でエラー完全無視
- 他フック: `logServiceError` のみで UI 表示なし

**実装内容:**

1. 統一エラー通知システムを作成:
   ```typescript
   // frontend/src/context/ErrorNotificationContext.tsx
   type ErrorNotification = {
     id: string;
     message: string;
     severity: 'warning' | 'error';
     timestamp: number;
     dismissable: boolean;
   };
   ```

2. `TimerContext.tsx` のセッション保存エラー:
   - エラー発生時にリトライキューに入れる（最大3回）
   - リトライ失敗時は `ErrorNotificationContext` 経由でユーザーに通知
   - `currentSessionIdRef.current = null` をエラー時には実行しない

3. 全フックの `.catch(() => {})` を削除し、適切なエラーハンドリングに置換

4. `App.tsx` に統一エラーバナー表示:
   - 現在 `persistError`（TaskTree のみ）で表示しているバナーを全エンティティに拡張
   - 自動消去（5秒）+ 手動消去ボタン

**テスト:**
- タイマーセッション保存失敗 → エラー通知表示 → リトライ → 成功/最終失敗
- プレイリスト操作失敗 → エラー通知表示

---

## 影響範囲

| レイヤー | 変更ファイル数 | 新規ファイル数 |
|----------|---------------|---------------|
| Electron (DB) | 3 | 0 |
| Frontend (hooks) | 5 | 2 |
| Frontend (context) | 2 | 1 |
| Frontend (components) | 1 | 0 |

## 技術的考慮事項

- **後方互換性:** V22 マイグレーションは既存データの `template_id` カラムを削除するため、
  古いバージョンからのアップグレード時にデータ消失はないことを確認
- **パフォーマンス:** `optimisticUpdate` のスナップショット保存は浅いコピーで十分
  （配列は参照保存、個々の要素は不変）
- **テスト:** Task 3, 4 は既存テスト基盤（`mockDataService.ts`, `renderWithProviders.tsx`）を活用
