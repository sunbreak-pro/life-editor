# MEMORY (chat-materials-refine)

## 進行中

### 🔧 #118 Notes/Daily パスワードハッシュ化 + #181 materials 行消化（着手日: 2026-07-11）

**対象**: `shared/src/services/SupabaseNotesUnifiedService.ts` `shared/src/services/SupabaseDailiesUnifiedService.ts` `shared/src/utils/passwordHash.ts`（新設）
**計画書**: `.claude/docs/vision/plans/2026-07-11-notes-daily-password-hashing.md`（orders: `2026-07-11-materials-refine-orders.md`）

- 前回: #181 materials 行消化（実測 → チェック + コメント済み）。#118 実装完了（PBKDF2 + lazy rehash・security-review / role-qa PASS / sync-auditor Blocking 0・790 tests 緑）
- 現在: draft PR #195 提出 → ユーザーレビュー待ち（🛑 merge = 人手）。merge 時に Issue #118 が auto-close
- 次: merge 後に plan COMPLETED + archive 移動。以降は v2 adoption（部品 merge 待ち）・life-tags レビュー（合図待ち）

### ⏸️ Layout Standard v2 adoption（materials・#203 依存待ち）（着手日: 2026-07-11）

**対象**: `web/src/tasks/**` `web/src/notes/**` `web/src/daily/**` `web/src/wikitag/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-materials-refine-orders.md`（親: `2026-07-11-layout-standard-v2.md` / Issue #207）

- 前回: —
- 現在: adoption Issue #207 起票（section:materials）+ #203（layout-standard 全幅化 shell）へ「notes/daily は fluid 希望」を outbox 送付 + notes/daily/tags の reading 前提コメントに素の全幅移行意図を先行明記。方針=素の全幅（ユーザー決定）。**#203 未着手 = 依存待ち**
- 次: #203 merge 後に各サブタブの全幅表示確認 + コメント確定 → #207 チェックリスト消化 → close

## 直近の完了

- Notes/Tasks レイアウト反転（PR #189 merge 済み）✅（2026-07-11）

## 予定

- life-tags 詳細設計レビュー参加（兄弟計画 Step 2・合図待ち）
