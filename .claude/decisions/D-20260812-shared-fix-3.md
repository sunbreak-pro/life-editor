---
id: D-20260812-shared-fix-3
type: decision
status: answered
asked: 2026-08-12
answered: 2026-08-12
chat: shared-fix
answer: A
topics: [mcp, verification, rls, test-data]
refs:
  [
    "#700",
    "supabase/migrations/0002_rls_tasks.sql",
    "mcp-server/src/supabase.ts",
  ]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260812-shared-fix-3: 検証用 MCP ツールが撒くデータをどの DB に置くか

## 背景

（#700 の Step 1。**キューには未提出のまま回答が先に来た**ため、背景は #700 本文と 2026-08-12 の chat-main の実測から再構成した）

本プロジェクトの Supabase は作者本人の実データが入った 1 つだけで、検証データを撒けば実運用の画面に混ざる。#700（検証用 MCP ツールの追加）はこの入口が決まるまで着手禁止としていた。

## 選択肢と裁定

- A: **検証専用ユーザーを 1 つ作り、RLS の分離に乗せる**（**採用** — ユーザー回答 2026-08-12。同日、検証用アカウントを作成済み）
- B: 本番ユーザーのまま、id に検証用の接頭辞を付けて後で一括削除する（却下 — 分離が「ツールがシールを貼り忘れないこと」に依存する。1 本の貼り忘れで実データに混ざり、しかも混ざったことに気付けない）
- C: ローカル Supabase を立てる（却下 — コスト \$0 は守れるが、起動手順と DDL 同期の運用が恒久的に増える。A が仕組みで担保できる以上、割に合わない）

## 採用の根拠（2026-08-12 chat-main の実測）

分離が**運用の気をつけ方ではなく DB の仕組み**で成立していることを確認した:

- 全テーブルの RLS ポリシーが `auth.uid() = user_id` で、`user_id` の既定値がサーバ側で `auth.uid()` に決まる（`supabase/migrations/0002_rls_tasks.sql:25` — 「Clients must NOT pass user_id」）。**クライアントが他人の id を名乗って書き込めない**
- MCP Server は anon key + `signInWithPassword` で**ふつうの認証ユーザーとして**繋がる（`mcp-server/src/supabase.ts:60`）。RLS を素通りする service_role キーは使っていない。したがって撒き先の切り替えは `LIFE_EDITOR_SUPABASE_EMAIL` / `_PASSWORD` の差し替えだけで済み、コード変更をほぼ要しない

## 後片付けの順序（実装時の必須事項）

**`user_id` から `auth.users` への外部キーが無い**（`grep -rn "references auth.users" supabase/migrations/*.sql` が 0 件）。アカウントを消しても行は cascade で消えず、誰にも見えないまま残留する。よって後片付けは:

1. 検証ユーザーでログインしたまま、撒いた行を消す
2. その後にアカウントを消す

この順序を #700 の DoD に落とすこと。「過去に検証用テストアカウントの削除がユーザー手番のまま残った実例」への対策がこれにあたる。

## 波及

- #700 の Step 1 ゲートは解除。Step 2（状態の投入 / 読み出し / 後片付け）へ進んでよい
- 認証情報は env 経由のみ（`.mcp.json` の `${VAR}` 参照を平文展開しない — CLAUDE.md §9 の鉄則・`hooks/pre-commit-mcp-check.sh` が機械チェック）
- 実運用の MCP 接続と併存させる方法（別サーバーエントリを立てるか env を切り替えるか）は #700 の実装時に決める
