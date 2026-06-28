# MEMORY (chat-db-hardening)

## 進行中

### 🔧 DB hardening — data 層監査 + cleanup（着手日: 2026-06-28）

**対象**: `shared/src/services/`, `cloud/`, `supabase/migrations/`

- 前回: —
- 現在: relation-mapper dedup 完了 (256d0ad4)。RLS 本番実適用チェックは PAT 失効 (HTTP 401) でブロック
- 次: 有効 `SUPABASE_ACCESS_TOKEN` 取得 → RLS 実適用チェック（get_advisors + pg_policies）

## 直近の完了

- relation-mapper soft-delete dedup + コメント訂正 ✅（2026-06-28, 256d0ad4）
- data 層 3観点監査（security / 可読性 / 重複）✅（2026-06-28）

## 予定

- RLS 本番実適用チェック（有効 PAT 待ち・**Critical**）
- dead code 撤去: 旧 V1 mapper cohort（多ファイル協調・要承認）
- 重複集約: meta+payload join / getUserId / nextVersion（任意）
- cloud/(D1) 退役判断（Phase 5・SSOT 改訂事項）
