---
Status: Draft # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: 2026-11-02
Branch: 未定（実施するセッションで `claude/security-red-team-<issue>` を切る）
Owner-chat: main
---

# Plan: 動的な攻撃の再現と、AI を使った攻撃のシミュレーションの準備

---

## Context

- **動機**: 2026-11-02 の静的なセキュリティレビュー（コードを読むだけの確認）では、確信度 8/10 以上の脆弱性は 0 件でした。ただし、実際に攻撃を送って確かめたものはありません。また、AI が読む文章に命令を混ぜる攻撃（プロンプトインジェクション）は、レビューの基準で対象外になっていました。この計画は、動かして確かめる検証と AI を使った攻撃の想定を、本格的に実施する前の準備としてまとめます。
- **このセッションでやること**: この計画書を書くところまでです。攻撃の実行・環境づくり・対策の実装は、別のセッションで Issue を切ってから行います。
- **制約**:
  - 完成までコスト $0 を守ります（CLAUDE.md 冒頭）。有料のペンテスト業者・有料の Claude API の呼び出しは使いません。Claude を使うシミュレーションは、サブスクリプションの範囲の Claude Code で回します。
  - 本番（Supabase の本番プロジェクト・公開 Web URL・本番の Worker）には攻撃を送りません。読み取りだけの設定確認（例: `GET /auth/v1/settings`）は本番でも可とします。
  - DDL は「ローカルファイル先行 → こうだいさんが `supabase db push`」です（§7.3）。PR の merge は常にこうだいさんです（P-001）。
  - playwright（実ブラウザ）と dev server は chat-main だけが使います（§7.4）。
- **Non-goals**:
  - 負荷をかける攻撃（DoS）と、レート制限の試験はしません。無料枠を使い切ると本番も止まるためです。
  - 依存パッケージの CVE の深掘りはしません。自動のスキャナで件数を出すところまでにします。
  - 他人のサービス（claude.ai・Supabase・Cloudflare・GitHub）そのものへの攻撃はしません。こちらの設定と使い方だけを確かめます。

---

## 前提として分かっていること（2026-11-02 の静的レビューの結果）

| 項目 | 状態 | 出典 |
| --- | --- | --- |
| RLS（行ごとのアクセス制御） | 公開スキーマの約 35 テーブルすべてで有効です。ポリシーは持ち主だけに絞られています。 | `supabase/migrations/` の最終状態 |
| 本番のサインアップ | 開いたままです（`disable_signup: false` を実測）。誰でもアカウントを作れます。 | `GET /auth/v1/settings`（2026-11-02） |
| 全ユーザー共通の一意キー | `items_meta.id` と `dailies_payload.date` は、ユーザーをまたいで一意です。他人に先に取られると、こうだいさんの保存が止まります。 | `0008_data_unification_schema.sql:76,494` |
| ノートと Daily のパスワード | ハッシュにせず、平文のまま保存されています。 | known-issues 027 |
| Desktop の CSP | `app://` の応答には CSP（読み込んでよい場所の制限）が付いていません。 | `desktop/src/main/index.ts:363` |
| 拡張アプリ用の窓口 | 書けるのは自分が作ったアイテムだけです。読むほうはロック中のノートを除いて全域です（D-20261007-main-4 = B）。`create_note` と `update_note` も持っています。 | `mcp-server/src/extensionGateway.ts:59-88` |
| スマホ用の Worker | URL のパスに入れた共有シークレット 1 本で、全ツールを使えます。`add_ai_memory` と `create_ai_skill` も含みます。 | `mcp-server/src/remoteTools.ts:17`、`worker.ts:136-144` |
| AI の記憶とスキルの行き先 | DB にある記憶とスキルは、Desktop から Claude Code を起動するたびに `claude-workspace/.claude/` へファイルとして書き出されます。そこを `--add-dir` で読み込ませます。 | `desktop/src/main/claudeLauncher.ts:260-275, 498-502` |
| 無人の定期ルーチン | 昼に headless の Claude が、公開リポジトリの Issue と PR の一覧を読みます。permissions は読み取り中心です。 | `.claude/automation/routine-night-safe.md:20-21`、`settings-unattended-readonly.json` |
| リポジトリ | 公開されています。攻撃者の AI もコード・決定の記録・計画書を丸ごと読めます。 | CLAUDE.md §1 |

---

## 想定する攻撃者

| 記号 | 攻撃者 | 持っているもの |
| --- | --- | --- |
| T1 | 通りすがりの第三者 | 公開 Web URL、公開リポジトリ、メールアドレス 1 つ（サインアップが開いているため、アカウントも作れます） |
| T2 | 乗っ取られた、または悪意のある拡張アプリ | 窓口の鍵 1 本（読み取りは全域、書き込みは自作のアイテムだけ） |
| T3 | AI に読ませる文章を書ける人 | 拡張アプリ経由のノート、貼り付けた Web の文章、GitHub の Issue とコメント、メールの本文 |
| T4 | AI を道具に使う攻撃者 | 公開リポジトリを AI で丸読みして弱点を探す速さ、AI が作った自然なフィッシング文 |
| T5 | スマホ用 Worker のトークンを手に入れた人 | こうだいさんのアカウントの全データの読み書き（ロック中のノート本文を除く） |

---

## 検討した代替案

| 案 | 採否 | 却下理由 | 復活条件 |
| --- | --- | --- | --- |
| 無料枠の 2 つ目の Supabase プロジェクト（検証用）と、`wrangler dev` のローカル Worker で攻撃する | ✓ | — | — |
| `supabase start`（Docker でローカルに Supabase を立てる） | ✗ | この PC に Docker がありません。Windows に入れる手間が、検証用プロジェクトを 1 つ作る手間より大きいためです。 | Docker を入れる別の理由ができたとき。Mac で実施するとき。 |
| 本番に直接攻撃する | ✗ | こうだいさんの実データを壊すおそれがあります。無料枠を使い切ると本番も止まります。 | 採り直さない。読み取りだけの設定確認は例外として本番で可とします。 |
| 外部のペンテスト業者・バグバウンティ | ✗ | コスト $0 の制約に反します。 | 完成後に、コストの制約が外れたとき。 |
| 自動のスキャナだけで済ませる | ✗ | AI を使った攻撃と、データの持ち主をまたぐ攻撃は、汎用のスキャナでは見つからないためです。 | — |
| AI のシミュレーションを claude.ai のスマホのコネクタで手動だけで行う | ✗（一部だけ採用） | 回数を重ねて成功率を測れないためです。自動化は Claude Code の headless で行い、スマホのコネクタは最後に数件だけ手で確かめます。 | — |

---

## Scope (Touchable Paths)

実施するセッションで変更してよいパスです。この計画書のセッションでは、この計画書のファイルだけを書きました。

```
scripts/security/**                      # 攻撃の再現スクリプトとシミュレーション用ハーネス（新規）
.claude/docs/security/**                 # 実測結果・攻撃文の一覧・手順書（新規）
.claude/docs/known-issues/NNN-*.md       # 新しく見つかった弱点の記録
.claude/docs/vision/plans/2026-11-02-security-red-team-prep.md
mcp-server/.dev.vars                     # 検証用の環境変数（gitignore 済み・commit しない）
```

対策のコード変更（RLS・窓口・Desktop・ルーチンの permissions など）は、この計画の Scope に入れません。Phase 4 で候補を Issue にして、それぞれ別の計画と PR で行います（1 Issue = 1 ブランチ = 1 PR）。

---

## Steps

### Phase 0: 検証用の環境を本番から切り離す

| # | Step | Gate | Acceptance |
| --- | --- | --- | --- |
| 0-1 | Supabase に検証用のプロジェクトを 1 つ作り、URL と anon key を控える | 🛑 人手 | ダッシュボードにプロジェクトがあり、本番と ref が違う |
| 0-2 | 検証用のプロジェクトへ、全 migration を `supabase db push` で反映する（`--db-url` で検証用を指す） | 🛑 人手 | `supabase migration list` で 0045 まで反映済み |
| 0-3 | 検証用のプロジェクトにアカウントを 2 つ作る（owner 役と attacker 役）。サインアップはこの検証用だけで開いておく | 🛑 人手 | 2 アカウントでログインできる |
| 0-4 | `wrangler dev` でスマホ用の Worker と窓口の Worker をローカルに立て、検証用のプロジェクトに向ける（`.dev.vars`）。窓口には検証用の拡張アプリを 2 つ（A と B）登録する | 🤖 自律 | `curl` で `/mcp/<検証用トークン>` が 200、誤ったトークンが 404 |
| 0-5 | 目印の偽データ（カナリア）を owner 役に入れる。`CANARY-NOTE-<乱数>` を含むノート、ロック中のノート、AI の記憶 1 件を作る | 🤖 自律 | `scripts/security/seed-canary.mjs` が exit 0、件数を表示する |
| 0-6 | 無料の道具を揃える: gitleaks、osv-scanner、semgrep、electronegativity、OWASP ZAP、promptfoo | 🤖 自律 | 各道具の `--version` が通る |
| 0-7 | Supabase と Cloudflare の利用規約で、自分のプロジェクトへの検証が許されている範囲を読み、手順書に書く | 👀 目視 | `.claude/docs/security/rules-of-engagement.md` に、許可されている範囲と禁止事項がある |

### Phase 1: 自動のスキャナで現状の件数を測る

| # | Step | Gate | Acceptance |
| --- | --- | --- | --- |
| 1-1 | gitleaks で git 履歴全体の秘密情報を探す | 🤖 自律 | 検出 0 件、または全件に判定が付いている |
| 1-2 | osv-scanner（または `npm audit`）で、6 つのパッケージの依存の既知の脆弱性を数える | 🤖 自律 | 件数を重大度ごとに `.claude/docs/security/baseline.md` に記録 |
| 1-3 | semgrep の TypeScript と JavaScript の規則集で、危険な書き方を探す | 🤖 自律 | 検出を全件判定済みにする |
| 1-4 | electronegativity で `desktop/` の Electron の設定を検査する | 🤖 自律 | 検出を全件判定済みにする |

### Phase 2 以降: 未記入

Phase 2 以降（動的な検証の手順、AI を使った攻撃の想定、対策の候補）はまだ書いていません。2026-11-02 のセッションでは、この節より前までを書きました。