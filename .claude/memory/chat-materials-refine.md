# MEMORY (chat-materials-refine)

## 進行中

### 🔧 #118 Notes/Daily パスワードハッシュ化 + #181 materials 行消化（着手日: 2026-07-11）

**対象**: `shared/src/services/SupabaseNotesUnifiedService.ts` `shared/src/services/SupabaseDailiesUnifiedService.ts` `shared/src/utils/passwordHash.ts`（新設）
**計画書**: `.claude/docs/vision/plans/2026-07-11-notes-daily-password-hashing.md`（orders: `2026-07-11-materials-refine-orders.md`）

- 前回: #181 materials 行消化（実測 → チェック + コメント済み）。#118 実装完了（PBKDF2 + lazy rehash・security-review / role-qa PASS / sync-auditor Blocking 0・790 tests 緑）
- 現在: draft PR #195 提出 → ユーザーレビュー待ち（🛑 merge = 人手）。merge 時に Issue #118 が auto-close
- 次: merge 後に plan COMPLETED + archive 移動。以降は v2 adoption（部品 merge 待ち）・life-tags レビュー（合図待ち）

## 直近の完了

- Notes/Tasks レイアウト反転（PR #189 merge 済み）✅（2026-07-11）

## 予定

- Layout Standard v2 adoption（v2 共通部品 merge 待ち — 幅タブのサブタブ扱いは layout-standard と outbox 調整）
- life-tags 詳細設計レビュー参加（兄弟計画 Step 2・合図待ち）
