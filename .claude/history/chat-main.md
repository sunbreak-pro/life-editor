# HISTORY (chat-main)

### 2026-11-16 - 機能の棚卸し（Issue #2716 の手順 1）・12 の決定・削除の Issue 12 件・着地済みの Issue 50 件の close

#### 概要

こうだいさんの依頼「Issue #2716 の手順 1 を進め、機能を『残す / 削除の候補 / 迷う』に分けた表を見せてほしい」を受けて、79 件の機能を書き出した。最初の分類は、残す 31・削除の候補 25・迷う 17・削除がほぼ確定 6。報告書 = `docs/reports/2026-11-16-feature-inventory-for-removal.html`。コードは変えていない。

#### 変更点

- **こうだいさんの回答（4 つ）**: 予定の実績時間は消す。Analytics はセクションごと消す。配布向けの 5 件（サインアップとメール確認・アカウント削除・利用規約とプライバシーポリシー・ヘルプ・ツアー）は消す。ノートのテンプレート・ノートのパスワード・予定のタグのグループは使っているので残す
- **1 回目の回答のあとの内訳**: 残す 35・今日削除が決まった 14・削除がほぼ確定 6・削除の候補 17・迷う 7
- **2 回目の回答（3 つ）**: 音とタイマーまわりの 4 件（環境音のミキサーと音の土台・完了のチャイム・サイドバーのタイマー表示・サウンドアイテム #2369）は Work 画面と一緒に消す。画面から呼ばれていない 12 件は、AI のカスタマイズ以外の 11 件を消す（Issue #2757・#2758）。デイリーのピンと、予定と Todo の相互変換は残す。「殻と道具」の質問（データの書き出し・iOS と Android の殻・検証用の MCP の道具）には回答が付かなかった
- **2 回目の回答のあとの内訳**: 残す 37・削除が決まった 29・削除がほぼ確定 6・削除の候補 4・迷う 3
- **起票**: Issue #2749（ツアー）・#2750（ヘルプ）・#2751（利用規約とプライバシーポリシー）・#2752（サインアップとメール確認）・#2753（アカウント削除）・#2754（Analytics）。配布向けの 5 件は同じファイルを触るので直列にした。予定の実績時間は、Issue #2717 と #2718 にコメントで足した
- **3 回目の回答**: データの書き出し（Issue #2759）・iOS と Android のアプリの殻（Issue #2760）・ノートの表へのタグ付け（Issue #2761）は消す。オフラインの機能は「圏外の読み書きまで」消し、再読み込みを速くする保存と Service Worker は残す（Issue #2762）。検証用の MCP の道具・AI のカスタマイズ・ショートカットの割り当て直しは残す
- **3 回目の回答のあとの内訳**: 残す 40・削除が決まった 33・削除がほぼ確定 6。候補と迷うは 0
- **2 回目の起票**: Issue #2757（画面から呼ばれていないコードの掃除）・#2758（Desktop の自動更新の骨組み）
- **Issue の close**: こうだいさんが着地済みの Issue の close を認めた。67 件を別の役が読んで分け、全部着地の 4 件と、目視だけが残る 43 件を閉じた。圏外で書く機能の 3 件（Issue #2335 #2336 #2337）は、やらないものとして閉じた。残りがある 20 件は open のまま。一覧は Issue #2361 のコメント
- **決定の記録の訂正**: 別の目での確認が、DB の表を DROP するかを「未決」と書いた 2 本の誤りを見つけた。2026-11-12 に「0018 の表は残す」と決まっていたので、merge の前に直し、Issue #2717 にも訂正を書いた
- **決定の記録**: 12 本を台帳に書いた（PR #2755）。配布向けの決定は、2026-10-22 の決定の「コードに残す」の 1 行だけを置き換える

#### 実測・知見

- 音の土台（`AudioProvider`）を使うのは `TimerHost` と `WorkScreen` の 2 か所だけ。Work 画面を消すと、環境音・完了のチャイム・サイドバーのタイマー表示は使う所がなくなる
- 作業記録（`timer_sessions`）は 2026-08-01 以降で 30 回・155 分。拡張アプリの記録は 0 件、AI のカスタマイズ（ルール・記憶・スキル）は 3 つとも空だった
- Tier 3 の 6 機能のうち、コードが残るのは Analytics だけ。要件の文書が「凍結」と書く 4 タブは、隠す仕組みが無く表示されていた。Playlist は画面が無く、データの処理と表だけが残る
- Issue #2717 が消す候補に挙げる `eveningDay.ts` は、夕刊の予定と Todo の行も作っている。`WorkBreakBalance.tsx` は朝刊の右パネルも使う。どちらもファイルごとは消せない
- 決まったことを聞き直した原因は、Issue のコメントを読まずに本文の「着手前に決めること」だけを見たこと。Issue を読むときは `--json comments` も読む
- オフラインまわりは 4 層（ピン付きノートの先読み・送信待ちの箱・再読み込み用の保存・Service Worker）で約 4,300 行。`DataService` 全体を `createOfflineDataService` が包んでいる
- Supabase の MCP（データベースを直接読む道具）が `ByteString` のエラーで使えず、件数は life-editor の MCP で読める範囲だけになった。テンプレートやパスワードの件数は取れなかった

### 2026-11-16 - ハーネスの点検（改善 6 件）・定時の実行が止まった原因の特定・進捗メモの棚卸し

#### 概要

こうだいさんの依頼「ハーネスの構造を確かめ、改善の余地と、Issue を片づける手順と依頼文を教えてほしい」を受けて点検した。open の Issue 124 件のうち 69 件は PR が main に入っていて、確認と close だけが残っていた。報告書 = `docs/reports/2026-11-15-harness-check-and-issue-prompts.html`。こうだいさんの回答は「69 件は振り分けてから閉じる」「ハーネスの直しは 5 つとも直す」。

#### 変更点

- **並列で作る PR の本文**: issue-workflow の「PR の決まり」に「確かめたこと / 確かめていないこと」と「読む順」を足した（PR #2743）。`--body-file` で本文を渡す PR には、リポジトリの PR の型が効いていなかった
- **定時の実行**: 昼の監査とまとめが 2026-11-02 から 22 回続けて `setup failed` で止まっていた。作業場所 `workspaces/life-editor/routine` が worktree を外したあと空のフォルダだけ残り、起動スクリプトが印の無いフォルダを断っていた。空のフォルダを外し、空なら作り直すようにした（PR #2744）
- **セッション開始の警告**: main の checkout で「名前のファイルが 3 日以上古い」が毎回出ていた。linked worktree だけで検査するよう直した（claude-dotfiles の PR #119。テスト 877 件が通過）
- **進捗メモ**: 進行中 5 本と予定 8 本の見出しを PR・Issue・計画書の実測で判定し、すべて履歴へ移した。進行中は Issue #2715・#2714・#2361 の 3 件に立て直した
  - 完了: Desktop 配布（Issue #1300 #1301 #1987 は CLOSED、Release は v0.2.1 が公開済み。Windows 実機の 1 項目だけ残る）、worktree の総入れ替え、2026-08-10 の /goal の残件、#524、クリーンアップ（挙げていた 17 本のブランチは無い）
  - 運用が変わって無効: 拡張アプリの記録（削除の Issue #2720 が 2026-11-11 に立った。#2163 #2167 #2168 は OPEN）、ループカタログの試験運用（計画書は DEFERRED、loop のスキルは `loop-implement` だけ残る）、Loop Engineering の続き、ハーネス統合の残件、実機の目視待ち（Issue #2361 に引き継ぎ）、任意・将来タスク
  - こうだいさんの作業として残る: #700 の検証用 MCP（`.mcp.json` に `life-editor-verify` が無い）
- **merge 済みで open の 69 件の振り分け**: PR が変えたファイルで分けた。画面に見える変更 57 件、画面のファイルを触っていないもの 9 件、データベースの変更を含むもの 3 件

#### 実測・知見

- 進行中の枠は 3 件だが、13 本まで増えていた。完了した見出しを消さずに「現在」を足し続けたのが原因
- 定時の実行は 2 週間止まっていたが、誰も気づかなかった。失敗は `automation/logs/runs.log` にしか出ず、セッションの最初にも報告の PR にも現れない
- Issue #2714（2026-12-30 に完成させる範囲を決める・最優先）は「ハーネスの反映が終わるまで実装を止める」と書いている。点検の最初の報告はこれを見落とし、実装の回を先に勧めていた。Issue の一覧をラベルと件数だけで読むと、親の Issue の方針を落とす
- 2026-11-04〜2026-11-15 の履歴の項目は無い。この間の作業は `git log --since=2026-11-03` と `archive/2026-11-15-align-with-shared-rules.md` で追える
- 古い部品の調査で、判断待ちの置き場に、台帳へ昇格していない回答済みの判断が 6 件と未回答 1 件（`chat-refactor-core.md` に 2 件、`chat-schedule-refine.md` に 5 件）残っていると分かった。関連の PR はすべて merge 済み

### 2026-11-03 - worktree の片付け・並列 PR の衝突の調査と重なり検査（#2492）・PR 46 本の merge・main の CI 修理（#2534 / #2538）

#### 概要

ユーザー依頼「不要な worktree とファイルを消して。並列で PR を出すと衝突が起きるので、worktree ごとに触るファイルが区切られているかを調べて、必要なら直して」と、その後の「たまっている PR の merge を始めて」「main に戻して残りを消化して」。worktree 5 本と残骸を消し、衝突の原因を調べて重なり検査の仕組みを PR #2492 で入れ、open PR を下書き 2 本以外すべて merge した。途中で main の CI が赤くなったので、修理の PR を出して緑に戻した。

#### 変更点

- **片付け**: worktree 5 本を削除した（refactor-core / work-refine / mobile-refine / analytics-refine / mcp-tools。ブランチは残した）。登録が外れた残骸フォルダ 6 個、メインの作業コピーの `shots/`（40MB）、workspaces 直下にあった 9 月のログ 11 個も消した。`routine` は空のまま別プロセスが使っていて消せていない
- **衝突の調査**（Workflow・Sonnet 3 体で調査 → Sonnet で決定 → Opus で実装 → Sonnet 2 体で検証）: レーンとパスの対応表がなく、着手前にも PR 前にもファイルの重なりを見る手順がなかった。直近 4 週間の PR 151 本のうち 12 本で衝突を確認した。同じ機能ファイルを触る PR の組 86 組のうち 60 組は、同じレーンの別 Issue 同士だった
- **PR #2492**（merged `4b159f0d`）: 担当表 `.claude/scripts/lane-ownership.json`、検査スクリプト `scope-overlap.mjs` とその単体テスト、docs-lint の (g) を足し、worktree-policy / issue-prompter / issue-dispatch / `_TEMPLATE.md` / CLAUDE.md §7.4 / Issue フォームに手順を入れた
- **merge**: 46 本。メインの作業コピーが別セッションの検証で埋まっていて merge-round が動かせなかったので、同じ事前確認（先頭の一致・mergeable・CI 全緑）を scratchpad のスクリプトに書き、`gh pr merge <n> --squash` で 1 本ずつ merge した。回の前の main は `ce170034`
- **main の CI 修理**: #2469 が `GoalDetailLabels` に 2 項目を足したところへ、#2482 のテストが古いラベルを渡していた（どちらも単体では緑）。#2534 を起票し、PR #2538 で固定データに 2 行足した。CI が赤だった 8 本は `gh pr update-branch` で今の main を取り込ませてから merge した
- **#2465 の衝突**: `ANSWERS.md` だけだったので、一時 worktree で両側の追記を残して解き、fast-forward で push してから merge した

#### 実測・知見

- **単体で緑の 2 本が組み合わさって main を壊す型の 2 例目**（1 例目 = 2026-09-22）。片方が型を広げ、もう片方が新しい固定データでその型を使う組み合わせだった。scope-overlap は同じファイルの重なりしか見ないので、この型は拾えない
- **CI の再実行は当時の merge ref のまま走る**。main の修理のあとに PR の CI を直すには、`gh pr update-branch` で新しい push を起こす。PR を閉じて開き直す方法は auto mode に止められた
- **`git checkout main` は `.claude/settings.json` の deny に入っている**。メインの作業コピーを main に戻すのはこうだいさんの手番になる
- **ほかのセッションが per-issue の worktree（fix-24xx〜25xx）を作っては消している**。調べた数分後に消えていることがあるので、worktree を前提にした指示文は渡す直前に `git worktree list` で確かめる

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

> 古いエントリは [`archive/2026-09/chat-main.md`](./archive/2026-09/chat-main.md)・[`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
