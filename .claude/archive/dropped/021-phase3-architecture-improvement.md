---
Status: DROPPED (Phase C, 2026-04-18)
Created: 2026-02-22
Depends: 020-phase2-data-integrity (also DROPPED)
Drop reason: Electron アーキテクチャ前提の設計改善案。Tauri 2.0 migration で設計が大きく変わり、本 Plan の前提がほぼ消失。3 ヶ月放置 (commit 1 件)。アーキテクチャ改善論点は CLAUDE.md §6 および §9 に統合済。
---

# 021: Phase 3 — 設計改善・中期（MEDIUM〜HIGH）

## 概要・背景

Phase 1〜2 で安全性とデータ整合性を確保した後、アーキテクチャの中期的な改善を行う。
エラーメッセージのサニタイズ、DB インデックス追加、Context Provider の再構成、
リポジトリ層の共通化、Undo/Redo ボイラープレートの統合を対象とする。

## 対象問題

| #   | 問題                             | 深刻度 | ファイル                          |
| --- | -------------------------------- | ------ | --------------------------------- |
| 1   | エラーメッセージのサニタイズ     | MEDIUM | `electron/ipc/handlerUtil.ts`     |
| 2   | DB インデックス不足              | MEDIUM | `electron/database/migrations.ts` |
| 3   | Context Provider の再構成        | HIGH   | `frontend/src/main.tsx` 他        |
| 4   | リポジトリ層の CRUD 共通化       | MEDIUM | `electron/database/*.ts`          |
| 5   | Undo/Redo ボイラープレート共通化 | MEDIUM | `frontend/src/hooks/*.ts`         |

---

## タスク一覧

### Task 1: エラーメッセージのサニタイズ

**対象ファイル:** `electron/ipc/handlerUtil.ts`

**現状の問題:**
`loggedHandler` がエラーオブジェクトをそのままレンダラに throw するため、
SQL エラーメッセージに含まれるテーブル名・カラム名・ファイルパスが露出する。

**実装内容:**

1. `loggedHandler` にエラーサニタイズ層を追加:

   ```typescript
   function sanitizeError(e: unknown): Error {
     if (e instanceof Error) {
       // SQL エラー
       if (
         e.message.includes("SQLITE") ||
         e.message.includes("UNIQUE constraint")
       ) {
         return new Error("データベース操作に失敗しました");
       }
       // ファイル操作エラー
       if (e.message.includes("ENOENT") || e.message.includes("EACCES")) {
         return new Error("ファイル操作に失敗しました");
       }
       // 既知のビジネスエラー（バリデーション等）はそのまま返す
       if (
         e.message.startsWith("Invalid") ||
         e.message.startsWith("Unsupported")
       ) {
         return e;
       }
       return new Error("予期しないエラーが発生しました");
     }
     return new Error("不明なエラーが発生しました");
   }
   ```

2. オリジナルエラーはメインプロセス側でのみログに残す（既存の `log.error` で実現済み）

3. 開発モードでは詳細エラーを返すオプション:
   ```typescript
   const isDev = !app.isPackaged;
   throw isDev ? e : sanitizeError(e);
   ```

**テスト:**

- SQL エラー → サニタイズされたメッセージが返ること
- バリデーションエラー → 元のメッセージが返ること
- 開発モード → 詳細エラーが返ること

---

### Task 2: DB インデックス追加

**対象ファイル:** `electron/database/migrations.ts`

**現状の問題:**
頻繁にフィルタ/ソートされるカラムにインデックスがない。

**実装内容:**

V25 マイグレーションで以下のインデックスを追加:

```sql
-- tasks: status でのフィルタリング（TODO/DONE 切替）
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- tasks: scheduled_at でのカレンダー表示
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- tasks: due_date でのフィルタリング
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)
  WHERE due_date IS NOT NULL;

-- tasks: ソフトデリート + order の複合（タスクツリー表示で頻用）
CREATE INDEX IF NOT EXISTS idx_tasks_active_order ON tasks(is_deleted, parent_id, "order");

-- timer_sessions: 日付範囲での集計（Analytics）
CREATE INDEX IF NOT EXISTS idx_timer_sessions_started ON timer_sessions(started_at);

-- schedule_items: date + routine_id 複合
CREATE INDEX IF NOT EXISTS idx_si_date_routine ON schedule_items(date, routine_id);

-- routines: アクティブルーティン表示
CREATE INDEX IF NOT EXISTS idx_routines_active ON routines(is_deleted, is_archived);
```

**パフォーマンス検証:**

- `EXPLAIN QUERY PLAN` で各クエリのインデックス使用を確認
- タスク 1000 件 / セッション 10000 件のベンチマークデータで before/after を計測

---

### Task 3: Context Provider の再構成

**対象ファイル:**

- `frontend/src/main.tsx`
- `frontend/src/context/*.tsx`
- `frontend/src/App.tsx`

**現状の問題:**
8 層のフラットネストにより、どのコンテキスト変更でも全ツリーが影響を受ける。
また、依存関係が暗黙的（AudioContext が TimerContext に依存 等）。

**実装内容:**

1. 3 階層への再構成:

   ```
   Tier 1: アプリケーション基盤（変更頻度: 極低）
   ├── ThemeProvider
   ├── ErrorNotificationProvider（Phase 1 で追加）
   └── UndoRedoProvider

   Tier 2: コアデータ（変更頻度: 中）
   ├── TaskTreeProvider
   ├── CalendarProvider
   ├── ScheduleProvider
   ├── MemoProvider
   └── NoteProvider

   Tier 3: リアルタイム機能（変更頻度: 高）
   ├── TimerProvider（Phase 2 で分割済み）
   └── AudioProvider
   ```

2. Tier 2 のプロバイダを `CoreDataProvider` にまとめる:

   ```typescript
   // frontend/src/context/CoreDataProvider.tsx
   export function CoreDataProvider({ children }: { children: React.ReactNode }) {
     return (
       <TaskTreeProvider>
         <CalendarProvider>
           <ScheduleProvider>
             <MemoProvider>
               <NoteProvider>
                 {children}
               </NoteProvider>
             </MemoProvider>
           </ScheduleProvider>
         </CalendarProvider>
       </TaskTreeProvider>
     );
   }
   ```

3. `main.tsx` を簡潔にする:

   ```tsx
   <ThemeProvider>
     <ErrorNotificationProvider>
       <UndoRedoProvider>
         <CoreDataProvider>
           <TimerProvider>
             <AudioProvider>
               <App />
             </AudioProvider>
           </TimerProvider>
         </CoreDataProvider>
       </UndoRedoProvider>
     </ErrorNotificationProvider>
   </ThemeProvider>
   ```

4. **AudioProvider ↔ TimerProvider 依存の明示化:**
   - AudioProvider が TimerProvider の子であることを型レベルで保証
   - `useTimerState()` のみを使い、不要な再レンダリングを回避
     （Phase 2 の TimerContext 分割の恩恵）

**テスト:**

- 全既存テストが通過すること
- React DevTools Profiler でプロバイダ変更時の再レンダリング範囲を確認

---

### Task 4: リポジトリ層の CRUD 共通化

**対象ファイル:**

- `electron/database/taskRepository.ts`
- `electron/database/noteRepository.ts`
- `electron/database/memoRepository.ts`
- `electron/database/routineRepository.ts`
- `electron/database/playlistRepository.ts`
- `electron/database/calendarRepository.ts`
- 他 6 リポジトリ

**現状の問題:**
12 リポジトリで同一の create/fetchAll/fetchById/update/delete パターンが繰り返し。
N+1 クエリ（INSERT 後の即 SELECT）も全リポジトリに共通。

**実装内容:**

1. ベースリポジトリファクトリを作成:

   ```typescript
   // electron/database/baseRepository.ts
   type RepoConfig<T> = {
     table: string;
     columns: string[];
     primaryKey: string;
     fromRow: (row: unknown) => T;
     toParams: (entity: T) => Record<string, unknown>;
   };

   function createBaseRepository<T>(
     db: Database.Database,
     config: RepoConfig<T>,
   ) {
     const { table, columns, primaryKey, fromRow, toParams } = config;

     const insertSQL = `INSERT INTO "${table}" (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`;
     const selectAllSQL = `SELECT * FROM "${table}"`;
     const selectByIdSQL = `SELECT * FROM "${table}" WHERE "${primaryKey}" = ?`;

     return {
       create(entity: T): T {
         db.prepare(insertSQL).run(toParams(entity));
         return entity; // INSERT データをそのまま返す（N+1 解消）
       },
       fetchAll(): T[] {
         return (db.prepare(selectAllSQL).all() as unknown[]).map(fromRow);
       },
       fetchById(id: string | number): T | null {
         const row = db.prepare(selectByIdSQL).get(id);
         return row ? fromRow(row) : null;
       },
     };
   }
   ```

2. ソフトデリート対応のミックスイン:

   ```typescript
   function withSoftDelete<T extends { isDeleted?: boolean }>(
     base: ReturnType<typeof createBaseRepository<T>>,
     db: Database.Database,
     table: string,
   ) {
     return {
       ...base,
       fetchActive(): T[] {
         return base.fetchAll().filter((item) => !item.isDeleted);
       },
       softDelete(id: string): void {
         /* ... */
       },
       restore(id: string): void {
         /* ... */
       },
     };
   }
   ```

3. 各リポジトリを段階的にリファクタリング:
   - **Step 1:** `noteRepository` と `memoRepository`（最も単純）
   - **Step 2:** `routineRepository` と `calendarRepository`
   - **Step 3:** `taskRepository`（最も複雑、独自ロジックが多い）
   - **Step 4:** 残りのリポジトリ

4. 各リポジトリ固有のメソッドは拡張として保持:
   ```typescript
   export function createNoteRepository(db: Database.Database) {
     const base = withSoftDelete(
       createBaseRepository(db, noteConfig),
       db,
       "notes",
     );
     return {
       ...base,
       // Note 固有のメソッド
       fetchPinned(): Note[] {
         /* ... */
       },
       togglePin(id: string): void {
         /* ... */
       },
     };
   }
   ```

**テスト:**

- 各リポジトリの既存テスト（存在する場合）が通過すること
- N+1 解消の確認: `db.prepare().all()` の呼び出し回数をモニタリング

---

### Task 5: Undo/Redo ボイラープレートの共通化

**対象ファイル:**

- `frontend/src/hooks/useNotes.ts`
- `frontend/src/hooks/useMemos.ts`
- `frontend/src/hooks/usePlaylistData.ts`
- `frontend/src/hooks/useScheduleItems.ts`
- `frontend/src/hooks/useRoutines.ts`

**現状の問題:**
5 フックで同一の push → undo/redo コールバック → DataService 呼び出しパターンが
約 200 行分重複。

**実装内容:**

1. Undo/Redo ヘルパー関数群を作成:

   ```typescript
   // frontend/src/utils/undoableOperation.ts
   type UndoableOptions<T> = {
     domain: string; // "memo" | "note" | "playlist" | ...
     label: string; // "createNote" | "deleteNote" | ...
     push: UndoRedoPush; // UndoRedo context の push
     setState: React.Dispatch<React.SetStateAction<T[]>>;
     apply: (prev: T[]) => T[]; // 楽観的更新
     revert: (prev: T[]) => T[]; // undo 時の状態復元
     persist: () => Promise<void>; // DB 永続化（do）
     unpersist: () => Promise<void>; // DB 永続化（undo）
   };

   function undoableOperation<T>(options: UndoableOptions<T>): void {
     const {
       domain,
       label,
       push,
       setState,
       apply,
       revert,
       persist,
       unpersist,
     } = options;

     setState(apply);
     persist().catch((e) => logServiceError(domain, label, e));

     push(domain, {
       label,
       undo: () => {
         setState(revert);
         unpersist().catch((e) => logServiceError(domain, `undo-${label}`, e));
       },
       redo: () => {
         setState(apply);
         persist().catch((e) => logServiceError(domain, `redo-${label}`, e));
       },
     });
   }
   ```

2. 各フックの create/update/delete を置換:

   ```typescript
   // Before (useNotes.ts, ~20 lines):
   const newNote = { ... };
   setNotes((prev) => [newNote, ...prev]);
   push("note", {
     label: "createNote",
     undo: () => { setNotes(p => p.filter(n => n.id !== id)); ds.deleteNote(id).catch(...); },
     redo: () => { setNotes(p => [newNote, ...p]); ds.createNote(id, title).catch(...); },
   });
   ds.createNote(id, title).catch(...);

   // After (~8 lines):
   const newNote = { ... };
   undoableOperation({
     domain: "note", label: "createNote", push, setState: setNotes,
     apply: (prev) => [newNote, ...prev],
     revert: (prev) => prev.filter(n => n.id !== id),
     persist: () => ds.createNote(id, title),
     unpersist: () => ds.deleteNote(id),
   });
   ```

3. Phase 1 の `optimisticUpdate` と統合（エラー時ロールバック付き）:
   ```typescript
   // undoableOperation 内で optimisticUpdate を使用
   async function undoableOperation<T>(
     options: UndoableOptions<T>,
   ): Promise<void> {
     await optimisticUpdate({
       setState: options.setState,
       optimistic: options.apply,
       persist: options.persist,
       onError: (e) => logServiceError(options.domain, options.label, e),
     });
     options.push(options.domain, {
       /* undo/redo */
     });
   }
   ```

**テスト:**

- `undoableOperation` 単体テスト: apply → undo → redo のサイクル
- 各フックの既存テストが通過すること

---

## 影響範囲

| レイヤー           | 変更ファイル数  | 新規ファイル数 |
| ------------------ | --------------- | -------------- |
| Electron (IPC)     | 1               | 0              |
| Electron (DB)      | 7〜12（段階的） | 2              |
| Frontend (context) | 3               | 1              |
| Frontend (hooks)   | 5               | 0              |
| Frontend (utils)   | 0               | 1              |

## 技術的考慮事項

- **段階的リファクタリング:** Task 4（リポジトリ共通化）は一度に全リポジトリを変更しない。
  2〜3 ファイルずつ変更し、各ステップでテスト通過を確認する
- **後方互換:** Task 3（Context 再構成）は外部 API（フック）を変更しないため、
  コンシューマ側の変更は不要
- **インデックス追加の影響:** 書き込みパフォーマンスへの微小な影響。
  Task 2 は部分インデックス（`WHERE` 付き）を活用して影響を最小化
