# MEMORY (chat-materials-refine)

## 進行中

### 🔧 #118 Notes/Daily パスワードハッシュ化 + #181 materials 行消化（着手日: 2026-07-11）

**対象**: `shared/src/services/SupabaseNotesUnifiedService.ts` `shared/src/services/SupabaseDailiesUnifiedService.ts` `shared/src/utils/passwordHash.ts`（新設）
**計画書**: `.claude/docs/vision/plans/2026-07-11-notes-daily-password-hashing.md`（orders: `2026-07-11-materials-refine-orders.md`）

- 前回: —
- 現在: #181 materials 行の再実測完了（ハードコードは #189 で撤去済み・build/test 再検証中）。#118 の方式計画確定（Web Crypto PBKDF2 client-side + lazy rehash・DDL 不要）
- 次: role-engineer で #118 実装 → sync-auditor 監査 → #181 の materials 行チェック + コメント

## 直近の完了

- Notes/Tasks レイアウト反転（PR #189 merge 済み）✅（2026-07-11）

## 予定

- Layout Standard v2 adoption（v2 共通部品 merge 待ち — 幅タブのサブタブ扱いは layout-standard と outbox 調整）
- life-tags 詳細設計レビュー参加（兄弟計画 Step 2・合図待ち）
