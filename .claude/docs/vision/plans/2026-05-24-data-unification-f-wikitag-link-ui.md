---
Status: PLANNING — v2（2026-05-24 / B スコープ縮約）。Notes/Daily の Unified 完全切替（folder / password / lock / syncTree / restore / permanentDelete の Unified 拡張 + Provider 切替 + UI 動作確認）は **後続別計画 DU-G** に分離。本 DU-F は WikiTag/Link UI + CalendarTag 死削除 + wiki_tag_groups UI + 親計画書 DoD 達成宣言に集中。Routine は Event の一形態として Tag/Link 対象外。frontend/（旧 Tauri）は touched=NO 維持。
Created: 2026-05-24
Branch: data-unification/items-meta-redesign
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3, DU-F 行 + DoD）
Previous:
  - .claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md（DU-C+ scope-reduced、DU-F 完了時に同時 archive）
  - .claude/archive/2026-05-24-data-unification-d-notes-daily.md（DU-D scope-reduced）
Successor: DU-G — Notes/Daily Unified 完全切替（本 DU-F 完了時に別計画書スケルトンを `plans/` に置く）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」（wiki_tag_assignments / wiki_tag_connections）「Pattern A Provider 再設計案」「Sync への影響」「列化判定マトリクス」/ DU-B 確定（DB-Q3 composite FK パターン）/ DU-C+ scope reduction worklog / DU-D scope reduction worklog
---

# Plan: DU-F — WikiTag/Link UI（4 role 共通レイアウト）+ wiki_tag_groups UI + CalendarTag 死削除 + 親 DoD 達成

## このフェーズのゴール（Data Unification「見えるゴール」達成）

親計画書の Data Unification レーンを「ユーザーから見える完了」まで進める。Tag/Link グラフが 4 role で稼働し、CalendarTag 概念が消え、wiki_tag_groups CRUD が UI で動作する状態を作る。

- shared 側 `index.ts` の export を WikiTagsUnified 系 + 関連型に拡張
- web/ 側 App.tsx に WikiTagsUnifiedProvider を配置（NoteProvider/DailyProvider は **legacy shared 版のまま維持**、Unified 切替は DU-G）
- 共通 Tag/Link UI コンポーネント（詳細パネル + 行末ピル）を 4 role（Task / Event / Note / Daily）に展開
  - **Routine は Event の一形態という UX 設計**のため、Routine 専用 Tag/Link UI は実装しない
- wiki_tag_groups の CRUD UI を新設
- CalendarTag 関連 UI を web/ + shared から完全削除（DU-C+ で DB は DROP 済、UI 死コードが残留）
- 親計画書 DoD 全達成 + CLAUDE.md §4.3 一行追記（composite FK pattern + Routine UX 変更）+ 移行 SSOT に Data Unification レーン完了記録追記
- **DU-G 別計画書スケルトン作成**（Notes/Daily の Unified 完全切替の予約）

---

## scope reduction の経緯（v1 → v2）

### v1 で計画していた範囲

親計画書 DU-F 行通り「frontend↔shared 結線 + WikiTag/Link UI 全 role + Notes/Daily Provider 切替 + CalendarTag 削除」を 22 Step で実施予定だった。

### v2 で気付いた技術的負担

- **shared `SupabaseNotesUnifiedService` は最小 CRUD 6 メソッドのみ**（DU-D scope-reduced 成果物）。folder / password / lock / syncTree / restore / permanentDelete / fetchAllNotes / fetchDeletedNotes / setNotePassword / removeNotePassword / verifyNotePassword / toggleNoteEditLock 等の Notes UX 必須機能が未実装
- 一方、現状動作中の `shared/src/hooks/useNotesAPI.ts` (legacy) は上記をすべてカバーし、web/ NotesView も legacy 経由で動作
- Notes/Daily を Unified 完全切替するには `SupabaseNotesUnifiedService` を 7〜8 メソッド拡張 + Dailies にも同型拡張 + ロジック移植 + テスト追加が必要 → **DU-F が XL 化**

### v2 の判断（B スコープ）

- Notes/Daily の write path は **legacy shared 版で安定動作中** → 触らない
- 親計画書 DU-F 出口の "NoteProvider/DailyProvider が shared 版" は **legacy shared を満たしているとも解釈可** → DU-G で正式 Unified 切替
- DU-F は **「ユーザーから見える Data Unification 完了」** に集中：WikiTag/Link UI 稼働 + CalendarTag 概念消滅 + wiki_tag_groups UI
- Step 数 22 → 14 に縮約。L 規模

### DU-G に分離する作業（本 DU-F の Non-goal）

- `SupabaseNotesUnifiedService` の機能拡張（folder / password / lock / syncTree / restore / permanentDelete / setNotePassword / removeNotePassword / verifyNotePassword / toggleNoteEditLock）
- `SupabaseDailiesUnifiedService` の機能拡張（必要に応じて）
- shared Pattern A NotesUnified / DailiesUnified Provider + hook 新設
- web/ NoteProvider / DailyProvider を Unified 版に切替
- legacy mapper (noteMapper / dailyMapper) の削除
- Notes 階層 DnD / TipTap 編集 / Daily UPSERT の Unified 経路 golden path 動作確認
- 親計画書 v1 DU-F の Step 1-8 相当の作業

---

## ユーザー確定事項（2026-05-24 / DU-F v2 起票時）

| #      | 項目                         | 確定                                                                                                                        |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| DF-Q1  | DU-F 進め方                  | **親プラン内 Step 細分化（単一計画書）**。sub-phase 分割（DU-F-1..N 子計画書）は採らない                                    |
| DF-Q2  | Tag/Link UI 配置             | **4 role 共通レイアウト**（詳細パネル + 行末ピル）。Routine は Event の一形態 UX に変更しているため、Routine 専用 UI は不要 |
| DF-Q3  | role 対象                    | **Task / Event / Note / Daily の 4 role**。Routine の Tag/Link は Routine 由来 Event 経由                                   |
| DF-Q4  | UI 個別最適化                | **本計画では共通レイアウトに統一**。各 role の UI/UX を見て今後最適な配置を考案・変更する可能性あり                         |
| DF-Q5  | frontend/（旧 Tauri）        | **touched=NO 維持**（廃止移行中、Data Unification 対象外）                                                                  |
| DF-Q6  | legacy mapper / service      | **削除しない、deprecated コメントも付けない**（Notes/Daily の legacy mapper は DU-G まで現役）                              |
| DF-Q7  | wiki_tag_groups UI           | **本計画で実装**（タグマスタ + グループ CRUD + tag↔group 割当）。親計画書 DoD 必須項目                                      |
| DF-Q8  | DU-C+ 計画書 archive         | **DU-F 完了時に同時 archive**（DU-C+ END 時に archive 漏れていたため、本計画完了 task-tracker END で吸収）                  |
| DF-Q9  | データ移行                   | **しない**（DU-A 破壊的リセットで既存データ消失済）                                                                         |
| DF-Q10 | Notes/Daily Unified 完全切替 | **DU-G に分離**（本 DU-F の Non-goal）。本 DU-F 完了時に DU-G スケルトン計画書を `plans/` に置く                            |

---

## Context

- **動機**: Data Unification の「見える完了」達成。5 role 統一アーキテクチャの **読み出し方向**（WikiTag/Link グラフ + CalendarTag 概念の消滅 + wiki_tag_groups UI）を稼働させる。Notes/Daily の write path Unified 化は DU-G に分離して安全実装
- **制約**:
  - 親計画書のユーザー確定事項 Q1〜Q16 を変更しない
  - DU-A / DU-B / DU-C / DU-C+ / DU-D は完了済（commit `2878136` 時点の shared 層 + composite FK migration 0014 適用済）
  - frontend/（旧 Tauri）は touched=NO 維持
  - web/ ↔ shared の結線（vite alias + tsconfig paths）は触らない（既達）
  - 本計画では **追加 DDL なし**
  - Notes/Daily の write path は legacy shared 経路を維持（DU-G で切替）
- **Non-goals**:
  - frontend/（旧 Tauri）の修正・削除
  - Routine 専用 Tag/Link UI（DF-Q2/Q3）
  - graph 可視化 UI（親 Q12 通り backlink list のみ）
  - MCP Server の WikiTag / Notes / Dailies ツール書き換え（MCP catch-up plan へ）
  - Notes/Daily の write path Unified 切替（DF-Q10 / DU-G に分離）
  - SupabaseNotesUnifiedService / SupabaseDailiesUnifiedService の機能拡張（DU-G）
  - shared Pattern A NotesUnified / DailiesUnified Provider + hook 新設（DU-G）
  - legacy noteMapper / dailyMapper の削除や deprecated 化（DF-Q6）
  - role 個別最適化 UI（DF-Q4）
  - 追加 DB migration
  - week ビューの復活（親 Q4）

---

## Scope (Touchable Paths)

```
# shared 側（WikiTagsUnified の export 追加のみ。Notes/Daily 系は触らない）
shared/src/index.ts                                      # WikiTagsUnifiedProvider + WikiTagsUnifiedContext + useWikiTagsUnifiedContext + WikiTag / WikiTagAssignment / WikiTagConnection / WikiTagGroup / WikiTagGroupAssignment 型 export 追加

# shared 側 CalendarTag 削除（DU-C+ 後送り）
shared/src/context/CalendarTagsContext.tsx               # 削除
shared/src/context/CalendarTagsContextValue.ts           # 削除
shared/src/context/index.ts                              # CalendarTags export 削除 + 新規 unified export 追加なし（DU-G）
shared/src/hooks/useCalendarTagsAPI.ts                   # 削除
shared/src/hooks/useCalendarTagsContext.ts               # 削除
shared/src/hooks/useCalendarTagsContextOptional.ts       # 削除
shared/src/services/calendarTagDefinitionMapper.ts       # 削除
shared/src/services/calendarTagAssignmentMapper.ts       # 削除
shared/src/types/calendarTag.ts                          # 削除（CalendarTag 型）

# web/ 側 Provider 配置（DU-C+ 後送り）
web/src/App.tsx                                          # WikiTagsUnifiedProvider 配置 + CalendarTagsProvider 削除（NoteProvider/DailyProvider は legacy のまま維持）
web/src/MainScreen.tsx                                   # CalendarTag 参照削除（schedule 周辺の filter UI に影響あり、置換 or 縮退）

# web/ 側 CalendarTag 死削除
web/src/schedule/CalendarTagsView.tsx                    # 削除
web/src/schedule/ScheduleItemsView.tsx                   # CalendarTag 参照削除 + Tag/Link UI 配置（Event 行）

# web/ 側 共通 Tag/Link UI コンポーネント（新規）
web/src/wikitag/TagPill.tsx                              # 新規（行末ピル表示）
web/src/wikitag/TagPicker.tsx                            # 新規（タグ選択 + 新規作成）
web/src/wikitag/LinkPanel.tsx                            # 新規（リンク作成 + backlink list）
web/src/wikitag/WikiTagsManagementView.tsx               # 新規（wiki_tag_groups CRUD + tag マスタ CRUD）
web/src/wikitag/index.ts                                 # 新規

# web/ 側 4 role に Tag/Link UI 配置
web/src/notes/NotesView.tsx                              # Tag/Link UI 配置（既存 legacy NoteContext 経由のまま、Tag/Link 部分のみ Unified 経由）
web/src/daily/DailyView.tsx                              # Tag/Link UI 配置（同上）
web/src/tasks/TaskTreeView.tsx                           # Tag/Link UI 配置（Task 行）

# 計画書 + 親計画書改訂
.claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md     # 本計画書
.claude/docs/vision/plans/2026-05-25-data-unification-g-notes-daily-unified.md # DU-G スケルトン新規（DU-F 完了時）
.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md            # 親計画書 DoD 達成宣言 + DU-G 行追加
.claude/2026-05-04-cross-platform-migration.md                                 # 移行 SSOT に Data Unification 完了記録追記
.claude/CLAUDE.md                                                              # §4.3 一行追記（composite FK pattern + Routine UX 変更）
```

スコープ外（=触らない）:

- `frontend/`（旧 Tauri 全体）
- `shared/src/services/notesUnifiedMapper.ts` / `dailiesUnifiedMapper.ts` / `SupabaseNotesUnifiedService.ts` / `SupabaseDailiesUnifiedService.ts`（DU-D 成果物、DU-G で活性化）
- `shared/src/services/noteMapper.ts` / `dailyMapper.ts`（legacy mapper、Notes/Daily の write path で現役）
- `shared/src/context/NoteContext.tsx` / `DailyContext.tsx`（legacy Provider、現役）
- `shared/src/hooks/useNotesAPI.ts` / `useDailyAPI.ts`（legacy hook、現役）
- `shared/src/services/SupabaseWikiTagsUnifiedService.ts`（DU-C+ 完了済、配線変更のみ）
- `supabase/migrations/`（追加 DDL なし）
- `calendars` テーブル + 関連 UI（フォルダフィルタ UI 保持、親 Q-Calendar / Q16）
- TipTap editor 本体
- 汎用 Database 機能 / Pomodoro / Audio / SidebarLinks / Template 等の touched=NO 領域
- MCP Server 32 ツール

スコープ外の変更が必要になった場合は、本計画書を更新してから手を付ける（更新せず広げない）。

---

## 採用アーキテクチャ

### Provider 順序の本 DU-F 完了時の形

App.tsx の Provider 順序差分（CalendarTagsProvider 削除 + WikiTagsUnifiedProvider 追加。Notes/Daily Provider は legacy のまま）:

```diff
ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock
  → ItemsMetaProvider                       ← DU-B で導入想定（必要に応じて確定）
    → TasksProvider                         ← DU-B 完了
    → EventsProvider                        ← DU-C 完了
    → RoutineProvider                       ← DU-C 完了
    → NoteProvider (legacy shared)          ← 維持（DU-G で NotesUnifiedProvider に切替）
    → DailyProvider (legacy shared)         ← 維持（DU-G で DailiesUnifiedProvider に切替）
+   → WikiTagsUnifiedProvider               ← 本計画で配置（DU-C+ で shared 側実装済）
- → CalendarTagsProvider                    ← 削除
  → Template → FileExplorer → Timer → Audio → ShortcutConfig → SidebarLinks
```

### Tag/Link UI の二重依存戦略

- 4 role の本体 UI（NotesView / DailyView / TaskTreeView / ScheduleItemsView）は **legacy Provider 経由で動作維持**
- Tag/Link 機能のみ `useWikiTagsUnifiedContext()` から取得（item_id は legacy の各 NodeNode.id を渡せば items_meta.id として通用 — 親 Q14 / Q3 / id 不変式により）
- これにより Tag/Link UI が legacy / Unified 切替の影響を受けない（DU-G で legacy → Unified に切替えても Tag/Link UI 側は再変更不要）

### 共通 Tag/Link UI コンポーネント設計

```
web/src/wikitag/
  ├── TagPill.tsx                # 行末ピル表示。タグ名 + color + 解除ボタン
  ├── TagPicker.tsx              # 既存タグ選択 + 新規タグ作成 UI
  ├── LinkPanel.tsx              # 詳細パネル: リンク先 item 選択 + backlink list 表示
  ├── WikiTagsManagementView.tsx # タグマスタ CRUD + wiki_tag_groups CRUD + group 割当
  └── index.ts
```

4 role すべてで同じ component を再利用:

- **Task 行 (TaskTreeView)**: 行末に TagPill 群、詳細展開時に TagPicker + LinkPanel
- **Event 行 (ScheduleItemsView)**: 同上（DU-C+ Step 5-6 として企画されていた配置）
- **Note 行 (NotesView)**: 同上、TipTap editor の外に詳細パネル
- **Daily ビュー (DailyView)**: 詳細パネル（ヘッダ近辺）+ メタ欄に TagPill

### Routine UX 変更の意味

- 親計画書では 5 role すべてで Tag/Link UI 想定だったが、**Routine は Event の生成テンプレートという立ち位置に再定義**
- Routine 専用 Tag/Link UI は実装しない
- Routine が Tag/Link を必要とする場合は、Routine から生成された Event が Tag/Link を持つ（生成時に Routine のテンプレ値を継承する設計は別計画で検討）
- データモデル上は `wiki_tag_assignments.item_id` は items_meta の任意の role を許容（routine も含む）。将来 Routine UI に Tag/Link を戻したくなった場合は UI 追加だけで対応可

---

## Steps（14 Step、v2 縮約版）

| #   | Step                                                                                                                                                              | Gate              | Acceptance                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | shared `index.ts` の export を WikiTagsUnified 系（Provider / Context / hook / 型）に拡張 + `shared/src/context/index.ts` も同期                                  | 🤖 自律           | shared `tsc -b` exit 0 / `cd web && npm run build` exit 0（既存 import は壊さない）                                                                                        |
| 2   | web/ App.tsx に WikiTagsUnifiedProvider を配置（NoteProvider/DailyProvider は legacy のまま、CalendarTagsProvider 削除）                                          | 🤖 自律           | `cd web && npm run build` exit 0 / Provider 順序が CLAUDE.md §6.2 と整合                                                                                                   |
| 3   | web/ MainScreen.tsx + ScheduleItemsView.tsx の CalendarTag 参照を削除（filter UI は縮退 or 削除）                                                                 | 🤖 自律 + 👀 目視 | web build exit 0 / CalendarTag filter なしで Schedule タブが動作                                                                                                           |
| 4   | web/ CalendarTagsView.tsx 削除                                                                                                                                    | 🤖 自律           | `git grep -E "CalendarTagsView" web/src` ヒット 0                                                                                                                          |
| 5   | shared 側 CalendarTag 関連 context / hook / mapper / type 削除 + `shared/src/index.ts` から CalendarTag export 削除                                               | 🤖 自律           | shared `tsc -b` exit 0 / web build exit 0 / `git grep -E "CalendarTagsContext\|CalendarTagsProvider\|useCalendarTagsAPI\|calendarTagDefinitionMapper" shared/src` ヒット 0 |
| 6   | web/ に共通 Tag/Link UI コンポーネント（TagPill / TagPicker / LinkPanel）新規実装                                                                                 | 🤖 自律           | web build exit 0 / 単体テスト緑（mock `useWikiTagsUnifiedContext`）                                                                                                        |
| 7   | Events タブ（ScheduleItemsView）に Tag/Link UI 配置（DU-C+ 後送り）                                                                                               | 🤖 自律 + 👀 目視 | Event 1 件作成 → Tag 付与 → 一覧で TagPill 表示 → Tag 解除 / Event から Task に Link 作成 → backlink list で逆方向確認                                                     |
| 8   | Tasks タブ（TaskTreeView）に Tag/Link UI 配置                                                                                                                     | 🤖 自律 + 👀 目視 | Task に Tag 付与・解除 / Task から Note に Link 作成 → backlink 確認                                                                                                       |
| 9   | Notes タブ（NotesView）に Tag/Link UI 配置（legacy NoteContext のまま、Tag/Link 部分のみ Unified 経由）                                                           | 🤖 自律 + 👀 目視 | Note に Tag 付与・解除 / Note から Event に Link 作成 → backlink 確認 / 既存 NotesView 機能（階層 DnD / TipTap / pin / password）が無影響                                  |
| 10  | Daily ビュー（DailyView）に Tag/Link UI 配置（同上）                                                                                                              | 🤖 自律 + 👀 目視 | Daily に Tag 付与・解除 / Daily から Note に Link 作成 → backlink 確認 / 既存 DailyView 機能（TipTap / 日付切替 / password）が無影響                                       |
| 11  | wiki_tag_groups CRUD UI 実装（WikiTagsManagementView）                                                                                                            | 🤖 自律 + 👀 目視 | グループ作成 / タグ → グループ割当 / グループ → タグ一覧表示 / グループ削除 が UI で動作                                                                                   |
| 12  | RLS gate スクリプト確認（wiki_tags 系 5 + notes_payload composite FK 適用後の状態）                                                                               | 🤖 自律           | RLS gate offender 0 / Supabase advisor lint 新規 WARN 0（既知 `auth_leaked_password_protection` のみ許容）                                                                 |
| 13  | 親計画書 DoD 達成宣言 + CLAUDE.md §4.3 一行追記（composite FK pattern + Routine UX 変更）+ 移行 SSOT に Data Unification 完了記録追記 + DU-G スケルトン計画書作成 | 🤖 自律           | 親計画書のチェックリスト全 ON / CLAUDE.md / 移行 SSOT / DU-G スケルトン diff レビュー OK                                                                                   |
| 14  | session-verifier → commit（pathspec 明示 stage）→ task-tracker END → role-qa（別コンテキスト、Agent 起動）→ PR 作成                                               | 🛑 人手           | role-qa APPROVE / PR レビュー & merge ボタン                                                                                                                               |

### Gate 凡例

- **🤖 自律** — Claude が完結。後追い検証（type check / test）で品質担保
- **👀 目視** — UI / 体感 / レイアウトでユーザー目視必須
- **🛑 人手** — DDL push / シークレット投入 / PR merge / 本番デプロイ

「人手」を減らすために減らさない。1 コマンドで通せる形に圧縮する。

---

## Acceptance Criteria（機械検証可能）

- [ ] `cd web && npm run build` exit 0（型エラー 0）
- [ ] `cd shared && npx vitest run` 全 pass（DU-D 完了時 174/174 緑から減少なし）
- [ ] `cd web && npx vitest run` 全 pass
- [ ] `git grep -E "CalendarTagsProvider|CalendarTagsView|useCalendarTags|useCalendarTagsAPI|calendarTagDefinitionMapper|calendarTagAssignmentMapper" web/src shared/src` ヒット 0
- [ ] Supabase `calendars` テーブル健在（フォルダフィルタ UI は機能切替により表示なしになるが、テーブルは保持）
- [ ] Supabase `wiki_tags` / `wiki_tag_groups` / `wiki_tag_group_assignments` / `wiki_tag_assignments` / `wiki_tag_connections` の 5 テーブル健在
- [ ] Supabase `calendar_tag_definitions` / `calendar_tag_assignments` 不在
- [ ] RLS gate スクリプト offender 0 / Supabase advisor lint 新規 WARN 0
- [ ] 4 role（Task / Event / Note / Daily）すべてで Tag 付与・解除・Link 作成・backlink 表示が動作（👀 目視）
- [ ] wiki_tag_groups CRUD UI が動作（👀 目視）
- [ ] 親計画書 `2026-05-21-data-unification-items-meta.md` DoD チェックリスト全 ON（DU-G への明示的な分離記述追加）
- [ ] CLAUDE.md §4.3 に composite FK pattern + Routine UX 変更の一行追記済
- [ ] 移行 SSOT に Data Unification レーン完了記録追記済
- [ ] DU-G スケルトン計画書 `2026-05-25-data-unification-g-notes-daily-unified.md` が `plans/` に存在
- [ ] frontend/ touched=NO 確認（`git diff main...HEAD -- frontend/` で本計画書範囲の変更 0）

---

## DB Migration Notes

**本計画では追加 DDL なし**（migration ファイル新規作成しない）。

- `wiki_tags` / `wiki_tag_groups` / `wiki_tag_group_assignments` / `wiki_tag_assignments` / `wiki_tag_connections` の 5 テーブルは DU-A の `0008` で作成済
- `calendar_tag_*` 2 テーブル DROP は DU-C+ の `0012` で完了済
- `notes_payload` composite FK は DU-D の `0014` で完了済
- RLS 4 policy × 13 テーブルは DU-A 時点で完備、initplan キャッシュ化は逐次完了

本計画は RLS gate スクリプト確認のみ（Step 12）。

---

## Risks & Mitigations

| ID  | リスク                                                                                  | レベル | 緩和策                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | shared `index.ts` の export 追加で web/ 側既存 import が壊れる                          | 高     | Step 1 で export 追加のみ（legacy export は完全維持）+ 即座に `cd web && npm run build` で検出                                          |
| R2  | CalendarTag 削除で Schedule の filter 機能が消えて UX 後退                              | 中     | Step 3 で filter なしで Schedule タブが動作することを 👀 目視確認 / 必要なら WikiTag filter に置き換える検討は DU-F 完了後の別計画      |
| R3  | Tag/Link UI が 4 role で「コピペ」になり保守コスト増                                    | 中     | 共通 component（TagPill / TagPicker / LinkPanel）を web/src/wikitag/ に集約 / role 固有差分は props で吸収                              |
| R4  | CalendarTag 削除段階で残存 import が build 破壊                                         | 高     | Step 3 → 4 → 5 の段階削除（UI → CalendarTagsView → shared）/ 各 Step で build 確認                                                      |
| R5  | wiki_tag_assignments の item_id が削除済 items_meta を参照（孤児行）                    | 中     | 0008 で `ON DELETE CASCADE` 既定 / soft-delete は SELECT 時に EXISTS フィルタ                                                           |
| R6  | wiki_tag_connections の自己リンク混入                                                   | 中     | 0008 で `CHECK (from_item_id <> to_item_id)` 既定 / UI 側でも対象選択時に self-id 除外                                                  |
| R7  | Routine UX 変更（Tag/Link UI を持たない）が既存ユーザー操作と衝突                       | 中     | 親計画書のユーザー検証段階で N=1（作者本人）合意済（DF-Q3）/ 将来 Routine UI に Tag/Link を戻す場合は UI 追加のみで対応可               |
| R8  | wiki_tag_groups UI が「使われずに死蔵」                                                 | 低     | DF-Q7 で必須化（親 DoD 項目）/ 実装後の golden path で動作確認                                                                          |
| R9  | RLS policy 抜けで他ユーザーのタグ / Link が見える                                       | 致命   | Step 12 の RLS gate スクリプトで全 13 テーブル offender 0 確認 / advisor lint 新規 WARN 0                                               |
| R10 | DU-C+ 計画書 archive 漏れの再発（DU-F 完了 task-tracker END での吸収忘れ）              | 中     | Step 14 commit 後の task-tracker END で本計画書 + DU-C+ 計画書を明示 archive 対象に列挙                                                 |
| R11 | frontend/ 変更が誤って混入                                                              | 中     | Step 14 commit 前に `git status -- frontend/` で確認 / pathspec 明示 stage / Acceptance で `git diff main...HEAD -- frontend/` 0 確認   |
| R12 | DU-G が「ずっと後送り」になる                                                           | 中     | Step 13 で DU-G スケルトン計画書を物理ファイルとして配置 + 親計画書に DU-G 行を追加 / memory/chat-main.md の「予定」に DU-G を昇格      |
| R13 | Tag/Link UI が legacy NoteContext / DailyContext と Unified Provider に二重依存して混乱 | 中     | 4 role の UI 本体は legacy のまま、Tag/Link 部分のみ `useWikiTagsUnifiedContext()` を呼ぶ。DU-G で legacy 側を Unified に揃える際に整理 |
| R14 | wiki_tag_groups の UNIQUE(tag_id, group_id) 違反でユーザー操作エラー                    | 低     | 0008 で `WHERE is_deleted=false` partial UNIQUE 既定 / UI 側で重複追加時にトーストで明示                                                |

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` で類似事例を確認
- 新規 known issue 候補（DU-F 完了時に docs/known-issues/ へ移送）:
  - 「shared `index.ts` の export 拡張時の legacy 共存パターン」
  - 「4 role 共通 Tag/Link UI コンポーネントの設計指針」（TagPill / TagPicker / LinkPanel の再利用パターン）
  - 「Routine を Event の一形態として UX 設計する場合の Tag/Link スコープ判断」（DF-Q2/Q3）
  - 「legacy Provider と Unified Provider の Tag/Link 二重依存パターン」（R13）

---

## References

- vision: `.claude/docs/vision/db-conventions.md`（payload mapper 規約 / RLS パターン / composite FK パターン / DU-B DB-Q2/Q3）/ `.claude/docs/vision/coding-principles.md`（Pattern A / Provider 順序）
- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（DU-F 行 + DoD + Q14 + DB-Q3）
- 前フェーズ:
  - `.claude/docs/vision/plans/2026-05-24-data-unification-c-plus-events-tags.md`（DU-C+ scope-reduced、本計画完了時に同時 archive）
  - `.claude/archive/2026-05-24-data-unification-d-notes-daily.md`（DU-D scope-reduced）
- 後続フェーズ: `.claude/docs/vision/plans/2026-05-25-data-unification-g-notes-daily-unified.md`（DU-G スケルトン、本計画 Step 13 で作成）
- DU-B 実績: `.claude/archive/2026-05-23-data-unification-b-tasks.md`（composite FK + re-export レイヤー実装パターン）
- related skills: `add-component`（Provider 追加パターン）/ `life-editor-migration-validator`（3 系統整合監査）/ `life-editor-sync-auditor`（sync 区分判定）/ `frontend-react-designer`（UI デザイン判断）

---

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。完了後に Known Issue 化すべき知見はここから `docs/known-issues/` へ移送。

- **2026-05-24** — v2 リビジョン: v1 計画書 22 Step で Step 1-8 を着手しようとした時点で、`SupabaseNotesUnifiedService` が DU-D scope-reduced により最小 CRUD 6 メソッドのみ（folder / password / lock / syncTree / restore / permanentDelete が未実装）であることが判明。Notes/Daily 完全 Unified 切替は DU-G に分離。本計画は WikiTag/Link UI + CalendarTag 死削除 + wiki_tag_groups UI + 親 DoD 達成宣言に集中（Step 数 22 → 14、L 規模）
- **2026-05-24 (Step 14 実機検証時)** — 隠れた前提崩れが顕在化:
  - 想定: Notes/Daily の legacy write path は安定動作中 → 触らない
  - 実態: migration 0007 で `public.notes` / `public.dailies` が DROP 済 → legacy `SupabaseNotesService` / `SupabaseDailyService` は **`_pendingDuRewrite` stub error** を throw（書き込み完全停止 / リロードで消える）
  - 二次被害: `wiki_tag_assignments` INSERT policy が `exists (select 1 from items_meta where id = item_id)` を要求するため、Notes/Daily の id が items_meta に登録されない → Tag/Link UI が RLS 403
  - **スコープ拡張で対応**: 既存 legacy class を変えずに、コンストラクタに Unified service 参照を渡して **bridge delegate** する形に最小改修（`fetchAllNotes` / `createNote` / `createNoteFolder` / `updateNote` / `syncNoteTree` / `softDeleteNote` / `fetchAllDailies` / `fetchDailyByDate` / `upsertDaily` / `deleteDaily` / `toggleDailyPin`）。`useNotesAPI` / `useDailyAPI` の UI surface は不変、書き込みのみ items_meta + payload に流す
  - **未対応（DU-G 残置）**: password / lock / restore / permanentDelete / fetchDeletedNotes / searchNotes は依然 stub or 空配列。UI 上は trash 空 + パスワード dialog 触ると throw（UI から触らなければ無害）。これにより Notes/Daily の write path が完全 Unified に揃うのは DU-G で実施
