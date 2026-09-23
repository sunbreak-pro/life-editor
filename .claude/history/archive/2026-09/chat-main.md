# HISTORY archive 2026-09 (chat-main)

### 2026-09-06 - open Issue 33 件を 9 レーンへ /goal 組み立て + 同日 merge の Mobile 修正 6 本を実ブラウザ検証

#### 概要

ユーザー依頼「現状の把握 + issue-prompter でプロンプト作成」→「chat-main で実行できることを一つ」。`issue-prompter` で open 33 件（open PR 0 本）を 9 レーン 23 件の `/goal` に束ねて表示し、続けて同日に main へ merge された Mobile 幅点検の修正 6 本（#1485 / #1513 / #1520 / #1524 / #1525 / #1527）を `playwright-ui-verifier` で runtime 検証した。結果は PASS 5 / N/A 1、console error 増分 0（0029 起因の 400 は除外）。各 Issue に実測値をコメント。

#### 変更点

- **/goal 配布**: settings 2 / analytics 2 / materials 4 / schedule 5 / briefing 2 / work 1 / connect 2 / tags-docs 1 / shared-fix 2（#1521 + #1512 の共有部品分のみ）/ refactor-core 1（#1388）。采配残 = #1526（`section:settings` と `section:tags` の 2 ラベルで宛先が割れる）/ #1300（コードは main 着地済み・残りはリリース workflow の初回実行と実機受け入れ = 人手）/ #1301（#1300 の着地が前提）/ #1408 #1409 #1335（`[main]`）/ #1121 #716（`[all]` Epic）/ #898 #677（frozen）。#1512 の画面別分は共有部品の着地後に section ごとへ割り直す
- **実ブラウザ検証（main 8560feda・vite 5173 の先客を流用）**: #1513 = ロゴ `word-break: keep-all`・scrollWidth 343 = clientWidth・「夕」「刊」同一行（UI 言語が en だったので ja 文字列は同一要素へ一時差し替えて計測）/ #1520 = ルーチン 0 件で N/A / #1524 = **migration 0029 が本番未適用（remote 最新 0028）で `timer_sessions` が 400 = 本物の 1 系統失敗**のもと status 要素「Some data could not be loaded (work sessions)…」が出て Todos 5 / Notes 8 など他系統が生存 / #1525 = カテゴリ選択でドロワー 332px が閉じ、ペイン width 390 / #1527 = 行タイトル width 260（旧 111）・2 段構成 / #1485（1280×800）= Todo 作成 → ヘッダー Undo で消え、リロード後も復活なし（soft delete でゴミ箱行き = 設計どおり）。検証データ `verify-1485` はゴミ箱から完全削除済み
- **副産物（未起票）**: ノート表示で warning `[web RichTextEditor] TipTap content schema error: Invalid JSON content` が複数回出る。#1521（callout ノード欠落で本文破棄）と同根の可能性があり、#1521 の着地後に再確認する
- **環境メモ**: ローカル `chore/tracker-main-20260906`（origin にも存在）は PR #1530 と同じ 18 行の差分しか持たない残骸で、PR 不要。worktree `docs-1409-report` / `plan-1409` / `tracker-main-20260905b` の削除は引き続きユーザー手番

### 2026-09-05 - #1409 Mobile 幅点検の実行セッション — finding 16 件（#1512〜#1527）起票・レポート PR

#### 概要

ユーザー依頼「1409 の実行を開始して」。計画書 `2026-09-05-mobile-screen-audit.md`（PR #1489 merge 済み）どおりに実行セッションを回した。dev server は先客 5174 を流用し `browser_resize(390, 844)` で固定（`innerWidth = 390` を全報告で実測）。シェル調査 → 7 画面を `playwright-ui-verifier` 直列（フォールバック 0 回・stream 停止なし・5〜25 分 / 40〜190 ツール呼び出し）→ 結合 M1〜M10 → 後始末 をメインが回し、所見はスクリーンショット / コード / SQL / MCP で spot check してから 1 件 1 Issue で起票。レポートを `docs/reports/2026-09-05-mobile-screen-audit.md` に置き、計画書を COMPLETED で archive へ（PR = docs/1409-mobile-screen-audit-report）。所要 約 2 時間（17:44〜19:45 JST）。

#### 変更点

- **環境の注記**: migration `0029_timer_sessions_event_link.sql`（#1375 / PR #1456）が**本番未適用**（remote は 0028 まで）で、`timer_sessions` の GET が `column event_id does not exist` の 400 になる。TimerProvider がグローバル層なのでセクション切替のたびに console error が増える。console 増分はこれを除いて数えた（それ以外は全工程 0）。**分析は `AnalyticsScreen.tsx:147` の `Promise.all` で束ねているため、この 1 本で Todo / イベント / 完了数まで全部 0** → 結合 M2 の分析側は環境起因で PARTIAL、作りの側を #1524 に起票。🛑 ユーザーの `supabase db push` 待ち
- **画面別**: briefing = ロゴ「夕 / 刊」の語中折れ・Todo 行のはみ出し（編集 / 削除の常設）/ schedule = ドロワー Todo 行の 8px はみ出し・月セルの `text-overflow: clip`・繰り返しタブ「N日ごと」の折り返し / materials = `[[` 候補メニューが right 453 で横スクロール / work = 選択シートに繰り返しの発生分が同名 7 行 / analytics = ルーチン名 96px 固定 / connect = **エディタに `callout` ノードが無く MCP が書いたノートの本文が破棄される**（対象外所見から重要所見へ格上げ・`grep callout` が web / shared で 0 件） / settings = カテゴリ選択でドロワーが閉じない・TagEditModal に閉じるが無い・ゴミ箱のタイトル列 111px。横断 = タップ対象 44px 未満（ヘッダー 36 / ドロワー閉じる 32 / タブ帯 33 / 気分★ 35 / 各行ボタン 41・32・24 高）を 1 件に束ねて #1512（important）
- **エージェント報告の棄却 / 格下げ**: schedule「移動ボタンがホバー専用」→ `[@media(hover:none)]:opacity-100` で実タッチは常時表示（実機申し送り）/ schedule「往復で時刻が消える」→ D-20260902-sched-1 = A（本日ユーザー裁定）の決定どおり / work「選び直し導線が消える」→ シートに「選択を外す」行あり（判断待ち）/ settings「ゴミ箱のカテゴリが 4 つ」→ 空カテゴリを畳む実装 / #1486 は PR #1449（#1442）で `role=checkbox` が付いており Desktop 側の再確認で close 可とコメント
- **結合**: M1 / M3 / M4 / M6 / M7 / M8 / M10 PASS。M2 PARTIAL（分析 = 0029）/ M5 PARTIAL（Note は保持されるが予定のアンカー日は今日にリセット → 判断待ち）/ M9 = Note 本文チェックボックス 20×25.6・role 無し（#1523）。**M4 の Desktop → narrow は完全 PASS**（月セル / 朝刊 / ノートのチェックボックス / セクション保持）
- **後始末**: MCP `delete_todo` / `delete_schedule_item` / `delete_note` / `untag_entity` でソフトデリート → 繰り返しは 1280 幅の「予定の操作 → 削除 → すべての予定（過去分も含む）」→ タグは 1280 幅の TagEditModal → **390 幅のゴミ箱で 39 行を複数選択して一括削除**（操作できた）。実測 = `items_meta` 0 行 / `search_all` 0 / `list_wiki_tags` 無し / `timer_sessions` 当日 0 → 0。**残置 = `wiki_tags` の `PWV1409-tag` ソフトデリート行**（ゴミ箱にタグのカテゴリが無く UI から消せない = 判断待ち P-16。#1408 の `PWV1408-tag` も同じはず）
- **判断待ち 16 件**をレポート §6 に列挙（ドロワーのスクリムが下タブを覆う / ドロワーが左から出る / 月グリッド下の余白 / セルの並び順 / Todo 詳細に日時入力が無い / アンカー日のリセット / ヒントのモーダル化と文言 / タグの完全削除経路 など）。`mobile-scope.md` は書き換えず、#7 / #8 行の齟齬は #1522（docs）
- **一時 worktree**: `C:/Users/user/orca/workspaces/life-editor/docs-1409-report`（`docs/1409-mobile-screen-audit-report` + tracker ブランチ）は PR merge 後に削除する。`plan-1409`（PR #1489 merge 済み）も削除対象
- **知見**: (1) playwright のスクリーンショットは cwd 直下に落ちる — `.playwright-mcp/` 配下の相対パスで指定する（scratchpad は allowed roots 外で拒否される）(2) 月セルは「他 N 件」に畳むので画面文字での有無確認は不能 → MCP `list_schedule` で裏取り (3) 同名行の `getByLabel().first()` は同じ要素を叩き続ける → DOM 側で全チェックボックスを直接 click (4) Desktop で開いていた詳細パネルは 390 に戻すとドロワーとして残り、スクリムが下タブを塞ぐ → 幅を戻す前に閉じる

### 2026-09-05 - #1409 Mobile 幅点検の計画セッション（PR #1489）+ origin 取り込み + night-safe 22:48 走の outbox 保全

#### 概要

ユーザー依頼「#1409 の計画セッションを実行し、並列で origin から main を取り込んで現状把握」。Issue 本文の 2 セッション分割に従い**計画セッション**として計画書 `plans/2026-09-05-mobile-screen-audit.md` を書き（ブラウザ未起動）、Desktop 側 #1408 と同じ一時 worktree 経由で PR #1489 を出した。main は 617d4981 → 47d2ba6d へ fast-forward（23 commit・#1408 のレポート / 計画書 archive / schedule 6 PR / analytics #1375 / 添付 sweep #1438 などを取り込み）。

#### 変更点

- **計画書（PR #1489）**: Desktop 計画の骨格（1 画面 1 エージェント直列 + 結合と後始末はメイン直接・`PWV1409-` 台帳・停止条件・フォールバック 2 回連続）に Mobile 固有を足した = ①**390×844 固定**で各報告の先頭に `innerWidth` 必須（768 以上の報告は無効）②画面別の前に**シェル調査**（下タブ 4 + More シート・ハンバーガーの `MobileDrawer`・`sectionDescriptors.tsx` の `narrowHeader` 形・横スクロールと本文潜り #631・入力欄 16px 下限 #1134）③出ない機能は **`mobile-scope.md` の行と照合して「仕様どおり / 不具合 / 判断待ち」に 3 分類**し、判断待ちはレポートに列挙してユーザーへ回す（計画書も実行も `mobile-scope.md` を書き換えない）④結合 M1〜M10（Quick capture → 朝刊 / ドロワー・**Desktop 幅で作って narrow で読む M4**・More シートと下タブ跨ぎの state・ヘッダーと More シートの Undo が同じスタック・フォント下限の横断実測）⑤**タイマーは開始しない**（#1475 の `timer_sessions` 残骸を作らない）⑥繰り返しの削除は narrow に導線が無い仕様（#5）なので後始末で Desktop 幅へ戻す ⑦除外リスト = Desktop 起票 20 件（Mobile でも出れば既存 Issue にコメント）。Desktop 計画の除外 #1371 / #1399 / #1405 / #1406 / #1442 は全部 CLOSED を実測し回帰項目へ ⑧swipe / ソフトキーボード / safe-area / 実タッチは SKIP 明記 + **実機（Epic #716 DoD）への申し送り節**
- **origin 取り込みの詰まり**: `git pull --ff-only` が「未追跡の `outbox/chat-night-safe/night-safe-report.md` を merge が上書きする」で abort。origin 側（PR #1447 で着地）は 09-01 と 09-02 21:01 の 2 走で、ローカルの未追跡は **09-02 22:48 の 3 走目**（未着地）だった。退避 → pull → 3 走目を pulled ファイルへ追記して保全（本 tracker PR に同梱）。3 走目の起票依頼 3 件 = `routine-night-safe.md` / `routine-digest.md` の「登録はまだ」注記更新 / `mobile-scope.md` #16 行の #1035 追随（Epic #716 の docs ゲート）/ 未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` の始末 — **未処理**
- **現状把握（2026-09-05 実測）**: open PR = #1489 のみ（本セッション前は 0）/ open Issue 25 件（#1467〜#1486 の Desktop 所見 20 + #1409 / #1408 / #1388 / #1335 / #1301）。#1408 は実行完了コメント済みで、残るのはユーザー手番の `timer_sessions` id 18 / 19 と Issue の close。Epic #1121（通しツアー）/ #716（実機目視）はどちらもユーザー手番のまま
- **git 上の注意**: `git show origin/main:<path>` は Git Bash の MSYS パス変換で `:` が `;` に化けて失敗する。`MSYS_NO_PATHCONV=1` を付けるか、退避 → pull → diff の順で回す
- **未追跡のまま残るもの**: `plans/2026-09-02-fable-51-harness-retune.md`（Draft・git 未追跡・night-safe が 2 走連続で指摘）。本セッションでは触っていない
- **一時 worktree**: `C:/Users/user/orca/workspaces/life-editor/plan-1409`（`docs/plan-1409-mobile-screen-audit`）は PR #1489 merge 後に削除する

### 2026-09-05 - #1408 Desktop 全画面の実ブラウザ点検を実行 — finding 20 件（#1467〜#1486）起票・レポート PR #1487

#### 概要

計画書 `2026-09-02-desktop-screen-audit.md` どおりに実行セッションを回した。7 画面を `playwright-ui-verifier` の直列起動で点検し（2026-09-02 に 6 画面・セッションが日付を跨いで 2026-09-05 に settings）、結合 S1〜S10 と後始末はメインが playwright MCP を直接操作。所見はすべてスクリーンショット / コード / SQL で spot check してから 1 件 1 Issue で起票し、レポートを `docs/reports/2026-09-05-desktop-screen-audit.md` に置いて計画書を COMPLETED で archive へ移した（PR #1487 open）。冒頭で issue-prompter も回し、5 レーン分の `/goal` を提示した（配布はユーザー）。

#### 変更点

- **環境**: dev server は同じリポジトリ直下の vite の先客 5174 を流用（8/31 のサインインが残っていた。自分で立てた 5175 はログイン画面 = origin 別で session が無い → 停止）。1280×800・ja・light・console error 0 がベースライン
- **画面別（共通項目は 7 画面すべて PASS）**: briefing = ストリーク「最長 (日)」折り返し / schedule = 詳細パネル開でツールバー 2 行 / materials = 検索 0 件の空状態が「まだありません」+ 中央ボタン・テンプレ幅 818 vs 642 / connect = 右パネル常時空・戻ると選択リセット / work = リセットしたセッションが `timer_sessions` に未完了行で残る（SQL で id 18 / 19 を実測）・disabled ボタンの見た目 / analytics = 期間プリセットが Todo トレンドに効かない（`TodosTab.tsx:40` の `days={30}` を実測）・円グラフのラベル切れ・英語ラベル残り・生 id 行・タイル省略・`<html lang="en">` / settings = ショートカット競合が無警告・再割当後の `Ctrl Digit9` 表記・ヒントの「⌘K」
- **結合**: S1〜S4 / S7 / S10 PASS。**S8 で「アイテムを追加」の Todo タブから作った Todo が Undo で消えない**（Event は消える・2 回再現・リロード後も残る）→ #1485。S5 / S6 は PARTIAL（Todo 側のリンク一覧は製品に無い = チェックリストの前提違い / `timer_sessions` の残骸）。日付跨ぎでテストデータが 9/2 付けになったため、当日付の `PWV1408-main-1〜5` を作って S1〜S3 を回した
- **棄却 / 格下げしたエージェント報告**: 設定の 4 カテゴリのプレースホルダ（`SettingsScreen.tsx:840-843` で by design）/ 予定の「Todo へ変換」の配置（メニュー側にある）/ テンプレ幅の「サイドバーに被る」（中央モーダルとして正常・幅差だけを起票）
- **エージェント運用**: 6 画面は 1 回で完走（9〜22 分・61〜135 ツール呼び出し）。settings は 1 回目が ToolSearch 直後に stream 停止（600 秒無進捗）→ 再起動で完走。フォールバック（メイン直接）への切替は不要だった。settings エージェントが素材で誤って Untitled ノートを 1 件作ってゴミ箱へ入れたので、後始末で完全削除（08-29 以前の Untitled 6 件は未接触）
- **後始末**: MCP の `delete_todo` / `delete_note` / `delete_schedule_item` で 9 件をゴミ箱へ → 繰り返しは UI「すべての予定（過去分も含む）」→ タグはタグ編集モーダル（0 件だと確認ダイアログ無し）→ ゴミ箱で 15 件 + Untitled 1 件を一括完全削除。実測 = `search_all("PWV1408")` 0 / `list_wiki_tags` [] / `list_schedule(09-05〜09-12)` 空 / `items_meta ilike PWV1408` 0 行。設定は light / ja / 18px / ショートカット `{}` へ復元（開始時に残っていた `global:new-task = Ctrl+Digit1` の上書きも既定化）
- **🛑 残るユーザー手番**: `timer_sessions` id 18（task-1788353805055・13 秒）/ id 19（task null・12 秒）。UI にも read-only MCP にも削除経路が無い（#1408 コメントと #1475 の Gate に記載）
- **PR の経路**: main 直下ではブランチを切れないため一時 worktree `main-docs-1408` から `docs/1408-desktop-screen-audit-report` を切り、レポート追加 + 計画書の `git mv` → docs-lint 緑 → push → PR #1487 → worktree 削除
- **issue-prompter（セッション冒頭）**: open PR 0 本・0027 適用済みを実測し、briefing（#1442）/ schedule（#1440 / #1406 / #1405 / #1403 / #1401 / #1371）/ materials（#1439 / #1438）/ shared-fix（#1399）/ tags-docs（#1391 / #1390）/ analytics（#1375）の `/goal` 6 本を提示。采配 = #1408 / #1409 / #1335 / #1300（残り = Release 初回実行と実機 = 人手）/ #1301（#1300 依存）/ #1388（`CalendarTab.tsx` と i18n JSON が schedule 6 件と重なるため後回し）/ Epic 2 本 / 凍結 2 本
- **申し送り（#1409 Mobile へ）**: 横断で出そうなもの = #1481 / #1474 / #1478 / #1486 / #1480。#1476 と #1485 は Mobile の List+FAB でも同じコードを通る。テストデータの日付は実行日に合わせる

### 2026-09-02 - Issue 棚卸し + 5 レーンへ /goal 組み立て + #1408 計画書（PR #1441）+ #1335 作業分（PR #1443）+ 判断 4 件の回収

#### 概要

ユーザー依頼「Issue を整理し、issue-prompter で各 worktree へ渡すプロンプトを作り、画面ごとにエージェントを起動して検証する Issue（#1408）にも手を付ける」。open Issue 20 件を仕分けて 5 レーン 11 件の `/goal` を組み立て、#1408 は Issue 本文の 2 セッション分割に従い**計画セッション**として計画書を書いた（ブラウザ未起動）。あわせて outbox の起票依頼 3 件を処理し、退役レーン宛 3 件の宛先を振り直し、判断 4 件を AskUserQuestion で回収して台帳へ昇格した。

#### 変更点

- **main の分岐解消**: ローカル main に tracker コミット 1 つ（前セッションの直 commit・未 push）だけが取り残され `git pull --ff-only` が失敗。origin 側はその 2 ファイルも `.claude/automation/` も触っていないことを `git diff --stat main...origin/main -- <paths>` で確認してから `git rebase --autostash origin/main`。そのコミットは本日の tracker PR に cherry-pick で載せ替え、main は `git reset --hard origin/main` で origin と一致させた（**chat-main の tracker も PR 経由に統一** — 直 commit は次の pull を割る）
- **Issue 棚卸し（open 20 + 本日 4）**: 配布 = schedule-refine 5（#1371 / #1406 / #1405 / #1403 / #1401）/ shared-fix 1（#1399）/ tags-docs 2（#1390 / #1391）/ materials-refine 2（#1438 / #1439）/ refactor-core 1（#1388）。除外 = #1374（PR #1433 open）。采配 = #1408 / #1409 / #1335 / #1300 / #1301 / #1375 / Epic #1121 / #716 / 凍結 #898 / #677。**宛先振り直し 3 件** = #1399 `[layout-standard]`→`[shared-fix]`・#1390 / #1391 `[docs-workspace]`→`[tags-docs]`（両レーンとも退役済みで worktree が無く、issue-prompter の宛先解決に乗らなかった。Issue コメントで理由を残した）
- **起票 4 件**: #1438（添付の孤児回収 / materials outbox）/ #1439（添付アップロード進捗の方針 — 方針決めの Issue / 同）/ #1440（#1373 で凍った進捗の数字 2 つ / schedule outbox）/ #1442（朝刊「今日のスケジュール」Todo 行のチェックボックスを共有部品へ / D-20260901-shared-fix-2 の裁定から）
- **PR #1433 の migration 版番号衝突を検出**: #1425（2026-09-02 merge）が `0027_attachments_bucket.sql` を先に入れたため、#1433 の `0027_events_payload_reminder_offset.sql` と `0027` が 2 本並ぶ。ファイル名が違うので git は MERGEABLE と言うが `supabase db push` は版番号で並べるので通らない。`0028` への改名を PR コメントで依頼。**ユーザーの db push 順 = 0027 attachments → 0028 reminder → #1433 merge**
- **#1408 計画書 = PR #1441**（`plans/2026-09-02-desktop-screen-audit.md`・一時 worktree `plan-1408` 経由・docs-lint 緑）: 画面別チェックリスト 7 本（タブ / パネルの一覧は型 `BriefingTab` / `ScheduleSidebarTabId` / `MaterialsTab` / `AnalyticsTab` / `TrashCategory` / `SECTION_TAB_IDS` を指して個数を書かない）/ 結合 S1〜S10 / 1 画面 1 エージェント直列 + メイン直接操作のフォールバック（2026-08-31 に playwright-ui-verifier が API のセッション上限で落ちた前例を手順に組み込んだ）/ 停止条件 / `PWV1408-` 台帳 / 後始末（`search_all` = 0 と `list_wiki_tags` 残無しを AC に）。**書いてはいけないもの**を明示 = Daily / 目標ノート / フォーカスノート / `timer_sessions`（削除 API が無い = grep で `deleteSession` 0 件）/ 添付（0027 未 push）
- **#1335 作業分 = PR #1443**: 2026-09-01 に working tree へ置いたままだった `.claude/automation/` 6 ファイル + settings-unattended 2 本を、ユーザー裁定（PR にして出す）に従い `git diff` パッチ + 未追跡 2 本のコピーで一時 worktree `automation-1335` へ移して PR。docs-lint 緑
- **判断 4 件を AskUserQuestion で回収 → 台帳へ**: D-20260901-shared-fix-1 = **A**（ツアー再生は続きから・現状維持）/ D-20260901-shared-fix-2 = **B 相当**（揃える。PR #1395 / #1410 が merge 済みのため別 Issue #1442 で。提示ラベルとキュー原文のズレを D ファイルに注記）/ D-20260902-main-1 = **A**（#1440 は Todo 由来だけに寄せる。キュー未提出のまま回答が先行 — D-20260812-shared-fix-3 と同型）/ #1335 の着地先 = PR。ANSWERS.md へ 3 行転記・shared-fix キューから 2 件削除・#1440 に裁定コメント
- **未処理で残したもの**: #1442 の briefing-refine への `/goal`（起票直後で未配布）/ #1375 の 3 レーン分割起票（#1440 の裁定後に着手可能・未実施）/ mobile-refine からの #1400 / #1402 実機確認依頼（#1409 の実行セッションへ畳む）

### 2026-09-01 - main の CI 赤（TagUsageCard の存在しない import）を PR #1430 で修正

#### 概要

cb445180 以降の main で `shared — build (tsc -b)` が TS2307 で落ちていた。`shared/src/components/Analytics/TagUsageCard.tsx:13` が `./EmptyState` を import していたが、Analytics サブバレルの空状態は `AnalyticsEmptyState` という名前で、`./EmptyState` は存在しない。import 名と JSX タグ名を揃える 2 行の rename で解消し、PR #1430 を open。

#### 変更点

- **原因**: `components/index.ts` が Analytics サブバレルを `export *` で再エクスポートするため、`components/EmptyState` との衝突を避けて意図的に `AnalyticsEmptyState` へ改名してある（`AnalyticsEmptyState.tsx:14-17` のコメントが根拠）。TagUsageCard だけが旧名で import していた（同じフォルダの `MobileAnalyticsView` / `ScheduleTab` / `TimeTab` は全て新名）
- **修正**: `TagUsageCard.tsx` の import 1 行 + JSX タグ 1 箇所を `AnalyticsEmptyState` へ。props（`icon` / `title` / `description`）は両者で完全一致のため振る舞いの変更なし
- **検証**: `shared` の build / typecheck:tests / lint、`tests/analyticsTagUsageCard.test.tsx`（3 passed）、`web` の build — すべて緑
- **経路**: main 直下では feature ブランチを切れないため、一時 worktree `hotfix-emptystate` から `claude/shared-fix-tagusage-emptystate-import` を切って push → PR #1430（open）→ worktree は即削除
- **衝突リスク**: 同じ修正の branch を `materials-refine`（`claude/shared-fix-main-red-20260901`）と `refactor-core`（`claude/shared-fix-analytics-emptystate-import`）が先に切っていた。いずれも未 commit / 未 push だが、両レーンへ「#1430 で着地するので降りてよい」と伝えないと三重作業になる

### 2026-09-01 - アプリ内 Note「Issue報告」を回収して Issue 9 本起票（#1399〜#1407）→ Note 削除

#### 概要

MCP 経由でアプリ内 Note「Issue報告」（Desktop 1 / Mobile 4 / 共通 4 の 9 項目）を回収し、重複チェックと実装箇所のあたり付けをしたうえで #1399〜#1407 として起票した。文が途切れていた 1 項目は起票前にユーザーへ確認して内容を確定。全 9 項目の起票完了後、指示どおり Note をソフトデリートした（「Issue報告のテンプレート」Note は対象外として温存）。

#### 変更点

- **起票 9 本**: #1399（Desktop leftSidebar ブランドヘッダーの縦ずれ・`[layout-standard]`）/ #1400（Mobile サイドバー幅をフォントサイズ非連動へ・`[mobile-refine]`）/ #1401（Mobile 月カレンダー刷新 — 横余白ゼロ・丸点→タイトルの縦リスト・省略記号なし。#1148 の後続）/ #1402（サイドバー swipe 判定を外側にも・#1050 の後続）/ #1403（Event 編集の終日トグルと日付フィールドの重なり・#940 の後続）/ #1404（materials スラッシュコマンドに画像・ファイル添付 — Supabase Storage 前提・🛑 バケット作成はユーザー手番と明記）/ #1405（Event→Todo の逆変換を編集パネルへ・#997 / #1043 参照・Materials 側は触らない）/ #1406（「本日のTodo」タブを「本日分 / その他」の 2 分類へ再編 + ホバー移動 + 移動時は日付のみ変更で時刻保持 — 途切れ項目を AskUser で確定）/ #1407（Materials 切替時のノート表示ロード）
- **Note 削除**: `note-b26afda4-…`（Issue報告）を `delete_note` でソフトデリート（Trash から復元可）
- **ルーティング**: schedule 4 本 = `section:schedule` / materials 2 本 = `section:materials` / shell 3 本 = `shared-fix`（`[layout-standard]` 1 + `[mobile-refine]` 2）。mobile 系 4 本は Epic #716 を参照に付けた

### 2026-09-01 - コード整理監査（Tauri 残骸 / 未使用コード / docs 整合）→ Issue 7 本起票（#1385〜#1391）

#### 概要

ユーザー依頼でコードベースと docs を 3 並列サブエージェント（Tauri 残骸 / 未使用コード / docs 整合）で監査し、file:line の spot check を通った findings を 7 本の Issue として起票した。ファイル・依存としての Tauri は完全に消えており、実装済み計画書の plans/ 残置も #1377 で既知の 1 本（claude-launcher）だけだった。

#### 変更点

- **起票 7 本**: #1385（未使用 `version` カラムのバンプ廃止 — PostgREST が `version = version + 1` を書けないため**全 mutation で version 取得専用 SELECT が 1 本余計に飛んでいる**。LWW cursor は `updated_at` で version は無関係・mcp-server は準拠済みで shared だけが残置）/ #1386（`migrateTodosToBackend` 削除 — 呼び出し元 0 を実測・4 箇所のみ）/ #1387（削除済み `frontend/` FROZEN 前提・撤去済み Provider の陳腐化コメント一掃 — `PRINCIPLES.md:190` は存在しない 3 Provider の Optional バリアントを指示する規範のまま）/ #1388（dead i18n 33 キー + dead CSS — kanban 名前空間は CalendarTab / TagColorControls が 6 キー借用中なので移設してから名前空間ごと削除）/ #1389（参照ゼロ export 5 型 + 使われないテストシーム + `EmptyState` 同名 2 実装の rename）/ #1390（#1293 Trash 移設の design docs 追随 — IA.md が registry に無い Trash をユーティリティ枠として列挙・_COMMON-CONTEXT は Version 3 のまま）/ #1391（add-ipc-channel スキルの「7 関数」が実装 9 と乖離ほか dead path・数値 drift の束）
- **起票しなかったもの**: claude-launcher 計画書の残置（#1377 で既知）/ `fetchAllPages` の shared↔mcp 重複（#677 の承認済み負債・コードコメントに明記あり）/ mapper の過剰 export 30+（公開 API サーフェス方針の判断が要るため #1389 の備考に留めた）/ REFERENCE 計画書の置き場不統一（A/B 裁定として #1391 内に記載）
- **監査の白判定**: Tauri ファイル・依存・IPC = 0 / ScreenLock・FileExplorer・Terminal 残骸 = 0 / import グラフ上の orphan ファイル = 0（src 400+ ファイル）/ plans 14 本の Status enum 逸脱 = 0 / d3・Connect グラフ残骸 = 0
- **運用メモ**: 未使用コード調査のサブエージェントが 600 秒ストール → SendMessage で再開させて完走（SSE バグの既知型）
