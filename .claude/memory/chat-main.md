# MEMORY (chat-main)

## 進行中

### 🔧 DU-D Notes role + Daily 移植（着手日: 2026-05-24、SCOPE-REDUCED）

**対象**: `supabase/migrations/0014_notes_payload_parent_fk.sql` / `shared/src/services/{notesMapper,dailiesMapper,SupabaseDataService}.ts`
**計画書**: `.claude/docs/vision/plans/2026-05-24-data-unification-d-notes-daily.md`

- 前回: DU-C+ scope-reduced 完了（shared 層 + DB migration のみ commit 済）
- 現在: shared notes/dailies mapper 着手前。frontend↔shared 統合は DU-F 後送り（DU-C+ 同型問題）
- 次: shared notes/dailies mapper + SupabaseDataService Notes/Daily Unified メソッド + composite FK migration 0014 作成 → ユーザー db push → commit

## 直近の完了

- DU-C+ scope-reduced 完了（DB migration 0012 + shared 層 WikiTag mapper/service/hook/Provider + 単体テスト 18 緑。Events UI / NoteProvider 置き換えは frontend↔shared 統合未達のため DU-F に統合）✅（2026-05-24）
- DU-C 全 7 ステップ完了（Routines + RoutineGroups + Assignments + ScheduleItems 全 Service 本実装 + RoutineScheduleSync 復活 + 0011 migration 本番適用）✅（2026-05-24）
- 並行作業基盤強化（Stop hook + Plan Gate Convention + 計画書テンプレ + CLAUDE.md §7.3）✅（2026-05-24）

## 予定

- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- DU-E Calendar 2 ビュー再実装（DU-D 完了後）
- DU-F WikiTag/WikiLink 残り 4 role UI + wiki_tag_groups UI（DU-C+ + DU-D 完了後）
- CLAUDE.md §4.3 一行追記（composite FK pattern。並行チャットの CLAUDE.md 編集完了同期後）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
