---
name: add-feature
description: life-editor で機能を DB から UI まで貫いて足すときの通し手順（supabase/migrations → shared/src/services の DataService 境界 → shared/src/components + web/src → Realtime ドメイン → テスト → 必要なら MCP ツール）。各層の詳細は db-migration / add-component / test-writing へ委譲する。Use when adding a feature that needs new persisted data or crosses the data / service / UI layers. Triggers include "機能追加", "新しいドメインを足す", "テーブルから UI まで", "層をまたぐ", "add feature", "new domain", "end to end".
---

# Add Feature — DB から UI まで貫くときの順番

> 本スキルは**通し手順（どの層をどの順に触るか）**だけを持つ。各層の中身は `db-migration` / `add-component` / `test-writing` が正本。
>
> 単一層で終わる作業（UI だけ / 文言だけ / バグ修正）ではこれを開かない — `lead-pipeline` の軽・中ティアで足りる。

## 0. 着手前に

- **本当に新しいテーブルが要るか**を先に判定する。特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が要る → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database（ただし現在凍結中）。判定基準の正本は CLAUDE.md §4
- 既存の 5 role（task / event / routine / note / daily）に**寄せられないか**を疑う。`notes_payload.note_type` に `'template'` を足したテンプレート機能（#1047）のように、**列 1 つで済むなら 2 行分割モデルと ID 不変式に手を入れない**のが最良の着地
- 計画書が要る規模なら `docs/vision/plans/_TEMPLATE.md` ベースで先に書く（Scope 宣言 / Gate 列 / 機械検証可能な AC。CLAUDE.md §7.3）

## Phase 1: データ層（DDL）

→ 手順の正本は **`db-migration` スキル**。

`supabase/migrations/<連番>_<slug>.sql` を**ローカルに置くだけ**にする。適用（`supabase db push`）はこうだいさんの手番で、`apply_migration` MCP の単独使用は禁止（CLAUDE.md §7.3）。ここで止まるので、**Phase 2 以降は DDL の適用を待たずに書いてよい**（型は自分で書くため）。

## Phase 2: サービス層（DataService 境界）

**フロントは `getDataService()` 経由でしかデータに触らない**（CLAUDE.md §3.1）。コンポーネントからバックエンドを直接呼ぶ経路は作らない。触るファイル:

| ファイル | 何をするか |
| --- | --- |
| `shared/src/types/` | ドメインの TS 型 |
| `shared/src/services/<domain>Mapper.ts` | 2 行分割の変換 3 関数（`rowsToType` / `typeToRows` / `typeUpdatesToPatches`）。**I/O を持たない純関数**で `@supabase/supabase-js` に依存しない |
| `shared/src/services/DataService.ts` | `<Domain>DataService` インターフェースを足し、`DataService` に合成 |
| `shared/src/services/Supabase<Domain>Service.ts` | 実装クラス + `PHASE2_<DOMAIN>_METHOD_NAMES` / `_METHODS` の export |
| `shared/src/services/dataServiceRouting.ts` | `PHASE2_ROUTING_DOMAINS` に 1 行足す |
| `shared/src/services/SupabaseDataService.ts` | `route()` の if 連鎖に足す |

routing は**型と実行時の二重で守られている**（`DataServiceIsFullyRouted` の型アサート + テストが `PHASE2_ROUTING_DOMAINS` を歩いて「全メソッドがちょうど 1 回ルーティングされている」ことを見る）。足し忘れは型か テストで落ちるので、手で全数を数え直さない。

mapper の 3 つの罠（詳細 = `docs/vision/db-conventions.md` §10）:

- **`items_meta.updated_at` は payload だけを更新するときも必ず bump する**（LWW cursor がこれ 1 本のため）
- **生成列（`parent_item_role`）に書き込まない** — PG が 42601 で reject する。Write 用型から `Omit` して型レベルで塞ぐ
- **upsert が UPDATE に転じると DEFAULT `now()` が効かない** — bulk 経路は caller 側で `updated_at` を spread して bump を強制する

## Phase 3: Realtime ドメイン

新テーブルを作ったら 2 箇所を lockstep で更新する。

1. migration 側で `supabase_realtime` publication に追加
2. `shared/src/context/SyncContext.tsx` の `REALTIME_TABLES` に追加
3. `shared/src/context/syncDomains.ts` のテーブル → ドメイン対応表に追加（新ドメインが要るなら `SYNC_DOMAINS` にも）

`syncDomains.test.ts` / `syncRealtimeTables.test.ts` が lockstep を見張っているので、片方だけだと落ちる。**読み手が分かれるなら既存ドメインに相乗りさせない**（#993 = 書き込みの多い `timer_sessions` を settings と同居させて、ポモドーロ操作のたびに設定 2 本を取り直していた）。

## Phase 4: UI

→ 手順の正本は **`add-component` スキル**、デザイン判断は `frontend-react-designer`。

hook（`shared/src/hooks/`）→ 必要なら Context（Pattern A）→ 部品（`shared/src/components/`）→ 画面への配線（`web/src/`）の順。読む effect で `useSyncDomains` を宣言する（Phase 3 の申告漏れはここで無言の stale になる）。

## Phase 5: テスト

→ 手順の正本は **`test-writing` スキル**。

最低限: mapper の純関数テスト（変換の往復と生成列の除外）+ hook / 画面のテスト。**`build` はテストファイルを見ず `vitest` は型を見ない**ので、`typecheck:tests` が独立のゲートとして要る。

## Phase 6: MCP に出すか

Claude Code から触れるようにするなら `mcp-server/src/tools/` にツールを足す（`defineTool.ts` の形に倣う）。**汎用 Database は MCP 未対応**なので、新しい PropertyType を足したときは MCP 側も揃える（CLAUDE.md §4）。

## Phase 7: 仕上げ

1. `session-verifier`（CI の `verify` ジョブを上から再現。触っていないパッケージも回す — 依存が shared → web → desktop / mcp-server と繋がっている）
2. 機能の追加 / 削除なら **CLAUDE.md §8 の Tier 表**と `docs/requirements/` を更新
3. `task-tracker`（**実装ブランチには載せない** — 専用ブランチ `chore/tracker-<chat>-YYYYMMDD` へ。CLAUDE.md §7.4）
4. `git-workflow` に従って commit / PR。**merge はこうだいさんの手番**（P-001）

## 実装中に計画外の変更が浮上したら

**実装せずキューへ**（`.claude/comm/decisions/chat-<self>.md`）。現計画を続行し、Scope / AC の自己免除はしない（P-008）。
