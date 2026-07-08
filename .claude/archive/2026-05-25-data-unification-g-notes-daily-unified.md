---
Status: COMPLETED — 4 PR 直列分割（G1=Notes Service 拡張 / G2=Dailies Service 拡張 / G3=Provider+web 切替 / G4=legacy 死削除）を全完了。G1-G4 = PR #29 / #30 / #31 / #36 全 merge 済（2026-05-25〜）。旧 Status「G2 進行中」は実績未反映だったため訂正（移行 SSOT L2 の「DU-G G2 進行中」も同様に追随修正が必要 — SSOT は本 PR スコープ外）。
Created: 2026-05-25
Revised: 2026-05-25 G2 着手 — Branch 切替、scope 詳細化（Daily 7 methods）
Branch: feat/du-g2-dailies-unified（worktree `.claude/worktrees/du-g2/`）
Owner-chat: main
Parent: .claude/archive/2026-05-21-data-unification-items-meta.md（親計画書 DoD「Notes/Daily Unified 経路への切替」相当・archive 済）
Previous: .claude/archive/2026-05-24-data-unification-f-wikitag-link-ui.md（DU-F v2、本計画書を後継として明示・archive 済）
Successor: 未定（必要なら DU-H Calendar 2 ビュー = DU-E と並走 / 後続）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」（notes_payload / dailies_payload composite FK）「Pattern A Provider 設計」「列化判定マトリクス」/ DU-D scope reduction worklog / DU-F worklog
---

# Plan: DU-G — Notes / Daily Unified write path 完全切替

## このフェーズのゴール

DU-F で legacy shared 経路のまま維持した Notes / Daily の write path を、Unified (items_meta + payload 2-row) 経路へ完全切替する。`SupabaseNotesUnifiedService` の機能拡張 + Pattern A Provider 新設 + web/ Provider 差し替え + legacy mapper 死削除を一気通貫で行い、5-role の **読み出し + 書き込み両方向**を Unified に揃える。

## scope reduction の経緯（DU-F → DU-G）

DU-F v1 で計画していた「Notes/Daily Unified 完全切替」は、`SupabaseNotesUnifiedService` が DU-D scope-reduced により最小 CRUD 6 メソッドのみ（folder / password / lock / syncTree / restore / permanentDelete / fetchAllNotes / fetchDeletedNotes / setNotePassword / removeNotePassword / verifyNotePassword / toggleNoteEditLock 等の Notes UX 必須機能が未実装）であることが判明し、DU-F が XL 化するため DU-G に分離。本計画書はその分離分。

## Non-goals（DU-G の範囲外）

- DU-F で扱った WikiTag/Link UI / wiki_tag_groups UI の再変更
- frontend/（旧 Tauri）の修正・削除
- DU-E Calendar 2 ビュー（別計画）
- MCP Server の Notes/Daily ツール書き換え（MCP catch-up plan へ）

## Scope (Touchable Paths)

```
shared/src/services/SupabaseNotesUnifiedService.ts      # 機能拡張: folder / password / lock / syncTree / restore / permanentDelete / setNotePassword / removeNotePassword / verifyNotePassword / toggleNoteEditLock / searchNotes
shared/src/services/SupabaseDailiesUnifiedService.ts    # 機能拡張: 必要に応じて（password / lock / restore / permanentDelete / toggleDailyPin）
shared/src/services/DataService.ts                       # Unified 系メソッドの interface 拡張
shared/src/context/NotesUnifiedContext.tsx               # 新規 Pattern A Provider
shared/src/context/NotesUnifiedContextValue.ts           # 新規
shared/src/context/DailiesUnifiedContext.tsx             # 新規
shared/src/context/DailiesUnifiedContextValue.ts         # 新規
shared/src/hooks/useNotesUnifiedAPI.ts                   # 新規 (useNotesAPI と同じ surface を Unified サービスに向ける)
shared/src/hooks/useNotesUnifiedContext.ts               # 新規
shared/src/hooks/useDailiesUnifiedAPI.ts                 # 新規
shared/src/hooks/useDailiesUnifiedContext.ts             # 新規
shared/src/index.ts                                      # NotesUnified / DailiesUnified Provider / Context / hook / 型 export
web/src/App.tsx / MainScreen.tsx                         # NoteProvider → NotesUnifiedProvider / DailyProvider → DailiesUnifiedProvider 差し替え
web/src/notes/NotesView.tsx                              # import 切替 (useNoteContext → useNotesUnifiedContext)
web/src/daily/DailyView.tsx                              # 同上

# legacy 死削除（DU-G 出口で実施）
shared/src/services/noteMapper.ts                        # 削除
shared/src/services/dailyMapper.ts                       # 削除
shared/src/services/SupabaseNotesService.ts              # 削除（PHASE2_NOTES_METHODS dispatch も削除）
shared/src/services/SupabaseDailyService.ts              # 削除（PHASE2_DAILY_METHODS dispatch も削除）
shared/src/context/NoteContext.tsx                       # 削除
shared/src/context/NoteContextValue.ts                   # 削除
shared/src/context/DailyContext.tsx                      # 削除
shared/src/context/DailyContextValue.ts                  # 削除
shared/src/hooks/useNotesAPI.ts                          # 削除
shared/src/hooks/useNoteContext.ts                       # 削除
shared/src/hooks/useDailyAPI.ts                          # 削除
shared/src/hooks/useDailyContext.ts                      # 削除
shared/src/hooks/useNoteTreeMovement.ts                  # 削除 or Unified 経路に統合
```

スコープ外（=触らない）:

- `frontend/`（旧 Tauri 全体）
- WikiTag / Routine / Schedule / Calendar 系 Provider
- `supabase/migrations/`（追加 DDL なし想定。NoteLink / NoteConnection も維持）
- 汎用 Database / Pomodoro / Audio / SidebarLinks / Template 等

## Steps（暫定、実装時に再見積もり）

1. SupabaseNotesUnifiedService に欠けているメソッドを 1 つずつ実装 + 単体テスト追加
2. SupabaseDailiesUnifiedService 同上
3. shared Pattern A NotesUnifiedProvider + hook 新設（DU-F TagPicker / LinkPanel が `useWikiTagsUnifiedContext()` を呼ぶように、各 role view は `useNotesUnifiedContext()` を呼ぶ）
4. shared DailiesUnifiedProvider + hook 同上
5. shared `index.ts` から NotesUnified / DailiesUnified を export
6. web/ App.tsx / MainScreen.tsx で Provider 差し替え
7. web/ NotesView.tsx / DailyView.tsx の import を Unified に切替
8. golden path 動作確認（階層 DnD / TipTap / password / lock / pin / 削除 / 復元 / 物理削除）
9. legacy mapper / service / Context / hook を一括削除
10. shared `tsc -b` + vitest + web build 全 pass 確認
11. RLS gate offender 0 / advisor lint 新規 WARN 0 確認
12. 親計画書 DoD の「5 role すべてが items_meta + 対応 payload 経由で動作」を完全達成として更新
13. session-verifier → commit → role-qa → PR

## Acceptance Criteria（機械検証可能、暫定）

- [ ] `cd shared && npx tsc -b` exit 0
- [ ] `cd shared && npx vitest run` 全 pass（DU-F 完了時 170/170 緑から減少なし。Unified 追加分の新規テストは pass 加算）
- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npx vitest run` 全 pass
- [ ] `git grep -E "noteMapper|dailyMapper|SupabaseNotesService|SupabaseDailyService|useNotesAPI\b|useDailyAPI\b|useNoteContext\b|useDailyContext\b|NoteProvider\b|DailyProvider\b" shared/src web/src` ヒット 0（Unified 系のみ残る）
- [ ] Supabase `notes_payload` / `dailies_payload` への INSERT/UPDATE/DELETE が web/ から成立
- [ ] RLS gate offender 0 / advisor lint 新規 WARN 0
- [ ] Notes/Daily UX 全機能（password / lock / pin / 階層 DnD / TipTap / 削除 / 復元 / 物理削除）が無回帰

## DB Migration Notes

**追加 DDL なし想定**。`notes_payload` / `dailies_payload` composite FK は DU-D `0014` で適用済。Unified サービスは既存スキーマで完結する。

## Risks & Mitigations

| ID  | リスク                                                                          | レベル | 緩和策                                                                                                              |
| --- | ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| R1  | SupabaseNotesUnifiedService の機能拡張が想定より多く XL 化                      | 高     | 1 メソッドずつ実装 + 単体テストで段階的に進める。各メソッド実装後に web/ から個別検証                               |
| R2  | password / lock / syncTree のロジックが legacy useNotesAPI と乖離する           | 高     | legacy `useNotesAPI.ts` の該当ブロックを逐語ベースで参照しつつ、items_meta 経由に書き換える                         |
| R3  | 階層 DnD の order/parentId 計算が `notes_payload` 経路で破綻                    | 中     | DU-D 完了時点で `moveNoteUnified(id, parentId, order)` は実装済。useNotesUnifiedAPI 側で順序保証ロジックを移植      |
| R4  | legacy 削除タイミングで未参照 import 残骸が build 破壊                          | 中     | Step 9 の前に `git grep` で参照点 0 を確認してから削除                                                              |
| R5  | DU-F で作成した TagPicker / LinkPanel が item_id 取得元（Provider）変更で壊れる | 低     | TagPicker / LinkPanel は `useWikiTagsUnifiedContext()` のみ依存。item_id の供給元（host context）が変わっても無影響 |
| R6  | RLS が Unified 経路で意図せず緩む                                               | 致命   | Step 11 の RLS gate スクリプトで全 13 テーブル offender 0 確認 / advisor lint 新規 WARN 0                           |
| R7  | DU-E (Calendar 2 ビュー) と並走時に Notes/Daily の data 破壊                    | 中     | DU-G を DU-E より先に走らせるか、`data-unification/g-notes-daily-unified` ブランチを単独で merge してから DU-E 着手 |

## References

- vision: `.claude/docs/vision/db-conventions.md` (payload mapper 規約 / composite FK パターン) / `.claude/docs/vision/coding-principles.md` (Pattern A / Provider 順序)
- 親計画書: `.claude/archive/2026-05-21-data-unification-items-meta.md` (DoD・archive 済)
- 前フェーズ:
  - `.claude/archive/2026-05-24-data-unification-f-wikitag-link-ui.md` (DU-F、本計画書の起点・archive 済)
  - `.claude/archive/2026-05-24-data-unification-d-notes-daily.md` (DU-D scope-reduced、本計画書が完成版)
- related skills: `add-component` (Provider 追加パターン) / `life-editor-migration-validator` / `life-editor-sync-auditor` / `frontend-react-designer`

## G2 Scope（Dailies Unified Service 機能拡張）

### 追加メソッド（7 個、Unified Service 側 / id ベース）

1. `fetchDeletedDailiesUnified(): Promise<DailyNode[]>` — `items_meta.role='daily' AND is_deleted=true` + payload join
2. `restoreDailyUnified(id: string): Promise<void>` — `is_deleted=false / deleted_at=null / updated_at=now / version++`
3. `permanentDeleteDailyUnified(id: string): Promise<void>` — payload row + meta row を物理 DELETE（Daily に子は無く、Notes G1 の descendants ループ / cycle guard は不要）
4. `setDailyPasswordUnified(id: string, password: string): Promise<DailyNode>` — payload `password_hash = <plaintext>` + meta version bump（**SECURITY DEBT 継続**: known-issues 027 を Notes+Daily 両対象に拡張）
5. `removeDailyPasswordUnified(id: string, currentPassword: string): Promise<DailyNode>` — verify 通過後に `password_hash = null` + meta version bump
6. `verifyDailyPasswordUnified(id: string, password: string): Promise<boolean>` — 単一列 `password_hash` のみ SELECT して plaintext eq
7. `toggleDailyEditLockUnified(id: string): Promise<DailyNode>` — `is_edit_locked` 反転 + meta version bump

`PHASE2_DAILIES_UNIFIED_METHODS` に上記 7 メソッドを追加。

### Mapper 拡張（`dailiesUnifiedMapper.ts`）

- `DAILIES_PAYLOAD_COLUMNS` から `password_hash` は除外維持（既存通り）。`verifyDailyPasswordUnified` のみが単一列 SELECT で `password_hash` を読む
- `dailyUpdatesToPatches` は password 列を扱わない（password 経路は service が直書き、Notes G1 と同様）

### Bridge delegate 切替（`SupabaseDataService.ts::SupabaseDailyService`）

`_pendingDuRewrite` stub の 5 メソッド + `fetchDeletedDailies()` の `[]` no-op を全て Unified delegate に切替:

- `fetchDeletedDailies()` → `unified.fetchDeletedDailiesUnified()`
- `restoreDaily(date)` → `unified.restoreDailyUnified(\`daily-${date}\`)`
- `permanentDeleteDaily(date)` → `unified.permanentDeleteDailyUnified(\`daily-${date}\`)`
- `setDailyPassword(date, pw)` → `unified.setDailyPasswordUnified(\`daily-${date}\`, pw)`
- `removeDailyPassword(date, pw)` → `unified.removeDailyPasswordUnified(\`daily-${date}\`, pw)`
- `verifyDailyPassword(date, pw)` → `unified.verifyDailyPasswordUnified(\`daily-${date}\`, pw)`（既存 `return false` 廃止）
- `toggleDailyEditLock(date)` → `unified.toggleDailyEditLockUnified(\`daily-${date}\`)`

### DataService interface 拡張

`shared/src/services/DataService.ts` の "Unified services" ブロック（L569 周辺）に 7 メソッド追加。legacy 側（L187-202）は無変更（G3/G4 で死削除）。

### Test 追加（`shared/tests/SupabaseDailiesUnifiedService.test.ts` 新規）

Notes G1 の `SupabaseNotesUnifiedService.test.ts` を template に in-memory Supabase stub で 25-30 ケース:

- fetchDeletedDailiesUnified: 0 件 / 1 件 / 複数 / 削除済以外を除外
- restoreDailyUnified: is_deleted/deleted_at リセット + version bump / 存在しない id でエラー
- permanentDeleteDailyUnified: meta+payload 両方削除 / 存在しない id は no-op
- setDailyPasswordUnified: password_hash 書き込み / has_password generated boolean が true に
- removeDailyPasswordUnified: 正しい currentPassword で password_hash=null / 誤 password でエラー
- verifyDailyPasswordUnified: 正/誤 password / null hash で false
- toggleDailyEditLockUnified: false→true / true→false / version bump

既存 `dailiesUnifiedMapper.test.ts` は無変更。`tsc -b` exit 0 + vitest 全 pass 維持。

### SECURITY DEBT 拡張

`.claude/docs/known-issues/027-notes-password-plaintext-debt.md` を Notes/Daily 両対象に書き換え。タイトル / Symptom / References を Daily 経路も明記。INDEX.md のタイトルも更新（"Notes/Daily password が plaintext"）。

## G2 Acceptance Criteria（機械検証可能）

- [x] `cd .claude/worktrees/du-g2/shared && npx tsc -b` exit 0
- [x] `cd .claude/worktrees/du-g2/shared && npx vitest run` 全 pass（G1 merge 後 200/200 → G2 で **232/232** 加算）
- [x] `git grep "_pendingDuRewrite" shared/src/services/SupabaseDataService.ts` の Daily 関連 5 件ヒット 0
- [x] `fetchDeletedDailies` の `return []` no-op コードが消滅
- [x] known-issues 027 が Notes+Daily 両対象に拡張済
- [x] Bridge SupabaseDailyService の全メソッドが Unified delegate（throw する stub 0）

## G4 Scope（legacy Notes/Daily 死削除 — Bridge dispatch 層まで撤去 / A-2）

> **着手**: 2026-05-30（worktree `.claude/worktrees/du-g/` / branch `feat/du-g-notes-daily-unified` / owner-chat `du-g`）。
> **方針決定**: ユーザーが **A-2（深掃除 = Bridge dispatch 層まで撤去）** を選択（2026-05-30）。`git grep` で legacy シンボル 0 を **method 名レベルまで**徹底する。G3 (PR #31) の Unified ファイルに残された「G4 will rewrite the hook body to call the \*Unified DataService methods directly + retire the Bridge」というコメント宣言を完遂する。

### 現状補正（計画書 L49-63 の記述が一部不正確だった — role-pm 裏取り済み）

1. **`SupabaseNotesService.ts` / `SupabaseDailyService.ts` という独立ファイルは史上存在しない**（`git log --all -- <path>` 空）。実体は `SupabaseDataService.ts` 内の **Bridge クラス**（`class SupabaseDailyService` L553 / `class SupabaseNotesService` L636）+ `PHASE2_DAILY_METHODS`(L2313) / `PHASE2_NOTES_METHODS`(L2328) dispatch。→ G4 は「ファイル rm」ではなく「**クラス + dispatch 削除**」が正。
2. **G3 (PR #31) は 8 ファイル追加のみ・削除ゼロ**。Unified 系（`NotesUnifiedContext` 等）は legacy hook の薄い alias/ラッパで、`useNotesAPI` / `useDailyAPI` に**型・ランタイム両方で実依存**。よって legacy hook は「単純 rm」できず、**中身ごと Unified 名へ移設**が必須。
3. **`useNoteTreeMovement.ts` は Notes 専用ヘルパで `useNotesAPI` のみが使用**（`useRoutinesAPI` / `useScheduleItemsAPI` は不参照 — 裏取り済み）。→ 削除せず保持し、移設後の `useNotesUnifiedAPI` 配下に残す。Acceptance の grep gate(L94) に `useNoteTreeMovement` は**含まれない**ので保持と矛盾しない（grep gate 対象外として明示）。
4. **`web/src/wikitag/TagPicker.tsx` の legacy 参照は JSDoc コメント 1 行のみ**で実依存なし（R5「無影響」は正しい）。
5. **`frontend/`（旧 Tauri）は shared を import せず自前同名実装を持つ** → shared の legacy 削除で frontend build は壊れない（Non-goals を安全に守れる）。

### A-2 トランスフォーメーション原則（核心）

Bridge クラス `SupabaseDailyService`(L553) / `SupabaseNotesService`(L636) は **legacy メソッド名 → Unified メソッド名の写像仕様そのもの**（G1/G2 で全メソッドが Unified delegate 済み）。よって:

1. Bridge クラスの各委譲（`legacyMethod() → unified.unifiedMethod()`）を **hook 呼び出し点へインライン化**する。すなわち `useNotesAPI` / `useDailyAPI` 内の `dataService.<legacyName>(...)` 呼び出しを、Bridge が示す対応する `dataService.<unifiedName>(...)`（例 `fetchAllNotes`→`fetchAllNotesUnified`）へ全書換。
2. インライン化後、Bridge クラス 2 つ・`PHASE2_DAILY_METHODS`/`PHASE2_NOTES_METHODS` set・`route()` の該当 2 行（L2457-2458）・bridge 生成 2 行（L2441-2442）・legacy mapper import + `_unused_*` フィールドを削除。
3. `DataService` interface（`DataService.ts`）から **legacy メソッド署名ブロック**を削除（Unified 署名のみ残す）。削除前に「legacy メソッド名が shared/web の生存コードから呼ばれていないか」を `git grep` で確認（呼び元は legacy hook のみのはず）。

### Scope (Touchable Paths)

```
# hook 本体の移設（A-2 中核）
shared/src/hooks/useNotesAPI.ts            → 中身を useNotesUnifiedAPI.ts へ移設後 削除
shared/src/hooks/useDailyAPI.ts            → 中身を useDailiesUnifiedAPI.ts へ移設後 削除
shared/src/hooks/useNotesUnifiedAPI.ts     # alias re-export → 実 impl（Unified メソッド直呼び）へ
shared/src/hooks/useDailiesUnifiedAPI.ts   # 同上
shared/src/hooks/useNoteTreeMovement.ts    # 保持（Notes 専用 / grep gate 対象外）。移設後 hook から import

# Bridge + dispatch 撤去
shared/src/services/SupabaseDataService.ts # Bridge クラス2 / PHASE2_DAILY/NOTES_METHODS / route 2行 / 生成2行 / legacy mapper import / _unused_* 削除
shared/src/services/DataService.ts         # legacy メソッド署名ブロック削除（Unified のみ残す）
shared/src/services/noteMapper.ts          # 削除
shared/src/services/dailyMapper.ts         # 削除
shared/src/services/noteMapper.roundtrip.ts  # 削除（legacy mapper のテスト）
shared/src/services/dailyMapper.roundtrip.ts # 削除（同上）

# legacy Context/hook 削除
shared/src/context/NoteContext.tsx / NoteContextValue.ts     # 削除（Unified が import を新名へ切替後）
shared/src/context/DailyContext.tsx / DailyContextValue.ts   # 削除
shared/src/hooks/useNoteContext.ts / useDailyContext.ts      # 削除
shared/src/context/NotesUnifiedContext.tsx / NotesUnifiedContextValue.ts    # import 先を新 impl へ repoint
shared/src/context/DailiesUnifiedContext.tsx / DailiesUnifiedContextValue.ts # 同上

# barrel re-wire
shared/src/index.ts            # legacy export 除去（L52-56 Daily / L72-83 Note。useNoteTreeMovement export は web 使用実態で判断）
shared/src/context/index.ts    # legacy export 除去（L13-14 Daily / L25-26 Note）

# test
shared/tests/noteMapper.test.ts                  # 削除（道連れ）
shared/tests/useNoteTreeMovement.cycle.test.ts   # 保持（useNoteTreeMovement を残すため）。import パス追従のみ
（その他 legacy hook を直接 import するテストがあれば Unified 名へ追従）

# web JSDoc コメントの legacy 名掃除（grep gate を 0 にするため）
web/src/wikitag/TagPicker.tsx / web/src/notes/NotePasswordDialog.tsx / web/src/notes/useNoteTreeDnd.ts ほか
```

スコープ外（=触らない）: `frontend/`（旧 Tauri）/ `mcp-server/` / `supabase/migrations/`（追加 DDL なし）/ WikiTag / Routine / Schedule / Calendar / Database 等。

### Steps（Gate 列付き）

| #   | Step                                                                                                                                          | Gate    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | green baseline 取得（`cd shared && npx tsc -b` exit 0 / `npx vitest run` の pass 数記録 / `cd web && npm run build` exit 0）                  | 🤖 自律 |
| 2   | Bridge クラス 2 つを読み「legacy→Unified メソッド写像表」を確定（インライン化の仕様）                                                         | 🤖 自律 |
| 3   | `useNotesAPI` の中身を `useNotesUnifiedAPI.ts` へ移設し、DataService 呼び出しを Unified 名へ全書換（写像表に従う）。`useNotesAPI.ts` 削除     | 🤖 自律 |
| 4   | `useDailyAPI` 同様に `useDailiesUnifiedAPI.ts` へ移設 + 書換 + 削除                                                                           | 🤖 自律 |
| 5   | `NotesUnifiedContext`/`Value` / `DailiesUnifiedContext`/`Value` の import を新 impl へ repoint                                                | 🤖 自律 |
| 6   | legacy Context/hook（NoteContext / DailyContext / useNoteContext / useDailyContext）削除                                                      | 🤖 自律 |
| 7   | `SupabaseDataService.ts` の Bridge クラス 2 / `PHASE2_DAILY/NOTES_METHODS` / route 2 行 / 生成 2 行 / legacy mapper import / `_unused_*` 削除 | 🤖 自律 |
| 8   | `DataService.ts` interface から legacy メソッド署名削除（事前に呼び元 0 を `git grep` 確認）                                                  | 🤖 自律 |
| 9   | legacy mapper（noteMapper / dailyMapper）+ roundtrip テスト + noteMapper.test.ts 削除                                                         | 🤖 自律 |
| 10  | barrel（`index.ts` / `context/index.ts`）から legacy export 除去                                                                              | 🤖 自律 |
| 11  | web JSDoc コメントの legacy シンボル名を Unified 名へ更新（grep gate 用）                                                                     | 🤖 自律 |
| 12  | `cd shared && npx tsc -b` exit 0 / `npx vitest run` 全 pass（baseline から減少なし）                                                          | 🤖 自律 |
| 13  | `cd web && npm run build` exit 0 / `npx vitest run` 全 pass                                                                                   | 🤖 自律 |
| 14  | grep gate（下記 Acceptance）ヒット 0 を確認                                                                                                   | 🤖 自律 |
| 15  | Notes/Daily UX 無回帰の目視確認（password / lock / pin / 階層 DnD / TipTap / 削除 / 復元 / 物理削除）                                         | 👀 目視 |
| 16  | session-verifier → commit → role-qa（別コンテキスト）→ PR                                                                                     | 🛑 人手 |

### G4 Acceptance Criteria（機械検証可能）

- [ ] `cd shared && npx tsc -b` exit 0
- [ ] `cd shared && npx vitest run` 全 pass（baseline = G2 merge 後 232 から減少なし。mapper roundtrip / noteMapper.test 削除分の純減は許容、Unified へ移設したテストで担保）
- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npx vitest run` 全 pass
- [ ] `git grep -P "noteMapper|dailyMapper|SupabaseNotesService|SupabaseDailyService|useNotesAPI\b|useDailyAPI\b|useNoteContext\b|useDailyContext\b|NoteProvider\b|DailyProvider\b|NoteContext\b|DailyContext\b|PHASE2_NOTES_METHODS|PHASE2_DAILY_METHODS" shared/src web/src` ヒット 0（**コメント含む真の 0**。`useNoteTreeMovement` / `*Unified*` は対象外 = 保持）
  - ⚠️ **必ず `-P`（Perl 正規）を使う**。`git grep -E "\b"` は POSIX ERE が `\b` をバックスペース文字と解釈して**常に偽 0 を返す**罠（QA 2026-05-30 検出。本セッションでも序盤に同罠で per-symbol 0 を踏んだ）。`-w` か `-P` か `([^A-Za-z]|$)` を使うこと
- [ ] `SupabaseDataService.ts` に Bridge クラス（`class SupabaseDailyService` / `class SupabaseNotesService`）と `PHASE2_DAILY_METHODS` / `PHASE2_NOTES_METHODS` が存在しない
- [ ] `DataService` interface に legacy メソッド署名が存在しない（Unified 系のみ）
- [ ] frontend build に影響なし（shared 削除が frontend を壊さないことの確認 = frontend は shared を import しない事実の再確認で代替）

### G4 Risks & Mitigations

| ID   | リスク                                                                        | レベル | 緩和策                                                                                                                      |
| ---- | ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| G4R1 | legacy hook が呼ぶメソッドに Unified 等価が無く、削除でメソッド欠落           | 中     | Bridge クラスが全メソッドを Unified delegate 済み = 写像は完全。Step 2 で写像表を確定してから書換                           |
| G4R2 | Bridge dispatch 撤去で Proxy ルーティングが壊れ、別ドメインに波及             | 高     | `route()` は legacy 2 行（L2457-2458）と生成 2 行のみ除去。他ドメインの PHASE2\_\* set は無変更。Step 12-13 で全 build 検証 |
| G4R3 | `DataService` interface の legacy 署名削除で、shared/web の想定外呼び元が露見 | 中     | Step 8 で削除前に各 legacy メソッド名を `git grep`。呼び元が legacy hook 以外に無いことを確認してから削除                   |
| G4R4 | hook 移設で password/lock/pin/DnD のロジックが欠落・回帰                      | 中     | 中身を逐語移設（ロジック改変なし、DataService 呼び名のみ置換）。Step 15 で UX 目視                                          |
| G4R5 | DU-E 等と並走時に中核 `SupabaseDataService.ts` でコンフリクト                 | 中     | G4 を単独 merge してから DU-E 着手（R7 準拠）。本 worktree 専有                                                             |

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- **2026-05-25** — DU-F Step 13 でスケルトン作成。実装未着手。
- **2026-05-24/25** — G1 着手 → 実装 → role-qa NEEDS DISCUSSION → 同一ターンで QA1/2/3 + SEC-H1 全件対応 → PR #29 → merge (a977f8d)。
- **2026-05-25** — G2 着手 (worktree `du-g2` / branch `feat/du-g2-dailies-unified`)。Daily は階層 / search 不要のため Notes G1 より純粋に小さい（cycle guard / descendants delete / ilike join なし）。
- **2026-05-25** — G2 実装完了 (role-engineer)。`SupabaseDailiesUnifiedService` に 7 メソッド追加 (`fetchDeletedDailiesUnified` / `restoreDailyUnified` / `permanentDeleteDailyUnified` / `setDailyPasswordUnified` / `removeDailyPasswordUnified` / `verifyDailyPasswordUnified` / `toggleDailyEditLockUnified`) + private `nextVersion` / `readBackById` helper。Bridge `SupabaseDailyService` の 7 stub を全て Unified delegate に切替（`_pendingDuRewrite` Daily 関連 5 件 + `verifyDailyPassword` の `return false` + `fetchDeletedDailies` の `return []` 全て消滅）。`DataService` interface に 7 メソッド追加。`PHASE2_DAILIES_UNIFIED_METHODS` 7 件追加。Tests: `SupabaseDailiesUnifiedService.test.ts` 新規 32 ケース。tsc -b exit 0 / vitest 232/232 pass (G1 後 200 → +32)。known-issues 027 を Notes/Daily 両対象に拡張 + INDEX.md タイトル更新。設計判断: G2 仕様書通り `restoreDailyUnified` でも version bump（Notes G1 は updated_at のみ — Daily は Routine 再生成等で content 不変の restore 単独イベントが起こりうるので LWW cursor を明示）。Notes G1 の `verifyNotePasswordUnified` は id validate を省略していたが、Daily 側は payload table が `assertDailyId` を持つので `setDailyPasswordUnified` / `restoreDailyUnified` / `permanentDeleteDailyUnified` / `removeDailyPasswordUnified` / `toggleDailyEditLockUnified` 入口で `assertDailyId` を効かせ「invalid id は DB round-trip 前に reject」を回帰テストで固定（verify は legacy parity で id validate なし — null hash で false を返す方が UX として穏当）。
- **2026-05-30** — G4 着手 (worktree `du-g` / branch `feat/du-g-notes-daily-unified` / chat `du-g`)。新 Multi-chat Worktree Policy proactive 化（PR #33）後の初 worktree セットアップ = 4 ステップ 1 セットを規約通り実行し SessionStart hook 緑を確認（追従い検証）。role-pm スコープ確定 → ユーザーが **A-2（Bridge dispatch 層まで撤去）** を選択。計画書 L49-63 を補正（独立 Service ファイル不在 = `SupabaseDataService.ts` 内 Bridge クラス削除 / G3 は追加のみで death-removal は G4 / `useNoteTreeMovement` は Notes 専用ヘルパで保持 / frontend は shared 非依存で無影響）。`## G4 Scope` セクション追記。実装は role-engineer 委譲予定。
