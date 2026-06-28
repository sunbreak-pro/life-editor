# MEMORY (chat-db-hardening)

## 進行中

### 🔧 DB hardening — data 層監査 + cleanup（着手日: 2026-06-28）

**対象**: `shared/src/services/`, `cloud/`, `supabase/migrations/`

- 前回: relation-mapper dedup (256d0ad4)
- 現在: RLS 本番実適用チェック完了 — 全 20 public テーブルで RLS ON + 4 ポリシー、無効/0 ポリシー 0 件。Critical 解消
- 次: cleanup 着手判断待ち（V1 cohort 撤去は要承認）

## 直近の完了

- RLS 本番実適用チェック ✅（2026-06-28, 全20テーブル RLS ON+4policy / advisor ERROR 0・WARN 1）
- relation-mapper soft-delete dedup + コメント訂正 ✅（2026-06-28, 256d0ad4）
- data 層 3観点監査（security / 可読性 / 重複）✅（2026-06-28）

## 予定

- dead code 撤去: 旧 V1 mapper cohort（多ファイル協調・要承認）
- 重複集約: meta+payload join / getUserId / nextVersion（任意）
- cloud/(D1) 退役判断（Phase 5・SSOT 改訂事項）
- Auth: 漏洩パスワード保護 ON（ダッシュボード・軽微・任意）
