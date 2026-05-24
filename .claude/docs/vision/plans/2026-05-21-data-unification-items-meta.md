---
Status: PLANNING — 親計画書 v3（2026-05-22、role-qa 2nd 監査の新規 Blocker/Major/Minor を反映）。子計画書 (DU-A〜DU-F) は進行時に都度作成。
Created: 2026-05-21
Revised: 2026-05-22 v2 (role-qa 1st 監査の計 15 項反映、Phase 命名を Data Unification へ変更) → v3 (2nd 監査の Calendar 系維持 / events_payload Routine 識別 / 列名統一 / touched=NO テーブル列挙 を反映)
Task: Data Unification — Schedule items_meta + payload (旧名: Phase 3)
Project path: /Users/newlife/dev/apps/life-editor
Branch: data-unification/items-meta-redesign（refactor/web-first-v2 から分岐予定 / Phase 2 マージ後に作成）
Parent SSOT: .claude/2026-05-04-cross-platform-migration.md（移行 SSOT。本計画は移行 SSOT の番号体系 (Phase 3=Electron / Phase 4=Capacitor / Phase 5=配布) とは別軸の「データモデル再設計」レーンとして実施）
Supersedes-design: S5 WikiTags 旧計画 (`.claude/docs/vision/plans/2026-05-20-s5-wikitags-migration.md`) は 2026-05-21 に design knowledge を outbox `chat-web-migration.md` 経由でハンドオフ済み、ファイルは既に削除済 (commit 8ceae24)。本計画書が S5 設計領域を吸収。
Related: .claude/docs/vision/coding-principles.md / .claude/docs/vision/db-conventions.md / CLAUDE.md §3-§6
---

# Plan: Data Unification — Schedule items_meta + payload

## Phase 命名と移行 SSOT との関係

本計画は「Data Unification」と命名し、移行 SSOT の Phase 番号体系とは **別軸のレーン** として実施する。

| 軸                        | 番号体系                                                                                                               | 本計画との関係                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 移行 SSOT (主軸)          | Phase 1 (準備) / Phase 2 (Supabase コア移植) / Phase 3 (Electron 包装) / Phase 4 (Capacitor) / Phase 5 (配布)          | Phase 2 完了済み。Phase 3 は別作業                              |
| Data Unification (本計画) | DU-A (DB スキーマ) / DU-B (Tasks) / DU-C (Events+Routine) / DU-D (Notes+Daily) / DU-E (Calendar) / DU-F (WikiTag/Link) | 移行 SSOT Phase 2 と Phase 3 の間に挟むデータモデル再設計レーン |

- 本計画と移行 SSOT Phase 3 (Electron 包装) は **論理的に独立**。Data Unification 完了後でも、移行 SSOT Phase 3 着手前でも、両方可能。
- 本計画完了時に移行 SSOT の「Phase 2 と Phase 3 の間に Data Unification を実施した」旨を追記する (DoD 必達項目)。

## Context

### なぜ今やるのか

現状の Schedule セクションは Calendar / Dayflow / Tasks / Events の 4 タブで構成され、データモデルは
`tasks` / `schedule_items` / `routines` / `routine_groups` / `notes` / `dailies` が並立している。これに伴い
以下 3 つの構造的問題が顕在化している。

1. **「1 アイテムに複数振る舞い」モデルの限界**: 現状は role が「振る舞い切替フラグ」として
   schedule_items に同居。Task/Event/Routine の境界が曖昧で、UI 分岐と DB 制約が衝突しがち。
   引っ越しで例えれば「1 つの段ボールに皿もシャツも本も入れて、用途タグだけ貼る」状態で、
   取り出すたびに分類し直さないといけない。

2. **WikiLink グラフが分散**: WikiTag/WikiLink 連携が tasks / notes / schedule_items のそれぞれに
   独立した FK で実装され、グラフを横断走査するためには polymorphic な join が必要。Obsidian 的な
   「全アイテムが平等にリンク対象」という思想に反する。

3. **Tasks/Events/Routine の概念的源流が不明確**: 5 種すべて「予定や記録の単位」という共通の本質を
   持ちながら、テーブルが完全分離しているため、共通機能 (タグ付け / 検索 / 全文 / 並び替え) が
   毎回ドメイン別に再実装される。

### Phase 2 との関係

- Phase 2 (S0-S8) は Tauri SQLite → Supabase D1 への **インフラ移植** が主眼。データモデルは
  「frontend 型が正本」を守り、構造変更は最小限に抑えた。
- 本計画は移植が完了した Supabase 上で **データモデル自体を再設計** する。Phase 2 の S3 (Notes)
  / S4 (Schedule) で書いた shared mapper / Provider / web UI は本計画で **全捨て**。
  実装パターン (Pattern A Provider 構造 / DataService 抽象化境界) のみ参考にする。
- ただし **以下の純粋関数は再利用** する (本計画で再書き換えしない):
  - `shared/src/utils/routineFrequency.ts` (Routine 周期ロジック)
  - `shared/src/utils/routineScheduleSync.ts` (Routine → Schedule 生成器)
  - これらは items_meta 経由に書き換えても本質ロジック差分がない。
- S5 WikiTags 旧計画 (`2026-05-20-s5-wikitags-migration.md`) は本計画に吸収。WikiTag/WikiLink は
  最初から items_meta 上の一元グラフとして再設計する。S5 で書きかけた `wikiTagMapper.ts` 等は
  捨てる対象 (本計画の wiki_tags / wiki_tag_assignments / wiki_tag_connections 用に書き直す)。

### 並行チャット競合

- **chat-refactor** (frontend Phase 5 giant component decomposition): Phase 5 承認待ち。本計画
  着手中も `frontend/` 配下を触る可能性があるため、本計画は **`web/` および新規 `shared/`
  ファイル** を中心に作業する。
- **MEMORY.md / HISTORY.md**: 本レーン (chat-web-migration) が tracker 単独オーナー。

## ユーザー確定事項 (2026-05-21 / 2026-05-22 改訂)

実装に入る前のブレ防止のため、以下を本計画書の不変前提として固定する。

| #   | 項目                               | 確定                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | 統一スコープ                       | Tasks / Events / Routine / **Notes / Daily も含む** 5 種すべて統一                                                                                                                                                                                                                                                                   |
| Q2  | DB 戦略                            | **ハイブリッド** = `items_meta` + 種別 `*_payload` テーブル                                                                                                                                                                                                                                                                          |
| Q3  | 既存データ                         | **破壊的リセット (クリーンスタート)** 許容                                                                                                                                                                                                                                                                                           |
| Q4  | Calendar ビュー数 (改訂)           | **月ビュー + 3 日ビュー の 2 ビュー**。週ビューは本計画で除外、後期計画で復活                                                                                                                                                                                                                                                        |
| Q5  | S5 WikiTags 旧計画                 | 廃止 → 本計画に吸収。ファイルは既に削除済 (commit 8ceae24)、本計画書が設計領域を継承                                                                                                                                                                                                                                                 |
| Q6  | 既存コード                         | S3/S4 で書いた shared mapper / Provider / web UI は **全捨て**。Provider Pattern A 構造のみ参考                                                                                                                                                                                                                                      |
| Q7  | ブランチ                           | Phase 2 を `refactor/web-first-v2` に FF マージ → `data-unification/items-meta-redesign` を切る                                                                                                                                                                                                                                      |
| Q8  | 計画書粒度                         | **親計画書のみ今回作成**。子計画書 (DU-A〜DU-F) は進行時に都度                                                                                                                                                                                                                                                                       |
| Q9  | payload 物理設計                   | **専用列を厚く、JSONB は最小限** (Notes/Daily の content_json のみ JSONB、他はすべて専用列)                                                                                                                                                                                                                                          |
| Q10 | role 変更可否                      | **不可。作り直し UX** (payload テーブル間移行は実装しない)                                                                                                                                                                                                                                                                           |
| Q11 | Routine 詳細仕様                   | 子計画書 (DU-C) まで遅延。親計画書は「Events 内で RoutineGroup 作成・割当可能」まで                                                                                                                                                                                                                                                  |
| Q12 | WikiLink グラフ範囲                | **データモデル + backlink list のみ**。グラフ可視化 UI は別計画 (Data Unification 後続)                                                                                                                                                                                                                                              |
| Q13 | Phase 命名 (改訂で追加)            | 「Data Unification」へ変更。移行 SSOT の Phase 3 (Electron) との衝突回避                                                                                                                                                                                                                                                             |
| Q14 | role 拡張範囲 (改訂で追加)         | **role は 5 種厳守**。RoutineGroup / WikiTag (タグマスタ) / wiki_tag_groups は **専用テーブルで独立**                                                                                                                                                                                                                                |
| Q15 | template_event 型 (改訂で追加)     | **専用列に分解** (template_start_time / template_end_time / template_memo / template_reminder_offset_min)。列名は Phase 2 既存の `reminder_offset_min` と整合                                                                                                                                                                        |
| Q16 | CalendarTag 廃止 (2026-05-24 追加) | **`calendar_tag_definitions` + `calendar_tag_assignments` を DROP し、wiki_tags に統合**。`calendars` テーブルは保持（フォルダフィルタマスタとして引き続き使用）。Events 限定 UI 先行投入のため DU-C と DU-D の間に **DU-C+ sub-phase** を挟む。詳細は `.claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md` |

## 採用アーキテクチャ

### 2 層構造図

```
                  ┌─────────────────────────────────────┐
                  │           items_meta                │
                  │  (id, role, title, user_id,         │
                  │   created_at, updated_at,           │
                  │   is_deleted, deleted_at,           │
                  │   version)                          │
                  └────────────┬────────────────────────┘
                               │ FK item_id
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
 tasks_payload events_payload routines_payload notes_payload dailies_payload
  (5 種それぞれが items_meta.id を FK 参照)

専用テーブル群 (items_meta には乗せない / Q14)
  ├── routine_groups       (id, title, user_id, ...)
  ├── routine_group_assignments (routine_item_id FK, group_id FK)
  ├── wiki_tags            (id, name, color, user_id, ...)       ← タグマスタ
  ├── wiki_tag_groups      (id, name, user_id, ...)              ← タグの分類
  ├── wiki_tag_group_assignments (tag_id FK, group_id FK)
  ├── wiki_tag_assignments (item_id FK items_meta, tag_id FK wiki_tags)
  └── wiki_tag_connections (from_item_id FK, to_item_id FK)
```

### role の役割

- `items_meta.role` は **アイテムの本質型を決定する単一値** (TypeScript の判別共用体の discriminator)。
- 値域: `task` / `event` / `routine` / `note` / `daily` の **5 値厳守** (Q14)。
- **role 変更は許可しない** (Q10)。「メモから Task へ昇格」のような UX は手動の作り直しで対応。
- 1 つの items_meta 行に対応する payload テーブルは **role により一意決定** される (CHECK 制約で強制)。
- RoutineGroup / WikiTag / wiki_tag_groups は items_meta に乗せず、専用テーブル群で独立管理する (Q14)。

### items_meta.id の不変式

- フォーマット: `<role>-<uuid>` (CLAUDE.md §4.3 を踏襲)。例: `task-550e8400-e29b-41d4-a716-446655440000`
- **prefix から role を逆引きしてはならない**。アプリ層は必ず items_meta テーブルへ join して role 列を引く。
  - 理由: id 文字列パースは脆く、role 変更不可 (Q10) でも将来例外が混入するリスクを残すため。
  - daily も `daily-<uuid>` 形式とし、日付は `dailies_payload.date` で UNIQUE 管理する。`daily-YYYY-MM-DD` 形式は採用しない。

### Pattern A Provider 再設計案

Data Unification 完了時の Provider 順序 (外→内):

```
ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock
  → ItemsMetaProvider              ← 全 role 共通のメタ操作 (CRUD / tag / link)
    → TasksProvider                ← role=task の特化操作 (ツリー DnD / ステータス)
    → EventsProvider               ← role=event の特化操作 (2 状態 / リマインダー)
    → RoutineProvider              ← role=routine + RoutineGroup
    → NotesProvider                ← role=note (階層 / TipTap)
    → DailyProvider                ← role=daily (UPSERT)
    → WikiGraphProvider            ← items_meta 上の relation グラフ
  → CalendarTagsProvider → Template → FileExplorer → Timer → Audio → ShortcutConfig → SidebarLinks
```

- 役職別 Provider は **ItemsMetaProvider に依存**。ItemsMetaProvider は他 Provider に依存しない。
- CLAUDE.md §6.2 の依存制約 (内側 Provider → 外側 Context) を維持。

**本計画で touched=NO の Provider (変更しない)**: ErrorBoundary / Theme / Toast / Sync / UndoRedo /
ScreenLock / CalendarTags / Template / FileExplorer / Timer / Audio / ShortcutConfig / SidebarLinks。
これらは Phase 2 までの実装を維持する。

### 旧 → 新 Provider マッピング

| 旧 Provider (Phase 2)   | 新 Provider (本計画)            | 変更内容                                            |
| ----------------------- | ------------------------------- | --------------------------------------------------- |
| (なし)                  | **ItemsMetaProvider** (新設)    | 全 role 共通のメタ操作層を新規追加                  |
| `TaskTreeProvider`      | **TasksProvider**               | items_meta + tasks_payload 経由に書き換え + 改名    |
| `ScheduleItemsProvider` | **EventsProvider**              | role=event に特化、items_meta + events_payload 経由 |
| `RoutineProvider`       | **RoutineProvider** (維持)      | items_meta + routines_payload 経由に書き換え        |
| `NoteProvider`          | **NotesProvider**               | items_meta + notes_payload 経由 + 改名              |
| `DailyProvider`         | **DailyProvider** (維持)        | items_meta + dailies_payload 経由に書き換え         |
| `WikiTagProvider`       | **WikiGraphProvider**           | items_meta 上の relation グラフに再設計 + 改名      |
| `CalendarTagsProvider`  | **CalendarTagsProvider** (維持) | touched=NO。calendars 系テーブルを維持              |

### 本計画で touched=NO のテーブル (DROP も再設計もしない)

以下は Phase 2 までの実装を維持する。DU-A の DROP 対象にも新規 13 テーブルにも含めない。

- `calendars` (Q-Calendar 確定。Schedule のフォルダフィルタマスタとして保持)
- `task_templates` (Tier 2 Templates。Template Provider が引き続き利用)
- `time_memos` (5 role に該当しない時間メモ。将来 items_meta 統合は別計画で検討)
- `note_links` (daily↔notes Connect 用の非同期テーブル。wiki_tag_connections とは別物として残す)
- `pomodoro_presets` / `timer_sessions` (Pomodoro)
- `sounds` / `playlists` (Audio)
- `sidebar_links` (SidebarLinks)
- `paper_boards` (Tier 3 凍結)
- `databases` 系 (汎用 DB。移行 SSOT 後期まで凍結)

**Q16 (2026-05-24 追記)**: `calendar_tag_definitions` / `calendar_tag_assignments` は touched=NO リストから外し、**DU-C+ sub-phase で DROP + wiki_tags へ統合**する。`calendars` テーブル本体は引き続き保持。詳細は子計画書 `2026-05-24-data-unification-c-plus-events-tags.md`。

**将来 calendars を items_meta(role=calendar) に統合したい場合は別計画 (Calendar Migration plan) で実施**する。

## DB 設計詳細

### items_meta 列定義

| 列         | 型          | 制約                                        | 説明                                                   |
| ---------- | ----------- | ------------------------------------------- | ------------------------------------------------------ |
| id         | text        | PK                                          | `<role>-<uuid>` 形式 (CLAUDE.md §4.3 / 上記 id 不変式) |
| role       | text        | NOT NULL, CHECK in 5 値                     | アイテム本質型 (task/event/routine/note/daily)         |
| title      | text        | NOT NULL                                    | 一覧表示・検索対象。空文字許容しない                   |
| user_id    | uuid        | NOT NULL, FK auth.users, default auth.uid() | RLS gate                                               |
| created_at | timestamptz | NOT NULL, default now()                     |                                                        |
| updated_at | timestamptz | NOT NULL, default now()                     | LWW の唯一の権威列                                     |
| is_deleted | boolean     | NOT NULL, default false                     | ソフトデリート (Trash UI 用)                           |
| deleted_at | timestamptz | nullable                                    | is_deleted=true 時のみ値あり                           |
| version    | bigint      | NOT NULL, default 1                         | Sync LWW 用 (Phase 2 互換)                             |

### payload テーブル列定義 (Q9 = 専用列厚く / Q15 = template_event 分解)

#### tasks_payload (role=task)

| 列             | 型         | 説明                                        |
| -------------- | ---------- | ------------------------------------------- |
| item_id        | text PK FK | items_meta.id 参照                          |
| parent_item_id | text FK    | 親 Task。階層ツリー用 (FK は items_meta.id) |
| start_at       | text       | 日付 (YYYY-MM-DD)。タスク開始日             |
| due_at         | text       | 期限日 (YYYY-MM-DD)                         |
| status         | text CHECK | `not_started` / `in_progress` / `done` 3 値 |
| sort_order     | integer    | 同階層内のソート                            |

#### events_payload (role=event)

| 列               | 型          | 説明                                                                          |
| ---------------- | ----------- | ----------------------------------------------------------------------------- |
| item_id          | text PK FK  | items_meta.id 参照                                                            |
| start_at         | text        | 開始日 (YYYY-MM-DD)。null 許容 = ToDo のみ                                    |
| start_time       | text        | 開始時刻 (HH:mm)。null 許容                                                   |
| end_time         | text        | 終了時刻 (HH:mm)。null 許容                                                   |
| done             | boolean     | 2 状態チェックボックス (default false)                                        |
| reminder_at      | timestamptz | リマインダー時刻 (null 許容)                                                  |
| memo             | text        | 簡易メモ (RichEditor 非使用、プレーンテキスト)                                |
| routine_item_id  | text FK     | Routine 由来 Event の生成元 (items_meta.id, role=routine)。手動 Event は null |
| source_date      | text        | Routine 生成時の対象日 (YYYY-MM-DD)。冪等性キーの一部。手動 Event は null     |
| is_deleted_cache | boolean     | items_meta.is_deleted の冗長コピー (partial UNIQUE 用、後述)。トリガで同期    |

**Issue 011 (Routine 重複生成) 後継の冪等性保証**: Phase 2 の `schedule_items` では partial UNIQUE
`(routine_id, date) WHERE routine_id IS NOT NULL AND is_deleted=false` で重複生成を防いでいた。
events_payload では soft-delete フラグが items_meta 側にあるため PostgreSQL の partial UNIQUE では
join できない。対策として以下のいずれかを **DU-C 子計画書で確定**する (本計画書では設計方針のみ固定):

- 案 A: `is_deleted_cache` 列を events_payload に冗長化し、items_meta.is_deleted 更新トリガで同期。
  partial UNIQUE `(routine_item_id, source_date) WHERE routine_item_id IS NOT NULL AND is_deleted_cache=false`
- 案 B: トリガベースの BEFORE INSERT で重複チェック (partial UNIQUE を使わない)

`shared/src/utils/routineScheduleSync.ts` (再利用) は schedule_items 書き込み前提のため、
**events_payload 書き込み用アダプタの新規実装が必要** (純粋ロジックは流用、出力先テーブル契約のみ差し替え)。

#### routines_payload (role=routine)

| 列                           | 型         | 説明                                          |
| ---------------------------- | ---------- | --------------------------------------------- |
| item_id                      | text PK FK | items_meta.id 参照                            |
| frequency                    | text CHECK | `daily` / `weekly` / `monthly` 等             |
| interval                     | integer    | 繰り返し間隔 (1=毎回, 2=隔日 等)              |
| weekdays_json                | text       | 曜日指定 JSON 配列 (例 `[1,3,5]`)             |
| start_at                     | text       | Routine 有効化開始日                          |
| end_at                       | text       | Routine 有効化終了日 (null=無期限)            |
| template_start_time          | text       | 生成 Event の開始時刻 (HH:mm、null 許容)      |
| template_end_time            | text       | 生成 Event の終了時刻 (HH:mm、null 許容)      |
| template_memo                | text       | 生成 Event の memo 雛形                       |
| template_reminder_offset_min | integer    | 生成 Event のリマインダー (分単位、null 許容) |

詳細仕様 (RoutineGroup 割当 / 生成タイミング / 既存 Event 上書きルール等) は **DU-C 子計画書まで遅延** (Q11)。

#### notes_payload (role=note)

| 列             | 型         | 説明                                        |
| -------------- | ---------- | ------------------------------------------- |
| item_id        | text PK FK | items_meta.id 参照                          |
| parent_item_id | text FK    | 親 Note。階層ツリー用 (FK は items_meta.id) |
| content_json   | jsonb      | TipTap のリッチコンテンツ (JSONB 例外 1)    |
| sort_order     | integer    | 同階層内のソート                            |

#### dailies_payload (role=daily)

| 列           | 型          | 説明                                     |
| ------------ | ----------- | ---------------------------------------- |
| item_id      | text PK FK  | items_meta.id 参照 (id=`daily-<uuid>`)   |
| date         | text UNIQUE | 日付 (YYYY-MM-DD)。1 日 1 row            |
| content_json | jsonb       | TipTap のリッチコンテンツ (JSONB 例外 2) |

### 専用テーブル (Q14 で items_meta から分離)

#### routine_groups

| 列         | 型            | 説明               |
| ---------- | ------------- | ------------------ |
| id         | text PK       | `rgroup-<uuid>`    |
| title      | text NOT NULL | グループ名         |
| user_id    | uuid NOT NULL | default auth.uid() |
| created_at | timestamptz   | default now()      |
| updated_at | timestamptz   | default now()      |
| is_deleted | boolean       | default false      |
| deleted_at | timestamptz   | nullable           |
| version    | bigint        | default 1          |

#### routine_group_assignments

| 列              | 型            | 説明                                                   |
| --------------- | ------------- | ------------------------------------------------------ |
| id              | text PK       | `rga-<uuid>`                                           |
| routine_item_id | text FK       | items_meta.id (role=routine) を参照                    |
| group_id        | text FK       | routine_groups.id                                      |
| user_id         | uuid NOT NULL | default auth.uid()                                     |
| updated_at      | timestamptz   | default now()                                          |
| is_deleted      | boolean       | default false (relation + soft-delete、Issue 008 同型) |
| deleted_at      | timestamptz   | nullable                                               |

UNIQUE(routine_item_id, group_id) WHERE is_deleted=false。

#### wiki_tags (タグマスタ)

| 列         | 型            | 説明                  |
| ---------- | ------------- | --------------------- |
| id         | text PK       | `tag-<uuid>`          |
| name       | text NOT NULL | タグ名                |
| color      | text          | UI 表示色 (null 許容) |
| user_id    | uuid NOT NULL | default auth.uid()    |
| created_at | timestamptz   | default now()         |
| updated_at | timestamptz   | default now()         |
| is_deleted | boolean       | default false         |
| deleted_at | timestamptz   | nullable              |
| version    | bigint        | default 1             |

UNIQUE(name, user_id) WHERE is_deleted=false。

#### wiki_tag_groups

| 列         | 型            | 説明               |
| ---------- | ------------- | ------------------ |
| id         | text PK       | `tgroup-<uuid>`    |
| name       | text NOT NULL | グループ名         |
| user_id    | uuid NOT NULL | default auth.uid() |
| created_at | timestamptz   | default now()      |
| updated_at | timestamptz   | default now()      |
| is_deleted | boolean       | default false      |
| deleted_at | timestamptz   | nullable           |
| version    | bigint        | default 1          |

#### wiki_tag_group_assignments

| 列         | 型            | 説明               |
| ---------- | ------------- | ------------------ |
| id         | text PK       | `tga-<uuid>`       |
| tag_id     | text FK       | wiki_tags.id       |
| group_id   | text FK       | wiki_tag_groups.id |
| user_id    | uuid NOT NULL | default auth.uid() |
| updated_at | timestamptz   | default now()      |
| is_deleted | boolean       | default false      |
| deleted_at | timestamptz   | nullable           |

UNIQUE(tag_id, group_id) WHERE is_deleted=false。

#### wiki_tag_assignments (items_meta ↔ wiki_tags)

| 列         | 型            | 説明                                |
| ---------- | ------------- | ----------------------------------- |
| id         | text PK       | `tag_assign-<uuid>`                 |
| item_id    | text FK       | items_meta.id (5 role すべて参照可) |
| tag_id     | text FK       | wiki_tags.id                        |
| user_id    | uuid NOT NULL | default auth.uid()                  |
| updated_at | timestamptz   | default now()                       |
| is_deleted | boolean       | default false                       |
| deleted_at | timestamptz   | nullable                            |

UNIQUE(item_id, tag_id) WHERE is_deleted=false。

#### wiki_tag_connections (items_meta ↔ items_meta)

| 列           | 型            | 説明                     |
| ------------ | ------------- | ------------------------ |
| id           | text PK       | `link-<uuid>`            |
| from_item_id | text FK       | items_meta.id (リンク元) |
| to_item_id   | text FK       | items_meta.id (リンク先) |
| user_id      | uuid NOT NULL | default auth.uid()       |
| updated_at   | timestamptz   | default now()            |
| is_deleted   | boolean       | default false            |
| deleted_at   | timestamptz   | nullable                 |

UNIQUE(from_item_id, to_item_id) WHERE is_deleted=false。CHECK (from_item_id <> to_item_id) で自己リンク防止。

### 列化判定マトリクス

| 属性カテゴリ                                                           | 配置先                             | 理由                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| 共通メタ (id/role/title/user_id/タイムスタンプ/ソフトデリート/version) | **items_meta**                     | 全 role 共通。検索・ソート・RLS で頻用                                                 |
| Task の階層・期限・3 状態                                              | **tasks_payload** 専用列           | DnD ツリー UI でクエリ頻出                                                             |
| Event の時刻・done・リマインダー                                       | **events_payload** 専用列          | カレンダー描画で範囲クエリ多発                                                         |
| Routine の繰り返し設定                                                 | **routines_payload** 専用列        | 生成器が cron-like に展開、テキスト解析最小化                                          |
| Routine の weekdays                                                    | text JSON 配列 (Phase 2 互換)      | 5 件以下の小配列、JSONB は過剰                                                         |
| Routine の template_event                                              | **専用列に分解** (Q15)             | template_start_time / template_end_time / template_memo / template_reminder_offset_min |
| Notes/Daily のリッチコンテンツ                                         | **JSONB** (`content_json`)         | TipTap の document JSON。スキーマ可変・全文検索は別軸。**JSONB は本 2 用途のみ**       |
| WikiLink (connections)                                                 | wiki_tag_connections テーブル      | many-to-many。グラフ走査クエリで FK index 必須                                         |
| WikiTag (assignment)                                                   | wiki_tag_assignments テーブル      | many-to-many。タグ検索 UI で WHERE 頻発                                                |
| WikiTag マスタ                                                         | wiki_tags 専用テーブル (Q14)       | items_meta に乗せない                                                                  |
| RoutineGroup                                                           | routine_groups 専用テーブル (Q14)  | items_meta に乗せない                                                                  |
| WikiTag のグループ                                                     | wiki_tag_groups 専用テーブル (Q14) | items_meta に乗せない                                                                  |

### parent_item_id 設計判断

- items_meta に parent_id を持たせない (Notes/Daily に意味のないカラムができるため)。
- Tasks/Notes だけ **payload テーブル側に独自の parent_item_id** を持つ。
- FK は items_meta(id) を参照、ただし同 role 内のみを参照することを SQL CHECK で強制 (DU-B 子計画書で実装パターン確定)。

**DU-B 確定 (2026-05-23 / DB-Q3)**: 同 role 制約は **composite FK パターン** で実装する (CHECK は採らない)。具体: items_meta に `(id, role)` UNIQUE 追加 + payload に `parent_item_role` を generated stored 列として固定値追加 + `(parent_item_id, parent_item_role) REFERENCES items_meta (id, role)` の composite FK + **ON DELETE NO ACTION**。DB スキーマで物理的に cross-role 親子を不可能化する。**ON DELETE 動作の確定経緯 (v3-rev2)**: SET NULL は PG 制約で不可 (SQLSTATE 42601) / CASCADE は items_meta 同士に FK 不在で子 items_meta 孤児化 / NO ACTION は子がいる親 hard-delete を PG が拒否 = アプリ層 (permanentDeleteTask) が descendants 再帰削除責務を持つ Tauri 同型に整合。詳細は DU-B 子計画書 `2026-05-23-data-unification-b-tasks.md` の DB-Q3 補足。DU-D (Notes) も同パターンを踏襲する。

### RLS 設計

#### items_meta の RLS

```sql
ALTER TABLE items_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_meta_select ON items_meta FOR SELECT USING (user_id = auth.uid());
CREATE POLICY items_meta_insert ON items_meta FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY items_meta_update ON items_meta FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY items_meta_delete ON items_meta FOR DELETE USING (user_id = auth.uid());
```

#### payload テーブルの RLS (4 policy テンプレート)

payload テーブルは Phase 2 慣行に倣い **`user_id uuid not null default auth.uid()` を冗長付与** する
(items_meta との整合を join 経由でも CHECK 経由でも保証できる二重防衛)。本計画書の payload 表には
記載を省略したが、すべての payload テーブルに同列を追加する。

```sql
-- 例: tasks_payload
ALTER TABLE tasks_payload ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_payload_select ON tasks_payload FOR SELECT USING (user_id = auth.uid());
CREATE POLICY tasks_payload_insert ON tasks_payload FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM items_meta WHERE items_meta.id = tasks_payload.item_id AND items_meta.user_id = auth.uid())
);
CREATE POLICY tasks_payload_update ON tasks_payload FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM items_meta WHERE items_meta.id = tasks_payload.item_id AND items_meta.user_id = auth.uid()));
CREATE POLICY tasks_payload_delete ON tasks_payload FOR DELETE USING (user_id = auth.uid());
```

- すべての payload テーブル (tasks/events/routines/notes/dailies) と専用テーブル (routine_groups / routine_group_assignments / wiki_tags / wiki_tag_groups / wiki_tag_group_assignments / wiki_tag_assignments / wiki_tag_connections) で同パターンの 4 policy を必須化する。
- RLS gate スクリプト (Phase 2 で導入済) を本計画で **計 13 テーブル対応** に拡張する。

## Role 仕様

| role      | 用途                   | 主な操作                                               |
| --------- | ---------------------- | ------------------------------------------------------ |
| `task`    | 階層タスク (ツリー)    | ツリー DnD / 期限設定 / 3 状態切替 / 子タスク追加      |
| `event`   | ToDo 兼予定            | 2 状態チェックボックス / リマインダー / カレンダー描画 |
| `routine` | 繰り返しテンプレート   | 周期設定 / RoutineGroup 割当 / Event 自動生成          |
| `note`    | リッチテキスト階層メモ | TipTap 編集 / 階層 DnD / WikiLink                      |
| `daily`   | 日次メモ (1 日 1 row)  | TipTap 編集 / 日付固定                                 |

**role 変更は不可** (Q10)。アイテム作成時に決定し、以降変更不能。CHECK 制約で固定。

## Tab / UI 仕様

### Schedule セクションのタブ構造 (3 タブ)

| タブ     | 内容                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| Calendar | **月ビュー + 3 日ビュー の 2 ビュー切替** (Q4 改訂)。Tasks/Events 両方を横断表示                  |
| Tasks    | role=task のツリー UI。階層 DnD + 期限 + 3 状態                                                   |
| Events   | role=event のリスト。**Routine / RoutineGroup の編集 UI も Events タブ内に内包** (Q11 で詳細遅延) |

旧 Dayflow タブは廃止。Dayflow の実装コードは破棄し、Calendar 3 日ビューは月ビューと同じスタイルで新規実装。

### Calendar 2 ビューの実装方針

- **共通レイアウト**: グリッド / イベント描画コンポーネントを 2 ビュー間で共有
- **月ビュー**: 既存 Calendar 実装を payload 経由に書き換え (UI ロジック流用)
- **3 日ビュー**: 月ビューの 1 行縦長レイアウトとして実装パターンを共通化 (新規実装)
- 子計画書 DU-E で具体的レイアウトを確定 (Q11 同様、親計画書では構造方針のみ)
- 週ビューは本計画で扱わない (Q4)。Data Unification 完了後の後続計画で復活を検討。

## MCP Server への影響

- Tasks / Notes / Schedule / Dailies / WikiTags 系の **計 16 ツールほど** が items_meta + payload を
  見るように書き換えが必要。
- **本計画期間中は MCP 書き換えを凍結対象 (Non-goal)** とする。期間中は MCP 経由の AI 操作が
  一時停止する。
- 本計画終了直後に **「MCP catch-up plan」を別計画で予定化** する (Data Unification 後続)。
- 緊急の AI 操作が必要なら、移行 SSOT の terminal-division 機能で代替する。

## Sync への影響

- **items_meta が version の唯一の所有者** になる。payload テーブルは `items_meta.updated_at` を信頼。
- versioned tables のリストは本計画完了時に `items_meta` + `routine_groups` + `wiki_tags` + `wiki_tag_groups` の 4 テーブルに集約される (Phase 2 では 5 テーブルが分散)。
- relation tables (routine_group_assignments / wiki_tag_group_assignments / wiki_tag_assignments / wiki_tag_connections) は version なし + updated_at + soft-delete-aware delta (Issue 008 同型) で扱う。
- 本計画では Sync は「壊さない」のみ守る。本格再設計は移行 SSOT の後期 Phase に委ねる。

**DU-B 確定 (2026-05-23 / DB-Q2)**: payload 単独 mutation 時の `items_meta.updated_at` bump 責務は **mapper 側で明示 invoke**（DB トリガは採らない）。`updateTask()` 等の DataService メソッド内で payload UPDATE と items_meta.updated_at=now() を直列 2 回 invoke する。LWW カーソルが見える位置にあり 5 payload で同一パターンを反復できる利点。bump 忘れは `taskMapper.test.ts` の必須ケースで防御。DU-C/D/E/F も同パターン踏襲。

## Migration 戦略 (破壊的リセット)

### 手順

1. DU-A 着手時点で `refactor/web-first-v2` ブランチの Supabase 既存テーブルのうち **本計画で再設計するもののみ** DROP する SQL を `0007_drop_legacy_item_tables.sql` として用意。
   - **DROP 対象 (DU-A)** (7 テーブル): `tasks` / `notes` / `dailies` / `schedule_items` / `routines` / `routine_groups` / `routine_group_assignments`
   - **追加 DROP 対象 (DU-C+ / Q16)**: `calendar_tag_definitions` / `calendar_tag_assignments` (DU-A 時点では残し、DU-C+ 時点で別 migration で DROP + wiki_tags へ統合)
   - **DROP しない** (Phase 2 のまま維持): `calendars` (Q-Calendar / Q16 確定。Schedule のフォルダフィルタマスタとして引き続き使用)
2. 直後に `0008_data_unification_schema.sql` で items_meta + 5 payload + 7 専用/relation の計 13 テーブルを作成。
3. RLS policy はすべて新スキーマに合わせて再定義 (4 policy × 13 テーブル = 52 policy)。calendars 系 3 テーブルの既存 RLS は維持。
4. 本計画で再設計するドメインの既存データは **作者本人のローカル環境含めすべて消滅** する。これは Q3 で合意済み。calendars 系のデータは保持される。

### データ消失の再確認

- 作者本人のローカル Supabase / リモート Supabase に蓄積された Phase 2 期間中のテストデータは DU-A apply 時点で完全消失する。
- バックアップが必要なら DU-A apply 前に **手動で SQL Editor から CSV エクスポート** すること。
- DU-A 着手前に親計画書承認 + ユーザーへの「破壊的 apply 実行可」最終承認を必須とする (二段承認)。

### DU-B 確定 (2026-05-23 / DB-Q1) — 0009 migration 追加

DU-B 着手時に `supabase/migrations/0009_tasks_payload_parent_fk.sql` (本体) + `0009_rollback.sql` (巻き戻し SQL) を同時 commit する。0009 は items_meta `(id, role)` UNIQUE + tasks_payload composite FK + 補助 index 2 本 (`items_meta_role_isdel_idx` partial / `tasks_payload_parent_idx`)。DU-A の破壊的 reset と異なり 0009 は非破壊 (DDL のみ、データ消失なし)。Atomicity 戦略は **クライアント直列 2 回 invoke + FK 順序強制**（RPC 化は採らず、createTask の try/catch + 失敗時 items_meta softDelete で孤児回避）。詳細は DU-B 子計画書 + Recovery Playbook 参照。

## Phase 分割表 (DU-A 〜 DU-F、DU-C+ 含む)

| #     | 名前                                                                                     | 入口 (前提)                                  | 出口 (検証可能な完了条件)                                                                                                                                                                                                                                                         | 規模 | 依存        |
| ----- | ---------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| DU-A  | **DB スキーマ設計 + apply**                                                              | Phase 2 マージ + 親計画書承認 + ブランチ作成 | `0007_drop` + `0008_data_unification_schema` 適用済 / 計 13 テーブル / 全 RLS gate offender 0 / advisor lint 0                                                                                                                                                                    | M    | -           |
| DU-B  | **Tasks role 移植**                                                                      | DU-A 完了                                    | TasksProvider が items_meta + tasks_payload 経由で動作 / Tasks タブで CRUD + ツリー DnD + 期限 + 3 ステータス確認 OK / vitest green                                                                                                                                               | L    | DU-A        |
| DU-C  | **Events role 移植 + Routine**                                                           | DU-B 完了 (Provider 順序確立)                | EventsProvider + RoutineProvider + RoutineGroup 動作 / Events タブで CRUD + 2 ステータス + リマインダー + Routine 生成 + RoutineGroup 操作 OK                                                                                                                                     | L    | DU-B        |
| DU-C+ | **Events 限定 WikiTag/Link + CalendarTag 吸収** (2026-05-24 起票 / **SCOPE-REDUCED**)    | DU-C 完了                                    | `calendar_tag_*` 2 テーブル DROP **済** / shared 層 (mapper / service / hook / Provider) 実装 **済** / Events UI Tag/Link は **DU-F へ後送り**（frontend↔shared 統合未完了問題）                                                                                                  | S    | DU-C        |
| DU-D  | **Notes role 移植 + Daily** (**SCOPE-REDUCED**)                                          | DU-A 完了 (Tasks/Events と並列可)            | shared 層 (mapper / service / Provider) 実装 **+** composite FK migration (`0014_notes_payload_parent_fk.sql`) 適用済 / frontend NoteProvider/DailyProvider 置き換えは **DU-F へ後送り**（frontend↔shared 統合未完了）                                                            | S    | DU-A        |
| DU-E  | **Calendar 2 ビュー再実装**                                                              | DU-B + DU-C 完了                             | Calendar タブで 月/3 日 ビュー切替 / items_meta から横断表示 / Tasks/Events 両方が表示 + 編集可                                                                                                                                                                                   | M    | DU-B, DU-C  |
| DU-F  | **frontend↔shared 統合 + WikiTag/WikiLink 全 role UI + DU-C+/D 後送り分** (**EXPANDED**) | DU-C+ + DU-D 完了                            | Tauri frontend が shared.SupabaseDataService を消費する経路（vite alias + tsconfig + dependency）/ NoteProvider/DailyProvider が shared 版 / Events Tag/Link UI / Notes/Tasks/Routine/Daily 4 role の Tag/Link UI / wiki_tag_groups UI / CalendarTag 死コード削除 / RLS gate 拡張 | XL   | DU-C+, DU-D |

**DU-F の拡大理由 (2026-05-24 / scope reduction)**: DU-C+ と DU-D 実装中に「frontend は独自 `tauriDataService` のみ参照、shared パッケージ未参照」が判明。Events UI / NoteProvider 置き換えなど **frontend が shared.SupabaseDataService を呼ぶ必要のあるタスク** はすべて DU-F に統合し、frontend↔shared 統合（Phase 2 完成相当）と同時実施する。DU-C+ で作成済の shared 層 mapper / service / hook / Provider は DU-F 着手時に活性化される。

### Phase 間順序グラフ

```
DU-A ─┬→ DU-B ─┬→ DU-E (Calendar 2 ビュー)
      ├→ DU-C ─┴→ DU-C+ ─┐
      └→ DU-D ───────────┴→ DU-F (残り 4 role UI)
```

DU-B / DU-C / DU-D は DU-A 完了後に並列可だが、N=1 + 1 role-engineer なので **順序実行を推奨**。
DU-C+ は DU-C 完了後すぐに着手。DU-D とは並列可だが順序実行を推奨。

### 各 Phase 完了時のユーザー検証

| Phase | golden path                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DU-A  | Supabase SQL Editor で `SELECT count(*) FROM items_meta` が 0 / RLS gate スクリプト 緑 / advisor lint 0                                |
| DU-B  | web/ で Tasks タブ → タスク作成 → 子タスク追加 → ステータス 3 段階切替 → 期限設定                                                      |
| DU-C  | Events タブ → イベント作成 → 2 ステータス → リマインダー → Routine 化 → RoutineGroup 作成・割当                                        |
| DU-C+ | Events タブ → Tag 付与・解除 → 別 item への Link 作成 → backlink 逆方向確認 / `calendar_tag_*` テーブル不在 / `calendars` テーブル健在 |
| DU-D  | Notes 階層 DnD / TipTap 入力 / Daily UPSERT                                                                                            |
| DU-E  | Calendar タブで月/3 日切替 + 各ビューで Tasks/Events 表示・編集                                                                        |
| DU-F  | Notes / Tasks / Routine / Daily すべてで Tag 付け → タグ検索 → backlink list 表示 / wiki_tag_groups UI 動作                            |

## Non-goals (今回やらないこと)

- 既存 SQLite/Tauri データからのマイグレーション互換 (破壊的リセットで合意済)
- Cloud Sync の完全動作 (Phase 2 申し送り S8 のまま。本計画では「壊さない」だけ守る)
- 汎用 Database 機能との統合 (移行 SSOT 後期で凍結)
- Mobile 専用 UI の Schedule 再設計 (Mobile レスポンシブは維持するが、Mobile 専用 Provider 設計は別タスク)
- MCP Server 32 ツールの完全置換 (Data Unification 後続「MCP catch-up plan」で別計画化)
- Tier 3 機能 (Paper Boards / Analytics / Google Calendar 連携 等)
- TipTap 以外のエディタ刷新
- WikiLink グラフの可視化 UI (Data Unification 後続「Graph visualization plan」で別計画化、Q12)
- role 変更 UX (作り直しで対応、Q10)
- 週ビュー (Q4 改訂で除外、Data Unification 後続で復活検討)
- role 拡張 (Q14: 5 種厳守。RoutineGroup/WikiTag は専用テーブル)

## Risks & Mitigations

| ID  | リスク                                              | レベル | 緩和策                                                                                                       |
| --- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| R1  | payload テーブル設計の正規化レベル選定ミス          | 致命   | Q9 確定 (専用列厚く)。本書「列化判定マトリクス」を DU-A 着手前に再確認                                       |
| R2  | role 変更時の payload 切替で孤児行                  | 致命   | Q10 確定 (不可)。CHECK 制約 + UI で変更ボタン非提供                                                          |
| R3  | items_meta 専用 RLS + payload RLS の不整合          | 高     | 全 payload テーブルで user_id 冗長付与 + 4 policy 必須化。RLS gate スクリプトを 13 テーブル対応に拡張        |
| R4  | Provider 順序の再設計ミス                           | 高     | 本書「Pattern A Provider 再設計案」を DU-B 着手時に再確認。CLAUDE.md §6.2 の更新は本計画完了時に 1 PR で対応 |
| R5  | MCP Server 16 ツールの影響範囲                      | 高     | 本計画期間中は MCP 凍結 (Non-goal)。後続「MCP catch-up plan」で別計画化                                      |
| R6  | Sync 設計への影響                                   | 中     | items_meta が version 所有者。payload は updated_at 連動。本格再設計は移行 SSOT 後期に委ねる                 |
| R7  | Calendar 2 ビュー再実装の UI 工数                   | 中     | 月ビューは既存実装をベースに payload 経由に書き換え。3 日ビューは月ビューの縦長縮退として共通化              |
| R8  | Tasks ツリーの parent 設計を items_meta に置く誘惑  | 中     | 本書「parent_item_id 設計判断」で payload 側に持たせる方針を固定                                             |
| R9  | 既存 docs (CLAUDE.md / requirements/) の更新コスト  | 低-中  | 本計画完了時にまとめて 1 PR。各 Phase 子計画書には「docs 更新は親完了時にまとめる」と明記                    |
| R10 | WikiLink グラフ UI が肥大化                         | 低     | Q12 確定 (backlink list のみ)。グラフ可視化は別計画                                                          |
| R11 | items_meta.id prefix からの role 逆引きコード混入   | 中     | 「id 不変式」章で明文化。コードレビュー時に prefix パースを検出するルール追加                                |
| R12 | RoutineGroup / WikiTag が items_meta に紛れ込む誘惑 | 中     | Q14 で 5 種厳守を確定。Non-goals にも明記                                                                    |
| R13 | template_event JSONB 化への揺り戻し                 | 中     | Q15 で専用列に分解確定。後で「設定追加」要望が来ても、まず専用列追加で対応                                   |

## Definition of Done (Data Unification 全体)

以下すべてを満たした時点で本計画完了とする。

- [x] items_meta + 5 payload + 7 専用/relation の計 13 テーブルが本番 Supabase に apply 済み（DU-A）
- [x] 5 role すべてが items_meta + 対応 payload 経由で動作 (CRUD / 一覧 / 検索) — **DU-F 注**: Tasks/Events/Routine は Unified 完了。Notes/Daily は **legacy shared 経路で安定動作中**、Unified write path への切替は **DU-G** に分離。読み出し方向（Tag/Link グラフ）は 4 role すべてで Unified 経由で動作
- [x] Schedule セクションのタブ構造が Calendar / Tasks / Events の 3 タブに変更済み（DU-C）
- [ ] Calendar タブで月 + 3 日の 2 ビュー切替が動作（**DU-E**）
- [x] Events タブ内で Routine / RoutineGroup の編集が可能（DU-C）
- [x] **CalendarTag (`calendar_tag_definitions` / `calendar_tag_assignments`) が DROP 済み (Q16 / DU-C+)** — DU-F Step 3-5 で UI 死コードも purge 済
- [x] **`calendars` テーブルは保持され、Schedule のフォルダフィルタ UI が引き続き動作 (Q16)**
- [x] WikiTag/WikiLink が items_meta.id を FK として 4 role すべてで利用可能 — Routine は Event の生成テンプレ UX に再定義したため Tag/Link UI は持たない（DU-F DF-Q2/Q3）。データモデル上は items_meta 経由で利用可
- [x] backlink list がアイテム詳細から表示可能（DU-F LinkPanel）
- [x] vitest 緑 (shared 170/170) / RLS gate offender 0 (wiki_tags 系 5 テーブル × 4 policy 確認済 / CalendarTag 系不在確認済) / advisor lint 新規 WARN 0 (既知 `auth_leaked_password_protection` のみ)
- [x] CLAUDE.md §4 / requirements/tier-1-core.md / db-conventions.md / coding-principles.md の更新済み（CLAUDE.md §4.3 一行追記は DU-F Step 13）
- [x] 移行 SSOT に「Phase 2 と Phase 3 の間に Data Unification を実施した」旨を追記済み（DU-F Step 13）
- [x] S5 WikiTags 旧計画の design knowledge 取り込み完了 (本計画に反映済)

**残作業**: DU-E (Calendar 2 ビュー) と DU-G (Notes/Daily Unified 完全切替) を別計画書として `plans/` に置く。Data Unification の「ユーザーから見える完了」（5-role tag/link graph 稼働 + CalendarTag 概念消滅 + wiki_tag_groups CRUD）は本 DoD 時点で達成。

## ロールバック方針

- **DU-A apply 後**: ローカル/リモート Supabase のテーブルが新スキーマに置き換わっているため、ブランチ
  `data-unification/items-meta-redesign` を捨てて `refactor/web-first-v2` に戻すだけでは DB は元に戻らない。
  - 戻す手段: DU-A の `0007_drop_legacy_item_tables.sql` で DROP した 7 テーブル分のみ、Phase 2 のスキーマ
    (S0-S4 までの migrations) を `supabase/migrations/` から再適用する (calendars 系は DROP していないので再適用不要)。**ただし既存データは復元不能**。
  - 実質的に「Data Unification はやらなかったことにする」だけが選択肢。データ復元は CSV エクスポート前提。
- **DU-B / DU-C / DU-D / DU-E / DU-F 失敗時**: その Phase のコミットを revert し、子計画書の状態に戻す。
  DB スキーマ (DU-A 由来) は維持。
- **ロールバック判断のタイミング**: 各 Phase の出口検証で golden path が通らない場合、その時点で
  ユーザーに報告し、続行 / 巻き戻しを決定する。

## マイルストーン (累計見込み + バッファ ±50%)

S4 Schedule 移植 (Phase 2 の 1 ドメイン) の実工数 ≒ 7 commit + 各 role-qa を経た実績を参照。
N=1 想定、1 日あたり 4〜6 時間作業を仮定。**実工数は子計画書執筆時に再見積もり**。

| マイルストーン                                 | 想定工数  | バッファ込み (±50%) |
| ---------------------------------------------- | --------- | ------------------- |
| 親計画書承認 + Phase 2 マージ + 新ブランチ作成 | 0.5 日    | 0.3〜0.8 日         |
| DU-A 完了 (DB スキーマ apply)                  | +1.5 日   | +0.8〜2.3 日        |
| DU-B 完了 (Tasks 動作)                         | +3 日     | +1.5〜4.5 日        |
| DU-C 完了 (Events + Routine 動作)              | +4 日     | +2〜6 日            |
| DU-D 完了 (Notes + Daily 動作)                 | +3 日     | +1.5〜4.5 日        |
| DU-E 完了 (Calendar 2 ビュー)                  | +2.5 日   | +1.3〜3.8 日        |
| DU-F 完了 (WikiTag/WikiLink)                   | +3 日     | +1.5〜4.5 日        |
| docs 更新 + MCP catch-up 計画作成              | +1.5 日   | +0.8〜2.3 日        |
| **総計**                                       | **19 日** | **10〜29 日**       |

## 計画書間連携

- **本計画書は親 SSOT**。Data Unification 全体の不変前提を保持。
- **子計画書 (DU-A〜DU-F)**: Phase 進行時に都度 `code-plan-editor` で作成。命名規則:
  `.claude/docs/vision/plans/2026-05-XX-data-unification-<sub-id>-<slug>.md`
  例: `2026-05-22-data-unification-a-db-schema.md`
- 子計画書には親計画書の **どの章を継承するか** を冒頭で明示する。
- 子計画書完了で `.claude/archive/` 移動 (`task-tracker` 経由)。親計画書は Data Unification 完了まで `plans/` に残す。

## Related plans / Supersedes

| 計画書                                           | 状態                    | 処遇                                                     |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------- |
| `2026-05-20-s5-wikitags-migration.md`            | 削除済 (commit 8ceae24) | 設計領域は本計画が継承。outbox にハンドオフ済            |
| `2026-05-17-s4-schedule-migration.md`            | COMPLETE                | そのまま archive 候補 (Phase 2 完了で task-tracker 経由) |
| `2026-05-17-notes-web-parity.md` (S3)            | COMPLETE                | そのまま archive 候補                                    |
| `2026-05-16-phase2-core-migration.md`            | 部分 COMPLETE           | Phase 2 完全クローズ時に archive                         |
| `.claude/2026-05-04-cross-platform-migration.md` | ACTIVE (移行 SSOT)      | 本計画完了時に Data Unification レーンの実施記録を追記   |

## 親計画書承認後の最初のアクション

担当: メインチャット (chat-web-migration) が逐次実行。

1. [メイン] `git-orchestrator` 経由で phase-2/schedule-migration の untracked な本計画書 v3 (`2026-05-21-data-unification-items-meta.md`) を commit (S5 ファイルは commit 8ceae24 で削除済 = commit 対象として存在しない)
2. [メイン] phase-2/schedule-migration を `refactor/web-first-v2` に FF マージ
3. [メイン] `data-unification/items-meta-redesign` ブランチを `refactor/web-first-v2` から作成
4. [メイン] `task-tracker` で MEMORY.md を更新 (Phase 2 完了マーク + Data Unification 進行中エントリ確定)
5. [メイン] MEMORY.md / outbox / `.claude/comm/` 配下の旧名「Phase 3 items_meta」を「Data Unification」に統一 (引用元の表現整合)
6. [メイン + ユーザー] **DU-A 着手の最終承認** (= Supabase 破壊的 apply の最終承認)
7. [メイン] DU-A 子計画書を `code-plan-editor` で作成

## Verification (親計画書自体の検証)

- [ ] Status / Created / Branch / Supersedes / Related が冒頭に揃っている
- [ ] Q1〜Q15 のユーザー確定事項が明示されている
- [ ] DB 設計が列レベルまで具体化されている
- [ ] Phase 分割が 6 子 Phase (DU-A〜DU-F) に整理され、入口/出口/規模/依存が表形式で揃っている
- [ ] Risk が R1〜R13 で網羅されている0009_tasks_payload_parent_fk.sql
- [ ] Non-goals が明示されている
- [ ] DoD が観測可能なチェック項目で揃っている
- [ ] ロールバック方針が DB apply 後の現実に即している
- [ ] Phase 命名衝突が解消されている (Data Unification + DU-A〜DU-F)
- [ ] role-qa による独立監査 (v2 で再実施)
- [ ] ユーザー承認
