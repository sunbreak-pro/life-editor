# HISTORY (chat-main)

### 2026-10-08 (2) - 拡張アプリの立ち位置を決めて計画書 Draft + 決定 2 件（D-20261008-main-1 / -2・PR #2158）

#### 概要

ユーザー依頼「life-editor と今後の拡張アプリの立ち位置・役割を決めたい。構想（出来事の保管 → 分析 → 次の Todo。家計簿などの数値は拡張アプリで収集）に意見を」。回答後に「その方向性で OK。Analytics に拡張アプリからのデータの収集・一覧化、leftSidebar に拡張アプリの登録・一覧タブ。この要件で実装計画書を。リポジトリは別々、手順がかなり増えるなら統合」。意見を返したあと、決定 2 件を台帳へ昇格し、計画書を Draft で書いて PR にした。

#### 変更点

- **意見（チャット）**: 構想は採用済みの Briefing ループ（朝刊 → Schedule → Work → 夕刊 → Claude 分析）と同じ軸で、Goals（#2101〜#2110）が「分析 → Todo」の配線の 1 本目。弱いのは分析の材料で、数値を貯める構想には賛成。先に作るべきは拡張アプリではなく共通の記録テーブル + MCP の道具で、最初の一歩は「テーブル + MCP + スマホの Claude から記録」を 2〜3 週間
- **D-20261008-main-1**（answered・Q1〜Q4 = A）: 役割分担（本社 / 支店）/ `app_records` は `items_meta` の外の独立テーブル（0018 の timer 系と同じ）/ データ先・アプリ後 / Analytics に記録タブ（既存 4 タブは凍結のまま。`archive/2026-07-16-loop-friction-fixes.md` 決定 6 を記録タブの分だけ supersede）+ サイドバーに Apps セクション
- **D-20261008-main-2**（answered・A 切替条件つき）: 別リポジトリを維持。手順を数えた差は「窓口の仕様ファイルと偽物の取り込み」1 つで、これは pdca-harness がどのみち要る。切替条件 = (a) 拡張アプリが `shared/` を import したくなったとき (b) 窓口の版上げで両リポジトリの同時変更が月 1 回を超えたとき
- **計画書 `2026-10-08-extension-app-records-and-apps-section.md`**（Draft・親 = 窓口の計画書）: `app_records` / `extension_apps` の列・RLS・Realtime・`delete_my_account` の更新 / 同期ドメイン 2 つ / MCP の道具 4 つ（`create_record` / `list_records` / `delete_record` / `list_extension_apps`）+ today / week context の records 要約 / Analytics の記録タブ（`AnalyticsTab` に `records`）と narrow のブロック / Apps セクション（`sections.ts` に `apps`・mobileOrder 6・`Blocks` アイコン・descriptor・登録 / 編集 / 削除・「記録だけ届いているアプリ」・Analytics への導線）/ Steps 11 本・Issue 下書き N1〜N8・AC 16 項目
- **ANSWERS.md** に 2 行追加。**PR #2158**（`docs/extension-records-apps-plan`・一時 worktree `docs-extension-records` 経由・サブエージェントが作成）

#### 実測・知見

- **先に出した意見を 1 つ取り下げた**: チャットでは「拡張アプリは同じ Supabase プロジェクトに同じユーザーで直接書く」と勧めたが、同日 merge の窓口の計画書と D-20261007-main-3 = A / -4 = B は窓口（専用 Worker・アプリごとの鍵）経由と決めていた。手元の main が `5a775287` で止まっていて PR #2137（13:18 merge）を読めていなかったのが原因。**着手前に `git pull --ff-only` して、決定台帳は origin/main で読む**（memory: stale-main-reasks-answered-decisions の再発）。計画書の代替案の表に取り下げの経緯を残した
- **Git Bash の `git show origin/main:path` と `git rev-parse HEAD origin/main` は `origin\main` に化ける**。`MSYS2_ARG_CONV_EXCL="*"` で回避（pitfalls 8 に追記）
- **Analytics の凍結は「一部解除」**: 記録タブだけ。既存タブを触りたくなる誘惑は Non-goals と Risks に明記した
- **窓口との identity の二重化が最大のリスク**: #2146 が鍵の保存先を独自に決めると、アプリの id が台帳（`extension_apps.slug`）と鍵側で 2 つになる。計画書 Step 8 は #2144 の着地を待たずに語彙のコメントだけ先に出す設計にした

#### 次

- 🛑 ユーザー手番: PR #2158 の merge（Step 1）。merge 後に N1〜N8 を起票
- 要判断: N5（Apps セクション）の宛先レーン
- 2〜3 週間の試用（スマホの Claude から記録）が済んでから、家計簿アプリの計画を別リポジトリで

### 2026-10-08 - アプリ内 Note「Issue報告」の 4 項目を回収して 8 本起票（#2141〜#2143・#2152〜#2156）

#### 概要

ユーザー依頼「Issue報告というタイトルの Note の内容を読み込んで Issue を起票して」。Remote MCP で Note を読み、Mobile 1 項目・共通 3 項目を重複チェックと実装箇所の当たり付けをしてから起票した。最後の項目（Claude Design で今の画面を再現して微調整する仕組み）は、ユーザーの希望どおり親 1 本 + 子 4 本の構成にし、GitHub の sub-issue で親子をつないだ。

#### 変更点

- **#2141**（`[shared-fix]`・type:bug）: 本文エディタがフォーカスを失うと履歴の提供を引き上げ（`RichTextEditor.tsx:607-610`）、ヘッダーの Undo / Redo が空のアプリ履歴を見て disabled になる。#1690 の仕組みの副作用。直し方は A / B / C の 3 案を書き、UX の分岐なので着手時に判断キューへ出す形にした
- **#2142**（section:schedule・type:feature）: タグフィルタのグループ。解除の処理（`handleSelectGroup(null)`）とタグの更新（`updateTagGroup(id, { tagIds })`）はデータの層に既にあり、パネルから呼ぶ口が無いだけ。Modal に閉じるボタンが無く、高さの上限も無い
- **#2143**（section:connect・type:bug）: `navigateToItem` が Todo を `{ section: "schedule" }` へ一方通行で飛ばし、詳細の `onClose` は詳細を閉じるだけ。移動元を覚える仕組みはアプリのどこにも無い。Desktop も同じ
- **#2156 親 + 子 4 本**（#2152〜#2154 は `[shared-fix]`・#2155 は section:schedule）: 1/4 = アプリの説明と設計の意図を部品集（DesignSystem プロジェクト）に常設し、`tokens.css` とのずれをテストで見つける / 2/4 = 今の画面を再現させる指示書の型を作り Schedule で試す / 3/4 = 微調整した値を実装へ戻す手順 / 4/4 = タグフィルタパネルの作り直し（#2142 の見た目の部分をこちらへ分けた）。残りの画面の再現は、型が固まってから各レーンへ起票すると親に書いた

#### 実測・知見

- **Note の扱い**: 2026-09-01 はユーザー指示で回収後にソフトデリートしたが、今回は指示が無いので Note は残した
- **#2079 は PR #2090 で main に着地済みなのに open のまま**（`CalendarNarrowLayout.tsx:94` に narrow のフィルタボタンが実在）。#2036 も PR #2112（`refs #2036`）で着地済みだが open。どちらも close するかは未判断
- **サブエージェントの申告を 1 件訂正した**: 「部品集の `typography.html` は 10 段の文字の段階を持つ」は誤りで、10 段は Settings の文字サイズ（root 12〜25px）のこと。部品集は Tailwind の `text-*` をそのまま段階として載せている。#2154 の本文はこの実測で書いた
- **数え直した値**: `shared/src` と `web/src` の `.tsx` で、Tailwind の余白クラスが約 1,700 か所、`lumen-*` の余白トークンが 22 か所、`text-xs`〜`text-4xl` が 690 か所、`text-[…]` が 38 か所
- 起票の最中に別チャットが `[mcp-tools]` の 8 本（#2144〜#2151）を起票していて、番号が飛んだ

### 2026-09-26 - スマホの Claude アプリから life-editor MCP を使えるようにした（Remote MCP の本番化 = #1994）

#### 概要

ユーザー依頼「Mobile 版の Claude アプリから life-editor MCP を使えるようにしたい。妥当性を確かめてから Issue にして」。コード（`mcp-server/src/worker.ts`）は #1589 で 09-12 に main へ入っていたが、Worker は一度もデプロイされていなかった（`/health` が Cloudflare の 1042・deploy ワークフローの実行 0 回）。公式ドキュメントで Claude 側の条件を裏取りして #1994 を起票し、こうだいさんと一緒にデプロイ → シークレット投入 → コネクタ登録まで通した。スマホの Claude からツールが動くことをユーザーが実機で確認した。

#### 変更点

- **妥当性の裏取り**（deep-web-research・一次資料 = claude.com/docs と support.claude.com）: Web で追加したカスタムコネクタは同じアカウントの iOS / Android でそのまま使える（スマホ上の追加はベータで資料同士が食い違う）/ ステートレスな Streamable HTTP と GET 405 は公式クイックスタートと同形 / 認証なし（No sign-in）は既定で使える・ヘッダ認証は組織オーナー限定のベータ / 接続元は Anthropic のクラウド（IPv4 `160.79.104.0/21`）/ 上限はツール結果 約 15 万文字・1 呼び出し 240 秒 / Free はカスタムコネクタ 1 本まで
- **Issue #1994** を `[main]`・`type:task`・`area:tooling` で起票し、結果をコメントで記録
- **本番化**: ユーザーが `wrangler login` → `npm run deploy`（Version `e1e9356d`）→ `secret put` ×5。こちらは curl で `/health` = `{"ok":true}`・誤トークン / トークンなしの `POST /mcp` = 404 を実測
- **PR #1997**（docs・branch `docs/remote-mcp-complete`）: 計画書 `2026-09-09-remote-mcp-mobile.md` を COMPLETED で `archive/` へ（乖離レビュー 3 行つき）。手順 5 に「Authentication は No sign-in」を明記。計画書の旧パスを指していた 13 ファイル（CLAUDE.md §5・移行 SSOT・D-20260909-mcp-mobile-1・mcp-server のコメント・deploy-mcp.yml）を張り替え、移行 SSOT の Remote MCP 2 項目にチェック、D ファイルの `implemented-by` に #1589 / #1994。`Closes #1994`

#### 実測・知見

- **つまずき ①**: シークレットの 1 本が `LIFE_EDITOR_SUPABASE_ANON_KEYL` という名前で入っていた。`wrangler secret list` の目視で見つけ、正しい名前で入れ直してから誤った 1 本を消した
- **つまずき ②（手順に反映）**: コネクタを OAuth 系の認証設定で追加すると、`initialize` が 200 で通っても Claude が `/.well-known/oauth-protected-resource` → `/.well-known/oauth-authorization-server` → `POST /register` へ進み、「サインインサービスに登録できませんでした」のトーストで止まる。認証設定は追加後に変えられないので、削除して **No sign-in** で追加し直すと通った。原因は `wrangler tail --format json` を 5 分流して特定した（URL のトークンは node のフィルタで長さだけ残して伏せた）
- **`!` 経由のコマンドは Bash で動く**: `cd C:\Users\...` の `\` が消えて cd が失敗し、`npm ci` がリポジトリ直下で走った。`/c/Users/...` の形で渡す。`wrangler secret put` の対話入力は `!` の中では貼れない見込みなので、PowerShell で直接打ってもらった
- **残り**: 本番のトークンが 8 文字で推測に弱い。64 文字への差し替えを #1994 のコメントでユーザー判断に回した

### 2026-09-23 - 棚卸し 3 本（デッドコード / 未完了 / 製品基準）→ 報告書 + 裁定 4 件（0030 push・デッドコード PR・配布前 Issue 4 本・完成条件の書き換え）

#### 概要

ユーザー依頼「dead コードがないか、他に着手していないものがないか、製品としての基準を満たしていないとしたら何がないかを確認して」。読み取り専用の調査エージェント 3 本（デッドコード / 未完了作業 / 製品基準）を並列に回し、Supabase の migration 台帳は自分で CLI 実測した。結果を HTML 報告書 1 枚にまとめて Artifact で発行し、こうだいさんの回答 4 件（push する / まとめて OK / きめる / かきかえて）を同じセッションで実行に移した。

#### 変更点

- **報告書**: `docs/reports/2026-09-23-product-audit.html`（Artifact https://claude.ai/artifact/6uBiKGVjaDjeHWN98iUdy3）。結論カード 3 枚 = 今日から（0030 push）/ 配る前に（SMTP・Electron・エクスポート・問い合わせ導線）/ 入れない（署名・自動更新・OAuth・Sentry・Tier 3）
- **Issue 起票 5 本**: #1985（デッドコード削除・`[main]`）/ #1986（独自 SMTP・`[web-public]` shared-fix・配布前 1/4）/ #1987（Electron 33 → 44・`[main]` area:security・2/4）/ #1988（JSON エクスポート・section:settings・3/4）/ #1989（ヘルプと問い合わせ導線・section:settings・4/4）
- **PR #1990（docs）**: 移行 SSOT の Phase 5 完了判定を書き換え（自動更新は完成後の判断表へ / MCP 条件は Desktop 起動導線 #1211 + Remote MCP / Phase 4 は完成条件から除外 / §9 Non-goals の「認証ありの公開配布」をマルチテナントに絞る / 5-A・5-B の着地済み項目にチェック）。台帳 D-20260923-main-1 / -2 を作成し ANSWERS.md へ転記。一時 worktree `main-ssot` は push 後に削除
- **PR #1991（デッドコード削除・#1985）**: worktree `main-deadcode`・branch `chore/dead-code-sweep-20260923`。role-engineer が実装 + CI 相当 15 ステップ緑、role-qa が独立監査。中身 = MobileFab / QuickAddSheet（部品 + テスト）/ 関数 3 個 / 再 export 3 行 / i18n 18 キー / web の `@dnd-kit/sortable` / CSS トークン 26 名 / 消した名前を指すコメントと design-system docs の追随。**見送り 2 件** = `materials.tags.usageCount`（`i18n.test.ts` が複数形解決の確認に使う）/ mobile の `@capacitor/preferences`（`supabaseAuthStorage.ts:87` が実行時に `window.Capacitor.Plugins.Preferences` を呼ぶネイティブプラグイン — 監査エージェントの見落とし）
- **tracker**: memory の Desktop ブロックに #1987 と D-20260830-main-3 を反映、直近の完了を 3 件に整理、history 4 エントリ（09-05 ×3 / 09-06）を `archive/2026-09/` へ

#### 実測・知見

- **migration 0030（タグの表示色 = PR #1603・09-12 merge）が本番の台帳に無い**: `supabase migration list --db-url` で 0001〜0029 は remote と一致、0030 だけ remote 空。`WIKI_TAG_ASSIGNMENTS_COLUMNS` が `created_at, is_display_color` を SELECT に含むため、列が無ければ `listAllTagAssignments` が 42703 で落ちる設計。0030 は `add column if not exists` で冪等なので手で当てていても push は安全。**push は auto mode の分類器（Production Deploy）で止まり、列の実在を読む node スクリプトも（Production Reads）で止まった** → 🛑 `cd supabase && npm run db:push` はこうだいさんの手番。Edge Function `delete-account` の deploy 状態はアクセストークンが 401 で未確認（Supabase MCP も同じ理由で Unauthorized）
- **デッドコードの実態**: import グラフ 1,191 ファイルで完全孤立 0、退役機能（Terminal / File Explorer / d3 / Tauri / D1）のコード残骸 0、MCP カタログ 43 = 43。残るのは「バレルに載っているが誰も取り出さない」部品と i18n / トークン。判断が要るものは残した = `dataServiceRouting.ts`（型検査目的・tests 専用）/ Desktop IPC 4 本（`getTheme` 等 — `ThemeContext` が `setTheme` を呼ばず OS の `nativeTheme` に届いていない**配線漏れの可能性**）/ web の `@supabase/supabase-js`（dedupe 方針）/ `electron-updater`（完成後）/ `life_tags_migration_log`（rollback 用）/ `SectionId` 再 export（CLAUDE.md §3.2 連動）
- **未完了の実態**: open Issue 12 件のうちコードで拾えるのは #1974 / #1973 / #1972 の 3 件。close 待ち = #1850 / #1335 / #1121（`gh issue close` は auto mode で止まる）。Remote MCP は計画書 Step 3〜5 が未実施で deploy ワークフローの実行 0 回。移行 SSOT の完成 8 条件は達成 2 のみ（→ PR #1990 で書き換え）。リモートブランチ 510 本は PR 無し 0 / 取り残し 1（`fix/analytics-restore-axis-label-helpers` = #1907 CLOSED の残骸）
- **製品基準**: 認証（サインアップ〜削除）/ RLS 20 テーブル漏れ 0 / 法務 ja・en 本文実在 / ErrorBoundary 2 層 + オフラインバナー / テスト 549 ファイル 約 5,250 件 / typecheck 除外 0 / i18n 差は `_one` 12 件のみ。欠け = 内蔵 SMTP のまま Confirm email ON / Electron 33 系（現行 44・サポートは直近 3 メジャー）/ エクスポート無し / ヘルプ導線無し / Electron に CSP 無し / LICENSE・CHANGELOG・`.env.example` 無し / E2E 自動化無し。`npm audit --omit=dev` の high = web 1（tiptap）/ desktop 4 / mcp-server 4、critical 0
- **記録の片付け候補（未実施）**: 回答済み判断の台帳化 4 件（D-20260905-shared-fix-1 は PR #1913 で実装済み・台帳未作成）/ memory 7 本の「未回答」表記 / `memory/chat-schedule-refine.md:98-100` の conflict 残骸 / CLAUDE.md:59 の閉じた Epic #321 参照 / ANSWERS.md:117 の旧パス / known-issues INDEX 集計行 / 未起票 3 件（ErrorBoundary 不在箇所・狭幅ツアーの z 順・Connect 一括操作の進捗表示）/ 未追跡 = Draft 計画書 `2026-09-02-fable-51-harness-retune.md`（commit か削除の判断）と `shots/` 71 枚 6.4 MB（`.gitignore` 候補）
- **環境**: Bash の複合コマンドで `cd` すると cwd が漂流し、以後の相対パスが全部外れる（`.claude/comm/decisions` に落ちたまま `ls shared/src` が「無い」と返った）。`git -C` / `npm --prefix` / 絶対パスで書く。`MSYS_NO_PATHCONV=1 git -C /c/...` は `-C` 側の変換まで止めて失敗するので `C:/...` 形で渡す。PostToolUse の formatter は `.claude/**/*.md` の表を整形し直すため、触っていない表の hunk（9 行）が diff に混ざった → HEAD の内容を splice で戻した
- **サブエージェントの申告差**: role-engineer は依頼した `Co-Authored-By: Claude Fable 5.1` を使わず自分のモデル名で署名した（squash merge で潰れるので放置）。amend + force-push の依頼は git-workflow の規約を理由に断り、追いコミットにした（正しい判断）

### 2026-09-19 - 他レーンの受信を実測で裁く → #1677 の依存解除・#1679 を実ブラウザ確認して close

#### 概要

connect-refine-d3 と materials-refine-d7 から受信 4 件。報告はすべて `origin/main` で実測してから裁いた。#1676 の着地を確認して #1677 の依存を解除し、materials の次の 4 本を確定。溜まっていた chat-main の手番のうち #1679 を実ブラウザで確認して close した。

#### 変更点

- **#1677 にコメント**（`issuecomment-5739197309`）: 依存 A が解除された旨と、使える部品 3 つの import 元・責務境界
- **#1680 / #1674 を close + #1722 / #1723 を起票**: どちらも DoD は全項目 PASS だが、#1680 の実装が狭幅で新しい不具合を生んでいた
- **#1671 を close**（`issuecomment-5740202141`）: 4 項目とも合格。レポート = `.claude/docs/reports/2026-09-19-issue-1671-mobile-verify.html`（Artifact v1 = https://claude.ai/artifact/GViM22WEXXGeFkximaYQLm・スクショ 5 枚を `shots/` で同梱）
- **#1679 を close**（`issuecomment-5740155396`）: DoD 全項目 PASS。ローカル main を 7 コミット遅れから `0d508a86` へ ff、dev server + `playwright-ui-verifier` で実測

#### 実測・知見

- PR #1685 は 2026-09-17 14:11 UTC merge・#1676 は CLOSED・#1677 は OPEN（`section:materials`）
- 部品は `shared/src/components/TagHub/` に実在し、`shared/src/index.ts:833` → `components/index.ts:476` → `TagHub/index.ts` の `export *` 3 段で `@life-editor/shared` から届く
- `TagActionsMenu` の責務境界がコード側で明示されている: 削除は「要求」でホストが確認レイヤーを持ち、識別系 3 項目は `TagHubEditField` を返すので `TagHubEditBlock` にそのまま渡せる
- **materials レーンの次の 4 本を確定**（issue-prompter で実測）: 未着手 = #1677 / #1687 / #1688 / #1689（4 本とも依存宣言なし）。除外 = #1680（PR #1693 open）/ #1674（PR #1699 open）/ #1679（PR #1683 merged だが Issue は open）
- 🛑 **#1679 は chat-main の手番**: PR #1683 の本文が「Not checked in a real browser. worktree policy keeps playwright on chat-main」と明記。DoD の「Desktop 幅で全項目が押せる」を実ブラウザで確認してから close する（PR は `Refs #1679` なので自動 close されていない）
- **#1679 は PASS**（実測値）: Daily エディタカードの computed `min-height` = 270px（`min-h-60` = 15rem × root 18px）・`min-h-0` は残存なし。本文が空の日でカード下端 y=414 に対しメニュー下端 y=281 = **余白 133px**。viewport 高さ 700px でも 270px を維持。`elementFromPoint` で各行の中心と下端 3px 手前を叩いて最前面を確認。Mobile 390x844 では kebab がカード外のヘッダー行にあり `overflow-hidden` の影響を受けない。6 セクション巡回で console error 0
- ⚠️ **#1679 は構造としては直っていない**: `Menu` が portal されずカード内に描画される形は修正前のまま。**項目が 3 行を超えると再発する**（現状の余白 133px が 36px 行 3 つ分）。再発時は min-height を積まず portal 化を検討する、と Issue に申し送り済み
- **#1671 も PASS**（390x844・dark・実データ）: #1516 = 末尾 9px の輝度が 400 → 11 で地色に溶ける（`mask-image` 実測 = `linear-gradient(to right, rgb(0,0,0) calc(100% - 9px), rgba(0,0,0,0))`）/ #1515 = スクロール容器が 331 対 331 で祖先に横溢れゼロ（起票時は 339 対 331）/ #1558 = 4 要素とも 49.5x49.5、gap 中央（x=243 と x=263.3）は容器が返り隣を誤爆しない / #1517 = 4 タブの y が 371.4 で揃い高さ 33。console error 増分 0
- **再起票しなかった所見 2 件**（Issue にコメント済み）: ドロワーのタブ帯は 98.3x33 で 44px 床の対象外（`::after` が `content: none`）/ 「Move to today」は `opacity-0` + `group-hover` でデスクトップ Chrome では見えず、`[@media(hover:none)]:opacity-100` の実機挙動はこの環境で確認できない
- **chat-main の実ブラウザ手番を棚卸しした**（merged PR × open Issue の突き合わせ）: `gh pr list --state merged --limit 120` の**タイトル**に Issue 番号を持つものだけを数え、tracker / outbox / docs ブランチの PR 37 本を除外すると 6 件。うち実ブラウザ待ちは #1680 / #1674（本文に "Not checked in a real browser"）と #1637 / #1638（PR 本文の未チェック項目に「実ブラウザ（chat-main）」）。残り 2 件は正常な open（#1644 = 2 本目の PR 待ち / #1642 = リファクタリング継続中）
- **突き合わせは PR タイトルで絞る**: 本文の `#<n>` を拾うと tracker PR が「今日触った Issue」を列挙するため誤検出が 15 件まで膨らむ。実装 PR は `fix(x): ... (#1679)` の形でタイトルに Issue を持つので、タイトルだけ見ると 6 件に落ちる
- 🛑 **#1637 / #1638 の残項目**: #1637 = チップのバブルと Todo 詳細の両方から変換 → Undo → Redo、あわせて「変換 → 別セクション → 戻る」で Undo が消えるか（計画書 #1642 の B-01 = Schedule の Provider が unmount で履歴を全部消す形が 5 本ある）。#1638 = 計画書 §6 の S11 / S12（各操作の直後に Undo → Redo・繰り返しでダイアログが出る）
- **#1722 の再実測は合格 → close**: 360 / 390 / 430 の 3 幅で星グループ右端 297.7 がカード右端（342 / 372 / 412）の内側、星 1 個 49.5x49.5 で 44px 床を維持、`elementFromPoint` で 5 個とも中心が自ボタン。1440 は横 1 行のまま（見出しと星の中心 y の差 3px 未満・星 31.5px）。**読み取り専用カードは呼び出し元が存在せず画面から到達できない**（`DailyView.tsx:672` が常に `onSelectMood` を渡す）
- **Connect Step 12 を通した → BLOCKING 2 件 + 設計差分 3 件を起票**: #1732（右パネルを開いたまま複数選択すると選択バーが崩れる。中央カラム 590px で en は 2 行折り返しでボタンの塗りから文字がはみ出し、ja は「2 件を選択中」が「2 …」に切り詰め。**en と ja で壊れ方が違う**）/ #1733（Mobile のエラートーストが下部タブバーに重なる。タブバー上端 783.6 に対しトースト下端 826）/ #1734（設計差分 3 件 = Mobile 上部バーが M1 と違う・リンク追加シートに「候補（N）」が無い・トーストのアイコンが AlertCircle でなく丸ドット）
- **一括操作 10 件の体感を実測**（計画書 §Risks の宿題）: タグを付ける = 件数反映 2,881ms / DOM 3,744ms、外す = 件数 45ms（楽観更新）/ DOM 2,447ms。選択は直後に解除され Untagged 34 → 24 → 34、開発 9 → 19 → 9 と往復。**「詰まる」とまでは言えないが、押した直後に何も変わらない時間が 1 秒以上ある**。進捗表示は無い
- **計画書は `.claude/archive/2026-09-14-connect-tag-link-workbench.md`**（Status COMPLETED で archive 済み）
- ⚠️ **#1715 は CI 緑でも merge しない**（schedule-refine からの申し送り + `git merge-tree --write-tree origin/main origin/claude/schedule-todo-tab-filter-1641` が **exit 1** で実測）: #1640（PR #1712）がトレイ上の単一作成ピルを廃止して見出し 2 か所へ移したのに対し、#1715 はその行がある前提でフィルタ行を作る。merge すると「+ Todo」ピルが 2 つ・ツアーアンカー `schedule-todo-add` も DOM に 2 つ・`web/tests/scheduleSidebar.test.tsx:431` が落ちる。**CI のチェックは古い base の上で走るので、緑は「いまの main と合う」を意味しない**
- **08:05 UTC 時点の着地**: Connect の 4 本（#1696 / #1698 / #1703 / #1709）と #1714 / #1710 が全部 merged。materials も #1687 / #1688 / #1713（#1677）/ #1720 が merged。**Connect ワークベンチが揃ったので Step 12 の実ブラウザ検証が chat-main の手番になった**
- **#1722 は materials が PR #1724 で修正**（実測から 30 分）: 狭幅だけヘッダーを `flex-col` にして星を独立した行へ出し、`md:` 以上は元の `flex-row` + `justify-between` に戻す。切り替えは `onSelectMood` の有無なので読み取り専用カードは 1 行のまま。44px 床は維持し、保険の `flex-wrap` も追加。**再実測（360 / 390 / 430）は merge 後の chat-main 手番**
- 🔴 **#1722 起票（#1680 の回帰）**: Mobile 幅で夕刊カードの気分の星 5 個のうち 1〜2 個が画面外に出て押せない。`DailyEveningCard.tsx:71` の `MOOD_STAR_BUTTON` が `max-md:min-h-11 max-md:min-w-11` を持つため狭幅で 1 個 50px になり、5 個のグループ 256.5px が見出し（右端 167.9）と `justify-between` で並んでカード（右端 372）をはみ出す。親が横スクロールを出さないので到達不能。実測 = 360 で 82px 超過 / 390 で 52px / 430 で 12px / 540 以上は収まる。**読み取り専用の `<span>` + 15px アイコン（約 83px）なら収まっていた = #1680 で入った差分**
- **#1723 起票（既存・データ損失なし）**: 夕刊だけの日で `stripEveningSection` が `content: []` の doc を返し TipTap のスキーマ検証に落ちる（警告 2 本）。**本文も夕刊も壊れない**ことを実測とコード両方で確認 — `DailyView.tsx:382` の `handleEditorUpdate` が保存前に `mergeEveningSection` で夕刊を戻す安全弁を持つ（`:378` のコメントが明言）。実害はコンソールのノイズだけ
- **#1680 の検証で触った値はすべて戻した**: 9/12 の気分をなしへ・9/10 を 2 へ・振り返りの文字数も元どおり（326 文字）。Daily 8 件 / Notes 20 件のまま増えていない。アップロードは 5 回とも Supabase に届く前に abort したので Storage にオブジェクトは無い
- **IME は CDP で代替確認した**: `Input.imeSetComposition` で変換中にして `keyCode 229` の Enter を送り、段落数が変わらないことを実測。**macOS WebKit の「`isComposing: false` + `keyCode 229`」経路は Chromium では再現できない**ので、そこは未確認のまま残る
- **connect-refine が 4 Issue 分の PR を open にした**（#1643〜#1646 のうち残り 3 Issue）: #1644 = PR #1696（一括タグ API + タグ統合）と PR #1698（複数選択と選択バー）、#1645 = PR #1703（右パネルの近傍モード）、#1646 = PR #1709（Mobile 3 段 + docs 追随・計画書は COMPLETED で archive 済み）、tracker は別枠の PR #1710。**merge 順は #1714 → #1698 → #1703 → #1709 → #1710**（全部 base = main だが後ろが前を含む）。固有分は 571 / 680 / 980 / 844
- **#1696 は 07:16 UTC に merge 済み**（`e432edeb`）。`connectScreen.test.tsx` の race 修正（PR #1714 = `await waitFor` で 9 行）を 4 本に cherry-pick する作業より merge の方が早く、**#1696 だけ +571/-1 のまま = main に race が残った**。#1698 以降は +9 が乗っている
- ⚠️ **squash merge と「前を含む PR」の組み合わせ**: #1698 の差分は #1696 の内容を丸ごと含むが、main 側は squash で SHA が別物。同じ変更を再適用する形になるので、前の PR が merge されるたびに取り込みと衝突確認が要る
- **CI が走らない PR がある**: #1698 / #1703 / #1709 は `statusCheckRollup` が 0 件（起動した形跡なし）。#1710 は FAILURE のまま。**行数と CI は別々に見る** — 「4 本とも緑」と読んだ最初の実測は、checks が 0 件の PR を「bad none」と数えていた
- **CONFLICTING は connect-refine が解消し、ロケール合流を実測で裏取りした**: 3 本とも MERGEABLE に戻り CI も起動。衝突の本体は `ConnectScreen.tsx` / `TagHubView.tsx` / `TagHub/index.ts` / `connectScreen.test.tsx` とロケール 2 本で、コードは「こちらが main の上位集合」として自分側を採用。**危なかったのはロケール**で、自分側を採用した最初の解消では main が先に得ていた 23 キー（`materials.daily.evening*` / `scheduleScreen.undoRepeat*` / `work.history.*` / `attachment.uploading`）が消え `DailyView.tsx` の `t()` が型エラーになっていた。main を土台にキー単位で合流し直したとの報告を実測し、**「main にあってブランチに無いキー」は en / ja とも 3 本すべてで 0 件**
- **`_one` サフィックスの en-only は欠損ではない**: i18next の複数形で、英語だけが one / other の 2 形を持つ。main の時点で 8 件あり #1698 で 2 件増えた（`connect.selection.failed_one` / `selected_one`）。**ja にあって en に無いキーは全ブランチ 0 件**なので、i18n の両 catalog 不変式は守られている。キー数の左右差を見ただけで「片側漏れ」と判定しない
- **main 取り込みで行数が実態に落ちた**: #1698 = +1260 → **+695**（900 行の目安を下回った）・#1703 = +2240 → +1675・#1709 = +3084 → +2520。前の PR の内容が差分から抜けたため
- 🛑 **chat-main の手番が 2 つ増えた**（4 本の main 着地後）: 計画書 Step 12 の実ブラウザ検証（1440×900 の 1a〜2f と 390×844 の Mobile 1a〜1l・light / dark）と、一括操作 10 件の体感実測
- **判断キューは作業コピーに現れない経路で積まれていた**: connect-refine は D-20260919-connect-1 を tracker PR #1710 に載せたので、merge されるまで `.claude/comm/decisions/chat-connect-refine.md` は「open エントリ無し」のまま。指摘して PR 本文へ全文を貼ってもらった。**tracker PR に積んだ判断は merge されるまで誰の目にも触れない** — 急ぐものは PR 本文に貼る
- **D-20260919-connect-1**（Mobile 上部バーに「＋」を置くか）: 推奨・放置時とも A = 現状維持。narrow ヘッダーは shell の形状 enum で、末尾アクションを足すと `MainScreen.tsx`（#1646 の Scope 外）に触るため。レール下端の追加行が narrow でも入口として出ている

> 古いエントリは [`archive/2026-09/chat-main.md`](./archive/2026-09/chat-main.md)・[`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
