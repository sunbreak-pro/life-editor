---
name: db-migration
description: life-editor の Supabase Postgres に DDL を足すときの手順（連番ファイルの作法・Plan Gate の「ローカル先行 → ユーザーが db push」・items_meta + payload の 2 行分割・RLS と Realtime publication・mapper 側の追随）。規約の正本は docs/vision/db-conventions.md、既存 DDL の監査は life-editor-migration-validator エージェント。Use when adding or changing a table, column, constraint, index, or RLS policy. Triggers include "マイグレーション", "テーブル追加", "カラム追加", "DDL", "スキーマ変更", "migration", "supabase db push", "RLS".
---

# DB Migration — Supabase Postgres に DDL を足す

> **規約の正本 = [`docs/vision/db-conventions.md`](../../docs/vision/db-conventions.md)**（特に §10 Payload Mapper 規約）。本スキルは「これから書く手順」だけを持つ。既存 DDL が規約に合っているかの**監査**は `life-editor-migration-validator` エージェントの仕事で、役割が違う。

## 🛑 最初に: Claude は DB に適用しない

CLAUDE.md §7.3 の Plan Gate:

> DDL は「ローカルファイル先行 → ユーザー `supabase db push`」（**`apply_migration` MCP 単独使用禁止**）

つまり本スキルの成果物は **`supabase/migrations/` に置かれた .sql ファイルだけ**。適用はこうだいさんが手で流す。実行済みかどうかを勝手に前提にしないこと — DDL が未適用でも TS 側（mapper / service / UI）は先に書けるので、待たずに進めてよい。

`mcp__supabase__execute_sql` での**読み取り**（既存スキーマの確認）は問題ない。書き込み系を単独で撃たない、が線引き。

## Step 1: ファイルを作る

```
supabase/migrations/<4 桁連番>_<snake_case_slug>.sql
```

連番は既存の最大値 + 1（`ls supabase/migrations | tail -3` で確認）。**`0013` は欠番で、埋めも振り直しもしない**（db-conventions §13）。

## Step 2: 冒頭にコメントで意図を書く

既存ファイル（例 `0024_notes_template_type.sql`）の形に倣う。最低限これだけは書く:

- **WHY** — なぜこの形にしたか。「テーブルを足さず既存の check 制約に値を 1 つ足した」のような**採らなかった選択肢**まで
- **SCOPE** — DDL だけか / backfill が要るか / RLS への影響
- **PLAN GATE** — 🛑 人手・LOCAL-FILE-FIRST・実行はユーザーの `supabase db push`（定型文をそのまま写す）
- **ATOMICITY** — `begin; … commit;` で囲うこと、再実行安全にした根拠

このコメントが後から読まれる唯一の設計記録になる。DDL 本体より長くて構わない。

## Step 3: DDL 本体

```sql
begin;

create table if not exists public.foo_payload (
  item_id text primary key references public.items_meta (id) on delete cascade,
  parent_item_role text generated always as ('foo') stored,
  ...
);

commit;
```

守ること:

- **冪等**（`if not exists` / `drop … if exists` → `add`）。同じファイルを 2 回流しても壊れない形にする
- **`begin` / `commit` で囲む**
- **RLS は全テーブルで有効化 + ポリシー付与**。単独テナントでも例外にしない
- **列名は `snake_case`**（TS 側は camelCase で、mapper が変換する）
- 同期対象なら **`supabase_realtime` publication に追加**

新しいドメイン型を足す場合は **2 行分割モデル**に乗る（詳細 = db-conventions §10.1 / §10.4）:

- `items_meta(id, role)` が SSOT。payload は `(parent_item_id, parent_item_role)` の composite FK で `items_meta(id, role)` を参照する（「親は同 role のみ」を DB で物理的に保証するため）
- `parent_item_role` は `generated always as ('<role>') stored`。**書き込むと 42601 で reject される**
- `<role>_payload` に `updated_at` を持たせない（LWW cursor は `items_meta.updated_at` の単独所有）
- `ON DELETE`: `item_id → items_meta.id` は CASCADE、composite FK 側は NO ACTION（= 子から先に消す descendants-first が caller の責務になる。SET NULL は生成列と衝突して使えない）
- ソフトデリートを持つなら `is_deleted` + `deleted_at`

## Step 4: TS 側を追随させる

DDL だけでは何も動かない。→ **`add-feature` スキルの Phase 2 / Phase 3**。要点だけ:

- `shared/src/services/<domain>Mapper.ts` に変換 3 関数（`rowsToType` / `typeToRows` / `typeUpdatesToPatches`）。I/O ゼロの純関数
- `typeUpdatesToPatches` は `metaPatch.updated_at = now` を**無条件**注入する（`now` は呼び出し側から注入 = 純粋性とテスト可能性のため）
- bulk upsert 経路は caller 側で `updated_at` を spread して bump を強制する（PostgREST の upsert が UPDATE に転じると DB DEFAULT が効かない）
- Realtime に足したなら `REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）と `syncDomains.ts` の対応表を lockstep で更新 — 片方だけだと守りのテストが落ちる

## Step 5: 検証

```bash
cd shared && npm run build && npm run typecheck:tests && npm run test
LC_ALL=C bash scripts/docs-lint.sh
```

`life-editor-migration-validator` エージェントを起動して、DDL が規約（2 行分割 / composite FK / 生成列 / 冪等性 / RLS / publication）に合っているか監査させる。同期挙動まで見るなら `life-editor-sync-auditor`。

## Step 6: 引き渡し

PR 本文に **「この migration は未適用。merge 前 / 後に `supabase db push` が要る」**と明記する。書かないと、コードだけ main に入って DB が追いつかない状態が無言で生まれる。
