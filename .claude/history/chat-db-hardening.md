# HISTORY (chat-db-hardening)

### 2026-06-28 - RLS 本番実適用チェック（Critical 解消）

#### 概要

失効していた `SUPABASE_ACCESS_TOKEN` を再発行後、Management API 経由（curl）で本番 DB の RLS 実適用を検証。当初 Critical だった「RLS が本番で効いているか未確認」を解消。

#### 変更点

- **verify**: `pg_class.relrowsecurity` + `pg_policies` を本番 DB に直接問い合わせ。public 20 テーブル全てで RLS ON + ポリシー 4 件。RLS 無効・ポリシー 0 件のテーブルはゼロ
- **verify**: security advisor は ERROR 0 / WARN 1（`auth_leaked_password_protection` のみ。RLS 非関連の Auth 設定、軽微）
- **infra**: 起動中 claude は旧トークンを env 継承したままのため、Bash で `source ~/.zshrc` して新トークンを取得する方式で実行（claude 再起動不要・コンテキスト維持）
- **結論**: anon/publishable キーのクライアント同梱は RLS 強制前提で安全。Critical finding クローズ

### 2026-06-28 - data 層監査 + relation-mapper dedup

#### 概要

db レーン（shared データ層 / cloud / supabase migrations）を3観点で監査し、relation-table soft-delete patch の重複を共通 helper に集約してコミット (256d0ad4)。RLS 本番実適用チェックは PAT 失効でブロック。

#### 変更点

- **refactor**: 3つの byte 一致 `*UpdatesToPatch`（wikiTag assignment / connection / group-assignment）を `softDeleteMapper.ts::relationSoftDeleteUpdatesToPatch` に集約。挙動・型不変、connection の self-loop ガード維持。vitest 512 pass + tsc -b 緑（256d0ad4）
- **docs(comment)**: `SupabaseDataService.ts` の「他メソッドは全部未実装で throw」嘘コメント2件を実態に訂正
- **audit**: security / 可読性 / 重複 の3サブエージェント監査。RLS は現存全テーブルで定義済（当初仮説=誤）・`cloud/`(D1) は dead code（実行経路は Supabase 直結）・前方互換スキャフォールド（noteLinkMapper 等）は KEEP 判定
- **infra**: docs / frontend worktree を新設し3レーン構成（docs / db / frontend）化。CLAUDE.md §7.4「worktree 分割の2軸」追記は docs レーンへ移送
- **blocked**: `SUPABASE_ACCESS_TOKEN` 失効（GET /v1/projects も HTTP 401）で RLS 本番実適用チェック未完。有効 PAT 再発行待ち
