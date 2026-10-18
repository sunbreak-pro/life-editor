# MEMORY (chat-refactor-core)

## 進行中

（なし）

## 直近の完了

- **#2271 extension_apps の主キーを乱数の id に — PR #2274 merged・0042 push 済み** ✅（2026-10-18）: 0042 で `id uuid` を足して埋め、`(user_id, slug)` を UNIQUE に下げてから主キーを付け替えた。コードは id を読まず slug のまま。push 後に本番で主キー・UNIQUE・REPLICA IDENTITY の索引・RLS ゲートを読み取りで確かめ、#2271 にコメントした（Issue は close 済み）。Supabase の MCP はトークンが無く通らないので、確認は `supabase/.env` の接続先を使う `supabase db query --output csv --agent no` で引いた
- **#2260 設定表 record_views とデータ層 — PR #2268 merged・0041 push 済み** ✅（2026-10-17）: 主キーは乱数の `id`、`(user_id, kind, unit)` は UNIQUE（D-20261017-main-2 で確定）。0041 の push 結果の確認コメントは 2026-10-18 に #2260 へ付いている
- **#2259 集計に occurredAt と latest — PR #2267 merged** ✅（2026-10-17）: #2261（mcp-tools）と #2262（analytics-refine）の前提が着地した

## 予定

- **merge 後に chat-main へ**: #948 のブラウザ側での裏取り（Briefing を開く / Analytics のタブ一巡で当該警告 0 件・1440px と 390px でチャートが従来どおり）。worktree では dev server / playwright を持てない（§7.4）ため、jsdom + 実 recharts で console を読むところまでが自分の担当
- **#1038 の案 B（無駄取りの削減）は未着手**。schedule 11→8 / connect 7→5 / Materials タブ切替 4→1 で、#1101（案 A-1）とは独立に効く。着手するなら Issue の起票依頼を outbox へ（起票は chat-main 一元化）。案 C（hover プリフェッチ）は初回訪問の chunk 待ちだけに効くので優先度は下
- **#958 / #960 / #963 / #985 / #1058 は 2026-08-18 時点で全部 merged**。merge 後にやり残しているのは #960 の**パッケージ版デスクトップの起動とログイン維持**の目視（IPC 登録経路が表になったため）— chat-main 手番
- **#898 は着手判断そのものがユーザー手番**。実装せず A/B を判断キューへ積む（#677 は status:frozen で対象外）
- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了・#675 は 4 項目とも PR 化済み）
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）
