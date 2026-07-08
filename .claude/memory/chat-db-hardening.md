# MEMORY (chat-db-hardening)

## 進行中

（なし）

## 直近の完了

- [chat-db-hardening] **DB hardening — data 層監査 + cleanup 一式** ✅（**PR #109 merged 2026-06-28**。2026-07-08 cross-lane 同期で完了化）— relation/V1 mapper dedup + getUserId 集約 + RLS 検証記録
- V1 mapper cohort 撤去 + getUserId 集約 ✅（2026-06-28, e1e1a730, -287/+54）
- RLS 本番実適用チェック ✅（2026-06-28, 全20テーブル RLS ON+4policy / advisor ERROR 0・WARN 1）
- relation-mapper soft-delete dedup + コメント訂正 ✅（2026-06-28, 256d0ad4）

## 予定

- cloud/(D1) 退役判断（Phase 5・docs SSOT 改訂事項。db レーン単独では着手しない — なお cloud/ 自体は 2026-06-28 に先行撤去済み）
- nextVersion 集約は見送り済（Calendars/NotesUnified で table/filter/nullability が異なる）
- Auth: 漏洩パスワード保護 ON（本番設定変更・要明示承認 or ダッシュボード手動）
