# 027: Notes / Daily password が plaintext で保存される（SECURITY DEBT）

**Status**: Active (Backlog)
**Category**: Security
**Severity**: Important (N=1 では実害なし、N>1 で即 HIGH 化)
**Discovered**: 2026-05-24 (DU-G G1 security-reviewer 監査で明文化) / **Extended**: 2026-05-25 (DU-G G2 で Daily 経路も同パターン追加)

## Symptom

### Notes (DU-G G1)

`notes_payload.password_hash` 列に対し、`setNotePasswordUnified(id, password)` は **plaintext を直接保存** する。`verifyNotePasswordUnified(id, password)` も `hash === password` の **plaintext eq** で照合する。bcrypt / argon2 / scrypt 等のパスワードハッシュ関数は適用されていない。

```ts
// shared/src/services/SupabaseNotesUnifiedService.ts L495-525 (setNotePasswordUnified)
.update({ password_hash: password, ... })  // plaintext のまま

// shared/src/services/SupabaseNotesUnifiedService.ts L577-591 (verifyNotePasswordUnified)
return data.password_hash === password;  // plaintext eq
```

### Daily (DU-G G2 — 同パターン)

`dailies_payload.password_hash` に対しても同じ plaintext 保存 + plaintext eq 検証が `SupabaseDailiesUnifiedService` で行われる（Notes G1 を template に移植したため）。

```ts
// shared/src/services/SupabaseDailiesUnifiedService.ts setDailyPasswordUnified
.update({ password_hash: password })  // plaintext のまま

// shared/src/services/SupabaseDailiesUnifiedService.ts verifyDailyPasswordUnified
return hash != null && hash === password;  // plaintext eq
```

## Root Cause

Legacy `useNotesAPI.ts` / `useDailyAPI.ts` (Tauri 時代) が plaintext を `password_hash` 列に保存する設計だった。DU-G G1 (Notes) で Unified 経路に移植する際、UX 完全パリティを優先して **legacy mandate** として継承し、DU-G G2 (Daily) でも同じ legacy mandate を踏襲した。

## Impact

放置 / 再発した場合:

- **N=1（現状、作者単独 Cloud Sync）**: 実害なし。RLS policy `notes_payload_select_own` / `dailies_payload_select_own` (migration 0008) が `auth.uid() = user_id` で他ユーザ row を SELECT 段階で遮断。`NOTES_PAYLOAD_COLUMNS` / `DAILIES_PAYLOAD_COLUMNS` からも `password_hash` は除外され、`verifyNotePasswordUnified` / `verifyDailyPasswordUnified` のみが SELECT する
- **N>1（友達 MVP 拡張時に即 HIGH 化）**:
  - Supabase DB バックアップ / PITR dump に plaintext password が残る（Notes + Daily 両方）
  - Postgres slow query log で `WHERE password_hash = '...'` が記録される可能性
  - 管理者権限（service_role key）保持者は全 user の password を平文で参照可能
  - RLS が唯一の防御線という構造的脆弱性

## Fix / Workaround

**現状の Mitigation**（DU-G G1 Notes + G2 Daily で適用済）:

- `NOTES_PAYLOAD_COLUMNS` / `DAILIES_PAYLOAD_COLUMNS` SELECT shape から `password_hash` 確実に除外 + 回帰テスト (`SupabaseNotesUnifiedService.test.ts` L728-745 / `SupabaseDailiesUnifiedService.test.ts` の verifyDailyPasswordUnified ブロック) で固定
- `verifyNotePasswordUnified` / `verifyDailyPasswordUnified` は `.select("password_hash")` 単一列 SELECT に限定
- 全 JSDoc に SECURITY DEBT を明記（Notes G1 / Daily G2 両 service）

**恒久対応（未着手 / 本 Issue が SSOT）**:

- bcrypt or argon2id への移行。Web Crypto API (`crypto.subtle.digest` + PBKDF2) で client-side ハッシュ化、サーバには hash のみ送信
- もしくは Supabase Edge Function 経由で `pgcrypto.crypt()` ハッシュ化 → DB は hash 文字列のみ保持
- migration: 既存 plaintext password は失効通知 → 再設定を促す（rehash 不可、plaintext → bcrypt 移行は user 操作必須）
- **Notes + Daily 両経路を一括対応**（同じ legacy mandate に由来するので片方だけ修正しない）

**着手タイミング**: 友達 MVP（Cloud Sync の N>1 化）の **前** に必須。それまでは N=1 限定で plaintext 継続。

## References

- 関連ファイル:
  - `shared/src/services/SupabaseNotesUnifiedService.ts:495-591` (Notes set / remove / verify password)
  - `shared/src/services/SupabaseDailiesUnifiedService.ts` (Daily set / remove / verify password — DU-G G2)
  - `shared/src/services/notesUnifiedMapper.ts:158-161` (`NOTES_PAYLOAD_COLUMNS` から password_hash 除外)
  - `shared/src/services/dailiesUnifiedMapper.ts:99-101` (`DAILIES_PAYLOAD_COLUMNS` から password_hash 除外)
  - `supabase/migrations/0008_data_unification_schema.sql` (RLS policy `notes_payload_select_own` / `dailies_payload_select_own`)
- 関連 commit: DU-G G1 commit (Notes / 本 Issue 初出) + DU-G G2 commit (Daily 経路追加)
- 関連 plan: `.claude/docs/vision/plans/2026-05-25-data-unification-g-notes-daily-unified.md`
- 関連 review: security-reviewer H1 (2026-05-24 監査)
- 関連 vision: `.claude/CLAUDE.md` §2 Platform (Cloud Sync = 作者本人のみ)

## Lessons Learned

- **legacy mandate を移植時に SECURITY DEBT として明記**: 「動くから」で plaintext を温存すると Phase 拡大時に忘却して致命傷化する。known-issues + JSDoc + test の 3 層で明示する
- **N>1 化の前ゲートに必須**: 友達 MVP / マルチユーザ化を実装する前に本 Issue を Fixed にする。docs/requirements/ への Tier 1 prerequisite として連動
- **password 経路の防御層列挙**: SELECT shape 除外 (mapper) / RLS scope / 単一列 SELECT (verify only) / 回帰テスト固定 — 4 層あれば plaintext でも漏洩経路は塞げる（ただし backup / log の問題は残る）
- 検索キーワード: `password_hash` `plaintext` `bcrypt` `argon2` `notes_payload` `SECURITY DEBT` `N=1 mandate`
