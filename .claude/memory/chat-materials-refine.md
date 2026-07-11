# MEMORY (chat-materials-refine)

## 進行中

### 🔧 life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: S1 実装完了（role-engineer 3 レーン並列: Kanban 2 ビュー化 + viewModeStorage legacy "folder"→"tag" 自己修復 + TaskAddDialog task 専用化 + Complete-folder 自動管理退役 / Notes タグ見出しグルーピング + useNoteTagDnd / migration 0020 + verify.sql + rollback）。shared 851 tests + web build green。監査 role-qa PASS・migration-validator / sync-auditor Blocking 0・Nit 反映済み
- 現在: S1 PR 提出（migration 0020 の実行 = 🛑 ユーザー `supabase db push` + verify.sql BEFORE/AFTER。CalendarView の folder select が空になるため S2 と同期実行を推奨）
- 次: schedule-refine の S2（CalendarView folder バインド置換）合意・完了待ち → S3（NodeType folder 除去 + mapper / analytics / connect / i18n / docs sweep + applyStatusChange DONE 沈み reorder のユニットテスト追加）

### ⏸️ Layout Standard v2 adoption（materials・#203 依存待ち）（着手日: 2026-07-11）

**対象**: `web/src/tasks/**` `web/src/notes/**` `web/src/daily/**` `web/src/wikitag/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-materials-refine-orders.md`（親: `2026-07-11-layout-standard-v2.md` / Issue #207）

- 前回: —
- 現在: adoption Issue #207 起票（section:materials）+ #203（layout-standard 全幅化 shell）へ「notes/daily は fluid 希望」を outbox 送付 + notes/daily/tags の reading 前提コメントに素の全幅移行意図を先行明記。方針=素の全幅（ユーザー決定）。**#203 未着手 = 依存待ち**
- 次: #203 merge 後に各サブタブの全幅表示確認 + コメント確定 → #207 チェックリスト消化 → close

## 直近の完了

- #118 Notes/Daily パスワードハッシュ化 + #181 materials 行消化（PR #195 merge 済み・plan archive 済み）✅（2026-07-11）
- Notes/Tasks レイアウト反転（PR #189 merge 済み）✅（2026-07-11）

## 予定

- （なし）
