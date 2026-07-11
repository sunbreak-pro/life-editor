---
Status: IN PROGRESS # 方向 = 2026-07-11 ユーザー確定。Step 2 詳細設計 = 2026-07-11 追記（実測込み）
Created: 2026-07-11
Branch: claude/materials-refine # 共有コア（types / Kanban / Notes・Daily UI / 変換 migration）= materials-refine が単一書込者。各セクション adoption は各レーン
Owner-chat: materials-refine
Issue: https://github.com/sunbreak-pro/life-editor/issues/225 (type:task + shared-fix)
Parent: (なし — 兄弟計画: 2026-07-11-layout-standard-v2.md)
---

# Plan: life-tags 統一 — folder 概念の廃止と WikiTag 基盤への一本化

> **本計画が要件 6（2026-07-11 ユーザー提示）の方向の正本**。詳細設計（UI モック・移行規則・対象コード実測）は Step 2 で本計画に追記する。

---

## Context

- **動機**: Tasks / Notes / Daily は現在「フォルダ・タグ・ステータス」の 3 系統で整理されており、画面ごとに使える手段が違う。全セクション共通の一つの整理概念 **life-tags** に統一し、フォルダのような整理・まとめは「タグ + フィルタリング」で実現する。階層は作らず**一階層 + フィルタで自由度を高める**方針に切り替える（多階層フォルダはシンプルさと操作性を損なうため廃止）
- **2026-07-11 ユーザー決定（AskUserQuestion で確定）**:
  1. **実体 = 既存 WikiTag 基盤を拡張して一本化**（`wiki_tags` / assignments / groups / connections・`items_meta` 全 role 対応）。新規タグシステムは作らない — 2 系統併存の二重管理を避ける
  2. **folder は「folder ノードだけ」廃止**。タスク同士の親子（サブタスク）は存続する
  3. **status（未着手 / 進行中 / 完了）は独立軸のまま残す**。整理 = タグ、進捗 = ステータスの役割分担。カンバンの status ビュー・完了処理は不変
  4. **着手は layout standard v2 の後**（計画は先行作成・実装は v2 共通部品 merge 後）
- **制約**: コスト $0 / DataService 境界（§3.1）/ 2 行分割 sync モデル・wiki 系テーブル規約 = `docs/vision/db-conventions.md` / DDL はローカルファイル先行 → ユーザー `supabase db push`
- **Non-goals**: status のタグ統合（運用が定着してから再検討）/ タグの階層化（一階層原則）/ 汎用 Database（凍結中）への適用 / Routine 専用タグ UI（CLAUDE.md §4 — Routine には持たせない）

---

## 設計方針（方向の正本 — 詳細は Step 2 で追記）

### 名称と実体

- UI 表示名 = **"Life Tags"**（仮 — i18n catalog 追加時に en/ja を確定）
- **DB テーブルは改名しない**（`wiki_tags` のまま — migration / sync リスク回避）。型・Provider 名（WikiTag → LifeTag 等）の段階的リネームは実装判断（やるなら改名 sweep = `rules/docs-consistency.md` §2 必須）

### folder → life-tag の移行

- 対象 = Tasks / Notes の `type:"folder"` ノード（folder はデータモデル上、独立テーブルではなくノード種別）
- 各 folder を**同名の life-tag に変換**し、直下のアイテムへ assignment を付与。folder の色は tag の色へ継承
- 多階層 folder の平坦化規則 = **直近 folder 名のみ付与で確定**（2026-07-11 実測 — アクティブ folder は全てルート直下で入れ子なし。§Step 2 詳細設計 B）
- folder ノード自体は変換後**ソフトデリート**（復元可能性を残す。hard delete しない）

### UI 波及

- **Kanban**: folder ビュー廃止 → **tag ビューが後継**（view 切替 enum から folder を除去・永続化済み view 設定の migration を忘れない）。status ビューは存続
- **Notes / Daily**: フォルダツリー → タグフィルタ + タググルーピング（タグをフォルダのように見せる UI/UX — 一覧のグループ見出し・サイドリスト等。詳細設計で確定）
- **全セクション共通のタグフィルタ UI**: 配置（ヘッダー or rightSidebar パネル）は**未定** — layout standard v2 の標準ヘッダー/パネル構造が確定してから決める

### データ移行

- 移行 migration + 変換スクリプト（folder rows → `wiki_tags` + assignments）。**実行 = 🛑 ユーザー**（実データの引っ越し）
- 実行前バックアップと検証クエリ（folder 数 = 変換された tag 数、直下アイテム数 = assignment 数）を移行スクリプトとセットで用意

---

## Step 2 詳細設計（2026-07-11 追記 — 実データ実測込み）

### A. folder 実データの実測（Supabase 本番）

計測方法 = Supabase Management API 経由の read-only SELECT（supabase MCP 未接続のため同一エンドポイントを直接使用。書込みなし）。
**⚠️ MCP life-editor サーバーは旧 SQLite（`.mcp.json` の `DB_PATH` = `~/Library/Application Support/life-editor/life-editor.db`）を読んでおり本番と別データ**（folder 1 件 / tags 3 件と、本番の task folder 9 行 = active 3 + deleted 6 / tags 4 件が不一致）。実測は Supabase 側を正とした。

| 対象                               | active   | deleted | 備考                                                                                                 |
| ---------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------- |
| tasks_payload `task_type='folder'` | **3**    | 6       | active = `testfolder`(#6b7280) / `folder２` / `TestTasks` — **全てルート直下・入れ子なし**           |
| 〃 deleted 6 件の内訳              | —        | 6       | 全て `folder_type='complete'`・title "Complete"・testfolder 配下（深さ 2）                           |
| tasks_payload `task_type='task'`   | 4        | 1       | folder 直下の active task は **`test2`（testfolder 配下）の 1 件のみ**。他はルート直下               |
| notes_payload `note_type='folder'` | **2**    | 0       | `New folder` / `f` — 全てルート直下。**直下ノート 0 件**（active note 5 件は全て parent null）       |
| calendars                          | **0 行** | —       | Schedule の folder 依存（`calendars.folder_id`）は**コード上のみ・実データなし**                     |
| wiki_tags                          | 4        | 0       | `Hello` / `newTag` / `newTagsAll`（本人）+ `verify-tag`（検証用アカウント）。**folder 名との衝突 0** |
| user_id                            | 2 名義   | —       | 本人（39 items）+ playwright 使い捨て（4 items）→ **変換 SQL は user_id 決め打ち禁止・set-based**    |

DB 制約の実測: `uq_wiki_tags_name` = `UNIQUE (name, user_id) WHERE is_deleted = false`（partial）/ `calendars_folder_id_fkey` = `REFERENCES items_meta(id) ON DELETE CASCADE`（**ソフトデリートでは発火しない** → folder ソフトデリート保持なら calendars は参照整合を保つ）。

### B. 平坦化・変換規則（確定）

1. **変換対象** = `is_deleted = false` かつ `folder_type IS DISTINCT FROM 'complete'` の folder ノード（tasks_payload / notes_payload 両方）。`'complete'` folder はシステム生成の完了バケツで status 軸が後継のため変換しない（実データでは全件 deleted 済）
2. **タグ化**: folder → 同 user の同名 active tag が既存なら**再利用**、なければ `wiki_tags` へ新規 INSERT（`ON CONFLICT` は partial unique に合わせる — Issue 011 契約と同型）。folder の `color` は新規タグへ継承（null 可）
3. **合流**: Task folder と Note folder の同名・同名 folder 重複は **1 タグに dedupe**（タグは role 横断が仕様）
4. **assignment**: 各 folder の**active 直下アイテム**（folder 以外）へ当該 folder タグを 1 つ付与。**直近祖先のタグのみ**で祖先連鎖は付与しない（一階層原則。実測では入れ子なしのため実影響なし）
5. **re-root**: 直下アイテムの `parent_item_id` → NULL（folder ごと消えてツリーから不可視になる事故の防止）。tasks は既存カラム `original_parent_id` に旧 folder id を退避、notes は移行ログテーブルに退避（ロールバック用）
6. **folder 本体**: `is_deleted = true` + `deleted_at = now()` のソフトデリート（hard delete しない — TrashView 復元と rollback の保険）
7. **実データでの期待値**: 新規タグ **5**（task folder 3 + note folder 2・再利用 0）/ assignment **1**（test2 → `testfolder`）/ re-root task **1**・note **0**

### C. 変換 migration の構成（検証クエリ・ロールバック対）

- 1 migration ファイル（ローカル先行 → 🛑 ユーザー `supabase db push`）: ①移行ログテーブル `life_tags_migration_log`（folder→tag の id 対応と re-root 退避を記録する最小 DDL）②変換 UPDATE/INSERT（B の規則を set-based で）
- **検証クエリ（実行前後で対）**: (a) 変換前 active folder 数 = ログ行数 = 生成 + 再利用タグ数 (b) 変換前 folder 直下 active アイテム数 = 生成 assignment 数 = re-root 行数 (c) 変換後 active folder 数 = 0。期待値は B-7（5 タグ / 1 assignment / 1 re-root）
- **ロールバックスクリプト（対で用意）**: ログを逆適用 — folder `is_deleted = false` 復元・re-root 復元（tasks は `original_parent_id`、notes はログ）・生成タグ / assignment の削除（再利用タグは削除しない — `was_new_tag` フラグで区別）

### D. UI 波及の詳細設計

- **Kanban（`shared/src/components/Kanban/**`）**: `KanbanViewMode` = `"status" | "tag"` の 2 ビューへ（`VIEW_ORDER` / `VIEW_ICON` から folder 除去）。**default view = `"tag"`**（folder ビューの後継）。`buildFolderColumns` / `FOLDER_ROOT_BUCKET_ID` 削除。カードの folder pill（`folderName` / `folderColor`）廃止 — tag chips が既に後継表示。列色編集（`onColorChange`）は tag 列で `setTagColor` に接続
- **view 永続化 migration（`viewModeStorage.ts`）**: localStorage key `life-editor:kanban-view-mode` に残る legacy 値 `"folder"` を**読み取り時に `"tag"` へ正規化して書き戻す**（`isKanbanViewMode` から folder を外し、read に legacy 変換を追加）。list ビュー側の双子 `materials/TaskListPanel.tsx` の `VIEW_ORDER` も同時に処理
- **Tasks 作成 UI**: `TaskAddDialog` の `TaskAddType` から folder 除去（タグ付けは既存のタグ UI へ誘導）。`useTaskTreeCRUD` の Complete-folder 自動生成・`completeFolderWithChildren` / `uncompleteFolder` は機能ごと退役（status = DONE が後継）
- **Notes（`web/src/notes/NotesView.tsx` ほか）**: フォルダツリー → **タグ見出しグルーピングのサイドリスト**（タグごとの見出し + 見出し折りたたみ + 「untagged」バケツ。見出しへの DnD ドロップ = assignment 付与に置換）。`createFolder` 導線・folder ガード類を除去
- **Daily**: フォルダツリーは**元々存在しない**（実測 + コード全数で確認）→ タグフィルタ追加のみ
- **全セクション共通タグフィルタの配置**: layout standard v2 のヘッダー / パネル構造確定後に決定（未定のまま — v2 依存）

### E. 対象コード面積（実測 — 全数調査 + 急所は Read で確認済）

folder 概念の参照は **約 62 ファイル**（shared/src ≈35・web/src 9・mcp-server 2・i18n catalog 2・shared/tests 13 ほか）。急所は 4 クラスタ:

| クラスタ         | 主なファイル                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 型               | `shared/src/types/taskTree.ts`（`NodeType`:9・`folderType`:36・`originalParentId`:37・`FOLDER_PAD_TOP`:12）/ `types/note.ts`（`NoteNodeType`）/ `shared/src/index.ts` re-export                                                                                                                                                                                           |
| Kanban ビュー    | `Kanban/types.ts`（`KanbanViewMode`:17・`folderName/folderColor`）/ `KanbanBoard.tsx`（`VIEW_ORDER`:21・default folder:75）/ `buildColumns.ts`（`buildFolderColumns`:111-161）/ `viewModeStorage.ts` / `KanbanColumn.tsx` / `KanbanCard.tsx` / `materials/TaskListPanel.tsx`（双子 VIEW_ORDER:34）                                                                        |
| mapper / hooks   | `services/taskMapper.ts`（`task_type`/`folder_type`）/ `notesUnifiedMapper.ts`（`note_type`）/ `hooks/useTaskTreeCRUD.ts`（Complete-folder 自動生成:133-159・`completeFolderWithChildren`/`uncompleteFolder`:294-341）/ `useTaskTreeMovement.ts` / `useNotesUnifiedAPI.ts`（`createFolder`:446-475）/ `utils/sortTaskNodes.ts` / `getDescendantTasks.ts` / `folderTag.ts` |
| Schedule FK 連鎖 | `types/calendar.ts`（`folderId`）/ `services/calendarMapper.ts` / `hooks/useCalendarsAPI.ts` / `web/src/schedule/CalendarView.tsx`（`folderTasks`:41-52・FK 409 ガード:63）— **schedule-refine 領分**                                                                                                                                                                     |

横断の後継対応（各セクション adoption・Step 4 後段）: `utils/analyticsAggregation.ts` `aggregateByFolder`/`aggregateNotesByFolder` → タグ集計（analytics）/ `Connect/graph/buildGraphModel.ts` の folder→"project" ノード → タグ起点（connect）/ i18n の folder 系キー（`newFolder`・`folderCompleteConfirm`・`defaultTaskFolder*` 等 en/ja 両 catalog）/ mcp-server の `folder_id` パラメータ（旧 SQLite 読みのため実害なし — MCP の Supabase 再接続時に整理）。

### F. 実装ステージング（compile 安全順）

| 段                 | 内容                                                                                                                                                                                               | レーン                             | 依存                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| S1                 | Kanban 2 ビュー化 + view 永続化 migration + Tasks/Notes の folder 作成 UI 除去 + Notes タグ見出しグルーピング + 変換 migration ファイル作成（**NodeType は温存** — Schedule のコンパイル互換維持） | materials-refine                   | v2 共通部品 merge 後                                                            |
| S2                 | CalendarView の folder バインド → 新モデル（calendars 0 行のため**コード変更のみ・データ移行不要**。候補: life-tag バインド or バインドレス化）                                                    | schedule-refine                    | S1 と独立・**outbox 合意**（→ Worklog）                                         |
| S3                 | `NodeType` から folder 除去・`folderType`/`originalParentId`/mapper cleanup・analytics / connect の後継集計・i18n / docs sweep                                                                     | materials-refine（横断は各レーン） | S2 完了後                                                                       |
| 実データ変換の実行 | 🛑 ユーザー `supabase db push` + 検証クエリ                                                                                                                                                        | —                                  | S1 merge 後（CalendarView の folder select が空になるため **S2 と同期を推奨**） |

## Scope (Touchable Paths) — 実測済（§Step 2-E）

```
shared/src/types/**               ← taskTree（NodeType）/ wikiTagUnified
shared/src/components/Kanban/**   ← folder ビュー除去・tag ビュー強化
shared/src/components/**          ← タグフィルタ / グルーピング UI（新設分）
shared/src/services/**            ← Mapper / DataService の folder 経路整理
web/src/**                        ← 各セクションの adoption
supabase/migrations/*.sql         ← 移行 DDL・変換スクリプト
.claude/docs/vision/plans/2026-07-11-life-tags-unification.md
.claude/CLAUDE.md / docs/requirements/**  ← §4・§8・tier-1/2 の追随（同一 PR）
```

---

## Steps

| #   | Step                                                                                    | Gate    | Acceptance                                     |
| --- | --------------------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| 1   | 本計画 PR merge（方向の確定）                                                           | 🛑 人手 | PR merge                                       |
| 2   | 詳細設計を本計画に追記（UI モック・平坦化規則・対象コード面積と folder 実データの実測） | 🤖 自律 | 本計画更新 PR（Status → IN PROGRESS）          |
| 3   | epic Issue 起票 + 実装レーン決定（新 worktree or 既存レーン）                           | 🛑 人手 | Issue URL・Branch/Owner-chat を frontmatter に |
| 4   | 移行 migration / スクリプト → shared UI → 各セクション adoption                         | 🤖 + 🛑 | DDL push はユーザー / build・test pass         |
| 5   | データ移行実行 + 検証クエリ + 全画面確認                                                | 🛑 + 👀 | 検証クエリ一致 + ユーザー OK                   |

---

## Acceptance Criteria (機械検証可能 — 方向レベル。Step 2 で具体化)

- [ ] folder ビュー・folder ノード作成 UI がコードから消えている（`KanbanViewMode` に folder が無い等・grep で確認）
- [ ] 既存 folder が同名タグとして引き継がれている（検証クエリで folder 数 = tag 数・直下アイテム数 = assignment 数）
- [ ] タスクのサブタスク（task 親子）が回帰していない（既存 test green）
- [ ] status ビュー・完了処理が回帰していない（既存 test green）
- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] docs 追随: CLAUDE.md §4（ID 不変式の folder 表記）・§8 / requirements tier-1（Tasks / Notes）・tier-2（WikiTags）の sweep（`rules/docs-consistency.md` §2）
- [ ] 完了時: 本計画 Status → COMPLETED + `archive/` 移動 + per-chat memory 更新（DoD）

---

## DB Migration Notes

- ローカルファイル先行ルール（MANDATORY — `_TEMPLATE.md` 参照）。`apply_migration` MCP 単独使用禁止
- 変換は UPDATE/INSERT 系（DDL は最小）。ロールバック = folder ノードのソフトデリート復元 + 生成 tag/assignment の削除スクリプトを対で用意

---

## Risks / Known Issues 参照

- **移行の不可逆性**: 変換後に folder UI を消すため、移行規則の誤りは目視で気づきにくい → 検証クエリ + folder ソフトデリート保持で保険
- **WikiTag 改名の波及**: 型リネームをやる場合、skill-lib / agents-lib は git 管理外（memory `skill-lib-agents-lib-not-git`）— 改名 sweep の grep 対象に含めること
- **並行レーンとの競合**: Kanban / Notes は materials-refine の領分 — 実装レーン決定時（Step 3）に単一書込者を明確化

---

## References

- 実体コード: `shared/src/types/wikiTagUnified.ts` / `shared/src/types/taskTree.ts`（NodeType）/ `shared/src/components/Kanban/buildColumns.ts`
- DB 規約: `docs/vision/db-conventions.md` / requirements: `docs/requirements/tier-2-supporting.md`（WikiTags）
- 兄弟計画: [`2026-07-11-layout-standard-v2.md`](./2026-07-11-layout-standard-v2.md)

---

## Worklog

- 2026-07-11: 計画作成（chat-docs-workspace）。方向 4 点（WikiTag 拡張一本化 / folder ノードのみ廃止 / status 独立軸 / v2 後に着手）をユーザーと AskUserQuestion で確定
- 2026-07-11 (2): **S1 実装完了**（chat-materials-refine・role-engineer 3 レーン並列: Kanban 2 ビュー化 / Notes タグ見出しグルーピング / 変換 migration 0020 + verify + rollback）。shared build + test 851 green・web build green。監査 = role-qa PASS / migration-validator Blocking 0 / sync-auditor Blocking 0（Nit 反映済み: assignTagHint 配線・stale コメント・rollback ヘッダに delta 復活時の soft-delete 切替注記）。S3（NodeType folder 除去）と各セクション adoption・i18n / docs sweep は schedule-refine の S2 合意待ちのまま。follow-up: applyStatusChange の DONE 沈み reorder 専用ユニットテスト（S3 で追加）
- 2026-07-11: Step 2 詳細設計を追記（chat-materials-refine・Status → IN PROGRESS）。Supabase 本番の read-only 実測（active folder = tasks 3 + notes 2・全ルート直下・calendars 0 行・タグ名衝突 0）で平坦化規則を「直近 folder 名のみ」で確定。epic Issue #225 起票（type:task + shared-fix）。共有コアの単一書込者 = materials-refine（chat-main 采配）。CalendarView の folder 依存（S2)について schedule-refine へ outbox で合意依頼を送付
