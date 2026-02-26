---
Status: PLANNED
Created: 2026-02-22
Depends: 019-phase1-security-critical-fixes
---

# 020: Phase 2 — データ整合性・次スプリント（HIGH）

## 概要・背景

Phase 1 のセキュリティ修正完了後、データ整合性とインポート/エクスポートの堅牢化、
パフォーマンスに直結する TimerContext のリファクタリングを行う。

## 対象問題

| # | 問題 | 深刻度 | ファイル |
|---|------|--------|----------|
| 1 | インポートデータ検証不足 | HIGH | `electron/ipc/dataIOHandlers.ts` |
| 2 | tasks.parent_id に FK 制約なし | HIGH | `electron/database/migrations.ts` |
| 3 | マイグレーションのトランザクション不足 | HIGH | `electron/database/migrations.ts` |
| 4 | memos UNIQUE 制約とソフトデリートの競合 | HIGH | `electron/database/migrations.ts` |
| 5 | TimerContext の巨大 value 分割 | HIGH | `frontend/src/context/TimerContext.tsx` |

---

## タスク一覧

### Task 1: インポートデータ検証の強化

**対象ファイル:** `electron/ipc/dataIOHandlers.ts`

**現状の問題:**
`validateImportData` は配列チェックと tasks の id/type/created_at のみ。
サイズ制限なし、他テーブルのフィールド検証なし。巨大 JSON で DoS 可能。

**実装内容:**

1. ファイルサイズ制限の追加:
   ```typescript
   const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50MB
   const stats = fs.statSync(result.filePaths[0]);
   if (stats.size > MAX_IMPORT_SIZE) {
     throw new Error(`Import file too large: ${stats.size} bytes (max: ${MAX_IMPORT_SIZE})`);
   }
   ```

2. 配列サイズ上限の追加:
   ```typescript
   const MAX_RECORDS: Record<string, number> = {
     tasks: 10000,
     timerSessions: 50000,
     soundSettings: 500,
     soundPresets: 100,
     memos: 5000,
     notes: 5000,
     calendars: 100,
     routines: 1000,
     scheduleItems: 50000,
     // tag 系は 1000
   };
   ```

3. 各テーブルの必須フィールド・型検証を追加:
   - `timerSessions`: id (number), session_type (enum), started_at (string)
   - `memos`: id (string), date (string, YYYY-MM-DD format), content (string)
   - `notes`: id (string), title (string), created_at (string)
   - `soundSettings`: sound_type (string), volume (number, 0-100)
   - `routines`: id (string), title (string)
   - `scheduleItems`: id (string), date (string), start_time (string), end_time (string)

4. バリデーション関数を分離（`electron/database/importValidation.ts`）:
   - `validateTasks(data: unknown[]): void`
   - `validateTimerSessions(data: unknown[]): void`
   - etc.

**テスト:**
- 50MB 超のファイル → エラー
- tasks 10,001件 → エラー
- tasks に type が欠落 → エラー
- 正常データ → 通過

---

### Task 2: tasks.parent_id への FK 制約追加

**対象ファイル:** `electron/database/migrations.ts`

**現状の問題:**
`parent_id TEXT` のみで FK 制約がないため、親タスク削除時に子タスクが孤立する。
実際には `useTaskTreeDeletion.ts` で子の再帰削除を行っているが、
DB レベルでの保証がなく、バグ混入時にデータ不整合が起きる。

**実装内容:**

1. V23 マイグレーションで tasks テーブルを再作成:
   ```typescript
   function migrateV23(db: Database.Database): void {
     const migrate = db.transaction(() => {
       // 1. 孤立ノードを先にクリーンアップ（parent_id が存在しない tasks を指す）
       db.exec(`
         UPDATE tasks SET parent_id = NULL
         WHERE parent_id IS NOT NULL
           AND parent_id NOT IN (SELECT id FROM tasks);
       `);

       // 2. テーブル再作成（FK 追加）
       db.exec(`
         CREATE TABLE tasks_new (
           id TEXT PRIMARY KEY,
           type TEXT NOT NULL CHECK(type IN ('folder', 'task')),
           title TEXT NOT NULL DEFAULT '',
           parent_id TEXT,
           "order" INTEGER NOT NULL DEFAULT 0,
           status TEXT CHECK(status IN ('TODO', 'DONE')),
           is_expanded INTEGER DEFAULT 0,
           is_deleted INTEGER DEFAULT 0,
           deleted_at TEXT,
           created_at TEXT NOT NULL,
           completed_at TEXT,
           scheduled_at TEXT,
           scheduled_end_at TEXT,
           is_all_day INTEGER DEFAULT 0,
           content TEXT,
           work_duration_minutes INTEGER,
           color TEXT,
           due_date TEXT,
           FOREIGN KEY (parent_id) REFERENCES tasks_new(id) ON DELETE CASCADE
         );
         INSERT INTO tasks_new SELECT * FROM tasks;
         DROP TABLE tasks;
         ALTER TABLE tasks_new RENAME TO tasks;
         CREATE INDEX idx_tasks_parent ON tasks(parent_id);
         CREATE INDEX idx_tasks_deleted ON tasks(is_deleted);
       `);
     });
     migrate();
     db.pragma("user_version = 23");
   }
   ```

2. **注意:** 自己参照 FK の場合、`REFERENCES tasks_new(id)` で作成し RENAME 後に FK が
   正しく `tasks(id)` を指すことを SQLite のドキュメントで確認する

**テスト:**
- 孤立 parent_id を持つレコード → NULL に修正されること
- マイグレーション後に `PRAGMA foreign_key_check(tasks)` → エラーなし
- 親タスク削除 → 子タスクがカスケード削除されること

---

### Task 3: マイグレーションのトランザクション化

**対象ファイル:** `electron/database/migrations.ts`

**現状の問題:**
V1〜V5, V7〜V8, V10〜V16, V18 が `db.transaction()` で囲まれていない。
途中クラッシュ時にスキーマ不整合のリスク。

**実装内容:**

1. 全マイグレーション関数を `db.transaction()` で囲む:
   - V1: `db.exec(...)` → `db.transaction(() => { db.exec(...) })()`
   - V2, V3, V4, V5, V7, V8, V10, V11, V12, V13, V14, V15, V16, V18: 同様
   - **V6, V9, V17, V19, V20, V21**: 既にトランザクション化済み → 変更不要

2. `PRAGMA user_version = N` をトランザクション外に移動:
   ```typescript
   // PRAGMA はトランザクションに参加しないため、成功後に実行
   const migrate = db.transaction(() => {
     db.exec(`CREATE TABLE ...`);
   });
   migrate();
   db.pragma("user_version = N");
   ```

3. `runMigrations` 自体にもエラーハンドリングを追加:
   ```typescript
   try {
     if (currentVersion < N) {
       log.info(`[DB] Running migration V${N}`);
       migrateVN(db);
     }
   } catch (e) {
     log.error(`[DB] Migration V${N} failed:`, e);
     throw new Error(`Database migration V${N} failed. Please contact support.`);
   }
   ```

**テスト:**
- マイグレーション途中のエラーシミュレーション → user_version が更新されないこと

---

### Task 4: memos UNIQUE 制約の修正

**対象ファイル:** `electron/database/migrations.ts`, `electron/database/memoRepository.ts`

**現状の問題:**
`memos.date` が `UNIQUE` かつソフトデリート対応。
削除済みメモと同日のメモを新規作成すると `ON CONFLICT(date) DO UPDATE` で
削除済みデータが復活上書きされる予期しない挙動。

**実装内容:**

1. V24 マイグレーションで UNIQUE 制約を条件付きに変更:
   ```typescript
   function migrateV24(db: Database.Database): void {
     const migrate = db.transaction(() => {
       db.exec(`
         CREATE TABLE memos_new (
           id TEXT PRIMARY KEY,
           date TEXT NOT NULL,
           content TEXT NOT NULL DEFAULT '',
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           is_deleted INTEGER NOT NULL DEFAULT 0,
           deleted_at TEXT
         );
         INSERT INTO memos_new SELECT * FROM memos;
         DROP TABLE memos;
         ALTER TABLE memos_new RENAME TO memos;
         CREATE INDEX idx_memos_date ON memos(date);
         CREATE INDEX idx_memos_deleted ON memos(is_deleted);
         -- アクティブメモのみユニーク（部分インデックス）
         CREATE UNIQUE INDEX idx_memos_date_active ON memos(date) WHERE is_deleted = 0;
       `);
     });
     migrate();
     db.pragma("user_version = 24");
   }
   ```

2. `memoRepository.ts` の `upsert` を修正:
   - `ON CONFLICT(date) DO UPDATE` を削除
   - アクティブメモの存在チェック → 存在すれば UPDATE、なければ INSERT に変更
   - 削除済みメモの同日作成を許可

**テスト:**
- 日付 A のメモをソフトデリート → 日付 A の新規メモ作成 → 両方存在すること
- アクティブメモが 2 件同日で存在しないこと（UNIQUE インデックス違反）

---

### Task 5: TimerContext の分割

**対象ファイル:** `frontend/src/context/TimerContext.tsx`

**現状の問題:**
32 プロパティ・32 依存の `useMemo` で、`remainingSeconds` が毎秒更新されるたびに
全コンシューマが再レンダリングされる。

**実装内容:**

1. 3 つのコンテキストに分割:
   ```
   TimerStateContext    — remainingSeconds, isRunning, sessionType, progress, completedSessions
   TimerControlsContext — start, pause, resume, stop, skip, reset, toggleTimer, etc.
   TimerSettingsContext  — workDuration, breakDuration, longBreakDuration, etc.
   ```

2. ファイル構成:
   - `frontend/src/context/timer/TimerStateContext.tsx`
   - `frontend/src/context/timer/TimerControlsContext.tsx`
   - `frontend/src/context/timer/TimerSettingsContext.tsx`
   - `frontend/src/context/timer/TimerProvider.tsx` （3つをまとめるラッパー）
   - `frontend/src/context/timer/timerReducer.ts` （既存を移動）
   - `frontend/src/context/timer/index.ts`

3. Controls は `useRef` + `useCallback` で安定化（deps を最小化）:
   ```typescript
   const stateRef = useRef(state);
   stateRef.current = state;

   const start = useCallback(() => {
     // stateRef.current を使用 → deps: []
   }, []);
   ```

4. Settings は変更頻度が低いため、別 `useMemo` で分離

5. 既存の `useTimerContext()` を後方互換ラッパーとして維持:
   ```typescript
   export function useTimerContext() {
     const state = useTimerState();
     const controls = useTimerControls();
     const settings = useTimerSettings();
     return { ...state, ...controls, ...settings };
   }
   ```

6. パフォーマンスが重要なコンポーネントから段階的に個別フックに移行:
   - `TimerDisplay.tsx` → `useTimerState()` のみ
   - `PomodoroSettingsPanel.tsx` → `useTimerSettings()` のみ
   - `TaskSelector.tsx` → `useTimerControls()` のみ

**テスト:**
- 既存の `TimerContext.test.tsx` が分割後も全テスト通過すること
- `timerReducer.test.ts` は変更なし
- React DevTools Profiler で `TimerDisplay` の再レンダリング回数が
  「全プロパティ変更時」から「state 変更時のみ」に減少することを確認

---

## 影響範囲

| レイヤー | 変更ファイル数 | 新規ファイル数 |
|----------|---------------|---------------|
| Electron (DB/IPC) | 3 | 1 |
| Frontend (context) | 1（分割） | 5 |
| Frontend (hooks) | 1 | 0 |
| Frontend (components) | 3〜5（段階移行） | 0 |

## 技術的考慮事項

- **V22〜V24 マイグレーション順序:** Phase 1 の V22 完了後に V23, V24 を実行する前提。
  もし Phase 1 と同時着手する場合はバージョン番号を調整すること
- **tasks FK 自己参照:** SQLite の自己参照 FK は ALTER TABLE 時の制約がある。
  テーブル再作成方式（CREATE → INSERT → DROP → RENAME）で対応
- **TimerContext 分割の後方互換:** `useTimerContext()` ラッパーを残すことで
  全コンシューマの一斉変更を避ける。段階的移行が可能
- **memos 部分インデックス:** SQLite 3.8.0+ で対応。Electron 35 に同梱の SQLite バージョンを確認
