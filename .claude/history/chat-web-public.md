# HISTORY (chat-web-public)

### 2026-08-30 - #1281 法務リーダーに dialog の作法（#1251 の追随）

#### 概要

PR #1270 の merge 後実機検証で chat-main が出した非 BLOCKING 3 件（focus 管理なし / Escape で閉じない / アプリ内から開くとブラウザ戻るでアプリを離脱）を 1 本にまとめて PR #1309 を open にした。`origin/main` から独立に切った枝で、CI の `verify` 全ステップ + docs-lint をローカルで exit 0 まで通してある。merge は未（P-001）。

#### 変更点

- **focus / Escape**: `LegalReaderHost` を `role="dialog"` + `aria-modal` + `aria-labelledby`（文書タイトル）にし、**Modal / BottomSheet と同じ `useDialogA11y`** に乗せた。初期フォーカス（先頭の Back ボタン）・Tab トラップ・IME ガード付き Escape・body スクロールロック・閉じたら開いた元へフォーカスを返す、まで一式が hook 側にあるので、reader 側に独自実装は 1 行も無い。副産物として `hasOpenDialogLayer()` が true になり、文書を開いている間は drawer の端スワイプが立ち止まる
- **Back ボタンを先頭フォーカスのままにした理由**: BottomSheet の `DIALOG_AUTOFOCUS_SKIP`（#525）を真似て Back を飛ばすと、次の focusable は本文中のリンクになり、文書の途中に着地する。本文が素のテキストなら panel 自身に落ちるが、文書によってはリンクが混ざるので Back を先頭に据える方が安定
- **戻るボタン**: `legalUrl.ts` を **アプリ内から開くときは `pushState`** に切り替えた（採用。旧 `replaceState` は URL を書く最短手であって意図した選択ではなく、依存もゼロ）。押した entry には `history.state` にマーカーを載せ、リロードをまたいでも「下にアプリの entry がある」と分かるようにした。**内側から閉じる（Back / Escape）も同じ 1 歩戻り**にして、3 つの出口が同じ場所（開く前のアプリ・state ごと）へ着地する。文書の切替（terms ↔ privacy）は replace で entry を積まない
- **共有リンク直開きだけは例外**: 下にアプリの entry が無いので `history.back()` すると**サイトの外へ出る**。この場合だけ従来どおり URL を書き換えて閉じる。テストで `history.back` を spy して「呼ばれない」ことを固定した
- **テストの罠**: jsdom の履歴移動はブラウザと同じく**キュー経由の非同期**（`SessionHistory._queueHistoryTraversalTask` = setTimeout）。`history.back()` の直後に URL を見ても動いていないので、閉じる系の assert は `popstate` を待つヘルパ `untilPopstate` を通す。`authScreenLegal.test.tsx` の 2 ケースも同じ理由で async 化した。ついでに「comes back」のケースが**閉じたことを見ていなかった**（探していたサインインボタンは overlay の下で常に在る）ので、文書タイトルの消失を足した
- **踏んだ罠（再発）**: 全件 vitest で `briefingEveningLazyMount.test.tsx` が 2 回落ちた（1 回目 1 件・2 回目 2 件）。単体では 7/7 緑で、`web/src/legal` への import 経路も無い。**全件並列だと TipTap の transform が 1 秒の `waitFor` に間に合わない**環境起因で、desktop / mcp-server / docs-lint を先に回してマシンが静かな状態で web の vitest を最後に置いたら 963/963 緑。「warm なら通る」だけでは足りず、**並走を減らす**のが効いた
- **やらなかったこと**: 背後の DOM への `inert` / `aria-hidden`（Modal / BottomSheet も付けておらず、DoD は Tab トラップまで）。Capacitor のハードウェア戻るは pushState の恩恵を自然に受けるが未検証

### 2026-08-30 - 配布後の追随 2 件（#1252 ポリシー §6 の食い違い / #1251 サインイン中の導線）

#### 概要

2026-08-29 に出した 3 本（#1199 / #1197 / #1198）が merge され、その実ブラウザ検証で chat-main が見つけた 2 件を処理して PR #1257 / #1270 を open にした。どちらも `origin/main` から独立に切った枝で、CI の `verify` 全ステップ + docs-lint をローカルで exit 0 まで通してある。merge は未（P-001）。

#### 変更点

- **#1252（PR #1257）**: プライバシーポリシー §6 が「アプリ内から自分で削除できる機能は準備中です」のままだった。#1200 が Settings → アカウントに削除を実装済みで、**文書が実装を過小申告していた** — 誰も気付かないまま、二手で済む操作をメールで依頼させる形になっていた。en / ja とも Settings を指し、連絡先は「その操作ができない場合」の逃げ道として残し、旧文になかった「即座に実行・取り消し不可」を明記した
- **#1252 の守り**: 綴りではなくドリフトを見張る。`settings.account.delete.button` がカタログに在る限り §6 は「準備中 / in preparation」と言えない、というテストを 1 本足した。**`i18n.exists` を使う**（`t` は未定義キーでキー文字列を返すので、機能の有無に関わらず通ってしまう）
- **#1251（PR #1270）**: ポリシー / 規約はサインイン中に到達手段がゼロだった（`?legal=` も session gate に飲まれる）。**reader を App へ引き上げ、URL をこの機能の唯一の正にした** — `openLegalDocument` が URL を書き換えて CustomEvent を飛ばし、`LegalReaderHost` が購読する。これにより 4 階層下の Settings カードが **props を 1 つも増やさずに** reader を開ける
- **#1251 で Context を採らなかった理由**: `SettingsScreen` は既存 6 スイートが render しており、Provider にすると全部を「他に用の無い Provider」で包む必要が出る。URL を SSOT にすればその 6 本は無傷
- **#1251 の配置**: Settings の General、チュートリアルとリセットの間（文書を読む行為の重さはリセットよりチュートリアル寄り）。reader は置き換えでなく重ね（下のアプリを残すので、読んで戻ってもセクションや入力途中が消えない）。リンク文言は `auth.legal.privacy` / `.terms` を引用（`auth.` 接頭辞は「最初にどこで要ったか」の記録であって所有権ではない）
- **踏んだ罠（記録）**: 1 回目のフル verify で `briefingEveningLazyMount.test.tsx` が落ちたが、**自分の変更とは無関係で vite の transform キャッシュが冷えているときだけ落ちる**。cold = 70 秒（transform 52 秒）で 2 件失敗 / warm = 7 秒で 7 件全緑。テスト本文自身が「the one test that does mount it pays the transform」と書いており、`waitFor` の既定 1000ms に transform コストが直で効く。**「分岐元 main で通った」を根拠にするときは順序に注意** — キャッシュが共有なので、先に回した方が後を温めてしまう

### 2026-08-29 - shared-fix 3 件（#1199 ErrorBoundary / #1197 メール確認 / #1198 ポリシー・規約）

#### 概要

第三者への Web 配布に向けた `[web-public]` 3 件を順に処理し、PR #1215 / #1219 / #1222 を open にした。3 本とも `origin/main` から独立に切った枝で、CI の `verify` 全ステップ（shared → web → desktop → mcp-server）+ docs-lint をローカルで exit 0 まで通してある。#1215 / #1219 は GitHub 側の CI も両ジョブ pass を実測。merge は未（P-001）。ユーザー手番が 3 件（Supabase のトグル / ポリシー文面 / リージョン表記）出たので判断キューへ積んだ。

#### 変更点

- **#1199（PR #1215）**: `shared/src/components/ErrorBoundary.tsx` を新設し、`main.tsx`（I18nProvider の内側・他の全部の外側）と `MainScreen.tsx`（シェルの内側・セクション本体の周り）の 2 枚を張った。セクション側は `resetKey={section}` を持つので、**別セクションへ歩くこと自体が復帰操作**になる（リロード不要）
- **#1199 のクラス採用理由**: React が catch フック（`getDerivedStateFromError` / `componentDidCatch`）をクラスにしか生やしていないため、CLAUDE.md §6 の hooks 優先則はこのファイルに適用できない。i18n は他の shared 部品と同じく props 注入で、カタログを読むアダプタ `web/src/components/AppErrorBoundary.tsx` を web 側に置いた
- **#1199 の限界（PR 本文にも明記）**: 境界が捕まえるのは描画中の throw だけで、イベントハンドラ・非同期コールバック・commit 後の throw は素通りする。「白画面にしない床」であって global try/catch ではない
- **#1197（PR #1219）**: `signUp` の戻り値に `pendingConfirmation` を足した。Confirm email ON のとき Supabase は**成功なのに session を返さない**ため、`!session` で判定していた旧コードは「アカウントは出来てメールも飛んだ」状態を失敗として報告していた（しかも文言が「confirm-email を無効にしろ」だった）
- **#1197 の非対称な事実**: 登録済みアドレスでのサインアップも**同じ形**（identities 空の難読化ユーザー・session 無し）で返る。Supabase がアドレスの存在を開示しない仕様なので区別は不可能で、UI もどちらでも「メールを確認してください」と同じことしか言わない
- **#1197 の設定非依存**: プロジェクト設定は一切読まず、`signUp` の戻り値の形だけを見ている。ダッシュボードのトグルはデプロイ無しでどちらにも倒せる（トグル自体は D-20260829-web-1 として積んだ）
- **#1197 のリダイレクト先**: 確認メールのリンクも復帰リンクと同じ着地先が要るため、`passwordRecoveryRedirectUrl` を `authRedirectUrl` に改名して両方から使う（他に呼び出し元は無かった）
- **#1198（PR #1222）**: プライバシーポリシーと利用規約を en / ja で起草し、`web/src/legal/` に**データとして**置いた。i18n カタログに入れなかったのは、カタログが UI 文字列の平坦な地図なのに対し、文書は見出し・段落順・箇条書きという**形**を持つため。t を通すのはリンク文言と戻るボタンだけ
- **#1198 の導線**: AuthCard に `legalFooter?: ReactNode` を 1 個足し、両モードで表示（規約は読む人も縛る）・同意文言は新規登録モードだけ。読み手側はモーダルでなく全画面（スクロールして読む・リンクを送る文書とフォーカストラップは相性が悪い）
- **#1198 の URL**: Router は無いままだが `?legal=privacy` をアドレスバーに書く。URL が無いと「これがプライバシーポリシーです」を人に送れないため。共有リンクで開くと最初から文書が出る
- **#1198 で意図的にぼかした 2 点**: Supabase のリージョンは「日本国外」（US でも EU でも真。誤った国名を書くより良い = D-20260829-web-2）、連絡先は個人メールでなく GitHub Issues（ポリシーページはスクレイピングされる = D-20260829-web-3）。データ削除も「連絡先へ依頼。アプリ内の削除機能は準備中」と実態どおりに書いた（削除機能はコードベースに未実装）
- **検証の形**: 3 本とも「静的ゲートまで」。実ブラウザ確認（フォールバック UI の目視 / 確認メール一連 / ポリシーページ）は §7.4 により chat-main 手番で、#1197 に至っては Supabase のトグルが ON になるまで実施できない

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
