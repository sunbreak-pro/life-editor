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

### parse 検証則（security-review 2026-07-11 反映）

self-describing format を無検証で信じない:

- verify 時、stored 値の **iterations は許容レンジ [100,000, 1,000,000] でレンジ検証（clamp ではなく reject）** — 範囲外・数字以外の混入は即 `ok: false`（毒値による PBKDF2 フリーズ = DoS の遮断）
- salt はデコード後 **厳密 16 bytes** / hash は **厳密 32 bytes** — 外れたら `ok: false`
- **`pbkdf2$` prefix があるのに parse / 検証が通らない値（malformed）は plaintext eq に fallback しない**（downgrade 経路の遮断）— `ok: false` で終わる
- 含意: legacy 平文パスワードが偶然 `pbkdf2$` で始まる場合はロックアウトになる（確率は無視できる水準・境界仕様としてテストで固定）

## 既存データ移行（lazy rehash）

- verify 時に stored 値が `pbkdf2$` prefix を持たなければ **legacy plaintext** とみなし plaintext eq で照合
- **照合成功時にその場で PBKDF2 形式へ書き換え**（lazy rehash）。書き込み失敗は verify の成否に影響させない（best-effort・次回 unlock で再試行される）
- **rehash は payload 単独 UPDATE（items_meta bump なし）— DB-Q2 の意図的例外**: `password_hash` は全 `*_PAYLOAD_COLUMNS` SELECT shape から除外されており sync 面に存在しない（verify は常にクラウド行を単一列 SELECT で直読み・クライアント側キャッシュなし）ため、LWW 伝播が不要。bump すると「unlock して閲覧しただけでノートが一覧先頭に飛ぶ」副作用が出る（一覧は `updated_at DESC` ソート） うえ、meta + payload の 2 文書き込みで非原子性も生む。payload 単独なら 1 文で原子的
- Issue 本文の「rehash 不可・再設定必須」は hash-only 前提の記述で、現状は plaintext が残っているため照合成功時点で正しい平文を持っており lazy rehash が可能（失効通知フローは不要）
- 経路: verify（unlock / remove の前段）を通れば自動移行。**lazy 単独では「平文ゼロ」の完了保証はない** — 下記 N>1 前ゲートで機械検証する

### N>1 化の前ゲート（移行完了の機械検証）

友達ビルド / N>1 化の直前に、平文残留ゼロを SQL で確認する（本 Issue close 時に N>1 側チェックリストへ転記）:

```sql
select count(*) from notes_payload   where password_hash is not null and password_hash not like 'pbkdf2$%';
select count(*) from dailies_payload where password_hash is not null and password_hash not like 'pbkdf2$%';
```

両方 0 でなければ、残存行の再設定（または棚卸しスクリプト）を済ませてから N>1 に進む。

## Sync（2 行分割モデル）への影響

- set / remove は既存どおり `items_meta.updated_at` + `version` bump → LWW 伝播（`has_password` 生成列の変化を配るため必要・変更なし）
- lazy rehash のみ payload 単独 UPDATE（理由は上記 — sync 面外の列・`has_password` は真のまま不変）。この例外の妥当性は実装後に `life-editor-sync-auditor` で監査する
- payload に `updated_at` を追加しない / SELECT shape（`*_PAYLOAD_COLUMNS`）は不変

## Residual risk（本計画が守らないもの — 明記）

- **本変更は password の at-rest 保護であって、ノート/日記本文のアクセス制御ではない**。`content_json` は `*_PAYLOAD_COLUMNS` に含まれ、RLS スコープ内のセッションを持つ主体は password なしで本文を読める（password gate は UI 層のロック表示）。本文の真の機密化は content_json 暗号化 or security-invoker RPC が別途必要 — 既存コードの「ideally a security invoker RPC」DEBT コメントは**退役させず引き継ぐ**
- 便益の正確な範囲 = 「DB バックアップ / ログ / ダンプに平文 password が残らない」「password 使い回しの露見防止」。短い PIN 型 password は salt 込み hash がクライアントに落ちる構造上オフライン総当たりに弱く、PBKDF2 でも実用時間で割れうる
- **過去の平文は遡って消えない**: rehash は現行行を書き換えるだけで、既存の DB バックアップ / PITR に残った平文はスクラブされない
- 定数時間比較は実装するが防御の主軸ではない（verify はクライアント側完結でリモートタイミングオラクルが存在しない — belt-and-suspenders）
- set / verify に PBKDF2 の数百 ms レイテンシが乗る。UI は変えないため、verify の二重発火が冪等であることを Verification で確認する

## Steps

1. [ ] `shared/src/utils/passwordHash.ts` 新設: `hashPassword(password): Promise<string>` / `verifyPassword(password, stored): Promise<{ok: boolean, needsRehash: boolean}>`（形式 parse = 上記検証則・legacy fallback・定数時間比較）+ 単体テスト
2. [ ] `SupabaseNotesUnifiedService`: set = hash して保存 / verify = verifyPassword + legacy 一致時 lazy rehash / remove = 変更なし（verify 経由）。SECURITY DEBT コメント・JSDoc を更新
3. [ ] `SupabaseDailiesUnifiedService`: 同上
4. [ ] 既存テスト更新（plaintext eq 前提のブロック）+ lazy rehash の回帰テスト追加
5. [ ] `shared` build/test + `web` build pass → sync-auditor 監査 → Issue #118 コメント・close は PR merge 後（🛑 人手）

## Files

| File                                                   | Operation | Notes                                                                                                 |
| ------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| `shared/src/utils/passwordHash.ts`                     | create    | PBKDF2 helper + 形式 parse                                                                            |
| `shared/tests/passwordHash.test.ts`                    | create    | 単体テスト（テストは `tests/` 配下 — `src/` 内は dist に emit されるため禁止・vitest.config.ts 参照） |
| `shared/src/services/SupabaseNotesUnifiedService.ts`   | edit      | set/verify 経路 + lazy rehash                                                                         |
| `shared/src/services/SupabaseDailiesUnifiedService.ts` | edit      | 同上                                                                                                  |
| `shared/tests/SupabaseNotesUnifiedService.test.ts`     | edit      | plaintext 前提テストの置換                                                                            |
| `shared/tests/SupabaseDailiesUnifiedService.test.ts`   | edit      | 同上                                                                                                  |
| `shared/tests/setup.ts`                                | edit      | jsdom に `crypto.subtle` 注入（node:crypto webcrypto・テスト環境のみ）                                |

## Verification

- [ ] `cd shared && npm run build && npm run test` pass
- [ ] `cd web && npm run build` pass
- [ ] 新規: hash → verify 往復 / 誤パスワード false / legacy plaintext 照合 + lazy rehash 発火（payload 単独 UPDATE・meta bump なし）/ rehash 失敗時も verify 成功
- [ ] parse 検証則: iterations レンジ外 false / salt・hash 長不正 false / malformed `pbkdf2$…` が plaintext fallback しない / 平文 `pbkdf2$` 始まりの境界仕様
- [ ] verify 二重発火の冪等性（連続 2 回 verify で 2 回目も正しく true / rehash 2 回でも壊れない）
- [ ] `life-editor-sync-auditor` で bump 漏れなしを確認
