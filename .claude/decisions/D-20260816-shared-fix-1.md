---
id: D-20260816-shared-fix-1
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-16
chat: chat-shared-fix
answer: A
topics: [auth, supabase, password-recovery, cross-platform]
refs:
  [
    "#919",
    "shared/src/services/supabaseClient.ts:38",
    ".claude/2026-05-04-cross-platform-migration.md",
  ]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260816-shared-fix-1: パスワードリカバリーのリンクをアプリに拾わせる方式をどれにするか

## 背景

（キュー未提出のまま回答が先行した — こうだいさんが在席していたため `comm/decisions/chat-shared-fix.md` を経由せず AskUserQuestion で同期確認した。以下は提示時の本文をそのまま再構成したもの）

#919 の実装前提。`shared/src/services/supabaseClient.ts:38` が `detectSessionInUrl: false` のため、Supabase から届くリカバリーリンクを踏んでも URL に載ってきた recovery トークンをアプリが一切拾わない。リンクを踏むと通常画面が出るだけで何も起きない。

`detectSessionInUrl` を `true` に変えると Electron / Capacitor を含む全プラットフォームの起動時 URL 解釈が変わるため、全面有効化するか recovery だけ明示処理するかを実装前に決める必要があった（#919 本文「実装前に要る判断」）。

判断のために取った実測（2026-08-16・`claude/shared-fix-919-password-reset`）:

- アプリ側に URL を解釈する経路が **1 件も無い**。React Router を持たず（CLAUDE.md §3.2）、`shared/src` / `web/src` / `desktop/src` の全域で `location.hash` / `location.search` / `URLSearchParams` / `history.replaceState` の参照がゼロ件
- Electron はパッケージ時 `loadFile`（`file://`）・Capacitor は `capacitor://localhost`（`desktop/src/main/index.ts:193-195`）。どちらもクエリ / フラグメントが載らないので、有効化しても実際に効くのは公開 Web URL（`https://life-editor.sunbreak-pro.workers.dev`）だけ
- supabase-js 2.105.4 の `detectSessionInUrl` は「URL に callback パラメータが載っているときだけ」働く（`GoTrueClient._initialize` の `callbackUrlType !== "none"` ガード）。素の起動では従来どおり storage からの復元経路に落ちる
- 同版は `detectSessionInUrl` に判定関数も渡せる（`(url, params) => boolean`）。ただしこの関数が偽を返すと期限切れリンク（`#error=…&error_description=…`・`type` が付かない）まで無視され、「踏んでも無反応」という #919 と同じ症状が残る

## 選択肢と裁定

- **A: `detectSessionInUrl: true`（全面有効化）**（**採用** — ユーザー回答 2026-08-16）。アプリ側の URL 解釈がゼロ件・Electron / Capacitor には URL パラメータ自体が載らないため、実質の影響範囲は公開 Web URL に閉じる。期限切れリンクのエラーも supabase-js 側が拾って `PASSWORD_RECOVERY` / エラーとして通知するので、追加の分岐が要らない
- B: recovery 限定の判定関数（却下 — #919 本文の「他は現状維持」に最も忠実だが、守る対象（他の URL 解釈経路）が実在しない。加えて `type` の付かない期限切れリンクを通すため `error_description` を自前で足す必要があり、抜けると #919 と同じ無反応バグを再生産する）
- C: URL を使わず 6 桁コード（`verifyOtp({ type: "recovery" })`）（却下 — 3 つの殻で挙動が揃う利点はあるが、Supabase ダッシュボードの Reset Password テンプレートへ `{{ .Token }}` を足す 🛑 ユーザー手番が増える。A で公開 Web URL 経由の復旧が成立するので、追加の手番に見合わない）

## 却下案が復活する条件

- C: 公開 Web URL を閉じる / リンクを踏ませずアプリ内だけで完結させたくなった場合
- B: OAuth など Supabase 以外の URL コールバックを足し、フラグメントに `access_token` を載せる経路が生まれた場合

## 波及

- 変更先 = `shared/src/services/supabaseClient.ts` の auth オプション 1 行
- リカバリーの**完了**は 3 つの殻すべてで公開 Web URL 上の操作になる（メールのリンクは OS 既定ブラウザで開くため）。ネイティブ殻では再設定後に新パスワードでサインインし直す導線になる
- 併せて確認した UI ミクロ判断（P-006 相当・同日ユーザー回答）: ログイン中のパスワード変更フォームは Settings に「アカウント」カードを 1 枚足す形で置く（サイドバーのサインアウト隣に新規ダイアログを作る案は却下）
