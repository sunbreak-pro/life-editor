---
Status: IN-PROGRESS — 2026-05-24 着手。4 PR 直列分割（G1=Notes Service 拡張 / G2=Dailies Service 拡張 / G3=Provider+web 切替 / G4=legacy 死削除）。現在 **G1 進行中**（後追い検証スタイル / role-engineer 委譲）。
Created: 2026-05-25
Revised: 2026-05-24 G1 着手 — Branch / Owner-chat 確定、PR 分割戦略確定
Branch: feat/du-g-notes-daily-unified（worktree `.claude/worktrees/du-g/`）
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

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- **2026-05-25** — DU-F Step 13 でスケルトン作成。実装未着手。
