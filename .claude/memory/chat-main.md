# MEMORY (chat-main)

## 進行中

### 🔧 DU-F WikiTag/Link UI 4 role + CalendarTag 死削除 + 親 DoD 達成（着手日: 2026-05-24）

**対象**: `shared/src/context/` + `shared/src/hooks/` + `shared/src/index.ts` + `web/src/{App,MainScreen,notes,daily,tasks,schedule,wikitag}/` + `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md` (親計画書 DoD) + `.claude/CLAUDE.md` §4.3 + `.claude/2026-05-04-cross-platform-migration.md` (移行 SSOT)
**計画書**: `.claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md`

- 前回: —
- 現在: 計画書ドラフト完了・承認済。Step 1 (shared NotesUnified/DailiesUnified Pattern A Provider 新設 + hook + 単体テスト) 着手準備
- 次: Step 2 (shared index.ts export 拡張: WikiTagsUnified + NotesUnified + DailiesUnified) / Step 3 (legacy mapper に deprecated コメント)

## 直近の完了

- Anthropic Cloud Routine 2 本セットアップ（朝の歴史学習 + 帰宅時モバイル開発準備）✅（2026-05-24）
- DU-D Notes role + Daily 移植（scope-reduced）✅（2026-05-24）
- .claude/ 配下整理（vision/plans 精査で point-view + phase5 削除 / 学習教材 code-explanation・code-examples 削除 / 残骸 LearningRoadmap・note-summaries・HISTORY-archive.bak・code-inventory 削除 / instructions の単発指示書を archive 移動）✅（2026-05-24）

## 予定

- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- DU-G Notes/Daily Unified 完全切替（SupabaseNotesUnifiedService 機能拡張 + Provider 切替 + UI 動作確認。DU-F Step 13 でスケルトン作成）
- DU-E Calendar 2 ビュー再実装（DU-F / DU-G 完了後）
- CLAUDE.md §4.3 一行追記（composite FK pattern + Routine UX 変更。DU-F Step 13 で実施）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
