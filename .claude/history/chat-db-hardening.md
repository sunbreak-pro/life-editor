# HISTORY (chat-db-hardening)

### 2026-06-28 - data 層監査 + relation-mapper dedup

#### 概要

db レーン（shared データ層 / cloud / supabase migrations）を3観点で監査し、relation-table soft-delete patch の重複を共通 helper に集約してコミット (256d0ad4)。RLS 本番実適用チェックは PAT 失効でブロック。

#### 変更点

- **refactor**: 3つの byte 一致 `*UpdatesToPatch`（wikiTag assignment / connection / group-assignment）を `softDeleteMapper.ts::relationSoftDeleteUpdatesToPatch` に集約。挙動・型不変、connection の self-loop ガード維持。vitest 512 pass + tsc -b 緑（256d0ad4）
- **docs(comment)**: `SupabaseDataService.ts` の「他メソッドは全部未実装で throw」嘘コメント2件を実態に訂正
- **audit**: security / 可読性 / 重複 の3サブエージェント監査。RLS は現存全テーブルで定義済（当初仮説=誤）・`cloud/`(D1) は dead code（実行経路は Supabase 直結）・前方互換スキャフォールド（noteLinkMapper 等）は KEEP 判定
- **infra**: docs / frontend worktree を新設し3レーン構成（docs / db / frontend）化。CLAUDE.md §7.4「worktree 分割の2軸」追記は docs レーンへ移送
- **blocked**: `SUPABASE_ACCESS_TOKEN` 失効（GET /v1/projects も HTTP 401）で RLS 本番実適用チェック未完。有効 PAT 再発行待ち
