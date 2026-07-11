# MEMORY (chat-materials-refine)

## 進行中

### 🔧 life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: S3 実装完了（NodeType folder 除去・isLegacyFolderRow fetch 除外・i18n/docs sweep・新規テスト 2 本）。855 tests + build + lint green・role-qa PASS・sync-auditor Blocking 0
- 現在: S3 PR 提出（Closes #225）。merge = こうだいさん操作・merge 後の実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換（ユーザー `supabase db push` 0020 + 0021 + verify.sql・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

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
