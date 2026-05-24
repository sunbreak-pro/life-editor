---
Status: COMPLETED — 2026-05-24 commit `8a45397`（後送り分の Events UI Tag/Link は DU-F Step 6-14 で完了）。DB schema + shared 層 mapper / service / hook / Provider は DU-C+ 単独で完了済（commit `aa114d1`）。
Created: 2026-05-24
Branch: data-unification/items-meta-redesign
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3, 改訂で Q16 + DU-C+ 行を追加予定）
Previous: .claude/archive/2026-05-24-data-unification-c-events-routine.md（DU-C 完了）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」（wiki_tags / wiki_tag_assignments / wiki_tag_connections の列定義）「列化判定マトリクス」「Pattern A Provider 再設計案」「Sync への影響」
---

# Plan: DU-C+ — Events 限定で WikiTag/WikiLink を先行 + CalendarTag 吸収

## DU-C+ scope reduction (2026-05-24)

実装途中で **frontend↔shared 統合が Phase 2 完成タスクとして残っている**ことが判明（frontend は独自 `tauriDataService` のみ参照、`shared/SupabaseDataService` 未参照）。Events UI で `useWikiTagsUnifiedContext` を呼んでも data access が動かない構造のため、本 sub-phase を以下に縮約する:

- ✅ 完了: DB migration (`0012_drop_calendar_tags.sql`) / shared 層 (mapper 5 / SupabaseWikiTagsUnifiedService / hook / Provider) / 単体テスト 18 / DataService interface 拡張
- ⏭ 後送り: Events UI の Tag/Link (Step 5-6) / CalendarTag UI ファイル削除 (Step 7) / App.tsx Provider 配置 (Step 8) / RLS gate 拡張 (Step 9) → すべて DU-F の frontend↔shared 統合タスクへ統合
- 🗑 廃棄: 一時的に追加した frontend 独自 `useWikiTagsUnifiedAPI` + `WikiTagsUnifiedContext` (4 ファイル) は本 commit 前に削除済（DU-F 着手時に shared 版を直接消費する方針）

DU-C+ scope-reduced 完了の判断は: `cd frontend && npm run build` exit 0 / `pnpm -F shared test` 緑 / Supabase `calendar_tag_*` 不在 / shared 層 mapper + service + hook + Provider が build-clean (DU-F で frontend↔shared 統合と同時に活性化される)。

## このフェーズの当初ゴール（参照のみ — scope reduction 後は無効）

親計画書 DU-F の WikiTag/WikiLink 統合を **DB スキーマ全 role 対応 + UI は Events 先行** で分割実施する。

- `calendar_tag_definitions` / `calendar_tag_assignments` を DROP（CalendarTag 概念の廃止）
- `wiki_tags` / `wiki_tag_groups` / `wiki_tag_group_assignments` / `wiki_tag_assignments` / `wiki_tag_connections` の 5 テーブルは **DU-A の `0008_data_unification_schema.sql` で既に作成済み**（再 migration 不要）
- `calendars` テーブルは保持（Schedule のフォルダフィルタ UI を生かす）
- WikiTagsProvider / WikiGraphProvider を新設（5 role すべてで使える契約）
- ~~Events タブにのみ Tag 付け UI + Link UI を実装~~ → DU-F へ
- ~~CalendarTag UI / Context / hook / mapper / service を削除~~ → DU-F へ（テーブルは既に DROP 済、コードは死んだまま放置）
- vitest 緑 / `npm run build` exit 0 / RLS gate offender 0 / advisor lint 0

完了後の DU-F は「残り 4 role（task / routine / note / daily）の UI 実装 **+ DU-C+ 後送り分（Events UI Tag/Link + CalendarTag コード削除 + Provider 配置 + RLS gate）**」に拡大される。

## ユーザー確定事項（2026-05-24 / DU-C+ 起票時）

| #     | 項目                              | 確定                                                                                                                                                 |
| ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP-Q1 | CalendarTag テーブル削除範囲      | **`calendar_tag_definitions` + `calendar_tag_assignments` の 2 テーブルのみ削除**。`calendars` は保持（フォルダフィルタマスタとして引き続き使用）    |
| CP-Q2 | 直近実装範囲                      | **DB は 5 role 全部対応で作る** / Provider・UI は **Events のみ先行**。他 4 role 用 UI は DU-F で実装                                                |
| CP-Q3 | Tag/Link スコープ                 | **Tag (assignments) + Link (connections) 両方**実装                                                                                                  |
| CP-Q4 | wiki_tag_groups 範囲              | 親計画書 DU-F 通り wiki_tag_groups + wiki_tag_group_assignments も同時新設（Events からは Tag 単体での付与だけ使うが、テーブルとマスタ CRUD は用意） |
| CP-Q5 | CalendarTag データ移行            | **しない**（親 Q3 = 破壊的リセット許容に整合）。CalendarTag に登録済みのテストデータは消失する                                                       |
| CP-Q6 | Events UI の Tag/Link 配置 (改訂) | **詳細は実装フェーズ（DU-C+5 / DU-C+6）でユーザー確認**。本計画書では「Events 詳細パネル内 + リスト行右端に視覚的ピル表示」という方針のみ固定        |

### CP-Q3 補足（Tag と Link の概念区分）

- **Tag (`wiki_tag_assignments`)**: items_meta の 1 行 ↔ wiki_tags マスタの 1 行（分類）。Obsidian の `#tag` 相当
- **Link (`wiki_tag_connections`)**: items_meta の 1 行 ↔ items_meta の別の 1 行（双方向の接続）。Obsidian の `[[note-name]]` 相当
- 命名の歴史: Phase 2 までは Tauri SQLite で `wiki_tag_connections` がタグ間の親子関係を表していたが、Data Unification では **items 間の relation graph** に再定義する（親計画書 DU-F の方針通り）

### CP-Q4 補足（wiki_tag_groups を含める理由）

親計画書では DU-F で `wiki_tags / wiki_tag_groups / wiki_tag_group_assignments / wiki_tag_assignments / wiki_tag_connections` の 5 テーブルセットを想定。本計画書で wiki_tag_groups を後回しにすると DU-F で再 migration が必要になりコスト二重化。先にスキーマだけ作り、Events UI からは Tag マスタ CRUD と assignment しか使わない（group UI は DU-F で実装）。

### CP-Q6 補足（UI 配置を実装段階で確認する理由）

UI 配置はユーザーの主観的判断が大きいため、計画書段階で固定しない。実装ステップ DU-C+5 / DU-C+6 で screenshot 提示 + AskUserQuestion で確認する。

---

## Context

- **動機**: 親計画書の DU-F (WikiTag/WikiLink 全 role 統合) のうち、Events 部分を DU-D 前に切り出して先行検証する。CalendarTag 概念を WikiTag に統一することで「分類タグの体系が 2 つあって使い分けが曖昧」状態を解消し、Obsidian 的な「全アイテム平等にリンク対象」思想に一歩近づける
- **制約**:
  - 親計画書のユーザー確定事項 Q1〜Q15 を変更しない（追加で Q16 を起票する形）
  - DU-A / DU-B / DU-C は完了済（commit `c1e1896` 時点）。本計画書は items_meta + events_payload が稼働していることを前提とする
  - `calendars` テーブルは保持（フォルダフィルタ UI が生きている）
  - 既存 CalendarTag テストデータは消失する（破壊的リセット）
- **Non-goals**:
  - Notes / Tasks / Routine / Daily への Tag/Link UI 実装（DU-F で実施）
  - wiki_tag_groups の UI 実装（DU-F で実施）
  - graph 可視化 UI（親計画書 Q12 通り backlink list のみ、グラフ可視化は別計画）
  - MCP Server の WikiTag ツール書き換え（親計画書通り「MCP catch-up plan」へ）
  - calendars テーブルの設計変更

---

## Scope (Touchable Paths)

```
supabase/migrations/0012_drop_calendar_tags.sql          # 新規 (drop のみ。create は DU-A の 0008 で完了済)
shared/src/types/wikiTag.ts                              # 新規 (5 role 共通の TS 型)
shared/src/services/wikiTagMapper.ts                     # 新規
shared/src/services/wikiTagAssignmentMapper.ts           # 新規
shared/src/services/wikiTagConnectionMapper.ts           # 新規
shared/src/services/SupabaseDataService.ts               # CalendarTag メソッド削除 + WikiTag メソッド追加
shared/src/hooks/useWikiTagsAPI.ts                       # 新規 (タグマスタ + assignments + connections)
shared/src/context/WikiTagsContext.tsx                   # 新規
shared/src/index.ts                                      # CalendarTag export 削除 + WikiTag export 追加
shared/src/types/sync.ts                                 # CalendarTag refs 削除 + WikiTag 追加
shared/tests/wikiTagMapper.test.ts                       # 新規
shared/tests/wikiTagAssignmentMapper.test.ts             # 新規
shared/tests/wikiTagConnectionMapper.test.ts             # 新規

# 削除対象 (CalendarTag 系)
shared/src/services/calendarTagDefinitionMapper.ts       # 削除
shared/src/services/calendarTagAssignmentMapper.ts       # 削除
shared/src/services/calendarTagDefinitionMapper.test.ts  # 削除 (存在すれば)
shared/src/services/calendarTagAssignmentMapper.test.ts  # 削除 (存在すれば)
shared/src/hooks/useCalendarTagsAPI.ts                   # 削除
shared/src/context/CalendarTagsContext.tsx               # 削除

# Frontend
frontend/src/context/WikiTagsContext.tsx                 # 新規 (shared Provider を拡張) または shared 版を直接使用
frontend/src/context/index.ts                            # Provider export 更新
frontend/src/App.tsx                                     # Provider 順序更新 (WikiTagsProvider 配置 / CalendarTagsProvider 削除)
frontend/src/components/Tasks/Schedule/Events/**         # Tag 付け UI + Link UI 追加
frontend/src/components/WikiTags/**                      # 既存の WikiTag UI を items_meta 経由に書き換え (もしくは新規)

# 削除対象 (CalendarTag 系 frontend)
frontend/src/context/CalendarTagsContext.tsx             # 削除
frontend/src/context/CalendarTagsContextValue.ts         # 削除
frontend/src/hooks/useCalendarTags.ts                    # 削除
frontend/src/hooks/useCalendarTagAssignments.ts          # 削除
frontend/src/hooks/useCalendarTagFilter.ts               # 削除
frontend/src/components/Tasks/Schedule/Calendar/**       # CalendarTag UI 部分のみ削除 (calendars UI は残す)

# 計画書
.claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md  # 本計画書
.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md          # 親計画書改訂 (Q16 / Phase 分割表 / DROP 対象 / DoD)
```

スコープ外の変更が必要になった場合は、本計画書を更新してから手を付ける（更新せず広げない）。

---

## 採用アーキテクチャ

### DB スキーマ差分（DU-A 以降の追加）

#### DU-A 時点の既存スキーマ（再 migration 不要）

`0008_data_unification_schema.sql` で以下 5 テーブルが既に作成済み:

| テーブル                     | 役割                        | PK / UNIQUE                                                                                         |
| ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `wiki_tags`                  | タグマスタ (5 role 共通)    | PK=id, UNIQUE(name, user_id) WHERE is_deleted=false                                                 |
| `wiki_tag_groups`            | タグの分類                  | PK=id                                                                                               |
| `wiki_tag_group_assignments` | wiki_tags ↔ wiki_tag_groups | PK=id, UNIQUE(tag_id, group_id) WHERE is_deleted=false                                              |
| `wiki_tag_assignments`       | items_meta ↔ wiki_tags      | PK=id, UNIQUE(item_id, tag_id) WHERE is_deleted=false                                               |
| `wiki_tag_connections`       | items_meta ↔ items_meta     | PK=id, UNIQUE(from_item_id, to_item_id) WHERE is_deleted=false / CHECK (from_item_id <> to_item_id) |

列定義・RLS policy・FK 設計・index はすべて `0008_data_unification_schema.sql` を SSOT とする。**本計画書では新 DDL を書かない**。

#### DU-C+ で追加する DDL（drop のみ）

`0012_drop_calendar_tags.sql`:

```sql
-- calendar_tag_assignments / calendar_tag_definitions を DROP
-- 0007 で truncate のみ、構造は維持されていた 2 テーブルを構造ごと削除する。
-- calendars テーブル本体は引き続き保持（Schedule のフォルダフィルタ UI で使用）。
DROP TABLE IF EXISTS public.calendar_tag_assignments CASCADE;
DROP TABLE IF EXISTS public.calendar_tag_definitions CASCADE;
```

RLS policy / index / FK は `CASCADE` で自動削除される。

#### 既存 FK 設計（参考、0008 で確定済）

- `wiki_tag_assignments.item_id` → `items_meta(id)` ON DELETE CASCADE（item 削除時はタグ assignment も消滅）
- `wiki_tag_connections.from_item_id` / `to_item_id` → `items_meta(id)` ON DELETE CASCADE
- `wiki_tag_assignments.tag_id` → `wiki_tags(id)` ON DELETE CASCADE
- DU-B の `(id, role)` composite FK パターンは本計画書では **採用しない**（Tag/Link は全 role を対象にするため）

### Provider 再配置

App.tsx の Provider 順序差分:

```diff
ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock
  → ItemsMetaProvider
    → TasksProvider → EventsProvider → RoutineProvider → NotesProvider → DailyProvider
+   → WikiTagsProvider                  ← 新設。items_meta に依存
-   → WikiGraphProvider (DU-F で予定だった)  ← WikiTagsProvider に統合
- → CalendarTagsProvider                ← 削除
  → Template → FileExplorer → Timer → Audio → ShortcutConfig → SidebarLinks
```

- WikiTagsProvider は `ItemsMetaProvider` の内側に配置（items_meta.id を FK として扱うため）
- Notes/Daily/Tasks Provider と並列の位置にあり、互いに依存しない
- CalendarTagsProvider は削除（依存していた CalendarView は items 横断 Tag を直接使うか、タグ無し版に縮退する → 詳細は DU-C+6 で確定）

### Shared 層の構造

```
shared/src/context/WikiTagsContext.tsx
  ↓ uses
shared/src/hooks/useWikiTagsAPI.ts
  ↓ uses
shared/src/services/SupabaseDataService.ts (WikiTag メソッド群)
  ↓ uses
shared/src/services/wikiTagMapper.ts            (wiki_tags row ↔ WikiTagNode)
shared/src/services/wikiTagAssignmentMapper.ts  (wiki_tag_assignments row ↔ WikiTagAssignment)
shared/src/services/wikiTagConnectionMapper.ts  (wiki_tag_connections row ↔ WikiTagConnection)
```

mapper 規約は DU-B の `taskMapper.ts` を踏襲（pure function / wire-faithful / updated_at bump は呼び出し側で明示）。

---

## Steps

| #   | Step                                            | Gate              | Acceptance                                                                                                                 |
| --- | ----------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | DB migration `0012_drop_calendar_tags.sql` 作成 | 🤖 自律           | `supabase/migrations/` に 1 ファイル追加 (drop のみ。create は DU-A で完了済)                                              |
| 2   | `supabase db push` 実行                         | 🛑 人手           | ユーザーが手で push / `list_tables` で wiki*tags 系 5 テーブル健在 + calendar_tag*\* 2 テーブル不在を確認 / advisor lint 0 |
| 3   | shared mapper + types 実装 + 単体テスト         | 🤖 自律           | `pnpm -F shared test` 緑 / `npm run build` exit 0                                                                          |
| 4   | shared hook + service + Provider 実装           | 🤖 自律           | `pnpm -F shared test` 緑 / Provider 単体テスト緑                                                                           |
| 5   | Events 詳細パネルに Tag UI 追加                 | 🤖 自律 + 👀 目視 | golden path = Events 1 件作成 → Tag 付与 → 一覧で Tag 表示 → Tag 解除                                                      |
| 6   | Events 詳細パネルに Link UI 追加                | 🤖 自律 + 👀 目視 | golden path = Events から Tasks に Link → backlink list で逆方向確認                                                       |
| 7   | CalendarTag UI / Context / hook / service 削除  | 🤖 自律           | `npm run build` exit 0 / CalendarTag に関する型エラー 0                                                                    |
| 8   | App.tsx Provider 順序更新 + 既存テスト修正      | 🤖 自律           | `cd frontend && npm run build` exit 0 / 全 vitest 緑                                                                       |
| 9   | RLS gate スクリプト拡張 (5 テーブル追加)        | 🤖 自律           | RLS gate offender 0                                                                                                        |
| 10  | 親計画書改訂 (Q16 / Phase 表 / DROP / DoD)      | 🤖 自律           | 親計画書 diff レビュー OK                                                                                                  |
| 11  | コミット → PR レビュー                          | 🛑 人手           | PR レビュー & merge ボタン                                                                                                 |

### Gate 凡例

- **🤖 自律** — Claude が完結。後追い検証（type check / test）で品質担保
- **👀 目視** — UI / 体感 / レイアウトでユーザー目視必須
- **🛑 人手** — DDL push / PR merge 等のユーザー操作必須

---

## Acceptance Criteria（機械検証可能）

- [ ] `cd frontend && npm run build` exit 0（型エラー 0）
- [ ] `pnpm -F shared test` 全 pass
- [ ] `cd frontend && npx vitest run` 全 pass
- [ ] Supabase に `wiki_tags` / `wiki_tag_groups` / `wiki_tag_group_assignments` / `wiki_tag_assignments` / `wiki_tag_connections` の 5 テーブル存在
- [ ] Supabase に `calendar_tag_definitions` / `calendar_tag_assignments` 不在
- [ ] Supabase に `calendars` テーブルは引き続き存在（保持確認）
- [ ] RLS gate スクリプトで offender 0（拡張後）
- [ ] Supabase advisor lint 0
- [ ] `git grep -E "(calendar_tag_definitions|calendar_tag_assignments|CalendarTagsProvider|useCalendarTags)"` で frontend / shared にヒット 0（cloud/db/migrations 内の **過去の** migration ファイル参照を除く）
- [ ] Events タブで Tag 付与 → 削除の golden path が画面上で動作（👀 目視）
- [ ] Events タブで Link 作成 → 逆方向 backlink 表示の golden path が画面上で動作（👀 目視）

---

## DB Migration Notes

DDL 含むため必須記入。**ローカルファイル先行ルール厳守**:

1. Claude が `supabase/migrations/0012_drop_calendar_tags.sql` を作成 + SQL 記入（drop のみ。wiki_tags 系 5 テーブルは DU-A の `0008_data_unification_schema.sql` で作成済）
2. **ユーザーが** `supabase db push` を実行（`apply_migration` MCP 単独使用禁止 = schema drift 確定）
3. 適用後、Claude が `list_tables` で確認しレポート（wiki*tags 系 5 テーブル健在 + calendar_tag*\* 2 テーブル不在）

### ロールバック

- 失敗時は逆向き migration を別ファイルで作成（`0012_rollback.sql` 等。既存 migration ファイル編集は禁止）
- CalendarTag 復元は Phase 2 期間の migration を再適用する形（ただし既存データは復元不能 = 親 Q3 同様の前提）

---

## Risks & Mitigations

| ID  | リスク                                                                                  | レベル | 緩和策                                                                                                                        |
| --- | --------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | Provider 順序ミス（CalendarTagsProvider の依存元が見落とされて残る）                    | 高     | DU-C+8 で `git grep -rn "CalendarTagsContext\|useCalendarTags"` を 0 にしてから build 確認                                    |
| R2  | wiki_tag_connections の自己リンク混入                                                   | 高     | CHECK (from_item_id <> to_item_id) を migration で必須化                                                                      |
| R3  | wiki_tag_assignments が削除済 items_meta を参照（孤児行）                               | 中     | FK ON DELETE CASCADE で物理連動。is_deleted=true の items_meta もアプリ層 SELECT で除外                                       |
| R4  | items_meta(id) FK で role 制約しない設計の妥当性                                        | 中     | 5 role 全部を対象にする設計なので意図通り（cross-role 防止が要件ではない）。本判断を `db-conventions.md` に追記               |
| R5  | Events UI に Tag/Link を入れた後、他 4 role UI 実装時に契約変更が発生                   | 中     | shared 層の hook / service は **5 role 共通契約** で設計（item_id: string + role: ItemRole 引数）。Events 専用にしない        |
| R6  | CalendarView から CalendarTag フィルタが消えると UX 後退                                | 中     | DU-C+6 で「タグ無し版に縮退」or「WikiTag フィルタに置き換え」をユーザー目視で確認。デフォルトは縮退、WikiTag 化は DU-F で検討 |
| R7  | RLS policy 抜けで他ユーザーのタグが見える                                               | 致命   | DU-B 同型の 4 policy + RLS gate スクリプト拡張で検出                                                                          |
| R8  | wiki_tag_groups テーブルを作ったが UI 未実装で死蔵                                      | 低     | CP-Q4 で受容。DU-F で UI 化                                                                                                   |
| R9  | shared/src/index.ts の export 変更で既存 import が壊れる                                | 中     | DU-C+7 で `npm run build` を 2 回（frontend / shared）走らせて検出                                                            |
| R10 | calendars テーブルへの import (CalendarNode 等) が CalendarTag 削除と一緒に巻き込まれる | 高     | calendars 系の import / mapper / hook は **触らない**。grep で意図しない削除がないか確認                                      |

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` で類似事例を確認
- 新規 known issue 候補:
  - 「items_meta FK で role 制約しないテーブルの設計指針」（wiki_tag_assignments が初例）
  - 「Provider 削除時の依存元 grep チェックリスト」

---

## References

- vision: `.claude/docs/vision/db-conventions.md`（payload mapper 規約 / RLS パターン）/ `.claude/docs/vision/coding-principles.md`（Pattern A / Provider 順序）
- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（Q14 + DU-F 章）
- 前フェーズ: `.claude/archive/2026-05-24-data-unification-c-events-routine.md`（DU-C 完了）
- related skills: `db-migration`（migration 追加手順）/ `add-component`（Provider 追加パターン）/ `life-editor-migration-validator`（3 系統整合監査）/ `life-editor-sync-auditor`（sync 区分判定）

---

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- (未着手)
