# Outbox — chat-shared-fix

shared-fix レーン（worktree `workspaces/life-editor/shared-fix`）。横断修正・refactor-core 宛て Issue の実装を担当。

## 2026-08-13 chat-main 宛: #782 の QA 見送り分 4 件の起票依頼

#782（3 PR: #822 / #828 / #832）の role-qa 監査で挙がったうち、PR に同乗させなかった別課題級を積みます。すべて mcp-server 周辺・緊急度は低です。

1. **mcp-server の tests/ がどのゲートでも型検査されない** — `tsconfig.json` の include が `src/**` のみで、vitest は型を落として実行するだけ。`tests/supabaseStub.ts` 等の共有テストインフラが増えたので腐りやすい。提案 = `tsconfig.test.json`（include に tests/ を追加・noEmit）+ `npm run typecheck` を CI の mcp-server ジョブに追加
2. **記録型 Supabase スタブが 2 系統ある** — #822 の `tests/supabaseStub.ts`（#832 でチェーン拡張）と #828 の `tests/searchSupabaseStub.ts`（in-memory フィルタ実行型）。設計思想が違う（前者 = クエリ組み立ての記録に徹する / 後者 = 行の取捨まで再現）ため QA が API 差分を指摘済み。両 PR merge 後にどちらかへ寄せる
3. **search_all の LIKE メタ文字と task_type の非対称** — (a) `%`/`_` 未エスケープは従来どおりだが、#828 の `.limit` 撤去後は `query: "%"` が tasks 全件取得に化ける（N=1 で実害薄・直すなら handler 側でエスケープ）。(b) `tasks_payload` 側の `.eq("task_type","task")` は NULL task_type の legacy 行を落とす — notes の `isLegacyFolder`（NULL = 通常扱い）方針と不一致
4. **`docs/requirements/README.md` の「Supabase 接続が要るツール」列挙が陳腐化** — `list_schedule 系・get_today_context・write_briefing` だけの列挙に対しツールは大幅に増えた。「MCP ツールはすべて Supabase 接続」の一文へ寄せる参照化を提案（数値の非複製原則）

## 2026-08-13 chat-main 宛: 合流事故の観測報告（起票不要・情報共有）

- #822（VALID_CALLS 網羅テスト）× #700（verification 3 ツール）の別々 merge で main の mcp テストが一時赤 → **#829 で修復済みを確認**。#832 側の重複修正は削除済み
- 単発 PR の CI 緑どおしでも合流点が赤になる型が今日 2 件（mcp / web kanban）。squash merge の宿命なので、merge 直後に main で `npm run test` を回す運用があると早く捕まります（提案レベル）

## 2026-08-16 chat-main 宛: 公開 Web のレスポンスヘッダ（CSP / Referrer-Policy）の起票依頼

#919 の security-reviewer 監査で挙がった、#919 の diff の外にある既存の穴です。緊急ではないが $0 で塞げます。

- **現状**: `web/wrangler.jsonc` は静的アセットの設定だけでヘッダ指定が無く、`web/index.html` にも meta CSP が無い。つまり公開 Web URL は CSP も `Referrer-Policy` も付かないまま配信されている
- **なぜ今か**: #919 で `detectSessionInUrl: true` にしたため、localStorage 上のセッションに加えて「一瞬だけ URL に載るリカバリートークン」が増えた。スクリプト注入が起きたときの持ち出し先が 1 つ増えた形
- **提案**: `web/public/_headers` に `Content-Security-Policy`（`default-src 'self'` + Supabase オリジンを `connect-src`）と `Referrer-Policy: no-referrer` を置く。Cloudflare Workers の静的配信がそのまま読む

## 2026-08-16 chat-main 宛: #956（下限 12）で古くなった他レーンの docs 2 本

#956（PR #967）でアプリのパスワード下限を 6 → 12 に上げました。次の 2 ファイルが「6 文字以上」を書いたまま残りますが、**どちらも Owner-chat が他レーン**なので単一書込者原則に従い触っていません。起票 or 該当レーンへの申し送りをお願いします。

1. **`docs/vision/plans/2026-08-07-web-mobile-public-url.md` Step 7**（Owner-chat: web-public・Status: IN PROGRESS）— Supabase ダッシュボードで要る設定の一覧なのに **Minimum password length の行が無い**。ここに無いと、再セットアップ時にサーバ側の下限だけ 6 のまま取り残される（アプリは 12 を求めるのに実際は 6 で通る状態）。同 Step の「代替の守り = 使い回しのない長いパスワード」の直後に 1 行足すのが自然
2. **`docs/design/briefs/auth.md`**（Owner-chat: design-auth・Status: Ready）— 4 箇所で「6 文字以上」をヘルパーテキストの仕様として書いている。ClaudeDesign へ渡した時点のブリーフなので**歴史として据え置くのが正しい可能性が高い**（判断はそちらへ委ねます）。据え置く場合、将来 grep した人が古い下限を拾わないよう 1 行の注記があると安全

なお `shared/tests/passwordField.test.tsx` も "At least 6 characters" を持っていますが、これは `PasswordField`（下限を知らない汎用入力）の helperText が描画されることだけを見るフィクスチャなので、意図的に据え置いています。

## 2026-08-16 chat-main 宛: #947 のついでに見た `web/index.html` の PWA meta 棚卸し（起票判断のお願い）

#947（PR #977）で同ファイルを開いたので、残りの PWA meta も一通り見ました。**#947 の PR は 1 行 + コメントのみに留め、以下は diff に入れていません**（スコープを広げない方針）。結論から言うと **Chrome が警告を出すものは他に無く、直さないと壊れるものもゼロ**です。判断が要りそうなのは 1 件だけです。

### 判断が要る 1 件: manifest の `theme_color` がライト固定でダークテーマと食い違う

- `web/index.html` は `theme-color` を `prefers-color-scheme` で 2 本持っている（light = `#fbf4e8` / dark = `#101a2c`）が、`web/public/manifest.webmanifest` の `theme_color` は `#fbf4e8` の**ライト 1 色だけ**
- manifest はメディアクエリを書けない仕様なので、これは書き漏らしではなく仕様上の制約。ただし **Android で「ホーム画面に追加」した後のタイトルバー / スプラッシュは manifest 側を見る**ため、夕刊テーマで使っていてもそこだけ朝刊色になる
- 実害は「インストール済み Android で色が 1 箇所ちぐはぐ」だけ。N=1 かつ主導線が公開 Web URL（`D-20260807-main-1`）なので**優先度は低い**と見ています。起票するか放置か、判断をお願いします
- `background_color`（スプラッシュの地色）も同じ理由で朝刊色固定です

### 直さないのが正しいと判断した 3 件（記録のみ・対応不要）

1. **`apple-mobile-web-app-title`** — 標準の対応物は manifest の `short_name`（"Life Editor" で設定済み）。iOS 16.4 以降の Safari は manifest を読むので理屈の上では重複だが、**それ以前の iOS はこの meta しか見ない**ので消すと古い端末でホーム画面名が URL になる。Chrome は警告を出さない
2. **`apple-mobile-web-app-status-bar-style="black-translucent"`** — 標準の代替が存在しない Apple 専用。safe-area padding（#320）とセットで効いているので現状維持が正しい
3. **`apple-touch-icon`** — manifest の `icons` に寄せられそうに見えるが、iOS はホーム画面アイコンをこのタグから取る。残すのが正解

### 参考: 環境メモ（起票不要）

この worktree の `desktop/node_modules` に `vitest` が入っておらず、`cd desktop && npm run test` が「コマンドが見つからない」で落ちていました（`package.json` には宣言済み・`npm ci` で解消）。CI は毎回 `npm ci` するため CI 側の問題ではありませんが、他レーンの worktree も古い install を抱えている可能性があります。
