# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- **#1750（気分スターの Undo が書き込み失敗を握りつぶす）を PR #1754 で修理** ✅（2026-09-19 — shared-fix レーンの報告。書いた時点の実測で **PR #1754 は open**。#1682 が 12 本直したときの取りこぼしで、`writeEvening` が `upsertDaily` の Promise を捨てていた。書き込みが落ちても「元に戻しました」だけが出て、コマンドが redo スタックへ移る）
  - **#1682 の形を写すだけでは足りない箇所がある**（今回の教訓）: `upsertDaily` は失敗を例外ではなく **`null` の resolve** で返す（自分で catch してログに出す）。`afterSettled` を足しても、その `null` を reject に戻さないと undo 閉包は失敗を一度も観測できない。同じ握りつぶしを他で直すときは「その write が reject するのか null を返すのか」を先に見る
  - **「undo が失敗扱いになるか」は実物の `UndoRedoManager` に流して固定する**: コマンドがどこへ行くか（redo へ進まず undo スタックへ戻る）は manager 側の契約なので、pushUndo のスタブを見るだけでは固定できない
- **#1722（自分の #1680 が狭幅で作った不具合）を PR #1724 で修理** ✅（2026-09-19 — chat-main の実ブラウザ検証で発覚。書いた時点の実測で **PR #1724 は open**。編集可能にした星は 44px の床（#1558）を持つので 1 個 50px になり、390 幅で 5 個 + 見出しがカードをはみ出して 5 段階目が画面外に出ていた。読み取り専用のときは 15px の span で 5 個約 83px だったため収まっていた。**狭幅だけヘッダーを縦積みにして星を独立した行へ出す**（`md:` 以上は従来の 1 行）。床は触らない。
  - **「読み取り専用を編集可能にする」変更は、当たり判定の床を連れてくる**（今回の教訓）: a11y の 44px は幅の要求でもあるので、横 1 行に 5 個並ぶ UI を編集可能にするときは狭幅のレイアウトを一緒に決める
- **#1677 / #1687 / #1688 / #1689 の 4 件を 4 PR に分けて提出** ✅（2026-09-19 — chat-main からの配布を受けて着手。書いた時点の実測で **#1677 = PR #1713 / #1688 = PR #1717 / #1689 = PR #1719 は open、#1687 = PR #1716 は merged**。#1689 だけは #1688 に stack した（同じ関数を触るため。Issue 本文も「#1688 の後」と指定）。
  - **タグのフィルタチップの id は「グループキー」でタグ id ではない**（#1677 で踏んだ）: `tagGroupKey(group) = group.tagId ?? "__untagged__"` なので、未分類だけが別物。右クリックのタグメニューに渡す前にここで弾く（Connect のレールが `isUntagged` でやっているのと同じ形）
  - **右クリックのパネルは RightSidebarPortal の中に置かない**（#1677）: 狭幅ではそのポータルが MobileDrawer なので、ドロワーと一緒に unmount する。ホストの最上位に置く（`TemplateEditHost` の既存コメントが同じことを言っている）
  - **memo している行にハンドラを渡すときは `(id, event) => void` の 1 本にする**（#1677）: 行ごとに `() => f(node.id)` を作ると `DesktopNoteRow` の memo が毎回外れる
  - **DnD の「移動」はドラッグ元をドラッグ id から取れる**（#1687）: 1 つのノートはタグごとに行を持つので、draggable id の接頭辞（グループキー）が「どの見出しから掴んだか」そのもの。jsdom にレイアウトが無くジェスチャは再現できないため、`planTagMove`（純関数）に判断を出して 5 ケースを固定した
  - **`[[` の検索語には閉じ括弧が入る**（#1689）: @tiptap/suggestion の `allowSpaces` 版の正規表現は `[[.*?(?=s[[|$)` で行末まで飲む。挿入側は range が `]]` を含むので既存の `deleteRange` のままでよく、直すのは検索語の読み方だけ
  - 4 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑。実ブラウザ確認（#1677 のパネル位置・#1687 のドラッグ）は merge 後に chat-main 側）

- **#1679 / #1680 / #1674 を 3 PR に分けて提出** ✅（2026-09-17 — 3 本とも `origin/main` から独立に切った。書いた時点の実測で **#1679 の PR #1683 は merged・#1680 の PR #1693 と #1674 の PR #1699 は open**。3 件はどれも Daily / Notes の「本文のまわり」で、触った層は別々（レイアウト / 夕刊セクションの書き込み / アップロードの見せ方）。
  - **#1679 の原因はメニューではなくカードの床**: kebab の `<Menu>` は portal ではなく `absolute top-full` でカードの中に描かれ、カードは `overflow-hidden`。`min-h-0` の flex 列が短い日のカードを夕刊カードの下で潰し、削除行が切れていた。`min-h-60` に置き換えたが、**`cn` は tailwind-merge ではない**ので `min-h-0` と並べず**差し替え**る（並べると CSS の記述順で決まる）
  - **夕刊の編集は「基準にする本文」の選び方が全部**（#1680）: 書き込みは `mergeEveningSection` に通し、基準はレンダーの `selectedContent` ではなく `getDailyForDate`（ref 読み）にした。undo / redo のクロージャはそのレンダーのずっと後に走るため。さらに書いた内容を `lastEmitted` に記録して**自分のエコー**に見せると、星を押しても本文エディタが remount しない（remount = カーソル消失 + 入力中の flush）
  - **気分 1 タップ = undo 1 回にするには `skipUndo` が要る**（#1680）: 初回書き込みは context 側が `createDaily` の undo を自分で積むので、放っておくと 1 タップで undo が 2 回必要になる
  - **`Loader2` はこの lucide-react に型として無い**（#1674 で踏んだ・申し送りにも既にあった）。deprecated alias なのでビルドは通るが、家の作法は `LoaderCircle` + `animate-spin motion-reduce:animate-none`（`AuthCard.tsx` が基準）
  - **同じ lazy-mount flake に 2 回当たった**（`briefingEveningLazyMount`）。4 worktree が同時に verify を回すと落ち、単体・静かな状態では緑。別レーンの PR #1692 が main に着地して以降は一括でも緑
  - **他レーンの誤 kill で verify が途中で死んだ**（connect-refine から連絡あり）。`ps | grep verify.sh` は**全 worktree の同名スクリプトに当たる**ので、止めるときはログのパスまで見る。復旧は落ちたステップから再開できる形にしておくと安い
  - 3 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑。実ブラウザ確認（#1679 のメニュー全項目・#1674 の帯の位置）は merge 後に chat-main 側）

- **#1606 / #1607 添付チップとリンクブロックを 2 PR に分けて提出** ✅（2026-09-13 — どちらも `origin/main` から独立に切った（stack しない）。書いた時点の実測で **PR #1612（#1606）/ #1617（#1607）とも open**。2 件は「本文の中の埋め込みを、同じ 1 つの形にそろえる」という 1 本の話で、#1606 が形を決め #1607 がそれに乗る。
  - **DoD が「ブラウザで実測して貼れ」と言うのに、この worktree は dev server を立てられない**（CLAUDE.md §7.4 = 実ブラウザは chat-main）。解いた形は、**ビルド済み CSS + アプリと同じ chrome を書き下ろした計測用ページ**を scratchpad に置き、`file://` は playwright が塞ぐのでポート 8791 の使い捨て静的サーバーで開く、というもの。アプリの dev server ではないのでポートが競合しない。数値（390 で 332.67 / 1280 で 998.67）と前提は Issue コメントに全部書いた
  - **`editor.isEditable` は node view の中で信用できない**（実測）: `isEditable` は `this.options.editable && this.view && this.view.editable` で、node view は **EditorView の構築中**に作られるので `this.view` がまだ undefined。読み取り専用ゲートに使うと**どの面でも false** になる。見るのは `editor.options.editable`（`setEditable` が同時に更新する）
  - **削除ボタンは `<a>` の子にできない**（リンクの中のボタンは不正な HTML）。兄弟にして CSS で右端に重ねると、DoD が測る `.note-attachment__file` は**本文カラム幅の要素のまま**でいられる。44x44 はここでは `max-md:` にせず全幅で無条件 — #1560 の narrow 限定はリストの desktop レイアウトを太らせないためで、ラベルの無いアイコン 1 個が横に本文の流れないブロック行にいるこの形には当てはまらない
  - **index.css の `@media (forced-colors: active)` は 1 つではなくなった**: `taskListCheckboxSize.test.ts` が「最初の 1 つ」を取っていたので、2 本とも中身で選ぶ形に直した（両ブランチに同じ修正が載っている = 片方 merge 後ももう片方は素通りする）
  - **`new URL()` は http(s) 以外も通す**: `javascript:alert(1)` は例外を投げず、host が空・pathname が `alert(1)` になる。見出しが空のカードになりかけた。`href` はクリックでそのままブラウザに渡る = アプリのオリジンで走るので、**http(s) 以外は href を付けない**を `safeHref` に切り出した（テスト付き）
  - **入力規則にはテストが無い**（申告済み）: ProseMirror のテキスト入力経路は jsdom のレイアウトと mutation flush を要求する。貼り付け・ラウンドトリップ・削除・URL 解釈は押さえた
  - 両ブランチで CI verify のステップ列 + `docs-lint` をローカル実行。**`mcp-server — test` だけ Windows 固有で 1 件赤**（`remoteRegistry.test.ts` が `utilserification.ts` と `utils/verification.ts` を比べている = パス区切りの問題で Linux ランナーでは緑。今回の変更は mcp-server に触れていない））


## 予定

（なし — 2026-09-13 時点で `section:materials` の open Issue は #1606 / #1607 で、それぞれ PR #1612 / #1617。どちらも merge はこうだいさんの手番（P-001）。次は chat-main からの新規 dispatch 待ち。**両方 merge された後の小さな片付けが 1 件** = `.note-attachment__file` と `.note-link-card__link` の CSS は独立ブランチのため意図的に重複しており、セレクタ 1 本にまとめられる（見た目は変わらない）。**すぐ来る見込みの 1 件** = アップロード進捗の実装（方針は `D-20260902-materials-1` で確定済み・起票依頼は outbox 2026-09-02）。**もう 1 件の見込み** = `toggleList` / `toggleSummary` / `toggleContent`（#1555 の PR 本文が table と並べて名指しした残り。table を #1579 で片付けたので、エディタのスキーマに無い MCP ノードはこれだけ。`<details>` 経由で素の markdown からも届くぶん経路が広い））

## 申し送り

- **worktree で「ブラウザで実測」を求められたら、アプリではなく CSS を計測用ページに載せる**（2026-09-13）: dev server は chat-main 専有（§7.4）だが、幅の DoD は `web/dist/assets/*.css` + アプリと同じ chrome を書き下ろした静的ページで測れる。playwright MCP は `file://` を塞ぐので使い捨ての静的サーバーを 1 本立てる（アプリの dev server ではないのでポートが競合しない）。前提（どの padding をどこから取ったか）を Issue に併記すれば、数値は読み手が検算できる
- **エディタのスキーマに無いノードは、その 1 ブロックではなく文書全体を捨てる**（#1521 / #1579 で 2 回）: `RichTextEditor` の `enableContentCheck: true` + `onContentError` が warn だけ + 800ms autosave、の 3 つが揃うと**開くだけで本文が消える**。MCP 側にノードを足したら web のスキーマにも足す、が対になっている
- **`@tiptap/extension-*` の peer は完全一致のピン**（2026-09-09 実測）: `extension-table@3.31.3` は `@tiptap/core` / `@tiptap/pm` に `3.31.3` を要求する。最新を素で入れるとエディタ基盤ごと上がるので、**入っている core / pm と同じ版を明示して入れる**（3.23.4 なら lockfile の増分は 1 パッケージ 15 行）
- **PR を出したら push を先に済ませる — merge は思ったより早く来る**（2026-09-02 の実損）: #1455 を作った後に 2 コミット目（outbox の起票依頼）を push したが、その間にこうだいさんが squash merge していて**2 コミット目だけ main に届かなかった**。PR が MERGED でも、載せたつもりの後追いコミットは `git log origin/main` に無い。**後から足す予定があるなら push してから PR を作る**（拾い直しは cherry-pick で済むが、気付かないと消える）
- **添付の孤児判定は 2 つの読み取りの順番が全部**（#1438）: バケットの一覧が先・ドキュメントの読みが後。逆順にすると「2 つの読み取りの間に添付されたファイル」が孤児に見え、消す対象がユーザーの見ている画像になる。**この順番を入れ替える変更は安全性の変更**なので、コメントを消さない
- **PostgREST のページングには `order` が要る**（#1438）: 行順の保証が無いので、順序なしの 2 ページ目は 1 ページ目の行を取り直したり別の行を飛ばしたりする。走査で飛ばした行 = 参照を見落としたノート = 使用中のファイルを消す、に直結する
- **`ATTACHMENT_NODE_TYPE` は 2 パッケージの契約**（#1438）: `web` の TipTap ノード名と `shared` の掃除がこの 1 語で繋がっている。ノード名を改名すると**全添付が孤児に見える**ので、リテラルに戻さない
- **`@supabase/storage-js` 2.105.4 に upload の進捗コールバックは無い**（2026-09-02 実測・`FileOptions` は `cacheControl` / `contentType` / `upsert` / `duplex` / `metadata` / `headers` のみ）。% を出すには signed upload URL + XHR への載せ替えが要る
- **web には `@testing-library/user-event` が入っていない**。コンポーネントテストのクリックは `fireEvent`（`@testing-library/react`）を使う
- **スピナーのアイコンは `LoaderCircle`**（`Loader2` はこの lucide-react に無い）。作法は `className="h-4 w-4 animate-spin motion-reduce:animate-none"` + `aria-hidden`（`AuthCard.tsx` が基準）
- **main が赤い間は自分の PR の赤を自分のせいだと読まない**（2026-09-01・PR #1431 で修理）: #1425 の CI 失敗は 1 件だけで、しかも `Analytics/TagUsageCard.tsx` — 自分が一度も触っていないファイルだった。**#1419 / #1422 / #1426 が「書いた時点では全部緑」のまま順に入って壊れた**形で、このチャットの申し送りに既にある「CI が緑 ≠ 取り込み済み」の 3 本版。**赤を見たら最初に「落ちているファイルは自分の Scope か」を見る**
- **取り込み順は #1431 → #1425**。#1431（main の修理）が入るまで #1425 の CI は緑にならない
- **2026-09-01 (2) の実測**（書いた時点）: PR #1417（#1407）/ #1425（#1404）とも **open**。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認は merge 後に chat-main 側**で、#1404 は**さらにバケット適用後**
- **#1404 の添付は孤児回収も進捗表示も無い**（どちらも意図的・outbox で起票依頼済み）。孤児回収 = ノードを消しても実体を残す（undo で復活しうるので編集のたびに消すのは正しくない）。進捗 = 挿入がアップロード完了後（先に入れると 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化される）
- **#1404 を配線したのは Notes だけ**。エディタは Daily / Briefing / Todo 詳細でも使うが、Issue の Scope が `web/src/notes/**` を名指ししているため。他画面は `attachments` prop を 1 本渡すだけで足りる（`attachment` ノード自体は全画面で**無条件登録**済みなので、画像入りノートは今でもどこでもスキーマエラーなく開き、リゾルバが無い面では読める文言に落ちる）
- **「Issue に書かれた当たりが既に実装済み」のことがある**（#1407）: Issue の当たりは lazy チャンク + 本文再フェッチの重なりだったが、チャンク側は #1158 の idle warm-up で既に潰れていて、残っていたのは本文の 1 往復だけだった。**先に「もう直っている部分」を切り分ける**と、直す場所が 1 箇所に絞れる
- **#1417 と #1425 はファイルが重ならない**（#1407 = `shared/src/hooks/useNote*` + `state/noteBodyStore.ts` / #1404 = services + `web/src/notes/` の新規 3 本 + `slashCommand.ts` / `RichTextEditor.tsx`）。`shared/src/index.ts` だけ両方が触るが、追記位置が別（前者 = domainSnapshotStore の隣・後者 = その直後の constants ブロック）なので順序はどちらでもよい
- **2026-09-01 の 4 本の実測**（書いた時点）: PR #1380（#1372）= merged / #1384（#1363）・#1394（#1364）・#1397（#1365）= open で CI は #1384 / #1394 が緑、#1397 は実行中。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認は merge 後に chat-main 側**で回す — worktree からは実ブラウザを起こさない規約
- **#1394 と #1397 は同じ `NoteTagFilterChips.tsx` を触る**（#1364 = 並び替えメモとトグル条件 / #1365 = interface のコメント・`VISIBLE_LIMIT`・チップの className）。行が離れているので auto-merge する見込みだが、**2 本目で衝突したら「両方残す」**（#1365 側が `VISIBLE_LIMIT` を 8 → 6 にしている点だけ注意）。`web/tests/notesView.test.tsx` も #1372（中程）と #1365（末尾追記）で重なる
- **grep で見つからない並び替えは `sort` を使っていないことを疑う**（#1364）: 実体は `filter` 2 回（picked / rest）の連結だった。Issue 側も「`selected` + `sort` の grep では未特定」と書いていたとおりで、**「並べ替え」を動詞ではなく結果（配列の再構築）で探す**方が早い
- **手組みの表示は「全 UI に反映」の穴になる**（#1365）: #1291 が `TagHeadingIcon` を唯一の読み取り経路にしたのに、Notes のチップ行だけ 6px の色ドットを自前で描いていたので `wiki_tags.icon` を一度も読んでいなかった。**色は出るがアイコンは出ない、という症状は「その面が共通部品を通っていない」サイン**
- **`Modal` に `reading` サイズを足した**（#1363・`max-w-lumen-reading` = `PageContainer width="reading"` と同じトークン）。テキスト面を載せるパネルは今後これを使う。`shared/tests/modalWidth.test.tsx` の「全サイズに幅が 1 つ」ループにも追加済み
- **#1345 の PR #1347 は open**（2026-08-31 書いた時点の実測。base = `origin/main`）。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認**（wide / narrow 両方でダイアログが出る・キャンセルで残る・実行後に Settings → ゴミ箱から復元できる）は merge 後に chat-main 側で回す
- **同じファイルの中で作法が割れていたら、揃える側の経路を数え直す**（#1345）: Issue は「ノート削除に確認が無い」1 件だが、実体は `onDeleteNote`（行のゴミ箱）と `onDelete`（ケバブ）の 2 経路だった。片方だけ直すと割れ方が変わるだけで残る
- **#1334 の PR #1340 は open**（2026-08-31 書いた時点の実測。base = `origin/main` の f7179efc）。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認（ノート「プライベートでやりたいこと」のリンクチップが「todo（削除済み）」相当になる）は merge 後に chat-main 側**で回す — worktree からは実ブラウザを起こさない規約
- **「テストが緑」を「経路が通っている」と読まない**（#1334 で 2 度目）: `linkPanel.test.tsx` は削除済み行入りの pool を panel に直接渡すので、#1292 で壊れていた**手前の工程（pool 生成）を一度も通らない**まま緑だった。#1285 の `materialsSelectionPersistence.test.tsx`（別 DataService インスタンスを渡して常にコールドマウント相当になっていた）と同じ形。**修正時は「入力を手で作っている場所」がバグの現場でないか**を先に見る
- （旧記述）materials 5 PR（#1306 / #1313 / #1316 / #1319 / #1322）は 2026-08-31 時点で**全部 merged**
- **5 本は同じファイルの別の場所を触るので merge 順に注意**: `NotesSidebarList.tsx` を #1286（ゴミ箱ブロック撤去 = ファイル末尾側）と #1288（チップ行 + 行上限 = 前半と中程）が、`NotesView.tsx` を #1286 と #1288 が、`shared/src/i18n/locales/*.json` を #1292 / #1286 / #1288 が触る。**行が重ならないので auto-merge するはず**だが、1 本入るたびに次の base が動くので、2 本目以降で衝突したら「両方残す」で解決する（2026-08-30 のテンプレート 3 本と同じ形）
- **#1292 の後半（削除時の「紐づくリンクも消えます」確認）は分割起票を依頼済み**（outbox 経由・@chat-main）。Todo の削除確認は `web/src/schedule/useScheduleTodoChips.ts` にあり schedule レーン専有で、リンク件数を渡すには `useWikiTagsUnifiedContext` の持ち込みが要るため materials では触っていない。#1292 の Scope 註が認めている分割で、DoD も「確認パネル **または分割起票の記録**」
- **#1288 は #1291（共通タグチップのアイコン）を採用していない**: tags レーンの PR #1318 がほぼ同時に open になったが merge 前で、`origin/main` の `shared/src/components/` に共通タグチップは存在しなかった。#1318 着地後の追随は `useNoteListState.tagFilterChips` の `icon` スロット 1 箇所を `TagHeadingIcon` に差し替えるだけ（`NoteTagGroup` は `tagIcon` を既に持っている）
- **`StatusFilterChips` は広げずに Notes ローカルの `NoteTagFilterChips` を新設した**: 共有チップは `value: string | null` の単一選択が契約で、もう一方の利用者は Mobile Todos のステータスフィルタ（あちらは単一選択が正しい）。他レーンの部品にモードフラグを足さない判断（one writer per artifact）
- **既存テストが 2 Issue ぶんバグを隠していた実例**（#1285）: `materialsSelectionPersistence.test.tsx` の再マウント検証は**別の DataService インスタンス**を渡していた。#1101 のスナップショットは DataService の identity で引くので、別インスタンス = 常に miss = 常にコールドマウント相当になり、実アプリの経路（同じ ds を使い回す）を一度も通っていなかった。**「再マウントを検証している」と読めるテストでも、実アプリと同じ依存を渡しているかを見る**
- （旧記述）PR #1260（#1248 / #1255）は 2026-08-30 に merged
- **テンプレートの Trash 復元は未着手のまま**: #1248 は「確認を挟む」だけで閉じており、削除したテンプレートが Trash に出ない構造（trash の読み取りがテンプレートを除外する）はそのまま。復元可能にするなら別 Issue が要る — 今回は文言で「戻せません」と断る形にした
- **空本文の適用でも Apply ボタンは赤（danger）のまま**: #1255 の Scope が hook と i18n catalog だけを名指ししているので、`TemplateApplyPanel` の `bg-lumen-danger` 固定には手を付けなかった。「破棄するものが無いのに赤い」を直すなら panel に prop を足す小さな follow-up になる
- **テンプレート 3 本（#1179 / #1180 / #1181）は 3 本とも merged**（PR #1227 = 5f562c35 で main へ）。#1180 と #1181 でテンプレート一覧を読むフックが 2 つ並んだままなのは下の項のとおり
- **「CI が緑」は「取り込み済み」を意味しない**（2026-08-30 の実測）: #1227 は CI 緑のまま放置されていたが、それは main を取り込んでいなかったからで、取り込んだ瞬間に 4 ファイルが衝突した。独立ブランチで並行している間は、**緑かどうかではなく base がいつの main かを見る**
- **マージ解決の教訓（2026-08-30）**: 独立ブランチ制約で「同じ機能領域を別々に触った 2 本」を合流させると、解決が**片方を消して片方を残す**形になりやすい。`git diff <merged-main> <merge-commit>` で「この PR が main に足す差分」を読むと、消えた export や入れ替わった import が一目で出る。CI ログは tsc が 1 件目で止まるので**全容を写していない**前提で読む
- （旧記述）2026-08-29 の 6 本は merge 順が要る: テンプレート 3 本は #1179 → #1180 → #1181。全部 `origin/main` から独立に切った（ユーザー指示）ので、`web/src/notes/NotesView.tsx` と `shared/src/components/materials/NoteDetailPanel.tsx` は衝突しうる。**#1179 だけが旧テンプレート工房（`NoteTemplateHost` / `NoteTemplatePanel`）を削除**し、#1180 は同じ行を触らずに新 UI を足す形にしてある（2 本で同じ行を消すと衝突するだけなので）。#1179 単体の状態ではテンプレートを読む導線が無いので、3 本続けて入れる前提
- **#1180 と #1181 でテンプレート一覧を読むフックが 2 つ並ぶ**（`useNoteTemplateLibrary` / `useNoteTemplateApply`）。独立ブランチ制約の副産物で、3 本着地後に統合するのが follow-up 向き
- **#1189 は解釈を 1 つ置いた**: Issue の「日付リスト（直近 14 日の DateStrip）」は rightSidebar に無い（DateStrip は狭幅の本文側）。今日/昨日タブと DateStrip は撤去し、**日付ピッカーは残した** — エントリがまだ無い日を開く導線がピッカーしか無いため。PR #1236 本文に明記済みで、ピッカーも不要ならユーザー判断で追加撤去
- **#1183 の before/after スクリーンショットは未添付**。worktree から実ブラウザを起こさない規約なので、目視は merge 後に chat-main 側
- **#1075（ノートテンプレート）は 2026-08-27 時点で merged**。前提だった `supabase db push`（`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加）が適用済みかどうかは未確認 — 未適用のまま merge されているとテンプレート作成が CHECK 違反で落ちるので、初回利用時に確認が要る
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
