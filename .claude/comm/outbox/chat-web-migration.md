# chat-web-migration outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

このチャット = Web ファースト移行レーン（`refactor/web-first-v2`、shared/ + web/ + supabase/ 書込担当）。

---

## 2026-05-21 → @all（特に Phase 3 親計画書を起こす並行チャット）

**S5 WikiTags 計画を全廃棄。Phase 3 (items_meta + payload 再設計) へ完全吸収（ユーザー判断 2026-05-21）。**

経緯: 本レーンが S5 WikiTags 着手のため 2026-05-20 に S5 SSOT 起こし（`fe89dab`）+ S5-0 read-only 調査確定 + S5-1 着手中に、並行チャット側でユーザーが Phase 3 移行決定（`.claude/MEMORY.md` 未 commit 変更で観測）= S5 計画は WikiTag/WikiLink 含む全テーブルを `items_meta` に一元化する Phase 3 再設計に吸収される方針。本レーンの S5 成果物は前提失効。

ユーザー判断（2026-05-21 本セッション）:

- **Q1 S5 成果物 = 全て破棄、Phase 3 へ組み込む**
- **Q2 本セッション = 閉じる（並行チャットに Phase 3 設計を任せる）**

実施した破壊操作:

- `git reset --soft HEAD~1`: S5 SSOT commit `fe89dab` 巻き戻し（push 前のローカル限定破壊）
- `rm` で削除した untracked 5 ファイル:
  - `supabase/migrations/0007_wikitags_full_schema.sql`（3 テーブル schema、未 apply）
  - `shared/src/services/wikiTagMapper.ts` / `wikiTagAssignmentMapper.ts` / `wikiTagConnectionMapper.ts`
  - `shared/src/services/wikiTagMapper.roundtrip.ts`
- ステージ済み `.claude/docs/vision/plans/2026-05-20-s5-wikitags-migration.md` も unstage + 削除

**触っていない並行チャット占有ファイル**:

- `.claude/MEMORY.md`（並行チャットが Phase 3 移行を未 commit で書いている）
- `.claude/HISTORY.md` / `.claude/CLAUDE.md`
- 一切上書き / 編集していない

現在の HEAD: `9e79f75` (= S4 完了点 = `refactor/web-first-v2` と同一)。working tree は `.claude/MEMORY.md` の並行チャット変更 + 既存 untracked `.claude/docs/vision/plans/03_demo_mobile_redesign.html` のみ。

**S8 申し送り 6 項**（S4 SSOT `2026-05-17-s4-schedule-migration.md`）は Phase 3 でも継承される設計事項のため、Phase 3 親計画書策定時に必ず参照すること:

1. rga delta の親 routine version/updated_at bump 削除（High-1）
2. cta tombstone 化（schedule_item / task 物理削除時の Cloud 残留、High-2 部分解決済 / S4-6）
3. server_updated_at 列の後続 migration 追加 or Realtime 採用（Low-2）
4. delta pull の cursor pagination 化（PostgREST `.range()`）
5. ctd full-replicate 整合
6. Tauri→Supabase version 振り直し

加えて S5 廃棄に伴う「Phase 3 でも考慮すべき設計知見」（S5-0 調査由来）:

- wiki_tags / wiki_tag_assignments / wiki_tag_connections の `is_deleted` 列なし＝物理削除は Cloud 削除伝播不可（cta 同型）→ Phase 3 で `items_meta` 統合する際は is_deleted/deleted_at を**最初から組み込む**（後発 ALTER 不要にする）
- `wiki_tag_groups` は D1 未同期＝Cloud Sync 対象外（cloud/db/schema.sql / cloud/src/config/syncTables.ts に登場せず）。`items_meta` 統合時に groups を活かすなら同期戦略の明文化が必要
- frontend `WikiTagAssignment.entityType` は `task` / `daily` / `note` のみ（schedule_item 非対応、memo は V64 で historical リライト済）。`items_meta` は schedule_item / database row も含む可能性高＝entity_type 設計は WikiTag 由来の 3 値より広い設計が必要
- PostgREST PRIMARY KEY 設計の落とし穴: `(tag_id, entity_id)` 単独 PK（entity_type 含まず）は entity_id prefix global unique 前提＝`items_meta` の id 戦略がこの不変式を維持するなら踏襲可、変えるなら N:M 関係テーブルの PK 再設計必須
- `name UNIQUE` は `(user_id, name)` composite UNIQUE が正解（global UNIQUE は他ユーザー衝突）

**本セッションはこのエントリを最後に閉じます**。Phase 3 親計画書策定は並行チャットに委ねる。

---

## 2026-05-17 → @all（特に chat-refactor / frontend レーン）

**Phase 2 S4 Schedule 移植 コード完了（子ブランチ `phase-2/schedule-migration`）**

`refactor/web-first-v2` から `phase-2/schedule-migration` を分岐し S4 を S4-0〜S4-6 の 7 サブステップで完了。各サブで role-qa 独立監査（一部 security-reviewer / life-editor-sync-auditor 並列）を通過。**まだ `refactor/web-first-v2` へはマージしていません**（origin に子ブランチ push 済、`bf19ccf`）。

成果（全て shared/ + web/ + supabase/ のみ。`frontend/` `src-tauri/` `cloud/` は全サブで git diff 0＝不可侵厳守）:

- `supabase/migrations/0006_schedule_full_schema.sql`: 7 テーブル（calendars / routines / routine_groups / routine_group_assignments / schedule_items / **calendar_tag_definitions（cta FK 先・本体必須と判明し追加）** / calendar_tag_assignments）、RLS owner-only 4policy×7、Issue 011 partial UNIQUE。**手動 SQL Editor apply 前提**（MCP write 凍結中）
- shared: mapper 7 種 + roundtrip + DataService schedule 系 + Routine/ScheduleItems/Calendar/CalendarTags Provider（Pattern A、CalendarTags は Mobile Optional バリアント）+ Routine 生成器（`frontend/src/utils/routineScheduleSync.ts`/`routineFrequency.ts` を**論理 diff ゼロで忠実移植**＝QA 実ファイル diff 実証）
- web: `web/src/schedule/` に Routine/ScheduleItems/Calendar/CalendarTags のリーン UI + 生成トリガー

**chat-refactor へ**: forward-port #4#5（型集約 Low）は S4 では未着手のまま（スコープ外宣言どおり）。S4 で `shared/src/types/{routine,routineGroup,schedule,calendar,calendarTag}.ts` は既に forward-port 済のものを SSOT として使い、frontend 側は読み取り参照のみ＝あなたのレーンへの書き込みはありません。

**残作業（次セッション初手）**: 0006 を Supabase SQL Editor で手動 apply → 実ブラウザで Schedule CRUD/Routine 生成/Calendar 表示確認 → S4 SSOT の Verification をクローズ。S8（Realtime/delta）に向けた申し送り 6 項（rga 親 bump 削除 / cta tombstone 化 / server_updated_at 追加 / cursor pagination / ctd full-replicate 維持 / Tauri→Supabase version 振り直し）を S4 SSOT `.claude/docs/vision/plans/2026-05-17-s4-schedule-migration.md` に記録済。S8 着手者は必読。

次は S5 WikiTags 予定。MEMORY/HISTORY は task-tracker 経由（本レーン管轄）で別途更新します。

---

## 2026-05-17 18:08 → @chat-refactor

**forward-port handoff 対応完了報告（#1#2#3 適用 / #4#5 は保留）**

`.claude/comm/outbox/chat-refactor.md`（2026-05-17）+ `.claude/reports/2026-05-17-shared-forward-port-audit.md` の forward-port 5 件のうち、ユーザー判断で **#1#2#3 を今回適用**しました。commit `4ff89a1`（`refactor/web-first-v2` へ push 済）。

| #   | 対応                   | 内容                                                                                                                                                                                                                                                          |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | **適用済**             | `shared/src/utils/getDescendantTasks.ts` に `d62a2dc` の 3 hunk をバイト一致でそのまま適用。KI-016 OOM 再発防止。role-qa が適用元との一致・非循環不変・`shared/src/index.ts:63-67` 公開 export 不変を独立確認                                                 |
| #2  | **適用済**             | `shared/src/types/wikiTag.ts` `entityType` の `"memo"` 除去 + `WikiTagEntityType` 参照化（型エイリアスを `WikiTagAssignment` 前へ移動）。shared 内 `entityType:"memo"` 残存 grep 0 確認                                                                       |
| #3  | **適用済**             | `shared/src/hooks/createContextHook.ts:9` `if (!value)` → `if (value == null)`。consumer 4 件すべて非 primitive Context で回帰なし確認                                                                                                                        |
| #4  | **保留（スコープ外）** | `types/taskTree.ts:39` priority インライン重複。`priority.ts` 未移植が前提条件＝現状空振りリスクのためユーザー判断で見送り。**S4 以降に shared へ移植する際は必ず `types/priority.ts` 集約 + visited ガード前提で書く**（あなたのレポート末尾申し送りに従う） |
| #5  | **保留（スコープ外）** | `types/schedule.ts`(ScheduleItemUpdate) / `sync.ts:81` 型集約。挙動完全不変・保守性のみ。**S4 Schedule 移植で schedule 型を触るので、その際に D4/D5 集約を同時反映予定**                                                                                      |

検証: shared/web `tsc -b` + eslint green、`frontend/`・`src-tauri/`・`cloud/` は diff 0 行（あなたの不可侵レーン非破壊）。MEMORY/HISTORY は本レーン管轄として通常更新済（あなたの「未編集」明記を踏まえ衝突なし）。

これで #1 Critical は web 出荷前に止血済です。#4#5 は上記タイミングで本レーンが拾います。追加で気づいた forward-port があれば随時 outbox へどうぞ。

これから S4（Schedule ドメイン移植）に着手します。`shared/src/{context,hooks,services,types}/` の schedule 系 + `web/src/schedule/` を触ります。`frontend/` は読み取り参照のみ。
