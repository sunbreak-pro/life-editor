---
Status: IN PROGRESS
Created: 2026-08-07
Branch: claude/main-600-web-public-url
Owner-chat: web-public
Parent: ../../../2026-05-04-cross-platform-migration.md
---

# Plan: Web を公開 URL に置き、スマホからどこでも使えるようにする

> 一言で言うと「家の中でしか動かないアプリを、外からも入れる住所に置く」作業。
> 新機能はほぼ作らない。**すでにできているものを外に出し、鍵をかけ直す**のが本題。

---

## Context

- **動機**: mobile をスマホで、オンライン上でどこでも見られる形にしたい（2026-08-07 ユーザー要望）。現状 mobile は Capacitor のネイティブ殻のみで、iOS は「無料 Apple ID + 7 日署名」＝ 1 週間ごとに Xcode で焼き直さないと起動しなくなる。Web URL なら署名が要らず、iOS / Android の区別もなくなる
- **すでに満たされている前提**（＝この計画が軽い理由）:
  - モバイル UI の切替は `shared/src/hooks/useMediaQuery.ts` の**画面幅**判定。`isNativeMobile()`（Capacitor 検知）とは独立しているので、**スマホのブラウザで開くだけでモバイル表示になる**（`shared/src/components/AppShell.tsx`）
  - `web/index.html` は `viewport-fit=cover` 済み（#320）。ノッチ端末の safe-area がそのまま効く
  - 配布表に「Web URL = Cloudflare（$0）」が既定として記載済み（移行 SSOT §8）
  - バックエンドは Supabase 直結。サーバーを立てる必要がない（配るのは静的ファイルだけ）
- **制約**: 完成まで $0 厳守（移行 SSOT §「完成まで $0」）。Cloudflare Workers 無料枠・Supabase 無料枠のみ使用。独自ドメインは取らず `*.workers.dev` を使う（**静的アセットへのリクエストは無料・無制限**なので、日次 10 万リクエストの Workers 無料枠にも当たらない）
- **ユーザー確定事項**（2026-08-07）: ホスティング = **Cloudflare Workers (Static Assets)**（当初 Pages で着手したが、Cloudflare が Pages を Workers へ吸収する方向でダッシュボードからも下げており、実際にトークン権限が見つからなかったため同日切替）/ PWA = アイコン＋全画面まで（Service Worker なし）/ デプロイ = main merge で自動 / Capacitor ネイティブ殻 = 現状維持で併存
- **Non-goals**:
  - Service Worker・オフライン閲覧・オフライン編集（移行 SSOT §9 の Non-goals を維持。PWA は「ホーム画面アイコン + 全画面表示」だけに限定する）
  - 独自ドメイン / 他人への配布 / マルチテナント（N=1 のまま）
  - Capacitor ネイティブ殻の退役（Phase 4 の完了判定は変更しない）
  - プッシュ通知

---

## Scope (Touchable Paths)

```
web/index.html
web/public/**
web/wrangler.jsonc                     # 新規（Workers Static Assets の配信設定）
.github/workflows/deploy-web.yml       # 新規
.claude/2026-05-04-cross-platform-migration.md    # §9 Non-goals の PWA 行を更新
.claude/CLAUDE.md                                  # §2 Platform に Web URL 導線を 1 行
.claude/docs/vision/plans/2026-08-07-web-mobile-public-url.md
```

スコープ外の変更が必要になったら、先に本書を更新する。**`shared/` と `web/src/` のロジックは触らない** — 触りたくなったら「本当にこの計画の一部か」を疑う。

---

## Steps

| #   | Step                                            | Gate    | Acceptance                                                        | 状態                       |
| --- | ----------------------------------------------- | ------- | ----------------------------------------------------------------- | -------------------------- |
| 1   | PWA メタ整備（manifest / アイコン / title）     | 🤖 自律 | `cd web && npm run build` exit 0・`web/dist/` に 4 資産が存在     | ✅ 済                      |
| 2   | RLS 監査（公開前の必須ゲート）                  | 🤖 自律 | `get_advisors(security)` の RLS 系 ERROR / WARN が 0 件           | ✅ 済（0 件）              |
| 3   | Cloudflare アカウント + サブドメイン + トークン | 🛑 人手 | workers.dev サブドメインが確定・トークン発行済み                  | ✅ 済                      |
| 4   | GitHub Secrets 登録（4 件）                     | 🛑 人手 | Actions の run で `***` としてマスク表示される                    | ✅ 済                      |
| 5   | deploy workflow 追加                            | 🤖 自律 | `deploy-web.yml` が PR で構文エラーなし（Actions の lint が通る） | ✅ 済                      |
| 6   | main へ merge → 自動デプロイ                    | 🛑 人手 | `curl -sI https://life-editor.<sub>.workers.dev` が `200`         | ✅ 済（URL 確定）          |
| 7   | Supabase Auth の URL 設定 + サインアップ封鎖    | 🛑 人手 | `/auth/v1/settings` が `disable_signup: true` を返す              | ✅ 済（実測）              |
| 8   | スマホ実機で golden path + ホーム画面追加       | 👀 目視 | 下記「実機チェックリスト」を 1 周                                 | 🔁 一部通過（#607 / #608） |
| 9   | docs 追随（SSOT / CLAUDE.md / 本書 Status）     | 🤖 自律 | `bash scripts/docs-lint.sh` exit 0                                | ✅ 済（配布表の URL 込み） |

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に自分で検証を回す
- **👀 目視** — Claude では検証不能（実機の見え方・触り心地）
- **🛑 人手** — ユーザー操作必須（外部サービスの登録・シークレット投入・merge・本番設定）

---

## Step 詳細

### Step 1 — PWA メタ整備（🤖）

やることは 3 つ。**ホーム画面に置いたときの「名札」「顔写真」「全画面で開く指示書」を用意する**だけで、アプリの中身は 1 行も変わらない。

1. **`web/public/manifest.webmanifest` を新規作成** ✅ — `name` / `short_name` / `display: "standalone"`（＝アドレスバーを消す）/ `background_color` / `theme_color` / `icons`。**色は朝刊テーマの `--color-bg-primary` の実値 `#fbf4e8`**（`shared/src/styles/tokens.css:40`）。manifest と `<meta>` は CSS ではないのでトークンを参照できず、ここと `index.html` の `theme-color` 2 行だけが**色ハードコードの許容例外**（CLAUDE.md §6 の不変式に対する明示的な例外として本書に記録する）
2. **アイコン PNG を 3 枚生成して `web/public/` にコミット** ✅ — `icon-192.png` / `icon-512.png` / `apple-touch-icon.png`（180px）。元は既存 `web/public/favicon.svg`。
   - **注意 2 点**: 元 SVG は 48×46 の**非正方形**かつ**背景が透明**。iOS は透明部分を黒く塗るので、**正方形キャンバスに中央寄せ + 不透明背景で焼く**（背景は上と同じ `#fbf4e8`）
   - ロゴ占有率は 192/512 が **60%**（Android が丸く切り抜く maskable セーフゾーン = 中央 80% 円に収めるため。512 は `purpose: "any maskable"` 兼用）、Apple は切り抜かず角を丸めるだけなので `apple-touch-icon` は **72%**
   - 生成は scratchpad に `sharp` を入れたワンショットスクリプト（**`web/package.json` の devDependency には入れない**。1 回焼いたら PNG をコミットして終わり。音源と違い画像はコミット禁止対象ではない — CLAUDE.md §9 の禁止は `public/sounds/` のみ）
3. **`web/index.html` の修正** ✅ — `<title>web</title>` を `Life Editor` に（**ホーム画面の名前になるので必須**）。`<link rel="manifest">` / `<link rel="apple-touch-icon">` / `apple-mobile-web-app-*` 3 種 / `theme-color`（light / dark の 2 本）を追加

> **#1007 追記（2026-08-18）**: `theme-color` 2 本は完全な静的タグではなくなった。`prefers-color-scheme` が決めるのは最初の 1 描画だけで、`ThemeProvider` がマウント後に `data-theme-color` 属性でメタを選び、`media` 属性を書き換えてアプリのテーマ（既定 light・OS 追従ではない）に追従させる（`shared/src/context/ThemeContext.tsx`・守り = `web/tests/themeColorMeta.test.ts`）。**色ハードコードの許容例外は上記 78 行のまま変わらない** — 色値は `index.html` に置いたままで TS 側に複製しない設計。manifest は意図的に朝刊色のまま（メディアクエリを書けず、`background_color` はインストール時に焼き付くため実行時に直せない）。あわせて Step 1 冒頭の「**アプリの中身は 1 行も変わらない**」も、この 1 箇所（`ThemeProvider` の既存 effect）だけ崩れた。

`vite-plugin-pwa` は**使わない**。あれは Service Worker の生成が主目的で、今回はそこを Non-goal にしているため、依存を増やすだけになる。`public/` に静的ファイルを置けば Vite がそのまま `dist/` へ通す。

### Step 2 — RLS 監査（🤖・公開前の必須ゲート）

**ここが今回いちばん大事な工程**。これまでアプリは自分の PC の中（Electron / localhost）だけで動いていたが、公開 URL に置くと**世界中からアクセスできる玄関ができる**。

`VITE_SUPABASE_ANON_KEY` は JS バンドルに埋め込まれ、**ブラウザの開発者ツールで誰でも読める**。これは設計どおりで事故ではない（anon key は「公開してよい鍵」で、実際の防御は Supabase 側の RLS が担う）。ただし**それは RLS に漏れが無いことが前提**で、今までは「そもそも外から誰も来ない」ことが暗黙の二重防御になっていた。その一枚が公開で剥がれる。

- Supabase MCP の `get_advisors({ type: "security" })` を実行し、`rls_disabled_in_public` / policy 欠落の指摘が **0 件**であることを確認する
- 1 件でも出たら **Step 3 以降に進まない**。修正を別 Issue に切って先に潰す（この計画のスコープ外 — RLS 修正は DDL を伴うため）

**実測結果（2026-08-07）✅ 通過**: RLS 系の指摘 **0 件**。唯一の指摘は `auth_leaked_password_protection`（WARN・RLS とは無関係で、「流出済みパスワードの使い回しを弾く機能が OFF」という内容）。**公開 URL 化でログイン画面が外から見えるようになるため、この 1 件は Step 7 に組み込んで有効化する**（ダッシュボードのトグル 1 つ・$0）。

### Step 3 — Cloudflare アカウント + サブドメイン + トークン（🛑）

こうだいさんの手作業。所要 5〜10 分。

1. https://dash.cloudflare.com/sign-up でアカウント作成（クレカ登録不要・$0）
2. Workers & Pages を開き、**workers.dev のサブドメインを決める**（アカウントごとに 1 回だけ。以後 URL は `life-editor.<決めたサブドメイン>.workers.dev` になる）
   - **Worker 自体の事前作成は不要**。初回の `wrangler deploy` が `web/wrangler.jsonc` の `name`（= `life-editor`）で作る
3. **Account ID を控える**（ダッシュボード右サイドバー、または URL の `dash.cloudflare.com/<account-id>/` 部分）
4. My Profile → API Tokens → Create Token → テンプレート「**Edit Cloudflare Workers**」を選んで発行 → **トークン文字列を控える**（再表示されない）
   - Pages 時代に要った Custom token（`Account / Cloudflare Pages / Edit`）はもう探さなくてよい。**この切替の実利のひとつがここ**

### Step 4 — GitHub Secrets 登録（🛑）

`https://github.com/sunbreak-pro/life-editor/settings/secrets/actions` に 4 件登録する。

| Secret 名                | 中身                                | 出どころ                    |
| ------------------------ | ----------------------------------- | --------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Step 3-4 のトークン                 | Cloudflare                  |
| `CLOUDFLARE_ACCOUNT_ID`  | Step 3-3 の Account ID              | Cloudflare                  |
| `VITE_SUPABASE_URL`      | `https://<project-ref>.supabase.co` | ローカルの `web/.env.local` |
| `VITE_SUPABASE_ANON_KEY` | anon（publishable）key              | 同上                        |

- **`.env.local` の中身をチャットに貼らないこと**（P-007 の精神。Secrets 画面に直接貼る）。anon key 自体は公開前提のものだが、貼る癖は service_role key を貼る事故につながる
- **`service_role` key は絶対に登録しない**。あれは RLS を素通りする合鍵で、バンドルに入ったら全データが読み書きされる

### Step 5 — deploy workflow 追加（🤖）

`.github/workflows/deploy-web.yml` を新規作成。既存 `ci.yml` は**触らない**（検証と配布は別の仕事なので、ファイルを分けて壊れたときの切り分けを楽にする）。

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch: # 手で叩き直せる逃げ道を残す
```

- 手順は `ci.yml` の verify job の shared → web ビルドをそのまま流用し、末尾に `cloudflare/wrangler-action` で `deploy`（`workingDirectory: web`）を足す。配信設定の実体は **`web/wrangler.jsonc`**（`name` / `compatibility_date` / `assets.directory` / `assets.not_found_handling`）
- ビルド step の `env:` に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を渡す（**Vite は `import.meta.env` をビルド時に文字列へ焼き込む**ので、実行時ではなくビルド時に必要 — `shared/src/services/supabaseClient.ts:17`）
- **Cloudflare の Git 連携を使わない理由**: この repo は monorepo で、`web` のビルドが `shared/` をソースから引く（`web/vite.config.ts` の alias）。Cloudflare 側のビルド設定は「ルートディレクトリ 1 つ + コマンド 1 本」が基本で、2 パッケージの install を通すのが素直に書けない。**すでに CI で通っている手順をそのまま使い回せる** GitHub Actions 側でビルドし、成果物だけ投げる方が確実
- **`not_found_handling: "single-page-application"` を入れる**: このアプリは React Router を使わず section state で切り替える（CLAUDE.md §3.2）ので通常運用で `/` 以外は踏まない。それでも入れるのは PWA の standalone 対策で、**アドレスバーが無い状態で 404 の白画面に落ちるとユーザーが自力で戻れない**ため

### Step 6 — main merge → 自動デプロイ（🛑）

P-001 のとおり merge はこうだいさんが押す。押した瞬間に Actions が走り、2〜3 分で `https://life-editor.<サブドメイン>.workers.dev` が生える。

**実測結果（2026-08-09）✅ 通過**: 確定 URL = **`https://life-editor.sunbreak-pro.workers.dev`**（run 31298158555・14 ファイル・Version ID `09ffe3af`）。`/` が 200 で `<title>Life Editor</title>`、manifest / アイコン 3 種 / favicon が全て 200、存在しないパスが index.html を返す（SPA fallback）、JS バンドルに Supabase URL が焼き込み済み。

到達までに 3 回落ちており、いずれも**設定ではなく外側**が原因だった。同じ形で迷わないよう記録する:

1. **wrangler 3.90.0 が `main` 無しの設定を蹴る**（run 31119518544）— `cloudflare/wrangler-action@v3` の既定版が Static Assets を知らない。`@v4` + `wranglerVersion: "4"` 明示で解決（#603）
2. **GitHub Actions の大規模障害**（2026-08-06 15:22Z〜）— `Failed to resolve action download info: Service Unavailable`。webhook が絞られて workflow 自体が起動しなくなる。**ジョブ開始前に落ちるログは自コード由来ではない**と切り分ける
3. **API トークンの権限不足**（run 31297746784）— `Authentication error [code: 10000]` on `/accounts/*/workers/services/life-editor`。**Pages 前提で発行したトークンを Workers 切替後もそのまま使っていた**のが原因。`Account → Workers Scripts → Edit` を足して解決（トークンを編集すれば値は変わらず Secret の入れ直しは不要）

### Step 7 — Supabase Auth の設定（🛑）

Supabase ダッシュボードでの手作業。**ここを飛ばすとログインできない or 他人が入れる**。

1. **Authentication → URL Configuration**（`/project/<ref>/auth/url-configuration`）
   - `Site URL` = `https://life-editor.sunbreak-pro.workers.dev`
   - `Redirect URLs` に同 URL を追加（`http://localhost:5173` も残す — ローカル開発が死ぬので消さない）
2. **Authentication → Sign In / Providers → 「Allow new users to sign up」を OFF**（`/project/<ref>/auth/providers` 上部の User Signups ブロック）
   - 公開 URL になると、URL を知った誰でもアカウントを作れてしまう。RLS があるので**既存データは読まれない**が、無料枠を他人に食われるし、そもそも N=1 のアプリに他人のアカウントは要らない（CLAUDE.md §1）
   - 自分のアカウントは**作成済みのものが引き続き使える**（OFF にするのは新規登録だけ）。後から人を足したければダッシュボードの Users から手動で作れる
3. ~~**「Leaked password protection」を ON**~~ — **無料プランでは設定不可。見送りと裁定した（2026-08-09）**
   - 流出済みパスワード一覧（HaveIBeenPwned）との照合機能だが、[公式ドキュメント](https://supabase.com/docs/guides/auth/password-security)に "Leaked password protection is available on the Pro Plan and above." と明記されている。**本プロジェクトは「完成までコスト $0 厳守」（CLAUDE.md 冒頭）なので採らない**
   - 計画時に「トグル 1 つ・$0」と書いたのは調査漏れ。Step 2 で出た `auth_leaked_password_protection` の WARN は**恒久的に残る**ため、以後の `get_advisors(security)` はこの 1 件を既知として扱う（0 件にはならない）
   - 代替の守り: 新規サインアップを閉じたので**攻撃対象は既存 1 アカウントのみ**。使い回しのない長いパスワードにしておくことで実質的に補う
4. **Authentication → Sign In / Providers → Minimum password length を 12 に**（同じ画面の Email プロバイダ設定内）
   - アプリ側の下限は #956（PR #967）で 6 → **12** に上がった（定数 = `shared/src/constants/password.ts` の `PASSWORD_MIN_LENGTH`）。ここを揃えないと**画面は 12 を求めるのにサーバは 6 で通る**状態になり、実効ポリシーが弱いほうに張り付く
   - 3 の Leaked password protection が無料プランで使えない以上、**長さが唯一の守り**になる（D-20260816-shared-fix-4 = A）。再セットアップのときもこの行を飛ばさない

**実測結果（2026-08-09）✅ 通過**: 公開バンドルから anon key を取り出し `GET /auth/v1/settings` を叩いて確認（読み取りのみ・本番への書き込みなし）。`disable_signup: true` / `external.anonymous_users: false` / `external.email: true` = **新規登録は閉じ、匿名ログインも無く、メールログインだけが生きている**状態。

### Step 8 — スマホ実機チェックリスト（👀）

こうだいさんがスマホで 1 周する。

- [x] ブラウザで `https://life-editor.sunbreak-pro.workers.dev` を開き、**ログインできる**
- [x] 下タブバーが出て、モバイルレイアウトになっている（デスクトップのサイドバーが出ていたら幅判定の不具合 → 報告）
- [x] ノッチ / ホームバーに UI が潜り込んでいない（safe-area）
- [ ] Briefing / Todos / Schedule / Notes / Daily を一巡して、データが Electron 版と一致する → **Notes で入力に入れず未完（#607）**
- [ ] 共有ボタン → 「ホーム画面に追加」→ **アイコンと名前が Life Editor になっている**
- [ ] ホーム画面から起動して**アドレスバーが消えている**（standalone が効いている）
- [x] 一度アプリを閉じて開き直しても**ログインが保持されている**

**実測結果（2026-08-09・Chrome / ブラウザタブ）**: **公開・ログイン・レイアウト・セッション保持は通過**。一方で narrow レイアウトの実機バグを 2 件検出したため、チェックリストは未完で残す。**バグはどちらも公開 URL 化で生えたものではなく、同じ web バンドルを載せる Capacitor 殻にも存在していたはず** — 実機で触る導線ができて初めて見つかった、という位置づけ。

| 観察                                                        | 判定                     | 追跡                                                                                                        |
| ----------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Note に書き込もうとすると入力パネルが一瞬出てすぐ閉じる     | **バグ**                 | [#607](https://github.com/sunbreak-pro/life-editor/issues/607)                                              |
| Note 作成時にボトムタブバーがせり上がってレイアウトが崩れる | **バグ**                 | [#608](https://github.com/sunbreak-pro/life-editor/issues/608)                                              |
| Briefing にハンバーガーが無い                               | **仕様**（意図的な保留） | [#609](https://github.com/sunbreak-pro/life-editor/issues/609)（コメントにしか無かった判断を起票）          |
| 画面上下に Chrome 自身の UI が出て邪魔                      | **仕様**                 | 「ホーム画面に追加」で standalone 起動すれば消える（この計画で `display: standalone` を入れた目的そのもの） |
| ログインし直しでデータが保持されている                      | ✅ 通過                  | —                                                                                                           |

**2 件のバグは同じ根を共有している可能性がある**（キーボードが出るとレイアウトが動く）。Android の Chrome はソフトキーボードでレイアウトビューポート自体を縮めるため、通常フローで底に置いた `BottomTabBar`（`shared/src/components/BottomTabBar.tsx:138`）が持ち上がる。この再レイアウトがエディタの再マウントを誘発していれば #607 も説明が付く。**片方だけ直すと取りこぼす**ので、着手時は両方を並べて見る。

**Step 8 の残り**（ホーム画面追加 → standalone 起動）は #607 / #608 と独立なので、先に確認して構わない。

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run lint` / `npm run build` / `npm run test` すべて exit 0
- [ ] `cd web && npm run lint` / `npm run build` / `npm run test` すべて exit 0
- [ ] `web/dist/manifest.webmanifest` / `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` の 4 ファイルが存在
- [ ] `web/dist/index.html` に `<title>web</title>` が**残っていない**（`grep -c '<title>web</title>' web/dist/index.html` が 0）
- [ ] `get_advisors({ type: "security" })` の RLS 系 ERROR / WARN が 0 件（Step 2）
- [x] `curl -sI https://life-editor.sunbreak-pro.workers.dev | head -1` が `HTTP/2 200`（Step 6 後・2026-08-09 実測）
- [ ] `bash scripts/docs-lint.sh` exit 0（`LC_ALL=C` 付きでローカル実行）
- [ ] PR diff が ±400 行以内（アイコン PNG のバイナリを除く）
- [ ] 完了時: 本書 Status を COMPLETED にして `archive/` へ移動・per-chat memory 更新

---

## DB Migration Notes

**なし**。DDL を 1 行も伴わない。Step 2 で RLS の**確認**はするが、修正が必要になった場合は別 Issue に切り出す（この計画では DDL を打たない）。

---

## Risks / Known Issues 参照

| リスク                              | 中身                                                                                                                                                                                                                      | 対処                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **RLS 漏れの露出**                  | 公開 URL 化で「外から誰も来ない」という暗黙の防御が 1 枚剥がれる                                                                                                                                                          | Step 2 を必須ゲートにした。0 件でなければ進まない                                                                                    |
| **iOS の PWA でログインが飛ぶ**     | iOS の ITP は、7 日間アクセスの無いサイトの localStorage を消すことがある。`persistSession: true`（`supabaseClient.ts:34`）が localStorage 依存なので、放置後にログイン画面へ戻される可能性がある                         | 実害はログインし直しのみ。**毎日使う想定なので実質発生しない**。頻発したら別 Issue（Supabase の refresh token を Cookie に寄せる等） |
| **パスワードリセットが機能しない**  | `detectSessionInUrl: false`（`supabaseClient.ts:36`）のため、メールのリセットリンクに乗ったトークンをアプリが拾わない                                                                                                     | **今回のスコープ外**（現状も同じで、退行ではない）。パスワードを忘れたら Supabase ダッシュボードから直接変更できる。必要なら別 Issue |
| **Supabase 無料枠の一時停止**       | 無料プロジェクトは 7 日間まったくアクセスが無いと一時停止される                                                                                                                                                           | 日常的に使う前提なので実質起きない。起きたらダッシュボードから再開（データは消えない）                                               |
| **Cloudflare の無料枠**             | Actions 側でビルドするので Cloudflare のビルド枠は消費しない。Workers 無料プランは日次 10 万リクエストだが、**静的アセットへのリクエストは無料・無制限**（Worker のコードを持たない構成のため全リクエストがこれに当たる） | 監視不要                                                                                                                             |
| **anon key の露出を「漏洩」と誤認** | バンドルに入るのは仕様。CLAUDE.md §9 の「API キーをフロントエンドに直書きしない」と衝突して見える                                                                                                                         | 禁止対象は**秘密鍵**（service_role 等）。anon key は公開前提の公開鍵で、直書きではなく env 経由。本書に明記しておく                  |

- 類似事例は `.claude/docs/known-issues/INDEX.md` を grep 済み（公開ホスティング関連の既存知見はなし）
- 新規 known issue 化候補が出たら Worklog に記録してから移送する

---

## docs 追随（Step 9 の内訳）

| ファイル                                          | 変更                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../../../2026-05-04-cross-platform-migration.md` | ✅ §9 Non-goals の「Service Worker / PWA インストール体験」を「Service Worker / オフラインキャッシュ」へ改訂し、ホーム画面アイコン + standalone は採用と明記。✅ §8 配布表の「Web URL」行に実 URL を追記（2026-08-09・Step 6 完了後） |
| `../../../CLAUDE.md`                              | ✅ §2 Platform に「スマホからの主導線 = 公開 Web URL（幅判定で同じ画面・ネイティブ殻は併存）」を 1 行                                                                                                                                 |
| `../../requirements/mobile-scope.md`              | **変更しない**（画面別スコープは Web でも同じ。幅判定で同じ UI が出るため）                                                                                                                                                           |

---

## References

- 親計画（移行 SSOT）: `../../../2026-05-04-cross-platform-migration.md` §8 配布・署名 / §9 Non-goals
- モバイル UI スコープ: `../../requirements/mobile-scope.md`
- frontend 規約: `../../../rules/frontend.md`
- 関連コード: `shared/src/hooks/useMediaQuery.ts`（幅判定）/ `shared/src/utils/platform.ts`（Capacitor 判定）/ `shared/src/services/supabaseClient.ts`（env と auth 設定）/ `web/vite.config.ts`（shared alias）
- related skills: `worktree-policy`（実装は worktree で）/ `docs-workflow`（Issue 起票）/ `session-verifier`（commit 前）

---

## Worklog

- 2026-08-07: 計画書作成（chat-main）。ユーザー確定 = Cloudflare Pages / PWA はアイコン + standalone まで / main merge で自動デプロイ / Capacitor 併存。実装は worktree へ切り出す
- 2026-08-07: Issue #600 起票 → worktree `web-public`（ブランチ `claude/main-600-web-public-url`）を作成し Step 1 / 2 / 5 / 9 を実装
  - **Step 2 を Step 1 と並行で先に通した**（計画では Step 1 の次）。RLS 系 0 件で、公開に進んでよいと確定してから Cloudflare の手順書を確定させたかったため。順序変更の実害なし
  - **アイコン背景を白ではなく `#fbf4e8`（朝刊テーマの背景色）にした** — 計画では「白 or 紫」と書いていた。ロゴが紫のグラデーションで、白だと浮き、紫だとロゴが埋もれる。アプリを開いた瞬間の背景と同じ色にすると、ホーム画面 → 起動の見た目が連続する（P-006 = UI ミクロ判断は実装者判断）
  - **`sharp-cli` ではなく `sharp` を scratchpad に入れて Node スクリプトで焼いた** — 正方形化・不透明背景・ロゴ占有率の 3 つを同時に指定する必要があり、CLI のオプションでは組み立てにくかったため。`web/package.json` は無変更（生成物の PNG だけコミット）
  - **`deploy-web.yml` に `verify build output` ステップを足した**（計画には無かった）。Secrets 未設定などでビルドが中途半端に通ったとき、**無言で壊れたページが公開される**のが公開 URL の一番怖い失敗なので、配る直前に成果物 5 点の実在と `<title>` の置換を機械チェックする
  - **`auth_leaked_password_protection`（Step 2 の唯一の指摘）を Step 7 に組み込んだ** — RLS 無関係だが、ログイン画面が外から見えるようになる以上、同じタイミングで有効化するのが自然
- 2026-08-07: **配信先を Cloudflare Pages → Cloudflare Workers (Static Assets) へ切替**（PR #601 の追加コミット・ユーザー確定）
  - 発端は「トークン権限 `Account / Cloudflare Pages / Edit` が画面に見当たらない」というユーザー報告。調べると権限自体は公式リファレンスに現存しており、直接の原因は Custom token 画面でスコープを Account に切り替えないと候補に出ないことだった
  - ただし**より根本的な事情**が判明: Cloudflare は Pages を Workers へ吸収する方向で、ダッシュボードから Pages を下げている。2026-03 時点で Workers は静的サイト / SPA / 独自ドメインで機能同等、新機能は Workers 側にしか来ない
  - 切替の実利が 3 つある: ①トークンはテンプレート「Edit Cloudflare Workers」で済み、詰まっていた権限探しが消える ②**静的アセットへのリクエストは無料・無制限**で $0 厳守に合致（Pages 同様） ③将来の再移行が要らない
  - 差分は `web/wrangler.jsonc` 新規 + `deploy-web.yml` の deploy ステップのみ。ビルド手順・PWA 資産・RLS ゲートは無変更
  - **`not_found_handling: "single-page-application"` を入れた**: 当初「React Router 不使用だから SPA fallback は不要」と判断していたが、PWA の standalone はアドレスバーが無く、404 の白画面に落ちるとユーザーが自力で戻れない。Pages 版で `_redirects` を置かなかった判断はここで覆した
- 2026-08-07: **#601 merge 直後に push した Workers 切替が main に届かず**、回収 PR #602 で載せ直した（`git checkout -b <new> origin/main` → `cherry-pick`・コンフリクトなし）。原因は「PR 提出後にユーザーとの対話で方針が変わり、調査に十数分かかる間に merge された」形で、**既存の対策「アドバーサリアルレビューを PR 前に回す」では防げない類型**（外部サービスの仕様変更に起因する転換は前倒しできない）。追加ルール = **PR 提出後に方針が変わったら同じブランチに push せず main から新ブランチを切る**
- 2026-08-07: **#602 merge 後の初回デプロイが失敗**（run 31119518544）。`✘ Missing entry-point: ... or the \`main\` config field`
  - 原因は **`cloudflare/wrangler-action@v3` の既定が wrangler 3.90.0** だったこと。3.90 には「コードを持たない静的アセットだけの Worker」の概念が無く、`main` の無い `wrangler.jsonc` を蹴る。**設定ファイル側は正しく、道具が古かった**
  - 対処 = action を `@v4` に上げ、**`wranglerVersion: "4"` を明示**する。action の既定に任せない — 今の既定がたまたま 4 系なだけで、暗黙に頼ると同じ形で再発する
  - **ローカルで `npx wrangler@4 deploy --dry-run` を回して実証してから PR を出した**。CI で 1 回ずつ試すと 1 往復 4 分かかるうえ、失敗が main に残る
- 2026-08-09: **公開完了 — `https://life-editor.sunbreak-pro.workers.dev`**（run 31298158555）。Step 6 / 7 とも通過し、残りは Step 8（実機目視）のみ
  - **GitHub Actions の大規模障害を挟んだ**（2026-08-06 15:22Z〜）。`Failed to resolve action download info: Service Unavailable` で、CI も deploy も PR の checks 自体も止まった。**webhook が絞られて workflow が起動しない**状態だったため「PR に checks が付かない」も同一原因。切り分けは `https://www.githubstatus.com/api/v2/components.json` の Actions コンポーネントを見るのが速い（このとき `major_outage`）。**ジョブ開始前・自コードのログが 1 行も出ずに落ちる失敗は、まず外側を疑う**
  - **最後に残った失敗は API トークンの権限不足**（run 31297746784・`Authentication error [code: 10000]`）。原因は **Cloudflare Pages 前提で発行したトークンを、Workers へ切り替えた後もそのまま使っていた**こと。Pages 系テンプレートには `Workers Scripts` が入らない。**トークンは作り直さず「編集」で `Account → Workers Scripts → Edit` を足せば値が変わらず、GitHub Secret の入れ直しが不要**
  - 症状の読み方: `wrangler whoami` 相当の出力でアカウント名が引けている＝トークン自体は有効。それでも `/accounts/*/workers/services/<name>` が 10000 で落ちるなら、**認証ではなく認可（権限）の問題**と断定してよい
  - **`Leaked password protection` は無料プランでは設定不可**と判明し、見送りを裁定（Step 7-3）。計画時に「トグル 1 つ・$0」と書いたのは調査漏れで、公式ドキュメントは Pro Plan 以上と明記している。**`auth_leaked_password_protection` の WARN は恒久的に残る**ため、以後 `get_advisors(security)` は 0 件にならない前提で読む
  - 公開後の検証は**本番に書き込まずに済ませた**: サインアップ封鎖の確認は「テスト登録して 422 を見る」ではなく、公開バンドルから anon key を取り出して `GET /auth/v1/settings` を読み、`disable_signup: true` を確認する形にした（読み取りのみ）
  - 配信直後の一瞬だけ `manifest.webmanifest` と `favicon.svg` が 404（`error code: 1042`）を返した。再取得で `CF-Cache-Status: MISS → HIT` の 200。**デプロイ直後の検証は 1 回の 404 で判断せず、必ず引き直す**
- 2026-08-09: **Step 8（実機）を 1 周し、通過 4 / バグ 2 / 仕様 2**。公開・ログイン・モバイルレイアウト・safe-area・セッション保持は問題なし。バグは [#607](https://github.com/sunbreak-pro/life-editor/issues/607)（Note の入力パネルが一瞬で閉じる）と [#608](https://github.com/sunbreak-pro/life-editor/issues/608)（キーボードでボトムタブがせり上がる）
  - **2 件とも公開 URL 化で生えたものではない**。同じ web バンドルが Capacitor 殻にも載っている以上、前から存在していたはず。**「実機で毎日触れる導線ができた」こと自体が検出力**になった、というのがこの計画の副次的な収穫
  - 「Briefing にハンバーガーが無い」は**バグではなく意図的な保留**だった（`BriefingScreen.tsx:209-214` に理由が明記され、`mobile-scope.md` #1 の Consumption スコープと整合）。ただし**判断がコードのコメントにしか無く追跡されていなかった**ので [#609](https://github.com/sunbreak-pro/life-editor/issues/609) に起票した。実機で「無い」と報告が上がった時点で、それは記録場所が足りていない証拠と見なす
  - 「画面上下に Chrome の UI が出る」は仕様。**「ホーム画面に追加」で standalone 起動すれば消える**ので、この計画で `display: standalone` を入れた目的そのものが答えになる。ブラウザタブのまま使う限りは消えない
