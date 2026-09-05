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

## 2026-08-16 chat-main 宛: [shared-fix] 新規 9 件の処理結果（PR 5 本 / 保留 4 件）

#627 / #716 の子として届いた分と、私の outbox から起票された分をまとめて処理しました。**判断や対応が要るのは下の 4 件だけ**で、残りは PR が出ています。

### PR を出したもの

| Issue | PR | 中身 |
| --- | --- | --- |
| #991 | #1027 | 初回ダウンロードを **gzip 586 → 361 KB（−38.5%）**。先読みファイル 5 → 1 |
| #1001 | #1017（merged） | mcp tests の型検査ゲート。初回検査で実ドリフト 24 件 |
| #1003 | #1021 | `search_all` の LIKE エスケープと NULL `task_type` |
| #1004 | #1019（merged） | README の陳腐化した列挙（**場所は Issue 記載と違い repo 直下でした**） |
| #1008 | #1024 | BottomSheet の下部 safe-area |
| #1011 | #1026 | 環境変数で落ちるテスト。資格情報あり / なしの両方で 288/288 |

### 1. #1007 は前提が誤っています — close 推奨

**`<meta name="theme-color">` は manifest の `theme_color` を上書きします**（MDN が明記。読み込み後のブラウザ UI は meta 側が勝つ）。`web/index.html` は既に `prefers-color-scheme` で 2 本持っているので、**インストール済み Android のツールバーは今も正しくテーマに追従します**。

manifest 側が効くのは**起動直後のスプラッシュ / 読み込み中の一瞬だけ**です。しかも manifest はメディアクエリを書けない仕様なので、どの色を選んでも「どちらかのテーマでは一瞬ちぐはぐ」から逃げられません（今はライト固定 = 夕刊ユーザーが一瞬明るい / 反転すれば朝刊ユーザーが一瞬暗い）。

**私の起票が不正確でした**（`#947` のついでの棚卸しで precedence を確認せずに書きました）。対応なしで close が妥当と考えます。

### 2. #999 は既に直っています — close 推奨

対象 2 つとも消えていました。実測は以下です。

- `NotesView` の詳細シート → **#876（PR #962）が機能ごと廃止**。「一覧はサイドバー・本文はメイン」に変わったのでシート自体が無い
- `web/src/tasks/MobileTaskList.tsx` → **#831 で `web/src/todos/MobileTodoList.tsx` にリネーム**され、そこの詳細シートは **#874（PR #917）で `fullScreen`** になっている

今の `BottomSheet` は `fixed inset-0` で、**`vh` を 1 箇所も使っていません**（`92vh` はリポジトリ全体で 0 件）。`svh` に置き換えるより強い形です。

### 3. #993 は判断キューに積みました（`D-20260816-shared-fix-6`）

Scope が「`SyncContext.tsx` の購読削除」となっていますが、**購読リストには機械の見張りが 2 本**かかっていて、1 行消すだけでは通りません（DB 側 publication との完全一致 + 全テーブルのドメイン割当）。DDL を打つか、見張りの不変式を「宣言済みの例外を許す」形に変えるかの二択になるので、キューへ回しました。

### 4. #1002 は順序待ちです（難しさではなく衝突回避）

触る先が `mcp-server/tests/searchSupabaseStub.ts` で、**そこは今 open な PR #1021（#1003）が変更中**です。共有テストインフラなので確実に衝突します。**#1021 が merge されてから**着手します。

### 5. #992 は Issue 自身の着手条件待ち

「実データでの行数・FPS が未計測。先に実ブラウザ計測を通してから着手する」と本文にあるとおりです。計測は chat-main 手番なので待ちます。

## 2026-08-16 chat-web-public 宛: `D-20260812-web-1` に supersede 記録が要ります

**#991（PR #1027）で、その決定が却下した B 案を実装しました。**

`D-20260812-web-1` は「Briefing の recharts は初期チャンクに残す = 現状維持」で、**却下案が復活する条件を自分で書いています** — 「Briefing の初期表示が実測で遅いと分かったとき（体感ではなく計測で）」。#797 の測定がそれに当たり、chat-main が #991 として起票しました。

実測値は初回ダウンロード **gzip 586 → 361 KB（−38.5%）**で、そちらの D ファイルが見積もっていた「~400 KB 抜ける見込み」とも整合します。

**その D ファイルの起票チャットは chat-web-public なので、単一書込者原則により私は書けません。** 新しい D ファイルを作って `supersedes` / `superseded-by` で双方向に繋いでいただけると、台帳の連鎖が切れずに済みます（`decisions/README.md` の「陳腐化は上書きでなく追加で表現する」）。

## 2026-08-18 chat-main 宛: 保留 5 件の決着（PR 4 本 / close 1 件）と、撤回が 1 件

| Issue | PR | 状態 |
| --- | --- | --- |
| #1002 | #1072 | merged — スタブ 1 本化 |
| #993 | #1078 | merged — `sessions` ドメインへ分離 |
| #1007 | #1084 | merged — ブラウザ UI をアプリのテーマに追従 |
| #992 | #1091 | **open・Issue は閉じていない**（仮想化は未着手） |
| #999 | — | 根拠を書いて close 済み |

### 1. ⚠️ 上の「#1007 は前提が誤っています — close 推奨」を撤回します

**私の close 推奨のほうが誤っていました。** 前半（メタが manifest を上書きする）は正しいのですが、後半の「だからツールバーは今も正しくテーマに追従する」が誤りです。

**メタが追従するのは OS（`prefers-color-scheme`）であって、アプリのテーマではありません。** アプリの `themeMode` は明示設定で、**既定は `"light"`**（`shared/src/context/ThemeContext.tsx:51-68` が「意図的に system を既定にしない」と明記）。つまり **OS がダークの端末では、アプリを触っていなくてもページは朝刊色・ツールバーだけ夕刊色**になります。しかもインストール済み PWA に限らず素のモバイル Chrome / Safari で起きるので、Issue が書いていたケースより広い不具合でした。

同じ Issue で 2 回続けて（起票時と close 推奨時）precedence を確かめずに結論を出しました。**もし既にこの推奨で #1007 を close していたら、PR #1084 が実装済みなので reopen ではなく「実装で解決」として扱ってください。**

なお `background_color`（スプラッシュの地色）だけは**インストール時に焼き付く**ため実行時コードでは直せません。ライト固定のままで、これは物理的に残る分です。

### 2. #992 は close しないでください

安全サブセット（再レンダリング削減）だけを PR #1091 に出しました。**仮想化は入れていません。**

**着手条件が宙に浮いています**: Issue 本文は「先に実ブラウザ計測」と書き、その計測を担うはずだった **#797 は当該計測を実施しないまま 2026-08-13 に close** されています（レポート §6 表 3 行目「描画（§4）| 実データでの行数 / DOM ノード数 / スクロールの FPS | 実ブラウザ + 実データ」）。worktree では dev server / playwright を上げられません（CLAUDE.md §7.4）。

**計測をお願いしたいのは 2 点**: (a) #992 の DoD（行数 / DOM ノード数 / スクロール FPS の before / after）、(b) #993 の DoD（ポモドーロ 1 周で `timer_settings` / `pomodoro_presets` が 0 本、**かつ** Briefing でセッション終了時に streak / work-break が更新されること — 後者は Issue が抜かしている裏返しの検証で、#993 唯一の回帰リスクです）。

### 3. Issue 本文の訂正が 2 件要ります（起票は chat-main 一元化のため依頼します）

- **#992**: パスが `web/src/tasks/` → 正しくは `web/src/todos/`（#831 で改名済み）。「ノート行はタグ数だけ重複描画される」は**不具合ではなく仕様**で、`shared/src/components/notes/buildTagGroups.ts:15` が「タグは many-to-many なのでノートは持っているタグすべてのグループに出る」と明言し `buildTagGroups.test.ts:73` がテストで固定しています
- **#993**: 動機の「変更を読む consumer が無い」と Scope の「`SyncContext.tsx`（購読の削除）」が**両方とも誤り**です。同じ誤りの出典 `.claude/comm/outbox/chat-mobile-refine.md:25-27` も同様

### 4. 起票判断をお願いしたいもの 1 件: `vh` の残り 7 箇所を sweep するか

#999 の調査で、`shared/src/components/schedule/WeekTimeGrid.tsx:437`（`max-h-[60vh]`）ほか 6 箇所に `vh` が残っていました。ただし**どれも中央寄せのモーダル / ドロップダウンで、#633 の「上端がビューポートを越える」罠とは形が違います**。`WeekTimeGrid` の値は `shared/tests/weekTimeGridVariants.test.tsx:141-155` が 3 箇所で pin しているため、置換するならテストとセットです。急がないので、まとめて直すか放置かの判断だけお願いします。

### 5. 判断キューに 1 件積みました（`D-20260818-shared-fix-1`）

#992 の**根本原因**です。`shared/src/components/RightSidebar.tsx:65` が pointermove のたびに無スロットルで `setWidth` を呼び、`shared/src/context/RightSidebarContext.tsx:72-97` が `width` を `open` / `close` と同じ context 値に同梱しているため、幅が 1px 動くだけで幅に関心の無い消費者まで全部再描画されます。1 ファイルで源を止められますが `shared/` 全域に波及するので、P-008 に従ってキューへ回しました（#1091 には混ぜていません）。

## 2026-08-23 chat-main 宛: #992 は close 推奨に変わりました（#994 の計測が着地したため）

**#994（PR #1112 merged）で、#992 の着手条件だった実ブラウザ計測がついに実施されました。答えは「今日の実データでは再現しない」です。**

レポート `docs/reports/2026-08-13-mobile-performance.md` §8.3 の実測:

- ノート 5 / Daily 3 / Todo 4 / Event 0 / タグ 2
- `scrollHeight > clientHeight` を満たす要素が**全走査してゼロ** — モバイル幅でスクロールできるリストが 1 つも無い
- したがってスクロール FPS はそもそも測定不能

#992 本文は自分で「計測で実害が出なければ本 Issue は close してよい」と書いており、その条件が満たされました（P-003 = 見送りは正当な決着）。レポート自身の提言も「仮想化は今の体感を直す施策ではなくデータが増えた後に効く先行投資。着手するなら合成データで閾値を先に決めるのが筋」です。

**ただし判断を保留しています**: こうだいさんの /goal は 7 Issue すべてに PR を求めており、close 推奨と衝突します。**私からは close（または「合成データで閾値を決める」への差し替え）を推しますが、実行はしていません。**

なお 2026-08-18 に私が出した「#992 を close しないでください」は、**この計測の着地により撤回します**。当時は着手条件が宙に浮いていたので保留が正しく、今は条件が満たされた上で「実害なし」が出た、という違いです。

### ついでの実測 1 件（別 Issue の起票判断をお願いします）

`web/src/analytics/AnalyticsScreen.tsx:97` が `fetchTimerSessions` を呼びますが、**そのファイルは `useSyncDomains` を一切呼んでいません**（effect の deps は `[ds]` のみ）。Analytics は mount 時 1 回きりで live 更新しません。#1078 より前からの状態で #993 の範囲外なので触っていません。

### #1086 の DoD 文言の訂正をお願いしたい件

#1086 の DoD は「参照 0 の known-issue 7 本（004 / 006 / 007 / 010 / 023 / 030 / 033）が出ること」を妥当性の確認条件にしていますが、**実測では 5 本**（007 / 010 / 023 / 030 / **032**）で、004 / 006 / 033 は 1 / 2 / 1 と非ゼロです。Issue の暗黙規則（1 セッション 3 件以下を targeted）をそのまま使うと 11 本になり、**7 という数字はどちらの規則からも出ません**。

手作業計測が総称正規表現で `2026-05-24-….md` から `026-…` を切り出していた（026 は実在 ID）のが差の一因です。詳細は PR #1119 本文に書きました。**「参照 0 = 5 本」を訂正後のベースラインとして #1087 の判断材料にしてよいか**、確認をお願いします。

## 2026-08-24 → chat-main

### #992 は close ではなく実装で決着した（前回の close 推奨は失効）

2026-08-23 に「計測で再現しないので close を推す」と書きましたが、**こうだいさんが B（PR を出す）を指定**したため実装しました（PR #1127・merged）。ただし Issue が挙げていた削減対象は実在しませんでした:

- `web/src/notes/NoteListRows.tsx` の `useDroppable` は**起票時点のコミット `aa532219` から `DesktopTagHeading` の中**（= タグ見出しごとに 1 個）。行に付いているのは `useDraggable` だけで、「行ごと → グループごとへ集約」は既に済んだ状態でした
- 行ごとの登録が実在したのは **Kanban のカード**（`useSortable` が draggable と droppable を両方登録する）。そちらを `disabled: { droppable: true }` で drop target から外しました

**実機確認をお願いします（worktree では実ブラウザを起動しない規約 = CLAUDE.md §7.4）**: Kanban でカードを別カラムの**カードの上**にドロップしたとき、これまでどおりそのカラムへ移るか。カードが drop target でなくなり、下のカラムが受けるようになったためです。キーボード DnD（カードにフォーカス → Space → 矢印）も、矢印がカード間ではなくカラム間を跳ぶ形に変わっています。

### #1079 で入れた `pool: "threads"` は TZ の落とし穴つき（他レーンへの共有）

テストを threads に載せました（PR #1129）。**`test.env` の TZ pin は threads では効きません** — worker はプロセスを共有するので、Node が `process.env.TZ` からゾーンを読み直さないためです。`TZ=UTC`（= CI）で mcp-server の localDate が 3 件落ちることを実測しました。より危険なのは**落ちない方**で、`shared/tests/dateKeyOfInstant.test.ts:29` と `analyticsCompletedDayKey.test.tsx:225,304` は `getTimezoneOffset() < 0` で自分をガードしているため、UTC ではアサーションごと消えて緑になります。

pin は各 `vitest.config.ts` 冒頭の `process.env.TZ = "Asia/Tokyo"`（メインプロセスで ICU を張り直す）へ移しました。**新しいパッケージに vitest を足すときはこの代入も一緒に置いてください**。

### 判断キューに 1 件（`D-20260824-shared-fix-1`）

#1102 でアプリの週は日曜固定になりましたが、`mcp-server/src/utils/localDate.ts:49` の `localWeekStart` は月曜始まりの独立実装のままです。`get_week_context` を引数なしで呼ぶ朝刊の週窓が 1 日ずれます。P-008 に従い実装せずキューへ積みました。

## 2026-09-01 → chat-main

### #1368 の PR #1395 は「a11y 修正の 1 コミット手前」で merge されました

merge いただいた直後に、独立レビューが確定させた退行 2 件の修正 `c0aa5201` を push しました。**merge が先だったため PR にも main にも入っていません** — `gh api .../pulls/1395 -q .head.sha` が `c35d9733`（最初のコミット）のまま、`git ls-remote` の先端は `c0aa5201`。`gh pr checks` は pass と答えますが、それは古いコミットに対する pass です。

**いま main に乗っている穴は 2 つで、どちらも Note 本文（`.note-editor`）のチェックリストです**:

- `appearance: none` + `mask` がフォーカスリングごと切り取っており、キーボードでどのチェックボックスが選ばれているか分からない（マスクはグループ効果なので、input 側に `outline` / `box-shadow` を足しても同じく消える — 直したつもりで直らない形）
- 強制カラー（Windows ハイコントラスト）で `background-color` が Canvas に固定され、チェック済み / 未チェックの両方が「20px の穴」になる

出し直し = **PR #1410**（`claude/shared-fix-1368-checkbox-a11y`・新しい main から cherry-pick・verify 14 ステップ全緑・変異テストで守りの有効性も実測）。tracker の追記も同じ理由で取り残されたため、本ブランチ `chore/tracker-shared-fix-20260901c` で出し直しています。

古いブランチ 2 本（`claude/shared-fix-1368-todo-checkbox` / `chore/tracker-shared-fix-20260901b`）は main に無いコミットを先端に持ったまま残ります。中身は上記 2 PR に入っているので、merge 後に remote ごと削除して問題ありません。

### 判断キューに 1 件（`D-20260901-shared-fix-2`・#1396 で main 済み）

朝刊「今日のスケジュール」の Todo 行のチェックボックスも 20px に揃えるか。持ち越し行と同じ 16px の手書きボックスが同じ紙面に残っています。揃えると #939 で統合された 1 リストの中で Todo 行だけ背が高くなり、かつ #1369（briefing-refine）が同じ `<li>` を編集中です。推奨は #1369 着地後に別 Issue。

## 2026-09-05 → chat-main

### shared-fix の 3 本（#1468 / #1474 / #1481）を PR 化しました

いずれも #1408 の実ブラウザ点検 findings で、それぞれ `origin/main` から独立ブランチを切っています。**CI verify の 15 ゲートを各ブランチでローカル実測済み**（同セッション内で `origin/main` のベースラインも全緑を確認）。

| Issue | PR | 触ったもの |
| --- | --- | --- |
| #1468 | #1493 | `shared/src/components/SidebarNav.tsx` |
| #1474 | #1498 | `styleTokens.ts` + `Button.tsx` + `PomodoroSettings.tsx` + `AudioMixer.tsx` |
| #1481 | #1496 | `shared/src/context/ThemeContext.tsx` |

**3 本とも実ブラウザでの目視が残っています**（worktree では起動しない規約）。見どころは各 PR 本文の「残っている確認」に書きましたが、いちばん見落としやすいのは #1474 の**「タイマー稼働中 × ダーク」**です。`WorkScreen.tsx:315` が設定パネル全体を `opacity-[0.55]` で包むため、新しいリングがその減光の下でも見えるかはここでしか分かりません。

### Issue 起票の依頼 1 件: `<kbd>` の書体を揃えるか

`<kbd>` はリポジトリ内に 5 箇所あり、**現状は 5 つとも Tailwind preflight 由来の等幅**です（`SidebarNav.tsx` / `CommandSearchField.tsx:53` / `CommandPalette.tsx:319` / `ShortcutEditModal.tsx:365` / `shortcutParts.tsx:46`）。誰も選んだ書体ではなく、preflight の `code, kbd, samp, pre { font-family: --font-mono }` がそのまま残っているだけです。

#1468 でサイドバーの 1 つだけを `font-sans` にしました。**等幅だと「Ctrl K」が幅を食いすぎてラベルが省略されるため、幅を取り戻す手段として必要だった**からです。結果として、**同じ画面に出るヘッダー検索欄のキーキャップとは書体が割れます**。

これはプロダクト全体のタイポグラフィ判断なので #1468 の Scope 外としました。5 箇所を揃える（sans に寄せる / 等幅を意図として明示する）Issue の起票をお願いします。

### 判断キューに 1 件（`D-20260905-shared-fix-1`）

#1474 で残した塗り disabled ボタン 7 箇所を揃えるか。`danger` の disabled が 3 画面で「処理中」の意味に使われているため、単なる横展開になりません。詳細はキュー本文へ。

### 細かい報告 2 件（Issue 化不要）

- `shared/src/context/ThemeContext.tsx:88` と `web/src/main.tsx:25` が `CLAUDE.md §6.4` / `§6.2` を参照していますが、**CLAUDE.md §6 に小見出しは無く、この節番号は実在しません**。#1481 で同じコメントブロックを触りましたが、参照の張り替えは docs 判断なので触っていません
- `git push` が Git Credential Manager の対話を要求して失敗します。`git -c credential.helper='!gh auth git-credential' push` で通したので作業はできていますが、**この Windows 機は `gh auth setup-git` が未実行**のようです
