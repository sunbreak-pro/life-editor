# MEMORY (chat-db-hardening)

## 進行中

### 🔧 DB hardening — data 層監査 + cleanup（着手日: 2026-06-28）

**対象**: `shared/src/services/`, `cloud/`, `supabase/migrations/`

- 前回: RLS 本番チェック (58043703)・relation-mapper dedup (256d0ad4)
- 現在: data 層 hardening 一式を **PR #109 で push 済**（relation/V1 mapper dedup + getUserId + RLS 検証記録・🛑 merge はユーザー）
- 次: cloud(D1) 退役は判断保留（Phase 5 + docs SSOT 改訂事項）／ Auth 漏洩PW保護 ON は要明示承認

## 直近の完了

- V1 mapper cohort 撤去 + getUserId 集約 ✅（2026-06-28, e1e1a730, -287/+54）
- RLS 本番実適用チェック ✅（2026-06-28, 全20テーブル RLS ON+4policy / advisor ERROR 0・WARN 1）
- relation-mapper soft-delete dedup + コメント訂正 ✅（2026-06-28, 256d0ad4）

## 予定

- 本ブランチ push → PR（4 commit: relation-mapper / RLS tracker / V1-cohort）
- cloud/(D1) 退役判断（Phase 5・docs SSOT 改訂事項。db レーン単独では着手しない）
- nextVersion 集約は見送り済（Calendars/NotesUnified で table/filter/nullability が異なる）
- Auth: 漏洩パスワード保護 ON（本番設定変更・要明示承認 or ダッシュボード手動）
