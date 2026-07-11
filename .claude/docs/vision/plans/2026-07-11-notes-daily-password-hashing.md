---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/materials-refine
Owner-chat: materials-refine
Issue: #118
Parent: 2026-07-11-materials-refine-orders.md
---

# Plan: Notes / Daily password の plaintext → PBKDF2 ハッシュ化（#118）

## Context

- **動機**: `notes_payload.password_hash` / `dailies_payload.password_hash` が plaintext 保存 + plaintext eq 照合（Issue #118 / 旧 known-issues 027）。N>1 化の前ゲート必須項目
- **方式決定: Web Crypto API（PBKDF2-HMAC-SHA256）による client-side ハッシュ化**
  - Issue 提示の 2 案のうち Edge Function + `pgcrypto.crypt()` 案は不採用: デプロイ資産が増える・オフライン（Electron ローカル）で検証不能になる・コスト $0 方針と不整合
  - `crypto.subtle` は Web / Electron renderer / Capacitor WebView / Node 18+（vitest）すべてで追加依存ゼロ
- **制約**: DataService 境界内で完結（UI 変更なし）。DDL 変更なし（`has_password generated always as (password_hash is not null)` はハッシュ文字列でも真を維持）。Notes + Daily 両経路を一括対応（片方だけ直さない — Issue の指示）
- **Non-goals**: Edit lock 経路の変更 / password UI の変更 / RLS・SELECT shape の変更（既存 mitigation は維持）

## 保存形式

`password_hash` text 列に自己記述形式で保存（列名・型は不変）:

```
pbkdf2$v1$<iterations>$<salt(base64)>$<hash(base64)>
```

- iterations = 600,000（OWASP 2023 推奨・形式内に持つので後から引き上げ可能）
- salt = 16 bytes（`crypto.getRandomValues`）/ hash = 32 bytes（SHA-256 出力長）

## 既存データ移行（lazy rehash）

- verify 時に stored 値が `pbkdf2$` 形式でなければ **legacy plaintext** とみなし plaintext eq で照合
- **照合成功時にその場で PBKDF2 形式へ書き換え**（lazy rehash・items_meta bump 込み）。rehash の書き込み失敗は verify の成否に影響させない（best-effort・次回 unlock で再試行される）
- Issue 本文の「rehash 不可・再設定必須」は hash-only 前提の記述で、現状は plaintext が残っているため照合成功時点で正しい平文を持っており lazy rehash が可能（失効通知フローは不要）
- 経路: verify（unlock / remove の前段）を通れば自動移行。通らない古いパスワードは plaintext のまま残るが、N=1 の現状で全 note/daily は本人が unlock するため実質全件移行される

## Sync（2 行分割モデル）への影響

- set / remove は既存どおり `items_meta.updated_at` + `version` bump → LWW 伝播（変更なし）
- lazy rehash も同じ bump 手順を踏む（payload 単独更新をしない — DB-Q2 遵守）
- payload に `updated_at` を追加しない / SELECT shape（`*_PAYLOAD_COLUMNS`）は不変
- 実装後に `life-editor-sync-auditor` で監査する

## Steps

1. [ ] `shared/src/utils/passwordHash.ts` 新設: `hashPassword(password): Promise<string>` / `verifyPassword(password, stored): Promise<{ok: boolean, needsRehash: boolean}>`（形式 parse・legacy fallback・定数時間比較）+ 単体テスト
2. [ ] `SupabaseNotesUnifiedService`: set = hash して保存 / verify = verifyPassword + legacy 一致時 lazy rehash / remove = 変更なし（verify 経由）。SECURITY DEBT コメント・JSDoc を更新
3. [ ] `SupabaseDailiesUnifiedService`: 同上
4. [ ] 既存テスト更新（plaintext eq 前提のブロック）+ lazy rehash の回帰テスト追加
5. [ ] `shared` build/test + `web` build pass → sync-auditor 監査 → Issue #118 コメント・close は PR merge 後（🛑 人手）

## Files

| File | Operation | Notes |
| --- | --- | --- |
| `shared/src/utils/passwordHash.ts` | create | PBKDF2 helper + 形式 parse |
| `shared/src/utils/passwordHash.test.ts` | create | 単体テスト |
| `shared/src/services/SupabaseNotesUnifiedService.ts` | edit | set/verify 経路 + lazy rehash |
| `shared/src/services/SupabaseDailiesUnifiedService.ts` | edit | 同上 |
| `shared/src/services/SupabaseNotesUnifiedService.test.ts` | edit | plaintext 前提テストの置換 |
| `shared/src/services/SupabaseDailiesUnifiedService.test.ts` | edit | 同上 |

## Verification

- [ ] `cd shared && npm run build && npm run test` pass
- [ ] `cd web && npm run build` pass
- [ ] 新規: hash → verify 往復 / 誤パスワード false / legacy plaintext 照合 + lazy rehash 発火 / rehash 失敗時も verify 成功
- [ ] `life-editor-sync-auditor` で bump 漏れなしを確認
