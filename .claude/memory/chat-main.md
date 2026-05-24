# MEMORY (chat-main)

## 進行中

### 🔧 DU-F WikiTag/Link UI 4 role + CalendarTag 死削除 + 親 DoD 達成（着手日: 2026-05-24）

**対象**: `shared/src/{context,hooks,services}/` + `web/src/{App,MainScreen,notes,daily,tasks,schedule,wikitag}/` + `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md` (親計画書 DoD) + `.claude/CLAUDE.md` §4.3 + `.claude/2026-05-04-cross-platform-migration.md` (移行 SSOT)
**計画書**: `.claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md` (v2 / B スコープ縮約)

- 前回: Step 1-5 完了 commit `074ec53` (WikiTagsUnifiedProvider 配置 + CalendarTag 死削除)
- 現在: **Step 6-13 + Notes/Daily 永続化 fix 実装完了 + 全検証緑** (shared tsc 0 / web build 0 / shared vitest 170/170 / RLS gate offender 0 / advisor lint 新規 WARN 0 / CalendarTag 文字列 grep ヒット 0 / frontend/ touched 0)
- 次: 👀 実機再確認（Notes/Daily 編集 → リロード → 残ること / 4 role Tag 付与 RLS 403 解消）→ OK なら 🛑 Step 14 commit + role-qa + PR

#### Step 14 実機検証で顕在化した追加 fix (2026-05-24)

- **隠れた前提崩れ**: migration 0007 で `public.notes` / `public.dailies` が DROP 済 → legacy `SupabaseNotesService` / `SupabaseDailyService` が stub error throw → Notes/Daily 書き込み停止 / リロードで消える
- **二次被害**: `wiki_tag_assignments` の RLS WITH CHECK は `items_meta` に item_id 存在を要求 → legacy 経路では items_meta に登録されず → Notes/Daily の Tag/Link が RLS 403
- **対応 (scope expansion)**: legacy class のコンストラクタに Unified service 参照を渡し、`fetchAllNotes` / `createNote` / `createNoteFolder` / `updateNote` / `syncNoteTree` / `softDeleteNote` / `fetchAllDailies` / `fetchDailyByDate` / `upsertDaily` / `deleteDaily` / `toggleDailyPin` を bridge delegate
- **未対応 (DU-G 残置)**: password / lock / restore / permanentDelete / fetchDeletedNotes / searchNotes は依然 stub or 空配列。trash 空表示 + password dialog 押下で throw（UI から触らなければ無害）

#### Step 6-13 で達成した内容

- Step 6: `web/src/wikitag/{TagPill,TagPicker,LinkPanel,index}.tsx` 新規 — 4 role 共通の Tag/Link UI
- Step 7-10: ScheduleItemsView / TaskTreeView / NotesView / DailyView に `<TagPicker itemId>` + `<LinkPanel itemId>` 配置（legacy host context 不変、Tag/Link 部分のみ `useWikiTagsUnifiedContext()` 経由）
- Step 11: `SupabaseWikiTagsUnifiedService` + `useWikiTagsUnifiedAPI` + `DataService` interface に `wiki_tag_groups` / `wiki_tag_group_assignments` の 7 メソッド追加。`web/src/wikitag/WikiTagsManagementView.tsx` 新規。MainScreen に "tags" セクション追加
- Step 12: Supabase MCP advisor + RLS テーブル確認 → `wiki_tags` / `wiki_tag_groups` / `wiki_tag_group_assignments` / `wiki_tag_assignments` / `wiki_tag_connections` 5 テーブル全て RLS enabled + 4 policy。`calendar_tag_*` 2 テーブル不在確認
- Step 13: 親計画書 DoD 達成宣言 (5 role tag/link graph 稼働 + CalendarTag 概念消滅 + wiki_tag_groups CRUD) / CLAUDE.md §4.3 に composite FK pattern + Routine UX 一行追記 / 移行 SSOT に Data Unification レーン完了記録追記 / DU-G スケルトン (`2026-05-25-data-unification-g-notes-daily-unified.md`) 作成 / CalendarTag stale comment 一掃

## 直近の完了

- DU-F Step 1-5: WikiTagsUnifiedProvider 配置 + CalendarTag 死削除 ✅（2026-05-24 commit `074ec53`）
- subagent self-contained brief 規約 + worktree integrity 改善（PR #22 draft）✅（2026-05-24）
- Anthropic Cloud Routine 2 本セットアップ（朝の歴史学習 + 帰宅時モバイル開発準備）✅（2026-05-24）

## 予定

- ✅ DU-F Step 7-11 + Notes/Daily 永続化 fix 実機確認 OK (リンク + データ保存 動作確認済) — Step 14 commit 待ち
- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- 🛑 DU-F 完了 commit 時に DU-C+ + DU-F 両計画書を同時 archive（DF-Q8）
- DU-G Notes/Daily Unified 完全切替（SupabaseNotesUnifiedService 機能拡張 + Provider 切替 + UI 動作確認。スケルトン作成済 `2026-05-25-data-unification-g-notes-daily-unified.md`）
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン作成済 `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立に進められる
- DU-E Calendar 2 ビュー再実装（DU-F / DU-G 完了後）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
