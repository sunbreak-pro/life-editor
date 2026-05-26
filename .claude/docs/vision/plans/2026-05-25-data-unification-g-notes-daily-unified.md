---
Status: IN-PROGRESS — 2026-05-24 着手。4 PR 直列分割（G1=Notes Service 拡張 ✅ / G2=Dailies Service 拡張 / G3=Provider+web 切替 / G4=legacy 死削除）。**G1 PR #29 merged (a977f8d, 2026-05-25)。現在 G2 進行中**（後追い検証スタイル / role-engineer 委譲）。
Created: 2026-05-25
Revised: 2026-05-25 G2 着手 — Branch 切替、scope 詳細化（Daily 7 methods）
Branch: feat/du-g2-dailies-unified（worktree `.claude/worktrees/du-g2/`）
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 DoD「Notes/Daily Unified 経路への切替」相当）
Previous: .claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md（DU-F v2、本計画書を後継として明示）
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
- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md` (DoD)
- 前フェーズ:
  - `.claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md` (DU-F、本計画書の起点)
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

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- **2026-05-25** — DU-F Step 13 でスケルトン作成。実装未着手。
- **2026-05-24/25** — G1 着手 → 実装 → role-qa NEEDS DISCUSSION → 同一ターンで QA1/2/3 + SEC-H1 全件対応 → PR #29 → merge (a977f8d)。
- **2026-05-25** — G2 着手 (worktree `du-g2` / branch `feat/du-g2-dailies-unified`)。Daily は階層 / search 不要のため Notes G1 より純粋に小さい（cycle guard / descendants delete / ilike join なし）。
- **2026-05-25** — G2 実装完了 (role-engineer)。`SupabaseDailiesUnifiedService` に 7 メソッド追加 (`fetchDeletedDailiesUnified` / `restoreDailyUnified` / `permanentDeleteDailyUnified` / `setDailyPasswordUnified` / `removeDailyPasswordUnified` / `verifyDailyPasswordUnified` / `toggleDailyEditLockUnified`) + private `nextVersion` / `readBackById` helper。Bridge `SupabaseDailyService` の 7 stub を全て Unified delegate に切替（`_pendingDuRewrite` Daily 関連 5 件 + `verifyDailyPassword` の `return false` + `fetchDeletedDailies` の `return []` 全て消滅）。`DataService` interface に 7 メソッド追加。`PHASE2_DAILIES_UNIFIED_METHODS` 7 件追加。Tests: `SupabaseDailiesUnifiedService.test.ts` 新規 32 ケース。tsc -b exit 0 / vitest 232/232 pass (G1 後 200 → +32)。known-issues 027 を Notes/Daily 両対象に拡張 + INDEX.md タイトル更新。設計判断: G2 仕様書通り `restoreDailyUnified` でも version bump（Notes G1 は updated_at のみ — Daily は Routine 再生成等で content 不変の restore 単独イベントが起こりうるので LWW cursor を明示）。Notes G1 の `verifyNotePasswordUnified` は id validate を省略していたが、Daily 側は payload table が `assertDailyId` を持つので `setDailyPasswordUnified` / `restoreDailyUnified` / `permanentDeleteDailyUnified` / `removeDailyPasswordUnified` / `toggleDailyEditLockUnified` 入口で `assertDailyId` を効かせ「invalid id は DB round-trip 前に reject」を回帰テストで固定（verify は legacy parity で id validate なし — null hash で false を返す方が UX として穏当）。
