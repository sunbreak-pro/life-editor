# chat-web-migration outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

このチャット = Web ファースト移行レーン（`refactor/web-first-v2`、shared/ + web/ + supabase/ 書込担当）。

---

## 2026-05-23 → @all（DU-B-1 完了報告 / DU-B-2 着手判断待ち）

**Data Unification DU-B-1（DB schema + composite FK + policy hardening）が本番 Supabase に apply 済。検証 9 件すべてクリア。次は DU-B-2 (taskMapper 書き換え) 着手判断。**

ブランチ: `data-unification/items-meta-redesign`（HEAD `7d164be`）。

### apply 履歴（最終形）

| migration                                    | 内容                                                                                                                                                                                  | apply 結果 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `0009_tasks_payload_parent_fk.sql` (v3-rev2) | items_meta `(id,role)` UNIQUE + tasks_payload composite FK (`parent_item_role` generated stored + ON DELETE **NO ACTION**) + parent_item_id 側 EXISTS policy 強化 + 旧単独 index drop | ✅         |
| 0009 差分 (v3-rev3 policy 2 本)              | `tasks_payload_insert_own / update_own` の `auth.uid()` を `(select auth.uid())` でラップ (advisor `auth_rls_initplan` WARN 対策)                                                     | ✅         |
| `0010_du_b_initplan_cache.sql`               | DU-A 由来 6 policy (items_meta 4 + tasks_payload select/delete 2) を同じく `(select auth.uid())` 化                                                                                   | ✅         |
| `0009_rollback.sql`                          | （未 apply、巻き戻し用に commit のみ）                                                                                                                                                | —          |

### v2 → v3 transition で実体験した PG 落とし穴

- **v2 (SET NULL) → apply エラー**: `SQLSTATE 42601: invalid ON DELETE action for foreign key constraint containing generated column` — GENERATED ALWAYS STORED 列を含む composite FK に SET NULL は不可。CASCADE / NO ACTION / RESTRICT は OK
- **v3 (CASCADE 検討) → 廃案**: items_meta 同士に FK がないため、子の tasks_payload は cascade されるが子の items_meta は孤児化 = 1:1 invariant 違反
- **v3-rev2 (NO ACTION) → apply 成功**: 子がいる親の hard-delete は PG が拒否、アプリ層 (`permanentDeleteTask`) が descendants 再帰削除する責務 (Tauri 同型)
- **v3-rev3 全体再 apply で `2BP01`**: UNIQUE 制約 drop の瞬間に composite FK が depend していて止まる。再 apply は cascade 指定 or 差分 SQL に限る。R1 Recovery Playbook に追記済

### 検証結果（A-G + RLS gate + advisor）

| #                                                | 検証                                                                     | 結果                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| A                                                | items_meta UNIQUE 制約存在                                               | ✅ 1 row                                                                              |
| B                                                | composite FK 存在 + 単独 FK drop 済                                      | ✅ 2 row（`tasks_payload_item_id_fkey` + `tasks_payload_parent_fk`）                  |
| C                                                | parent_item_role generated 列 = 'task'                                   | ✅                                                                                    |
| D                                                | ルート Task INSERT (parent NULL)                                         | ✅（user_id 明示が必要、Supabase SQL Editor は postgres role で `auth.uid() = NULL`） |
| E                                                | cross-role parent INSERT 拒否                                            | ✅ FK violation 期待通り                                                              |
| F-1                                              | 子がいる親 hard-delete 拒否                                              | ✅ FK violation 期待通り                                                              |
| F-2                                              | 子先削除 → 親削除成功                                                    | ✅ count 両 0                                                                         |
| G                                                | 自分所有 parent 正常 INSERT                                              | ✅                                                                                    |
| RLS gate (`check-rls.sql` 手動実行)              | ✅ `___RLS_GATE_OK___` sentinel + offender 0                             |
| Security advisor                                 | ✅ 既知 WARN 1 件 (`auth_leaked_password_protection`、DU-A 申し送り維持) |
| Performance advisor (items_meta + tasks_payload) | ✅ `auth_rls_initplan` WARN 0                                            |

### Known Issue 候補 (DU-B-6 docs 更新で `docs/known-issues/` に記録予定)

1. **PG: generated stored 列を含む composite FK に SET NULL 不可** (SQLSTATE 42601 / DU-B-1 v2 で実体験)
2. **Supabase SQL Editor は postgres role で動き `auth.uid() = NULL`**。検証 INSERT で user_id 明示が必要
3. **`check-rls.sh` wrapper が Supabase CLI v2.101 で `--output csv` 廃止により動作不能**。代替: `check-rls.sql` を SQL Editor で直接実行
4. **依存制約の連鎖 drop**: 再 apply で UNIQUE drop が composite FK 依存で `2BP01` を返す。差分 SQL or `drop ... cascade` で回避

### 次フェーズ（DU-B-2 着手判断待ち）

子計画書: `.claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md` (v3-rev3)
着手内容: `shared/src/services/taskMapper.ts` の 2 行分割書き換え + `taskMapper.roundtrip.ts` 更新。

並行チャット (chat-refactor) との競合は本レーンが `shared/` と `supabase/` のみ触る限り発生しない見込み。

---

## 2026-05-22 → @parallel-chat（Phase 3 親計画書作者）

**Phase 3 親計画書 (`2026-05-21-data-unification-items-meta.md`, 441 行, untracked) の独立 QA 監査結果。判定 = REVISE-REQUIRED。Blocker 7 + Major 8。ユーザーが本レーンに監査依頼 → 並行チャット (= 計画書作者) への修正委譲を選択。**

監査体制: 本セッションがメインから `role-qa` + `life-editor-sync-auditor` を並列起動、独立コンテキストで観点 A-H をクロスレビュー。**両エージェントがファイル変更 0 / git diff 0 で読み取り専用厳守**。

### 結論

| 区分            | 件数  | 含意                                               |
| --------------- | ----- | -------------------------------------------------- |
| **Blocker**     | **7** | commit 前必須修正。命名・列定義・Sync 章構造に直結 |
| **Major**       | **8** | commit してから Phase 3-A 着手前までに解消必須     |
| **Minor / Nit** | 12    | 後追い OK                                          |

### Blocker（commit 前修正必須）

1. **ファイル名 / 命名規則自己矛盾**
   - 実ファイル名 = `2026-05-21-data-unification-items-meta.md`
   - 計画書 L406 命名規則 = `2026-05-XX-phase3-<sub-id>-<slug>.md`
   - **frontmatter `Supersedes:` で指す `2026-05-20-s5-wikitags-migration.md` は物理不在**（本レーンが 2026-05-21 に reset で破棄済、commit `fe89dab` push 前ローカル限定）
   - 修正案: ファイル名を `2026-05-21-phase3-items-meta-unification.md` にリネーム or 命名規則を「親は phase3- 省略可」に明文化。`Supersedes:` 行を `Replaces (never-committed draft): S5 WikiTags 旧計画案` に書き換え、L373 DoD「S5 旧計画 archive 移動」を削除（archive 対象不在）

2. **items_meta に `server_updated_at` 列が無い** (sync C-1)
   - L128-138 列定義に `id / role / title / user_id / created_at / updated_at / is_deleted / deleted_at / version` のみ
   - S4 SSOT 申し送り③（Issue 013-B / 014 LWW 棄却時の cursor 非前進）が **時限爆弾化**。Phase 3 完了後の Cloud Sync 本格運用で発火
   - 修正案: items_meta に `server_updated_at timestamptz NOT NULL DEFAULT now()` 列追加 + INSERT/UPDATE trigger で必ず stamp（LWW 棄却時も進める）。Realtime 採用に倒すなら「Realtime のため列追加せず」と明示決定を記述（沈黙最悪）

3. **payload の `is_deleted` 設計が未定義** (sync C-2)
   - L142-198 の 5 payload テーブル列定義に is_deleted/deleted_at が一切なし
   - L218-236 RLS 設計に `ON DELETE` 句も不在
   - items_meta soft-delete vs payload 残留 / items_meta hard-delete vs payload 孤児化の方向未定義
   - 修正案: 「**is_deleted/deleted_at は items_meta が単一所有。payload は所有しない**」「**payload FK は `item_id REFERENCES items_meta(id) ON DELETE CASCADE` 強制**」を明文化

4. **wiki_tag_assignments / wiki_tag_connections の `is_deleted` 未定義** (sync C-3 + outbox S5-A)
   - L94-95 で言及のみ、列定義は DB 設計詳細章に不在
   - L281 で「relation tables は soft-delete-aware delta (Issue 008 同型)」と書きつつ対応列を定義していない → 不可能な指示
   - 修正案: DB 設計詳細章に「wiki_tag_assignments / wiki_tag_connections 列定義」サブ章追加。`is_deleted boolean NOT NULL default false / deleted_at timestamptz`を最初から組込（**cta tombstone 化問題 S8-2 を Phase 3 で同時解消**）

5. **RoutineGroup の role 値域矛盾** (qa B3 + sync H-4)
   - L101 `items_meta.role` 値域 = `task / event / routine / note / daily` の **5 値 CHECK 固定**
   - L173 `group_item_id` が「items_meta(role=routine_group) 参照」と仮置き
   - L178-180「3-C 子計画書まで遅延」← **5 値固定と矛盾、3-A apply 時に決定不能**
   - 修正案: 親計画書時点で確定。推奨 = routine_groups を items_meta に乗せず independent table（schedule_items 同様の論理 unique 別軸を持たないため素直）。CHECK 値域 5 で凍結

6. **parent_item_id cross-role FK 設計手法が親計画未確定** (qa B4)
   - L214-217「子計画書 3-B で SQL CHECK で強制する設計を確認」← 素朴 FK では表現不能
   - PostgreSQL FK + CHECK 組合せは generated column + composite FK で迂回するのが定石
   - 3-A apply 後に composite UNIQUE 必要と判明 → 破壊的 reapply 二度手間
   - 修正案: L126 items_meta 列定義表に `UNIQUE (id, role)` 明記。または「親計画書では制約強制可能性のみ保証、具体設計は 3-B で確定」を明文化

7. **Sync 章が 5 行のみで S8 申し送り 6 項クロスマッピング不在** (sync H-1)
   - L278-282 が Sync 章の全文
   - サブ計画書策定者が毎回 S4 SSOT に遡る必要 = 引継ぎ漏れ最大源
   - 修正案: Sync 章を 3 副節構造に拡張: ①Phase 3 で自動解消（version 集約等）／②Phase 3 で能動解決（is_deleted 最初から組込・cursor pagination 等）／③Phase 5 まで引継（Realtime 採用判断等）

### Major（commit 後 Phase 3-A 着手前必須）

- **M1 `.mcp.json` プレースホルダ鉄則欠**: Migration 戦略章 L286-292 直後に「MCP write 凍結中＝手動 SQL Editor。`.mcp.json` は `${SUPABASE_ACCESS_TOKEN}` 参照プレースホルダのまま commit（2026-05-17 Push Protection 事案再発防止）」追記
- **M2 Issue 008/011/017/020/KI-016 処遇書き分け欠**: 「Phase 2 既知債務の処遇表」副節を Migration 戦略と Phase 分割表の間に追加
- **M3 ロールバック逆 migration の commit 戦略欠**: L381 後に `0009_rollback_to_phase2.sql` を 3-A 着手時に同時 commit する旨明記（or 手順固定の代替案）
- **M4 `routines_payload.template_event` JSONB が Q9 矛盾**: 二択 (a) 専用列群に分解 (b) Q9 を「Notes content_json + Routines template_event のみ JSONB」に拡張
- **M5 MCP Server 16 ツール再配線で具体ツール名欠**: CLAUDE.md §5.1 の 32 ツールから items_meta 依存 16 を抜粋列挙
- **sync H-2 relation tables PK 設計が outbox S5-D 警告と齟齬**: id 戦略 `<role>-<uuid>` global unique 前提を踏襲 → `wiki_tag_assignments PK (tag_item_id, item_id)` 等明示
- **sync H-3 cursor pagination 未組込 (Issue 012 再発)**: items_meta は role 跨ぎ全件 SELECT 頻発 → 3-A 内で `nextSince` cursor + PostgREST `.range()` 化を先取り推奨。または `SYNC_PAGE_SIZE` の items_meta 用再設計を明示
- **sync H-5 ctd (CalendarTag) 廃止判断が沈黙**: L288 破壊 DROP リストに ctd 入りだが L289 新スキーマには ctd 無し → Non-goals に「Phase 3 で CalendarTag を WikiTag 統合 or 廃止」明示

### S8 申し送り × Phase 3 処遇マトリクス（要計画書反映）

| #    | 内容                                           | 処遇                       | 計画書反映              |
| ---- | ---------------------------------------------- | -------------------------- | ----------------------- |
| S8-1 | rga 親 routine version bump 削除               | 自動解消 (rga 自体消滅)    | 不在 (H-4 混乱の一因)   |
| S8-2 | cta tombstone 化                               | **能動解決**               | **不在=Critical (C-3)** |
| S8-3 | server_updated_at 追加 or Realtime             | **着手前判断必須**         | **不在=Critical (C-1)** |
| S8-4 | cursor pagination                              | Phase 3 先取り推奨         | **不在=High (H-3)**     |
| S8-5 | ctd full-replicate 維持 or 廃止                | 明示要                     | 不在=High (H-5)         |
| S8-6 | Tauri→Supabase version 振り直し                | 自動解消 (Q3 破壊リセット) | 不在=Low                |
| S5-A | wiki_tag\* に is_deleted 最初から組込          | **能動解決**               | **不在=Critical (C-3)** |
| S5-B | wiki_tag_groups 同期戦略                       | 明示必要                   | 不在=Low                |
| S5-C | entity_type 3 値→item_id 単独                  | items_meta で対応          | 不在=High (H-2)         |
| S5-D | (tag_id, entity_id) 単独 PK global unique 前提 | 踏襲可                     | 不在=High (H-2)         |
| S5-E | name UNIQUE は (user_id, name) composite       | wiki_tags 維持なら反映     | 不在=Medium             |

### 推奨修正フロー

1. 並行チャットが上記 Blocker 7 件を計画書に反映（推定 30-60 分。Sync 章拡張が最重）
2. Major 8 件は同時または着手前に解消
3. 並行チャットが修正版を commit + push（pathspec で計画書のみ。MEMORY.md は並行チャット側で当時の Phase 3 引継エントリと合わせて整理）
4. 必要なら本レーンが再 QA（簡易、Blocker 残存確認のみ）→ ユーザー承認
5. 承認後の 6 アクション (L423-428) へ

### 本レーンが触っていないもの

- 親計画書本体: 読み取り監査のみ、編集ゼロ（計画書作者 = 並行チャットの意図を尊重）
- `.claude/MEMORY.md` / `HISTORY.md` / `CLAUDE.md`: 並行チャットの未 commit Phase 3 移行エントリが MEMORY.md にあり、本レーン触らず
- frontend/ src-tauri/ cloud/ .mcp.json: 不可侵厳守

### 補足: ファイル可視性

親計画書は untracked 状態のため GitHub / 別 clone / 別チャットから見えません。修正後の commit + push で全レーンから読めるようになります（本レーンでは commit しません＝計画書作者の意図領域）。

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
