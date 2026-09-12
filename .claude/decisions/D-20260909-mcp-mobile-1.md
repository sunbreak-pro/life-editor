---
id: D-20260909-mcp-mobile-1
type: decision
status: answered
asked: 2026-09-09
answered: 2026-09-09
chat: mcp-mobile
answer: A（Workers に Remote MCP 新設）+ 認証は MVP の共有トークン
topics: [mcp, remote-mcp, mobile, cloudflare-workers, auth]
refs:
  [
    "docs/vision/plans/2026-09-09-remote-mcp-mobile.md",
    "2026-05-04-cross-platform-migration.md",
    "D-20260829-main-1",
  ]
supersedes: ["2026-05-04-cross-platform-migration.md § 3. 制約 — 「AI 連携 = stdio MCP Server を terminal-division から起動（Remote MCP は採用しない）」"]
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260909-mcp-mobile-1: MCP をスマホから使えるようにするか、するならどの経路と認証で

## 背景

ユーザー要望「life editor MCP をスマホからでもアクセス可能にしたい」（2026-09-09）。

現状の MCP Server は stdio 専用で、クライアントが同じマシンでプロセスを起動できることが前提。Claude の iOS / Android アプリはカスタムコネクタ（リモート MCP）に対応しているが、接続は端末からではなく **Anthropic のクラウドから**行くため、公開 HTTPS エンドポイントが要る。つまりこの要望は「設定を変える」話ではなく **2 本目のデプロイを作る**話で、移行 SSOT の制約表にある「Remote MCP は採用しない」（2026-05-04）を覆すことになる。

その 2026-05 の判断は、当時 AI 連携の入口が別リポジトリ terminal-division の stdio 起動に固定されていた文脈のもの。terminal 機能自体が 2026-07-05 に退役（D-20260705-main-1）し、起動導線は Desktop 殻へ移った（#1211）。前提が二重に変わっている。

## 選択肢と裁定

**Q1. どの経路でスマホから届かせるか**

- A: **Cloudflare Workers に Remote MCP を新設**（**採用** — ユーザー回答 2026-09-09。無料枠に収まり、web の配信で Workers の運用実績がある。普通の Claude チャットから全ツールが使えるので、要望そのものを満たす）
- B: Claude Code on the web の環境に stdio を通す（却下 — 即日使えるが、開発者向け UI で「普通のチャットから頼む」体験にならない。コンテナ揮発とシークレット管理も別問題）
- C: MCP を諦めモバイル Web UI で完結（却下 — 「AI に頼む」という要望自体を満たさない）
- D: 別の無料 Node ホストに stdio サーバーを置く（却下 — 常時起動が保証されず $0 の前提が崩れる）

**Q2. 認証方式**

- A: **共有シークレットトークン（URL パス）**（**採用** — ユーザー回答 2026-09-09。単独ユーザーの MVP に対して最小。Claude のコネクタは OAuth か無認証の二択でヘッダを手入力できないため、トークンは URL に載せる）
- B: Supabase Auth ベースの OAuth（却下 — 実装量が数倍。ただし**配布ユーザーにも MCP を開く時の唯一の正解**なので、退けたのは順序であって方向ではない）

**受け入れたリスク**（明示）: トークンを持つ者はオーナーのデータを全部読み書きできる。トークンは Anthropic 側にコネクタ設定として保存される。ローテーションは `wrangler secret put` + コネクタ再登録の 2 手。

## 却下案が復活する条件

- Q2-B（OAuth）: サインアップ開放ユーザー（D-20260829-main-1）に MCP を出す時 / トークン共有では権限分離が要ると分かった時 / トークン流出の実害が出た時
- Q1-B（Claude Code on the web）: Worker の運用（デプロイ・シークレット更新）が重いと分かった時の退避先として

## 波及

- 移行 SSOT `2026-05-04-cross-platform-migration.md` §3 制約表の「AI 連携」行を更新（Remote MCP 併存へ）
- CLAUDE.md §2（MCP は Desktop 専用）と §5（AI Integration）を更新
- `mcp-server/` に 2 本目のエントリポイント（`src/worker.ts`）が増える。stdio 版 `src/index.ts` は不変で併存
- Worker に載る都合で 2 つの前提が明文化された: ツール集合は「どこでも動く 10 ドメイン」が正（verification は local 専用）、日付ツールの基準ゾーンは実行環境任せにしない
