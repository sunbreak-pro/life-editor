---
Status: SCOPE-REDUCED — v2（2026-05-24）。DU-C+ と同じ frontend↔shared 統合未完了問題で、frontend Provider 置き換え (Step 3-4) と UI 動作確認 (Step 4) は DU-F へ後送り。本 sub-phase は shared 層 mapper + service + Provider + composite FK migration のみで完了。
Created: 2026-05-24
Branch: data-unification/items-meta-redesign
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3, DU-D 行 + DoD）
Previous: .claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md（DU-C+ 完了想定）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」（notes_payload / dailies_payload の列定義 + parent_item_id 設計判断）「Pattern A Provider 再設計案」「Sync への影響」「DU-B 確定 (2026-05-23 / DB-Q3)」（composite FK パターン）
---

# Plan: DU-D — Notes role + Daily 移植

## DU-D scope reduction (2026-05-24)

DU-C+ と同じく frontend↔shared 統合 (Phase 2 完成) 未達のため、Tauri frontend の NoteProvider / DailyProvider 置き換えは DU-F に統合。本 sub-phase は以下のみで完了とする:

- ✅ 対象: shared mapper (notes / dailies) + SupabaseDataService の Notes/Daily Unified メソッド追加 + Pattern A Provider + composite FK migration (`0014_notes_payload_parent_fk.sql`)
- ⏭ 後送り: frontend NoteContext / DailyContext を shared 版へ置き換え (Step 3) / UI 動作確認 (Step 4) → DU-F の frontend↔shared 統合と同時実施
- 🛑 人手ゲート: `supabase db push` (0014 適用) のみ残る (Step 5)

完了判断: `cd frontend && npm run build` exit 0 (frontend は touched=NO) / `pnpm -F shared test` 緑 / `0014_notes_payload_parent_fk.sql` 適用済 / composite FK + parent_item_role generated 列が Supabase に存在。

## このフェーズの当初ゴール（参照のみ — scope reduction 後は無効）

親計画書 DU-D 行を実装する。Tauri SQLite 時代の `notes` / `dailies` テーブルを完全置換し、`items_meta` + `notes_payload` / `dailies_payload` 経由で 5 role 統一アーキテクチャの 4 番目と 5 番目を稼働させる。

- notes_payload composite FK (`parent_item_id`, `parent_item_role='note'`) → `items_meta(id, role)` で cross-role parent を DB レベルで物理的に不可能化（DU-B 同型パターン）
- shared 層に Notes / Daily の mapper + service + hook + Provider を新規実装（Pattern A 3 ファイル構造）
- frontend 既存 NotesProvider / DailyProvider を **完全置換**（Phase 2 までの実装は捨てる、Q6 既存コード方針）
- Notes 階層 DnD / TipTap 編集 / Daily UPSERT が web 上で動作
- vitest 緑 / `cd frontend && npm run build` exit 0 / RLS gate offender 0 / advisor lint 0

完了後の DU-F は「Notes / Tasks / Routine / Daily 4 role の UI で Tag + Link 操作可能化」のみが残る。

## ユーザー確定事項（2026-05-24 / DU-D 起票時）

| #     | 項目                                  | 確定                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DD-Q1 | Notes 既存データ                      | **破壊的リセット**（親 Q3 と整合）。DU-A apply 時点で旧 `notes` テーブルは DROP 済 = 既に消えている                                                                                                                                                                     |
| DD-Q2 | Daily 既存データ                      | **破壊的リセット**（親 Q3 と整合）。DU-A apply 時点で旧 `dailies` テーブルは DROP 済                                                                                                                                                                                    |
| DD-Q3 | composite FK パターン                 | **DU-B 同型を踏襲**（親計画書 DB-Q3 確定）。notes_payload に `parent_item_role text generated always as ('note') stored` 列を追加 + composite FK + ON DELETE NO ACTION + parent_item_id 側 owner EXISTS 二重防衛 + initplan キャッシュ化 (`(select auth.uid())` ラップ) |
| DD-Q4 | UI 配置                               | **既存 Notes / Daily UI のレイアウトを維持**（NoteProvider / DailyProvider の差し替えのみ。component の見た目は触らない）。UI 改修要望が出た場合は別計画                                                                                                                |
| DD-Q5 | TipTap content_json                   | **そのまま JSONB で保存**（親 Q9 = JSONB は Notes/Daily content のみの例外）。schema migration は不要                                                                                                                                                                   |
| DD-Q6 | dailies_payload の UNIQUE             | **`UNIQUE(date)` のみ**（0008 既定）。N=1 / multi-tenancy non-goal なので user_id 込みの UNIQUE は不要                                                                                                                                                                  |
| DD-Q7 | DU-C+ との並列実行                    | **順序実行**（DU-C+ 完了後に DU-D 着手）。理由: chat-main 単独レーン + 同一ブランチ + 同一 App.tsx を触るため                                                                                                                                                           |
| DD-Q8 | password_hash / is_edit_locked の扱い | **そのまま port**（0008 で列定義済）。Notes / Daily の lock 機能は Phase 2 までの実装を維持                                                                                                                                                                             |
| DD-Q9 | note_type 判別子                      | **`folder` / `note` 2 値**（0008 で CHECK 制約済）。NoteNode の folder-tree UX を schema レベルでも区別                                                                                                                                                                 |

---

## Context

- **動機**: 親計画書 DU-D 行（Notes role 移植 + Daily）を実装し、5 role 統一アーキテクチャを完成へ近づける。DU-F は Tag/Link UI の残作業のみとなる
- **制約**:
  - 親計画書のユーザー確定事項 Q1〜Q16 を変更しない
  - DU-A / DU-B / DU-C / DU-C+ は完了済。本計画書は items*meta + tasks_payload + events_payload + wiki_tags 群 + (DU-C+ 完了時点で) calendar_tag*\* DROP 済 を前提とする
  - Notes / Daily の既存 UX を維持（UI レイアウト改修は別計画）
  - 既存 Notes / Daily データは消失する（DU-A の破壊的リセットで既に消えている）
- **Non-goals**:
  - Notes / Daily UI レイアウトの刷新（DD-Q4）
  - Notes / Daily の Tag / Link UI（DU-F で実施）
  - TipTap の拡張 / 置換（親 Non-goals「TipTap 以外のエディタ刷新」と整合）
  - MCP Server の Notes / Dailies ツール書き換え（親計画書通り「MCP catch-up plan」へ）
  - note_links / note_connections の復活（DU-A 時点で DROP 済、Connect は wiki_tag_connections で代替）
  - Notes の password lock UX 変更（DD-Q8: そのまま port のみ）

---

## Scope (Touchable Paths)

```
supabase/migrations/0014_notes_payload_parent_fk.sql       # 新規 (DU-B の 0009 と同型)
supabase/migrations/0014_rollback.sql                      # 新規 (巻き戻し SQL)

shared/src/types/note.ts                                   # 新規 (NoteNode 型 / NoteRow 型)
shared/src/types/daily.ts                                  # 新規 (DailyNode 型 / DailyRow 型)
shared/src/services/notesMapper.ts                         # 新規 (items_meta + notes_payload row ↔ NoteNode)
shared/src/services/dailiesMapper.ts                       # 新規 (items_meta + dailies_payload row ↔ DailyNode)
shared/src/services/SupabaseDataService.ts                 # Notes / Daily メソッド追加 (CRUD + UPSERT + 階層フェッチ)
shared/src/hooks/useNotesAPI.ts                            # 新規
shared/src/hooks/useDailiesAPI.ts                          # 新規
shared/src/context/NotesContext.tsx                        # 新規 (Pattern A)
shared/src/context/NotesContextValue.ts                    # 新規
shared/src/context/DailyContext.tsx                        # 新規 (Pattern A)
shared/src/context/DailyContextValue.ts                    # 新規
shared/src/index.ts                                        # Notes / Daily export 追加
shared/src/types/sync.ts                                   # notes / dailies refs を items_meta + payload に更新
shared/tests/notesMapper.test.ts                           # 新規
shared/tests/dailiesMapper.test.ts                         # 新規

frontend/src/context/NoteContext.tsx                       # 旧実装を削除 → shared 版に置き換え
frontend/src/context/NoteContextValue.ts                   # 削除
frontend/src/hooks/useNoteContext.ts                       # 削除（shared 版を再 export）
frontend/src/context/DailyContext.tsx                      # 旧実装を削除 → shared 版に置き換え
frontend/src/context/DailyContextValue.ts                  # 削除
frontend/src/hooks/useDailyContext.ts                      # 削除（shared 版を再 export）
frontend/src/context/index.ts                              # Provider export 更新
frontend/src/App.tsx                                       # Provider 順序更新 (新 NotesProvider / DailyProvider)
frontend/src/components/Notes/**                           # 内部の DataService 呼び出しを新 Provider hook 経由に置換
frontend/src/components/Daily/**                           # 同
frontend/src/components/**                                 # Notes / Daily を読む箇所の import パス更新

.claude/docs/vision/plans/2026-05-24-data-unification-d-notes-daily.md  # 本計画書
```

スコープ外（=触らない）:

- TipTap editor 本体 (`@tiptap/*` ラッパー / extensions)
- `note_links` テーブル系（DU-A で DROP 済）
- `wiki_tag_*` 系（DU-C+ で実装済、DU-D は使う側になるが UI 接続は DU-F）
- CalendarView の folder filter（calendars テーブル経由、touched=NO）
- MCP Server の Notes / Dailies ツール（凍結）

スコープ外の変更が必要になった場合は、本計画書を更新してから手を付ける（更新せず広げない）。

---

## 採用アーキテクチャ

### DB スキーマ差分（DU-A 以降の追加）

#### 既存（DU-A で作成済、変更不要）

```sql
-- notes_payload: item_id PK / parent_item_id (単独 FK) / note_type / content_json
--   / sort_order / is_pinned / is_edit_locked / color / icon / password_hash / has_password (generated)
-- dailies_payload: item_id PK / date UNIQUE / content_json / is_pinned
--   / is_edit_locked / password_hash / has_password (generated)
```

両テーブルとも 4 policy RLS + EXISTS 二重防衛 + indexes は 0008 で設定済。

#### DU-D で追加（`0014_notes_payload_parent_fk.sql`）

DU-B の 0009 と同型パターン:

1. notes_payload の単独 FK `notes_payload_parent_item_id_fkey` を DROP
2. `parent_item_role text generated always as ('note') stored` 列を追加
3. Composite FK `(parent_item_id, parent_item_role) -> items_meta(id, role) ON DELETE NO ACTION` を追加
4. 補助 index: `idx_notes_payload_parent_role` 複合 / 既存単独 index `idx_notes_payload_parent` は DROP（複合 index の prefix で代替可、書込みコスト二重化回避）
5. `notes_payload_insert_own` / `_update_own` policy を拡張: parent_item_id 側 owner EXISTS 二重防衛 + `(select auth.uid())` initplan キャッシュ化

`items_meta(id, role)` UNIQUE 制約は DU-B の 0009 で既に追加済（再追加不要）。

#### DU-D で `dailies_payload` には composite FK 不要

dailies に parent / 階層概念がない（1 日 1 row + date UNIQUE）。`dailies_payload` は 0008 のままで稼働可能。

### Pattern A Provider 再設計

```
ItemsMetaProvider                           ← DU-B で導入想定（実装は順次）
  ├── TasksProvider                         ← DU-B 完了
  ├── EventsProvider                        ← DU-C 完了
  ├── RoutineProvider                       ← DU-C 完了
  ├── NotesProvider (新 = shared 版)        ← 本計画書で新設
  ├── DailyProvider (新 = shared 版)        ← 本計画書で新設
  └── WikiTagsProvider                      ← DU-C+ 完了
```

shared 層に Provider を置き、frontend からは shared 版を import + Provider として配置する（NotesProvider / DailyProvider は frontend 独自実装を廃止）。

### Shared 層の構造

```
shared/src/context/NotesContext.tsx
  ↓ uses
shared/src/hooks/useNotesAPI.ts
  ↓ uses
shared/src/services/SupabaseDataService.ts (Notes メソッド群)
  ↓ uses
shared/src/services/notesMapper.ts             (items_meta + notes_payload row ↔ NoteNode)
shared/src/types/note.ts                       (NoteNode interface + NoteRow type)
```

Daily も同型。

mapper 規約（DU-B の `taskMapper.ts` を踏襲）:

- pure function（IO なし）
- wire-faithful（DB 列 ↔ TS 型を 1:1 マッピング、defaulting は最小）
- updated_at bump は呼び出し側（SupabaseDataService）で明示 invoke（親計画書 DU-B 確定 DB-Q2）

### 既存 frontend Provider との切替戦略

1. 新 shared NotesProvider / DailyProvider を実装
2. App.tsx で旧 NoteProvider / DailyProvider import を新 shared 版に置換
3. 既存 frontend NoteContext / DailyContext のファイルを削除
4. Notes / Daily を読む component の import パスを `frontend/src/context/...` から `shared/...` に更新（または frontend 側に re-export レイヤーを残す）
5. `cd frontend && npm run build` で型エラー 0 を確認

re-export レイヤー方針: DU-B の Tasks では shared 版を frontend 側で薄くラップして既存 import パスを維持する戦略を採った。本計画書も同パターンを踏襲する（既存 component の import 一括書き換えを避けて scope creep を防ぐ）。

---

## Steps

| #   | Step                                                                          | Gate              | Acceptance                                                                                                                            |
| --- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DB migration `0014_notes_payload_parent_fk.sql` + `0014_rollback.sql` 作成    | 🤖 自律           | `supabase/migrations/` に 2 ファイル追加（本体 + 巻き戻し）                                                                           |
| 2   | `supabase db push` 実行                                                       | 🛑 人手           | ユーザーが手で push / composite FK 存在 + parent_item_role generated 列存在 / advisor lint 0                                          |
| 3   | shared types + notesMapper + dailiesMapper + 単体テスト                       | 🤖 自律           | `pnpm -F shared test` 緑 / `npm run build` exit 0                                                                                     |
| 4   | shared SupabaseDataService に Notes / Daily メソッド追加                      | 🤖 自律           | listNotes / getNote / createNote / updateNote / deleteNote / moveNote / getDaily / upsertDaily などが items_meta + payload 経由で動作 |
| 5   | shared useNotesAPI + useDailiesAPI + Provider 実装                            | 🤖 自律           | shared Provider 単体テスト緑（mock SupabaseDataService）                                                                              |
| 6   | frontend NoteProvider / DailyProvider を shared 版に置き換え + 旧ファイル削除 | 🤖 自律           | `cd frontend && npm run build` exit 0 / 旧 NoteContextValue / DailyContextValue が grep でヒット 0                                    |
| 7   | App.tsx Provider 順序更新 + 既存 vitest 修正                                  | 🤖 自律           | `cd frontend && npm run build` exit 0 / `cd frontend && npx vitest run` 全 pass                                                       |
| 8   | Notes UI golden path 動作確認 (Notes 階層 DnD / TipTap 入力)                  | 🤖 自律 + 👀 目視 | Notes 1 件作成 → 階層 DnD → TipTap 編集 → 保存 → リロード後復元                                                                       |
| 9   | Daily UI golden path 動作確認 (Daily UPSERT)                                  | 🤖 自律 + 👀 目視 | Daily 開く → TipTap 入力 → 保存 → 別日に切替 → 戻ると保存内容復元                                                                     |
| 10  | RLS gate スクリプト確認 (notes_payload composite FK 追加後)                   | 🤖 自律           | RLS gate offender 0                                                                                                                   |
| 11  | session-verifier → commit → role-qa (別コンテキスト)                          | 🛑 人手           | role-qa 監査 OK                                                                                                                       |
| 12  | DU-C+ と統合 PR or 個別 PR で merge                                           | 🛑 人手           | PR レビュー & merge ボタン                                                                                                            |

### Gate 凡例

- **🤖 自律** — Claude が完結。後追い検証（type check / test）で品質担保
- **👀 目視** — UI / 体感 / レイアウトでユーザー目視必須
- **🛑 人手** — DDL push / PR merge 等のユーザー操作必須

---

## Acceptance Criteria（機械検証可能）

- [ ] `cd frontend && npm run build` exit 0（型エラー 0）
- [ ] `pnpm -F shared test` 全 pass
- [ ] `cd frontend && npx vitest run` 全 pass
- [ ] Supabase の `notes_payload` に `parent_item_role` 列存在（generated stored, 常に 'note'）
- [ ] Supabase の `notes_payload_parent_fk` constraint 存在（composite FK）
- [ ] Supabase の旧 `notes_payload_parent_item_id_fkey` constraint 不在（単独 FK は drop 済）
- [ ] RLS gate スクリプトで offender 0
- [ ] Supabase advisor lint 0
- [ ] `git grep -E "(frontend/src/context/NoteContextValue|frontend/src/context/DailyContextValue)"` でヒット 0（旧 Provider 削除済）
- [ ] Notes 階層 DnD / TipTap 編集 / Daily UPSERT が画面上で動作（👀 目視）

---

## DB Migration Notes

DDL 含むため必須記入。**ローカルファイル先行ルール厳守**:

1. Claude が `supabase/migrations/0014_notes_payload_parent_fk.sql` を作成 + SQL 記入（DU-B の 0009 と同型）
2. Claude が `supabase/migrations/0014_rollback.sql` を作成（巻き戻し SQL: composite FK drop → 単独 FK 復元 → generated 列 drop → policy 復元）
3. **ユーザーが** `supabase db push` を実行（`apply_migration` MCP 単独使用禁止）
4. 適用後、Claude が以下を `execute_sql` で確認しレポート:
   - `notes_payload_parent_fk` constraint 存在 + `notes_payload_parent_item_id_fkey` 不在
   - `parent_item_role` generated 列存在 + 常に 'note'
   - cross-role parent INSERT が FK violation で拒否される（DU-B の VERIFICATION D/E 同型）

### Atomicity

本 migration は DDL のみ・データ消失なし（DU-A の破壊 reset と異なる）。BEGIN/COMMIT で囲み、apply 失敗時は自動 ROLLBACK。

### ロールバック

- 失敗時は `0014_rollback.sql` を SQL Editor で実行
- DU-B の 0009_rollback.sql と同型パターン

---

## Risks & Mitigations

| ID  | リスク                                                                            | レベル | 緩和策                                                                                                                                     |
| --- | --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | composite FK 追加時に既存 notes_payload 行で violation                            | 致命   | DU-A で notes テーブルが破壊 reset 済 = 行数 0 のはず。push 前に `select count(*) from notes_payload` で 0 確認                            |
| R2  | parent_item_role generated 列 + ON DELETE NO ACTION で子がいる親 hard-delete 不能 | 中     | DU-B 同型でアプリ層（SupabaseNotesService.permanentDeleteNote）が descendants 再帰削除責務を持つ。蓄積されたデータがなければ問題顕在化せず |
| R3  | TipTap content_json の schema 変更（拡張）                                        | 中     | content_json は jsonb なので schema lock なし。TipTap version 差異は frontend 側の compat layer で吸収                                     |
| R4  | NoteProvider 切替で既存 component の import が壊れる                              | 高     | DU-D-6 で frontend 側 re-export レイヤーを残す（既存 import パスを維持）。`npm run build` で型エラー 0 を確認                              |
| R5  | shared/src/index.ts の export 変更で他 frontend 部品の import が壊れる            | 中     | DU-D-6 直後に `cd frontend && npm run build` を実行して即検出                                                                              |
| R6  | DailyContext の day-key 管理ロジックが新 shared 版で抜ける                        | 中     | shared 版で `getDailyByDate(date)` + `upsertDailyByDate(date, content)` を提供。frontend 側の day-key state は維持                         |
| R7  | password lock 機能（is_edit_locked / password_hash）が新 shared 版で抜ける        | 中     | DD-Q8: そのまま port 方針。shared mapper で全列を扱い、frontend Note/Daily lock UI は API レイヤー以外触らない                             |
| R8  | RLS policy の `(select auth.uid())` ラップ漏れで initplan キャッシュ効かない      | 低     | DU-B の 0009 パターンを 1:1 コピー。検出は Supabase advisor `auth_rls_initplan` WARN                                                       |
| R9  | DU-C+ と App.tsx Provider 順序衝突                                                | 中     | DD-Q7 順序実行で回避。DU-C+ の Provider 配置確定後に DU-D 着手                                                                             |
| R10 | Notes 階層 DnD の moveNode 関数が新 shared 版で挙動変化                           | 高     | DU-B の moveNode / moveNodeInto 同型実装。shared mapper test で fixture を作って同型挙動を確認                                             |
| R11 | wiki_tag_assignments / wiki_tag_connections が Notes の削除に追随しない           | 低     | 0008 で `ON DELETE CASCADE` 既定。物理削除時のみ発火（soft-delete 時は items*meta.is_deleted=true、wiki_tag*\* は SELECT 時にフィルタ）    |

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` で類似事例を確認
- 新規 known issue 候補:
  - 「shared Provider を frontend から薄ラップ re-export する切替パターン」（DU-B で実績、DU-D で再演）
  - 「DU-B 同型 composite FK + EXISTS 二重防衛の Notes 適用」

---

## References

- vision: `.claude/docs/vision/db-conventions.md`（payload mapper 規約 / RLS パターン / composite FK パターン）/ `.claude/docs/vision/coding-principles.md`（Pattern A / Provider 順序）
- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（DU-D 行 + Q14 + DB-Q3）
- 前フェーズ: `.claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md`（DU-C+ 完了想定）
- DU-B 実績: `.claude/archive/2026-05-23-data-unification-b-tasks.md`（composite FK + re-export レイヤー実装パターン）
- related skills: `db-migration`（migration 追加手順）/ `add-component`（Provider 追加パターン）/ `life-editor-migration-validator`（3 系統整合監査）/ `life-editor-sync-auditor`（sync 区分判定）

---

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- (未着手)
