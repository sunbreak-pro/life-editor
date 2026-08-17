# HISTORY (chat-web-public)

### 2026-08-18 - shared-fix 3 件（#1005 セキュリティヘッダ / #1037 standalone の空白 / #1009 ステータスバー文字色）

#### 概要

`[web-public]` ラベルの 3 件を順に処理し、PR #1053 / #1057 / #1061 を open にした。3 本とも `origin/main` から独立に切った枝で、CI の `verify` 全ステップ（shared → web → desktop → mcp-server）+ docs-lint をローカルで exit 0 まで通してある。merge は未（P-001）。#791 が「実測待ち」で残していた下側の余白の原因が、この過程で確定した。

#### 変更点

- **#1005（PR #1053）**: `web/public/_headers` を新設。Cloudflare Workers の静的配信がそのまま読む形で、`Content-Security-Policy`（`default-src 'self'` + Supabase の https / wss / storage）と `Referrer-Policy: no-referrer` を全パスに付与。Vite が `public/` を無加工で `dist/` へ写すことを実ビルドで確認済み
- **#1005 の `style-src`**: `'unsafe-inline'` は緩めではなく必須。`@tiptap/core` が実行時に `document.createElement("style")` で `<style>` を挿すため、厳格にするとノートエディタが死ぬ。逆に `script-src` は `'self'` のみで足りる（本番バンドルにインラインスクリプトが無い・`eval` / `new Function` も不在）
- **#1005 のテスト**: `web/tests/securityHeaders.test.ts`。`_headers` は本番でしか動かないテキストで型検査もビルドも中身を見ないため、ファイルをパースして形（両ヘッダの存在 / `default-src 'self'` / `script-src` に unsafe 系が無い / Supabase 4 経路）を固定した。素の grep はファイル自身のコメントにマッチしてルール本体を消しても緑になるので、パーサを書いている
- **#1037 の原因確定（PR #1057）**: `black-translucent` + `viewport-fit=cover` の iOS standalone は「文書を上へずらす」ことでステータスバー下まで描くが、**ずらした分の高さを viewport に返さない**。そのため `100svh` が画面よりステータスバー 1 本分（47〜59px）短くなり、シェルが下端に届かない。#791 が立てた「二重予約」仮説は外れで、#805 が削った 0.5rem は別件の余剰だった
- **#1037 の修正**: 高さを `--app-shell-height` トークン 1 個に集約し、`@media (display-mode: standalone)` のときだけ `calc(100svh + env(safe-area-inset-top))` にする。ブラウザタブは 1px も動かず、inset が 0 の環境（Android インストール / 横向き / Desktop）では補正が自動的に打ち消える。`body { min-height }` も同じトークンを読むようにして、#631 が要求する「body とシェルが同じ高さ」を手作業の一致から構造的な一致へ変えた
- **#1009 の調査結果（PR #1061）**: `black-translucent` はステータスバーの文字色を**背景に関係なく白に固定**する仕様で、朝刊（`#fbf4e8`）で読めないのは可能性ではなく確定だった。さらに Issue が挙げていた「テーマに応じて meta を差し替える」は**成立しない**（この meta は起動時に一度しか読まれず、`theme-color` / manifest の `theme_color` も iOS のステータスバーには効かない）。残る選択は固定 3 値のみなので `default` を採用
- **判断キュー**: `default`（夕刊の上に明るい帯）と `black`（朝刊の上に黒い帯）は見た目の好みでしか割れないため、D-20260818-web-1 として `comm/decisions/chat-web-public.md` へ積んだ。どちらも `web/index.html` の 1 語
- **意図的に触らなかった箇所**: `AppShell.tsx` の safe-area コメントは #1061 が merge されると文言が古くなるが、隣接行を #1057 が触っているため同時に直すと自分の open PR 同士がコンフリクトする。merge 順が決まってから 1 行の追随 PR で直す
- **環境**: この worktree の `desktop/node_modules` に `vitest` が無く `desktop — typecheck` / `test` が落ちた（`npm ci` で解消）。chat-shared-fix が 2026-08-16 の outbox に残していた記録と同じ症状で、コードとは無関係

### 2026-08-13 - #791 iOS safe-area 修正 と #676 (a) AppProviders 切り出し

#### 概要

iPhone の PWA standalone で上下が崩れる #791 を直し（PR #805）、続けて #676 の唯一の未着手ステップだった (a) 前半 = グローバル Provider 鎖の切り出しを実施した（PR #811）。どちらも shared / web / desktop の lint・build・test・typecheck が exit 0、merge は未（P-001）。

#### 変更点

- **#791 上（PR #805）**: `AppShell.tsx` narrow 根に `pt-[env(safe-area-inset-top)]` を追加。`viewport-fit=cover` + `black-translucent` で Web ビューが画面最上端から始まるのに、根が左右 inset しか持っておらず、ヘッダー行がステータスバーに直接描かれていた
- **#791 下（PR #805）**: `BottomTabBar` の `pb-[env(safe-area-inset-bottom)]` → `pb-[max(0px,calc(env(safe-area-inset-bottom)_-_0.5rem))]`。タブの `py-2` が既にラベル下 0.5rem を占めており、そこへ inset を丸ごと足して二重になっていた。`max(0px, …)` により inset=0 の環境は出力 CSS 不変・タップ領域も不変
- **実測の内訳**: 生成 CSS を grep して Tailwind が `max(0px, calc(env(safe-area-inset-bottom) - .5rem))` へ正しく展開することを確認（`_` → 空白）。**実機の数値測定は未実施**（worktree からは実機・dev server に触れない = CLAUDE.md §7.4）ため、PR 本文に測定スクリプトと「どの値が出たらどう対応するか」の判定表を書いて chat-main へ渡した
- **#676 (a)（PR #811）**: `web/src/AppProviders.tsx` を新設し、グローバル Provider 鎖（Toast → Sync → UndoRedo → ShortcutConfig → Audio → Timer → RightSidebar）と headless 2 本・`isNativeMobile()` の Mobile 省略ゲートを移設。`MainScreen.tsx` 531 → 434 行。index チャンク 1,438.66 → 1,438.83 kB（中立）
- **テスト**: `shared/tests/appShell.test.tsx` に safe-area 宣言のガード 2 本（jsdom は `env()` を解決しないのでクラス名で「どの要素がどの inset を持つか」だけ固定）／ `web/tests/appProvidersOrder.test.tsx` に Provider 入れ子順の実行時ガード 3 本（マーカー Provider 方式・`timerHostChime.test.tsx` に倣う）
- **スコープ外に送った発見（P-008）**: `BottomSheet.tsx` が `pb-6` 固定で bottom inset を持たない（iOS standalone で最終行がホームインジケータに食い込む）／ `black-translucent` の白文字が朝刊テーマで読めない懸念。どちらも実装せず outbox の起票依頼へ
