# MEMORY (chat-materials-refine)

## 進行中

### 🔧 life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: Issue #225 起票（type:task + shared-fix）。Supabase 本番を read-only SQL で実測（active folder = tasks 3 + notes 2・全ルート直下・calendars 0 行・タグ名衝突 0・user 2 名義）。計画書へ Step 2 詳細設計を追記（平坦化 = 直近 folder 名のみ・変換 migration + 検証クエリ + rollback 設計・S1/S2/S3 ステージング）し Status → IN PROGRESS。schedule-refine へ outbox で S2（CalendarView の folder バインド置換）合意依頼
- 現在: Step 2 設計 PR 提出
- 次: S1 実装（Kanban 2 ビュー化 + viewModeStorage legacy 変換 + Notes タグ見出しグルーピング + 変換 migration ファイル・NodeType は温存）— v2 共通部品 merge 後。S3（NodeType folder 除去）は schedule-refine の S2 合意後のみ

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
