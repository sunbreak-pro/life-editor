---
name: db-migration
description: SQLite マイグレーション追加手順。Use when adding tables, columns, or modifying database schema. Triggers include database change, schema update, new table, add column.
---

「db-migrationを起動します」と表示する。

## 手順

### Step 1: 現在のバージョン確認

`electron/database/migrations.ts` を読み、最新の `migrateVN` のバージョン番号を確認する。

### Step 2: マイグレーション関数を追加

`migrations.ts` の末尾に新しい関数を追加:

```typescript
function migrateVN(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS new_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    PRAGMA user_version = N;
  `);
}
```

複雑な変更（データ移行を伴う場合）:

```typescript
function migrateVN(db: Database.Database): void {
  const migrate = db.transaction(() => {
    db.exec(`ALTER TABLE existing ADD COLUMN new_col TEXT`);
    // データ変換処理...
  });
  migrate();
  db.pragma("user_version = N");
}
```

### Step 3: runMigrations に追加

```typescript
if (currentVersion < N) migrateVN(db);
```

### Step 4: Repository 作成（新テーブルの場合）

`electron/database/` に `newDomainRepository.ts` を作成。パターン参照: `calendarRepository.ts`

```typescript
export function createNewDomainRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(`SELECT * FROM new_table ORDER BY created_at`),
    insert: db.prepare(`INSERT INTO new_table (...) VALUES (...)`),
  };

  function rowToModel(row: Record<string, unknown>): NewDomain {
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,  // snake_case → camelCase
      updatedAt: row.updated_at as string,
    };
  }

  return {
    fetchAll(): NewDomain[] { return stmts.fetchAll.all().map(rowToModel); },
    create(...): NewDomain { /* ... */ },
  };
}

export type NewDomainRepository = ReturnType<typeof createNewDomainRepository>;
```

### Step 5: Repository を DB初期化に登録

`electron/database/db.ts` で Repository インスタンスを作成・エクスポートする。

## ルール

- カラム名: `snake_case`（JS側は `camelCase`、`rowToModel` で変換）
- テーブル作成: `CREATE TABLE IF NOT EXISTS`
- `PRAGMA user_version = N` は各マイグレーションの最後に実行
- 既存テーブルのカラム削除: SQLite非対応、テーブル再作成パターンを使う
- 複雑な変更: `db.transaction()` でアトミックに
