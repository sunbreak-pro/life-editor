---
Status: IN PROGRESS
Created: 2026-09-09
Branch: claude/life-editor-mcp-mobile-g3hpu6
Owner-chat: mcp-mobile
Parent: ../../../2026-05-04-cross-platform-migration.md
---

# Plan: Remote MCP Server — スマホから life-editor のツールを叩く

> 「MCP をスマホからでもアクセス可能にしたい」（2026-09-09 ユーザー要望）への実装計画。
> 判断の正本 = [`decisions/D-20260909-mcp-mobile-1.md`](../../../decisions/D-20260909-mcp-mobile-1.md)

---

## Context

- **動機**: MCP Server は stdio 専用（`mcp-server/src/index.ts` = `StdioServerTransport`）で、クライアントがプロセスを起動できる Desktop からしか使えない。外出先で「今日の予定を見て」「これタスクに入れて」を AI 経由でやる導線が無い。公開 Web URL（#600）は読み書きの UI は出すが、**AI に頼む**経路ではない
- **制約**:
  - 完成まで **$0 厳守**（移行 SSOT）→ Cloudflare Workers 無料枠（静的アセットの web とは別 Worker・Durable Objects 不使用）
  - Claude のカスタムコネクタは **Anthropic のクラウドから** 接続する。端末からではないので、公開 HTTPS URL が必須（社内 IP 制限・localhost は不可）
  - 認証は当面 **単独ユーザー（オーナー本人）**。Supabase の sign-in はオーナーの email/password 1 組（`mcp-server/src/supabase.ts`）
  - 移行 SSOT §3 の制約表に「Remote MCP は採用しない」（2026-05-04）とあり、**この判断の転換そのもの**にあたる → D-20260909-mcp-mobile-1
- **Non-goals**:
  - サインアップ開放ユーザー（D-20260829-main-1）への Remote MCP 提供。per-user OAuth が要るので今回はやらない
  - stdio 版の置き換え。Desktop は今まで通り `.mcp.json` の stdio 接続が主で、Worker は**併存する 2 本目の入口**
  - SSE / server→client 通知・resources / prompts capability。全ツールが 1 往復で完結するため不要

---

## 検討した代替案（必須）

| 案                                              | 採否 | 却下理由                                                                                                                   | 復活条件                                                       |
| ----------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **A. Workers に Remote MCP（共有トークン認証）** | ✓    | —                                                                                                                          | —                                                              |
| B. Workers に Remote MCP（Supabase Auth + OAuth） | ✗    | 実装量が数倍。単独ユーザーの MVP には過剰                                                                                 | 配布ユーザーにも MCP を出す時／トークン共有では権限分離できない時 |
| C. Claude Code on the web の環境に stdio を通す  | ✗    | 今日から使えるが、UI が開発者向けで「普通のチャットから頼む」体験にならない。コンテナは揮発しシークレット管理も別途必要   | Remote MCP の運用が重いと分かった時の退避先                     |
| D. MCP を諦めモバイル Web UI で完結              | ✗    | 「AI に頼む」要求そのものを満たさない                                                                                     | —                                                              |
| E. stdio サーバーを別の無料 Node ホストに置く    | ✗    | 無料 Node ホストは 2026 時点で常時起動が保証されず、$0 の前提が崩れる。Workers は web で運用実績がある                     | Workers 側で埋まらない Node 依存が出た時                        |

- 2026-09-09 `ask-user` の回答: **ルート = A（Workers に Remote MCP 新設）／認証 = MVP の秘密トークン方式（自分専用）**

---

## Scope (Touchable Paths)

```
mcp-server/src/worker.ts
mcp-server/src/registry.ts
mcp-server/src/remoteTools.ts
mcp-server/src/tools.ts
mcp-server/src/supabase.ts
mcp-server/src/utils/localDate.ts
mcp-server/tests/worker.test.ts
mcp-server/tests/remoteRegistry.test.ts
mcp-server/tests/localDateZone.test.ts
mcp-server/wrangler.jsonc
mcp-server/package.json
.github/workflows/deploy-mcp.yml
.gitignore
.claude/CLAUDE.md
.claude/2026-05-04-cross-platform-migration.md
.claude/decisions/D-20260909-mcp-mobile-1.md
.claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md
```

スコープ外が必要になったら **P-008** に従いキューへ積む（自分で広げない）。

---

## 設計

### 1. トランスポート — ステートレス Streamable HTTP

`POST /mcp/<token>` に JSON-RPC を 1 通、レスポンスも 1 通。セッション id も SSE ストリームも持たない（ストリームを提供しないサーバーは GET に 405 を返してよい、が仕様）。Durable Objects が要らないので無料枠に収まる。

SDK の `StreamableHTTPServerTransport` は `node:http` の req/res 前提で Workers には載らないため、JSON-RPC のディスパッチだけ `worker.ts` に直書きする。プロトコルバージョンは SDK の定数（`LATEST_PROTOCOL_VERSION` / `SUPPORTED_PROTOCOL_VERSIONS`）を import して stdio 版と同じ交渉をする。

### 2. 認証 — URL パスの共有シークレット

Claude のカスタムコネクタは OAuth か無認証の二択で、ヘッダを手で足せない。よってトークンは URL に載せる（`/mcp/<token>`）。定数時間比較・**不一致は 404**（401 にすると OAuth ディスカバリを誘発し、かつエンドポイントの存在を認めてしまう）。Desktop 用に `Authorization: Bearer` も受け付ける。

**受け入れているリスク**: トークンを持つ者はオーナーのデータを全部読み書きできる。トークンは Anthropic 側にコネクタ設定として保存される。ローテーションは `wrangler secret put` + コネクタ再登録。

### 3. ツール集合 — verification 3 本を外す

`remoteTools.ts`（＝どこでも動く 10 ドメイン）を **正**とし、`tools.ts` はそれ + verification。逆向きにすると新ドメインが Worker 側に届かず、スマホの Claude には「そのツールは無い」とだけ見える無症状の欠落になる。verification harness は台帳を `node:fs` に書く開発用で、Workers には書ける FS が無い（外部公開面が seed / bulk delete を持たない、という副次効果も取る）。

### 4. タイムゾーン — Workers は常に UTC

`utils/localDate.ts` はプロセスのローカル時刻で動いていた。Workers の isolate は UTC 固定で TZ 変数でも動かせないため、**09:00 JST 前は前日を返す**（ファイル冒頭が「fatal」と書いている当のバグ）。`configureTimeZone()` を足し、Worker は `wrangler.jsonc` の `vars.LIFE_EDITOR_TZ` から設定する。未設定なら UTC で黙って動かず例外にする。未設定時（stdio）の挙動は完全に据え置き。

---

## Steps

| #   | Step                                                       | Gate    | Acceptance                                                                     |
| --- | ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| 1   | レジストリ分割 + 認証情報注入 + TZ 設定可能化              | 🤖 自律 | `npm run build` / `typecheck:tests` / `vitest` 緑（既存 359 件を含む）         |
| 2   | `worker.ts` + `wrangler.jsonc` + deploy workflow           | 🤖 自律 | `wrangler deploy --dry-run` exit 0・`wrangler dev --local` で 4 経路が想定通り |
| 3   | Cloudflare にシークレット 5 本を投入                       | 🛑 人手 | `npx wrangler@4 secret list` に 5 本                                            |
| 4   | Worker をデプロイ                                          | 🛑 人手 | `curl https://<worker>/health` → `{"ok":true}`                                  |
| 5   | Claude アプリにカスタムコネクタとして登録                  | 🛑 人手 | スマホの Claude で `list_todos` 相当が返る                                      |
| 6   | PR レビュー → main merge                                   | 🛑 人手 | P-001（merge は常にユーザー）                                                   |

### 手順（Step 3-5 の実際のコマンド）

```bash
# 3. シークレット投入（1 本ずつ対話で貼る。値は shell 履歴に残さない）
cd mcp-server
npx wrangler@4 secret put LIFE_EDITOR_MCP_TOKEN          # openssl rand -hex 32 などで生成
npx wrangler@4 secret put LIFE_EDITOR_SUPABASE_URL
npx wrangler@4 secret put LIFE_EDITOR_SUPABASE_ANON_KEY  # anon key のみ。service_role は禁止
npx wrangler@4 secret put LIFE_EDITOR_SUPABASE_EMAIL
npx wrangler@4 secret put LIFE_EDITOR_SUPABASE_PASSWORD

# 4. デプロイ（GitHub Actions の "Deploy — Remote MCP" を手動実行しても同じ）
npm run deploy

# 4'. 疎通
curl https://life-editor-mcp.<subdomain>.workers.dev/health
```

5. Claude アプリ（iOS / Android）または claude.ai → 設定 → コネクタ → カスタムコネクタを追加
   - URL: `https://life-editor-mcp.<subdomain>.workers.dev/mcp/<LIFE_EDITOR_MCP_TOKEN>`
   - OAuth の欄は空のまま（このサーバーは OAuth を実装しない）

Desktop の Claude Code から同じ Worker を使う場合:

```bash
claude mcp add --transport http life-editor-remote \
  https://life-editor-mcp.<subdomain>.workers.dev/mcp \
  --header "Authorization: Bearer <LIFE_EDITOR_MCP_TOKEN>"
```

---

## Acceptance Criteria (機械検証可能)

- [x] `cd mcp-server && npm run build` exit 0
- [x] `cd mcp-server && npm run typecheck:tests` exit 0
- [x] `cd mcp-server && npm run test` 全 pass（新規 3 suite を含む）
- [x] `cd mcp-server && npx wrangler@4 deploy --dry-run` exit 0（bundle が node:fs で落ちない）
- [x] `tests/remoteRegistry.test.ts` が「remote = 全ツール − verification」を pin
- [x] `tests/worker.test.ts` が 誤トークン / 誤パス / トークン未設定 の 3 経路すべてで 404 を pin
- [ ] （Step 4 後）`curl https://<worker>/health` が `{"ok":true}`
- [ ] （Step 5 後）スマホの Claude からツールが 1 本以上成功
- [ ] 完了時: 本 plan の Status を COMPLETED にして `archive/` へ移動

---

## DB Migration Notes

なし（DDL 変更ゼロ・既存テーブルを既存 RLS のまま読む）。

---

## Risks / Known Issues 参照

- **トークン流出**: URL に載るため、コネクタ設定・ブラウザ履歴・プロキシログに残りうる。緩和 = 32 バイト以上のランダム値 + ローテーション手順（上記）。恒久対策は per-user OAuth（案 B）
- **無料枠**: Workers 無料は 10 万リクエスト/日。1 ツール呼び出し = 1 リクエストなので個人利用では遠い
- **Supabase の sign-in 回数**: warm な isolate ではセッションを再利用するが、cold start ごとに 1 回 sign-in する。無料枠の Auth 制限に対しては十分小さい
- **`items_meta.updated_at` LWW**（CLAUDE.md §3.3）: 書き込み経路は stdio と同一ハンドラなので新しい同期リスクは増えない

---

## References

- 移行 SSOT: [`2026-05-04-cross-platform-migration.md`](../../../2026-05-04-cross-platform-migration.md) §3 制約表（Remote MCP の項を本プランで更新）
- 判断: [`D-20260909-mcp-mobile-1.md`](../../../decisions/D-20260909-mcp-mobile-1.md)
- CLAUDE.md §5 AI Integration

---

## Worklog

- **2026-09-09**: Step 1-2 実装。`wrangler dev --local`（workerd 実機）で health / 404 / initialize / tools\:list(32 本) / notifications 202 / 資格情報不正時の isError を実測。bundle は gzip 215 KiB（無料枠上限 3 MiB に対し十分小さい）
- **設計上の気付き**: `localDate.ts` の TZ 依存は「Workers に載せる」まで誰も踏まなかった地雷。stdio 側は挙動据え置きにしたので、既存の朝刊経路への影響はゼロ
