# HISTORY (chat-materials-refine)

### 2026-09-22 (2) - materials の 9 本を main 取り込みで緑に戻した + main の再破損を PR #1945 で修理

#### 概要

前段で出した materials の 11 本のうち open の 9 本が CI 赤のままだったので、現在の main を取り込み、手元で全ゲートを回してから push し直した。作業中に main がもう一度壊れていることが分かり、先に PR #1945 で直した。9 本と #1945 はすべて CI 緑・MERGEABLE。

#### 9 本が赤かった理由

赤い main から枝を切ったため、`chartTheme.ts` の `fitAxisLabel` と `TodosTab.tsx` の `sessionsWithinRange` が無い状態で CI が走っていた。main 側は PR #1942 で既に直っていたが、`ci.yml` の `pull_request` トリガは **base が進んでも再実行されない**ので、古い赤がそのまま貼り付いていた。push し直すまで緑にならない。

#### main の 2 回目の破損（PR #1945）

PR #1921（#1823）が `StreakDisplayLabels.days` を `formatDays: (count) => string` へ改名し、その時点の 7 本のテスト用データを追随させた。直後に merge された PR #1926（#1826）が 8 本目 `shared/tests/briefingHeadingSpacing.test.tsx` を**古い形**で足した。どちらの PR も相手を見られない。

```
tests/briefingHeadingSpacing.test.tsx(104,11): error TS2353:
  'days' does not exist in type 'StreakDisplayLabels'
```

**誰も気付けなかった理由が 3 つ重なっている**: `build` はテストファイルを見ない、`vitest` は型を見ない、そして main 自身の run は `cancel-in-progress: true` により次の merge でキャンセルされる。見えるのは `typecheck:tests` だけで、その run が完走しない。

#### 変更点

- **PR #1945（main 修理）**: `shared/tests/briefingHeadingSpacing.test.tsx` の fixture を他の 7 本と同じ `formatDays: (n: number) => (n === 1 ? "day" : "days")` に
- **9 本すべてに現在の main を取り込み**: 競合は 2 本だけ。`claude/materials-1837` の `shared/src/index.ts`（barrel の export を `BUSY_STALE` と `DISABLED_FILLED_BTN` の両方残す）と、`claude/materials-1843` の i18n カタログ（`materials.notes.password.*` と `materials.notes.tableControls.*` を両方残す・JSON の構文と en/ja の鍵の対応を確認）
- **9 本すべてに #1945 の修理も載せた**: #1945 が merge されれば squash 時に差分ゼロになる（`red-main-blocks-pr-ci` の定石）
- **検証**: 9 本それぞれで shared / web の lint・build・typecheck:tests・test を全通し。desktop と mcp-server は 9 本とも触っていないので回していない

#### 並行セッションとの衝突

`claude/materials-1837` と `claude/materials-1843` への push が「behind」で弾かれた。別の Claude セッション（Fable 5.1 / session 019XSFhXmKcf）が 19:15 頃に**同じ 2 本へ同じ内容の main 取り込み**を push していた。解決の中身も同一だったので、force push せず向こうの commit を merge してから押し直した。**materials レーンを 2 つのセッションが同時に持っている**状態なので、次に同じ指示が来たら着手前に `git ls-remote` で自分のブランチの先端を見る。

#### 残った作業

- history のローリングアーカイブ（5 件超）はこの PR では実行していない。CI 修理の記録だけに絞るため見送った
- PR #1907 は 1 回目の main 破損の修理案だが、同じ内容が #1906 として merge 済みで中身が空振りしているはず。materials の担当外なので触っていない

### 2026-09-22 - 画面別検証の materials 11 件を 11 本の PR に（#1836 #1837 #1838 #1839 #1840 #1841 #1842 #1843 #1844 #1902 #1903）+ main の compile 不能を 1 本

#### 概要

`/goal` で渡された 11 件を 1 Issue = 1 branch = 1 PR で出した。着手直後に **origin/main がコンパイルできない**ことが分かり、先に PR #1905 で直した。11 本はどれもこれを含まず、ローカルの verify だけがそれを載せた状態で緑。

#### main が壊れていた件（PR #1905）

analytics レーンの 2 組の PR が互いに古い base から squash merge され、同じファイルを書き直した側が相手の追加を落としていた。git はどちらも MERGEABLE のまま。

- `TodosTab.tsx:65` の `sessionsWithinRange`: #1883 が呼び出しと import を足し、#1890 が古い base から import 行を書き直して落とした
- `chartTheme.ts` の `fitAxisLabel` / `estimateLabelWidth`: #1893 が足し、#1897 がファイル全体を書き直して落とした。`RoutineCompletionChart.tsx:21` と `analyticsRoutineChartLabels.test.tsx:5` がまだ import している

実測: shared build / shared typecheck:tests / web build がコンパイルエラー、shared vitest が 3 suite 9 件失敗。

**教訓**: 同じレーンで同じモジュールを触る PR が並ぶときは、open 時ではなく **merge 直前に main を取り込む**。squash merge は相手がファイルの形を変えたことを見られない。#1436 の「`tsc -b` のキャッシュのせい」とは別物で、こちらは本当にコードが欠けている。

#### 変更点

- **#1836（PR #1911）リンクカード変換後のキャレット** — 入力ルールがカードと**空段落を 1 手で**入れる。カードは block atom なので、段落をカードだけで置き換えると選択がノード自身（NodeSelection）に残り、次の 1 打鍵がそれを置換して URL ごと消える。`insertContentAt` は挿入の末尾にキャレットを畳むので、末尾を空段落にすればその中に入る
- **#1902（PR #1915）`/` と `[[` の一覧のスクロール** — `selected` が変わったら `scrollIntoView({ block: "nearest" })`。**キー操作のときだけ**（`onMouseEnter` でも `selected` は動くが、静止したポインタの下でスクロールすると次の行が滑り込んで選択がまた動き、一覧がカーソルから逃げていく）。2 つのピッカーは意図的に同じ作りなので両方直した
- **#1838（PR #1920）Daily の削除確認** — `useConfirmDialog` を通し、エントリの無い日は `disabled`。ダイアログはケバブの箱の中に 1 つだけ置いた（Desktop / Mobile はどちらも 1 回しか描かないので、質問の居場所が 1 つになる）
- **#1844（PR #1923）Light の 3 段目テキスト** — `--color-text-tertiary` を `#857054` → `#756249`。色相・彩度そのままで明度だけ −5.2pt。**値を決めたのは最悪ケースの `surface-sunken`**（サイドバー検索欄の placeholder）で 4.59。`#77644b` だと Issue の 3 件は通るがそこが 4.46 で落ちる。`PRINCIPLES.md §3.6` の「最低 3:1」も直した — これを残すと次の人が同じ値に戻す
- **#1839（PR #1928）Daily の状態表示** — 3 点のうち 2 点目は Issue の記述と実装がずれていた。選択判定も `aria-current` も既に正しく、**本当の欠陥は選択の塗りと hover の塗りが同じトークンだったこと**。`bg-lumen-accent-subtle` にした
- **#1841（PR #1931）タグピッカーの focus** — Create 行に `onMouseDown` の `preventDefault` が無く、かつ作成が query を空にして**その行自身を unmount する**。focus を持った要素が消えるので `<body>` に落ち、Escape が効かなくなる。既存の候補行も同じ形だったので両方に入れた。閉じたら trigger へ戻す cleanup は CommandPalette（#1874）の 2 つのガードごと写した
- **#1842（PR 番号は下記）「Show N more」と新規ノートのタイトル** — 片道だったボタンを対に。chevron が戻り道だと書かれていたが、chevron はグループ全体を畳む永続状態で、この cap は行数の非永続状態なので別物だった。タイトルは `createNote()` の戻り値（既に `useNoteLinking` が使っている）を host が保持し、`key={noteId}` で新しくマウントされた入力欄が 1 回だけ focus + select する
- **#1843** — 文言 13 本を `materials.notes.password.*` へ。**入口の復活は実装しない**（下記）
- **#1840** — `opacity: 0` の削除ボタンを狭幅で常時表示（`max-md:` と `[@media(hover:none)]` の両方。デスクトップブラウザの 390px は touch にならない）+ 5 箇所に 44px の床。**タスクのチェックボックスは変更なし** — #1523 が `index.css:713-730` で既に 44px の当たり判定を入れており、20px は描画サイズ。`getBoundingClientRect()` 単独の判定が拾う偽陽性で、`rules/frontend.md` が名指しで警告しているケース
- **#1837** — 本文検索の配線。`useNoteBodySearch`（新規）が debounce して `ds.searchNotesUnified` を呼び、**id だけ**を返す。行は Provider が持つ一覧のまま使うので、本文が React state に載らない。**あわせて `SupabaseNotesUnifiedSearch` に `has_password` の絞り込みを足した** — 元々 1 つも無く、呼び出し元がゼロだったので顕在化していなかった。UI を繋ぐこの PR がそれを有効にしてしまうため分離できない
- **#1903** — `/` にテーブル。`insertTable` は `@tiptap/extension-table` のもので、`tableNodes.ts` が #1579 から登録済み（つまりコマンドはずっとあって誰も呼んでいなかった）。行・列の操作は `TableControls.tsx`（新規）で、**caret 矩形に対する絶対配置を使わない**（jsdom で検証できない経路を作らないため）

#### 詰まった点と回避

- **`handleTextInput` は 5 引数**（prosemirror-view の型）。4 引数で呼ぶと `typecheck:tests` だけが落ちる（vitest は型を見ない）。5 つ目は「本来起きるはずだったトランザクション」を返す関数
- **`display: contents` に `opacity` は効かない**。検索中の薄表示は実体のある box に載せる
- **`DailyEntriesPanel` の prop を interface に足しただけでは動かない** — 分割代入にも足す。型は通るので build では気付けず、テストで `ReferenceError` になって初めて出た
- **新規ノートのタイトル focus は「既に選択済みのノートに + を押す」形ではテストできない** — `key={noteId}` が変わらないのでマウント効果が走らない。テストも実際の 2 段（押す → Provider がそのノートを選んで返る）に合わせた
- **既存テストの途中に `it` を差し込むと後半を吸い取る**ことがある。`expect(state.createNote).toHaveBeenCalledExactlyOnceWith();` はそのテストの最後の行ではなかった

#### 判断キュー

`D-20260922-materials-1`（#1843）: パスワードの掛ける / 外す入口を戻すか、機能ごと畳むか。入口が無いのは意図的な退役ではなく、`94e32ba4` が「バックエンドが throw するので一時的に外す。DU-G が 1 つの diff で戻せるよう state は残す」と書いたまま戻されなかったもの。ただし #1763 以降はロック中の本文を取得しないので、掛けた瞬間に本文が消え、忘れると復旧できない。体験が変わる分岐なので P-005 でキューへ。

### 2026-09-20 - #1760 ノート改名の Undo が入力欄に届かない / #1761 ノート書き込みの失敗が無言（PR #1762 / #1765）

#### 概要

chat-main の #1690 実ブラウザ確認から出た 2 件。どちらも「画面が嘘をついたまま黙っている」形で、片方は表示の追随漏れ、もう片方は失敗の握りつぶし。2 本とも `origin/main` から独立に切った。書いた時点の実測で PR #1762 / #1765 とも open。

#### 変更点

- **#1760 タイトル欄が外からの改名に追随する**（`shared/src/components/materials/NoteDetailPanel.tsx`）: `NoteTitleInput` は `initialTitle` をマウント時に 1 回だけ draft に取り込み、`key` はノート id だけだった。Undo が DB とサイドバーを戻しても入力欄だけが新しい名前のまま残る。`title` prop が変わったら seed し直す形にしたが、**`key` に title を混ぜる形は採っていない** — 入力中に remount してフォーカスを奪うため（元のコメントが明示的に避けている）。代わりに pending draft で守る: 300ms の debounce 待ちが残っている間は seed せず、flush 済み（= Undo が届く状態）でだけ seed する
- **#1761 拒否された書き込みを報告する経路を足した**（`shared/src/hooks/notesWriteError.ts` 新規 + `useNotesUnifiedCRUD` / `useNotesUnifiedTrash` / `useNotesUnifiedAPI`）: Notes の書き込みはすべて楽観的（先に画面を変えてから送る）なので、拒否されたときの受け皿が最初から無かった。Provider が `onWriteError(operation, error)` でホストに渡し、`web/src/notes/NotesUnifiedHost.tsx`（新規）が操作名つきの danger トーストにする。`console.warn` は残す — ドライバのメッセージを運ぶのはそちらで、ユーザー向け文言はわざと運ばない
- **棚卸し（Issue の依頼分）**: 同じ握りつぶしを Notes の書き込み経路で全部塞いだ。CRUD の作成 / 改名 / ピン / 削除、Trash の復元 / 完全削除、テンプレートの 2 フック（`useNoteTemplateLibrary` / `useNoteTemplateRegister`）。テンプレートは「ノート一覧に絶対入れてはいけないノート行」で NotesUnifiedContext を通らないため、`web/src/notes/hooks/useTemplateWriteFailure.ts`（新規）を別に立てた
- **塞がなかったものと理由**: 読み取り経路（一覧取得 / 本文 hydrate / ゴミ箱の読み込み）は log のみのまま — 失敗しても画面は元の内容を出し続け、再試行は次の sync で来る。Undo / Redo のクロージャも触っていない — reject は `UndoRedoManager` に届いて「元に戻せませんでした」になる（#1682）ので、ここでも報告すると 1 回の失敗にトーストが 2 枚重なる
- **i18n**: `notesView.writeFailed.*`（6 本）と `notesView.templateWriteFailed.*`（3 本）を en / ja 両方に追加。**キーのマップは `as const satisfies Record<Op, string>`** — このリポジトリの `t()` は `CustomTypeOptions` で型付きなので、`Record<Op, string>` にすると literal が落ちて TS2345 になる（実測で web の build / typecheck:tests が赤くなった）。literal を保つとキーのタイポがビルドで落ちる
- **`SECTION_DESCRIPTORS[...].body` は関数呼び出し**（`web/src/MainScreen.tsx:327` が `descriptor.body({...})`）なので hooks を書けない。トーストを噛ませるために `UndoRedoHost` と同じ形のホストコンポーネントを 1 枚立てた
- **テスト**: `shared/tests/noteDetailPanel.test.tsx` に 2 本（#1760 の再現 + debounce 待ち中に別の title が来ても打ちかけを消さない）、`shared/tests/notesUnifiedCRUD.test.ts` に 5 本（作成 / 改名 / ピン / 削除の拒否 + Undo の失敗は二重報告しない）、`shared/tests/notesUnifiedTrash.test.ts` に 3 本（復元 / 完全削除 + 読み込み失敗は届かない）、`web/tests/notesWriteFailures.test.tsx` 新規 4 本（トーストの種別と文言 / 操作ごとに文言が変わる / キーが en・ja 両方で解決する）
- **検証**: CI verify のステップ列 14 本 + `docs-lint` を 2 ブランチともローカルで上から実測し、全緑。実ブラウザ確認（#1761 は通信断の再現が要る。Issue が Playwright の `page.route` abort を示唆）は merge 後に chat-main 側

### 2026-09-19 (3) - #1750 気分スターの Undo が書き込み失敗を握りつぶす（PR #1754）

#### 概要

shared-fix レーンが #1681 の棚卸し中に Scope 外で見つけた 1 件。#1682 が Todo / Note / Daily / Briefing の 12 本を直したときに、ここだけ Scope の外だった。書いた時点の実測で PR #1754 は open。

#### 変更点

- **原因は 2 段**: `writeEvening`（`web/src/daily/DailyView.tsx`）が `upsertDaily` の Promise を `void` で捨てており、undo 閉包もその結果を見ていなかった。失敗してもトーストは出ず「元に戻しました」だけが出て、コマンドが redo スタックへ移る（= 一度も元に戻っていないものをやり直す選択肢が出る）
- **`writeEvening` が Promise を返す形にした**。merge で内容が変わらないときは `null`（旧 `boolean` の `false` に対応）。undo は `afterSettled(landed)` で打ち消す対象の着地を待ってから自分の書き込みを await する
- **`upsertDaily` の失敗は例外ではなく `null` の resolve で来る**（`shared/src/hooks/useDailiesUnifiedAPI.ts:175` が自分で catch してログに出す）。そのままでは undo 閉包が失敗を観測できないので、チェーンの中で `null` を reject に戻している。**#1682 の形をそのまま写すだけでは足りなかった箇所**で、同じ握りつぶしが他にあるなら「その write が reject するのか null を返すのか」を先に見る必要がある
- **テストは実物の `UndoRedoManager` に流す**: Issue が問うているのは「コマンドがどこへ行くか」で、それは manager 側の契約（`apply` が throw した undo を undo スタックへ戻す）。pushUndo のスタブを見るだけでは redo へ進まないことを固定できない
- **修正前に戻して落ちることを実測した**（`expected true to be false`）。既存の「puts a mood change on the undo stack」は undo が元の書き込みを待つようになった分 `await` を足している
- **検証**: CI verify のステップ列 14 本 + `docs-lint` をローカルで上から全部、15 本すべて exit 0。実ブラウザ確認（失敗トーストが出ること）は worktree では回さない規約なので merge 後に chat-main

### 2026-09-19 (2) - #1722 夕刊カードの気分の星が狭幅で画面外（PR #1724）

#### 概要

#1680（PR #1693）が狭幅で作った不具合を修理した。chat-main の実ブラウザ検証で発覚し、書いた時点で PR #1724 は open。

#### 変更点

- **原因**: 編集可能にした星は `max-md:min-h-11 max-md:min-w-11`（#1558 の 44px 床）を持つため、既定 root 18px で 1 個 50px。`flex items-center justify-between` のヘッダーに見出しと並ぶと 5 個 256.5px がカード幅を超え、390 幅で Mood 5/5 が画面外・横スクロールも出ないので到達手段が無かった
- **直し方**: `onSelectMood` があるときだけ、`md` 未満でヘッダーを `flex-col` にして星を独立した行へ出す（`md:` 以上は元の `flex-row` + `justify-between`）。読み取り専用のカードは 15px span で約 83px なので 1 行のまま。床は下げない。グループに `flex-wrap` を保険で追加（root font size が大きいと縦積みでも 1 行に収まらないため）
- **テスト**: shared 2 件（編集可能なら縦積み + 床のクラスが残る + wrap する / 読み取り専用は縦積みしない）。jsdom に高さ・幅が無いので実寸はクラスで固定し、360 / 390 / 430 の再実測は chat-main の手番
- **検証**: CI verify のステップ列 14 本 + `docs-lint` をローカル全緑

### 2026-09-19 - #1677 右クリック編集 / #1687 ドロップを移動に / #1688 未解決リンク行の削除 / #1689 閉じ括弧（PR #1713 / #1716 merged / #1717 / #1719）

#### 概要

chat-main の配布で materials の残り 4 件に着手し、4 PR にした。#1689 のみ #1688 に stack（同じ関数）。

#### 変更点

- **#1677（PR #1713）Note の rightSidebar を右クリックで編集**: タグ行（フィルタチップ / グループ見出し）は Connect と同じ `TagActionsMenu` をポインタ位置に開き、名前 / アイコン / 色はその場に `TagHubEditBlock` を出す（`useTagEditDrafts` = 保存ボタンだけが書く #715 の契約をそのまま使用）。削除は `ConfirmDialog`。ノート行は汎用 `ItemActionPopover`（#307）で、タイトル + `TagPicker` + 名前変更（インライン入力・IME 安全）+ 削除。新規 `web/src/notes/useSidebarContextMenus.tsx` に「ハンドラ + パネル」を 1 ファイルでまとめた（ハンドラは一覧の奥へ、パネルはホスト最上位へ行くため）。`shared/src/components/TagHub/` は触らず使うだけ
- **#1687（PR #1716・merged）ドロップ = 移動**: `handleDragEnd` がドラッグ元のタグ（draggable id のグループキー）を読み、`{noteId, fromTagId, toTagId}` を報告する。未分類も本物のドロップ先になり、そこへ落とすと**ドラッグ元のタグ 1 つだけ**を外す。書き込みの判断は純関数 `planTagMove` に出した（jsdom にレイアウトが無くジェスチャを再現できないため）。Scope どおり `useWikiTagsUnifiedAPI.ts` は不変
- **#1688（PR #1717）未解決リンクの行を削除**: 行と `insertUnresolved`・`exactMatch`・`"unresolved"` 種別・i18n キー（en/ja）を撤去。**ノート作成失敗時のフォールバックは残した**（`[[query` の削除は await より前に走る同期処理なので、フォールバックまで消すと打った文字が何も残らない）。`targetId: null` の描画は保存済み本文のため維持
- **#1689（PR #1719）閉じ括弧**: `stripLinkClosing` で検索語末尾の `]` / `]]` を落としてから、絞り込み・作成行のラベル・作成するノート名に使う。末尾だけを落とすので `Roof [draft] repair` は無傷。挿入側は無変更（range が `]]` を含む）
- **テスト**: web 8 件（#1677 = タグメニューの 4 項目・保存でのみ renameTag・削除の確認・未分類は素通り・ノートパネルの中身・名前変更・削除・狭幅で何も付かない）+ 10 件（#1687 = どの移動か 5 件 / どの書き込みか 5 件）+ 4 件（#1688）+ 3 件（#1689）。`buildItems` と `planTagMove` はテストのために export した（どちらも実 ProseMirror / 実ポインタなしでは到達できない判断）
- **検証**: 4 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑
- **申し送り**: #1687 と #1667（タグ付け外しの Undo）が重なると、移動 1 回が Undo 2 回になりうる。まとめるかは #1667 側で確かめる

### 2026-09-17 - #1679 Daily エディタカードの床 / #1680 夕刊カードの編集 / #1674 添付アップロードの帯（PR #1683 merged / #1693 / #1699）

#### 概要

section:materials の open 3 件を 1 件 1 ブランチで実装し、3 PR にした。#1679 は merge 済み、残り 2 本は書いた時点で open。

#### 変更点

- **#1679（PR #1683・merged）Daily の「…」メニューが切れる**: `web/src/daily/DailyView.tsx` の `EditorCard` に `DAILY_EDITOR_CARD_MIN_HEIGHT = "min-h-60"` を置き、`min-h-0` と**差し替え**た（`cn` は文字列連結なので 2 つ並べると CSS の記述順が勝つ）。原因は「メニューが portal ではなくカードの中」+「カードが `overflow-hidden`」+「flex 列が短い日のカードを潰す」の 3 つ重ね。開いたメニューの到達点は約 122px（pt-4 + 28px のトリガー + 行 2 本）なので、240px は 3 行目が増えても収まる。`Menu.tsx` は他画面共有なので触っていない。テストは desktop / mobile の 2 面でクラスの有無を見る（jsdom に高さは無い）
- **#1680（PR #1693）夕刊カード（気分・振り返り）を Daily 上で編集**: `DailyEveningCard` に `onSelectMood` と `reflectionSlot` を任意で足し、渡されなければ従来の読み取り専用のまま描く。ホスト側は `mergeEveningSection` で夕刊レンジだけ差し替えるので本文と MCP の往復形式は不変。振り返りは `EveningReflectionPreview`（夕刊画面と同じ部品 = TipTap チャンクを押すまで取りに行かない）→ 押したら `LazyRichTextEditor`。気分 1 タップ = グローバル undo 1 件（`skipUndo` で context 側の createDaily undo を抑止）、振り返りの打ち込みはエディタ自身の履歴。夕刊が無い日はカードではなく小さな「夕刊を書く」ボタンを出す（#1046 が避けた「空カードの氾濫」を作らない）。スケジュール行は読み取りのまま（Schedule のデータで、ここに保存先が無い）
- **#1674（PR #1699）添付アップロード中の帯**: `web/src/notes/AttachmentUploadStatus.tsx` を新設（ファイル名 + `attachment.uploading` + 不定形スピナー・`role="status"` + `aria-live="polite"`・idle では何も描かない）。`useAttachmentUpload` に任意の `onUploadingChange` を足し、サイズ検査を通った時点でファイル名・`finally` で null を渡す（失敗も拒否も帯が残らない）。ドキュメントは一切触らない = `D-20260902-materials-1` の裁定 B。`RichTextEditor` / `attachmentNode` は Scope 外のまま
- **テスト**: web 5 件（#1680 = 気分の設定 / 解除・振り返りの編集・夕刊が無い日の入口・undo コマンド。いずれも保存文字列を `extractEveningSection` / `stripEveningSection` で読み直して確かめる）+ shared 1 件（編集モードのカード）+ web 4 件（#1674 = 開始で出る / 成功・失敗・サイズ拒否で消える / `aria-live`）+ #1679 の 2 件。既存の #1046 テストは星が `role="img"` から button になったので `aria-pressed` を見る形へ直した
- **検証**: 3 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑。#1693 は #1683 の merge 後に `origin/main` を取り込んで衝突（テストの import 1 ブロック）を解消し、再度全緑
- **事故 / 摩擦 2 件**: (1) 他レーン（connect-refine）の `ps | grep verify.sh` が当方のプロセスまで kill した — 同名スクリプトが全 worktree にあるため。(2) `briefingEveningLazyMount` の cold-cache flake に 2 回当たった（単体では緑・別レーンの PR #1692 が main に着地して解消）

### 2026-09-13 - #1606 添付チップの全幅化 + 削除ボタン / #1607 URL のリンクブロック（PR #1612 / #1617）

#### 概要

2026-09-13 dispatch の 2 件。**どちらも `origin/main` から独立に切り、stack していない**（こうだいさんの指定）。2 件は「本文に埋め込んだものを 1 つの形にそろえる」1 本の話で、#1606 が形（本文カラム幅のブロック + 右端 44x44 の ×）を決め、#1607 がその形に URL を乗せる。

#### 変更点

- **#1606（PR #1612）添付ファイルのチップを本文幅いっぱいにし、右端に削除ボタンを置いた**: `.note-attachment__file` は `inline-flex` だったのでファイル名の文字数ぶんしか伸びず、短い名前だと行の左端に小さく残っていた。`display: flex` + `width: 100%` + `min-height: 2.75rem` の行にし、名前が伸びて省略記号で切れ、サイズと × が右に寄る。削除は `web/src/notes/attachmentNode.ts` の node view が実体の `<button>` を足す。消すのは**ノードだけ**で Storage のオブジェクトには触らない（孤児回収は #1438 — undo でノードを戻せる必要があり、消したファイルは戻せない）
- **#1607（PR #1617）段落に単独で置かれた URL をブロックにした**: 新規 `web/src/notes/linkCardNode.ts` = `linkCard` block atom（`attrs.href` のみ）。ホストを見出し・パスを副見出しにして、**通信は 1 本も足していない**（タイトル取得は CORS で塞がれ、代理取得はサーバー費用が出る = 完成までコスト $0 の前提に反する。favicon も同じ取引の小型版）。入口は入力規則（URL を打ち終えたスペース）と貼り付け（空段落に素の URL）の 2 つで、**文中の URL は下線リンクのまま**。既存ノートは遡って変換しない（開いても保存済み JSON は 1 バイトも変わらない）。`RichTextEditor` には**無条件登録**（スキーマが知らないノードは文書全体を捨てる = #1521 / #1579 と同型）

#### 決めたこと（Issue が実装者に委ねていた点）

- **読み取り専用の面では × を出さない**（#1606 の推奨どおり）。判定は `editor.options.editable`。**`editor.isEditable` は使えない** — `this.options.editable && this.view && this.view.editable` で、node view は EditorView の**構築中**に作られるため `this.view` がまだ undefined、つまりどの面でも false になる
- **× は常時表示**（hover / focus 出しは不採用）。タッチに hover が無く、実体が `<button>` なので Tab でも届く
- **× は `<a>` の兄弟**にして CSS で右端に重ねる。リンクの中のボタンは不正な HTML で、キーボードの対象が 2 重になる。この形なら DoD が測る `.note-attachment__file` が本文カラム幅の要素のままでいられる
- **44x44 は全幅で無条件**。#1560 の `max-md:` 限定はリストの desktop レイアウトを太らせないためで、ラベルの無いアイコン 1 個が「横に本文の流れないブロック行」にいるここには当てはまらない（逆に taskList のチェックボックスが 20px なのは本文の行の中にいてキャレットのクリックを食うから）
- **#1607 の表示はホスト + パス**、**切り替わるのは段落に URL 単独のときだけ**、**既存ノートは非変換**（Issue の 3 問すべて推奨どおり）

#### 実測（DoD）

dev server は chat-main 専有（§7.4）なので、**ビルド済み `web/dist/assets/*.css` + アプリと同じ chrome（SidebarNav 240 / NotesView narrow の `px-4` / NoteDetailPanel narrow `p-3`・wide `p-5` + 1px border）を書き下ろした計測用ページ**を作り、playwright MCP で開いて `getBoundingClientRect()` を読んだ。`file://` は playwright が塞ぐのでポート 8791 の使い捨て静的サーバー経由（アプリの dev server ではないのでポート競合が起きない）。

| viewport | 本文カラム | 添付チップ（前 → 後） | リンクブロック | × |
| --- | --- | --- | --- | --- |
| 390x844 | 332.67 | 176.73 / 132.29 → 332.67 | 332.67 | 44x44 |
| 1280x800 | 998.67 | 167.13 / 126.63 → 998.67 | 998.67 | 44x44 |

変更前の 2 つの数字は長いファイル名と短いファイル名で、名前の長さで幅が決まっていたことがそのまま出ている。

#### 途中で踏んだこと

- **`new URL()` は http(s) 以外も通す**: `javascript:alert(1)` は例外を投げず host が空・pathname が `alert(1)` になるので、見出しの空なカードになりかけた。`href` はクリックでブラウザにそのまま渡る = アプリのオリジンで走るため、**http(s) 以外は href を付けない**を `safeHref` に切り出した。ドキュメントには MCP サーバーも書き込むので「作る側が安全」は根拠にならない
- **`index.css` の `@media (forced-colors: active)` が 1 つではなくなった**: `taskListCheckboxSize.test.ts` が「最初の 1 つ」を取っていたため両ブランチで赤くなった。中身（`input[type="checkbox"]` を含む方）で選ぶ形に直してある。両ブランチに同じ修正が載っているので、片方 merge 後にもう片方が衝突しても内容は同一
- **入力規則にはテストが無い**（PR 本文で申告）: ProseMirror のテキスト入力経路は jsdom に無いレイアウトと mutation flush を要求する。貼り付け・ラウンドトリップ・削除・URL 解釈の 14 件は押さえた
- **`mcp-server — test` が Windows 固有で 1 件赤**: `remoteRegistry.test.ts` が `utilserification.ts`（プラットフォーム区切り）と `utils/verification.ts`（リテラル）を比べている。今回の変更は mcp-server に触れておらず、Linux ランナーでは緑。**プロダクト課題ではなくテスト側のパス組み立ての問題**なので、起票するなら chat-main 経由

#### 検証

両ブランチで CI verify のステップ列（shared → web → desktop → mcp-server）+ `bash scripts/docs-lint.sh` をローカル実行。上記 `mcp-server — test` の 1 件を除いて全て exit 0。テストは #1606 が web 7 件（`attachmentDelete.test.tsx`）、#1607 が web 14 件（`linkCardNode.test.tsx`）。

### 2026-09-09 - #1579 エディタに table 系ノードを教えた（PR #1587）

#### 概要

MCP の `generate_content` が書く表（`table` / `tableRow` / `tableHeader` / `tableCell`）を web エディタのスキーマが知らず、表入りノートは開いた瞬間に本文全体が捨てられて空の autosave に上書きされていた。#1521（callout・PR #1555）と同型で、その PR 本文が兄弟として名指ししていた残りの片方。`@tiptap/extension-table` を現行 core / pm と同じ 3.23.4 で入れ、4 ノードを無条件登録した。

#### 変更点

- **方針は #1521 に揃えた**（Issue の指示どおり）: MCP の生成をやめず、エディタ側にノードを足す。既存データがそのまま守れて MCP の機能も削らずに済む
- **ただし手書きの `Node.create` にはしなかった**: callout は属性 2 つの div なので手書きで足りたが、表はセルが colspan / rowspan / colwidth を持ち、編集中に表が壊れないための挙動（セル選択・Tab 移動・修復）は prosemirror-tables の `tableEditing` プラグイン側にある。それは各ノード仕様の `tableRole` を要求し、`tableRole` は `@tiptap/core` がこのパッケージのためだけに宣言しているフィールド。手書きだと「開くけれど編集すると崩れる」= バグの再演になる。旧 Tauri 版も同じパッケージ群だったので、当時のノートも同じノードとして読める
- **バージョンは 3.23.4 にピン**: このパッケージは peer で core / pm を**完全一致**で要求するため、最新（3.31.3）を取るとバグ修正 PR でエディタ基盤ごと動く。3.23.4 なら peer が現行と一致し、lockfile の増分は 1 パッケージ 15 行
- **`resizable: false` はどの node view が走るかも決めている**: リサイズ off だと素の `TableView` が使われ、表を `div.tableWrapper` で包む。CSS の `overflow-x: auto` はそこに掛けた。セルに 4rem の下限を置いたので、ノート幅より広い表は列を潰さずスクロールする
- **mcp-server は触っていない**: Issue の Scope は MCP 側も挙げていたが、突き合わせたらずれが無かった。ビルダーの出力（`table` > `tableRow` > `tableHeader` | `tableCell` > `paragraph`）は公式スキーマにそのまま収まり、空セルの `paragraph()` も `inline*` なので有効。`markdownToTiptap` は表を作らないため経路は `generate_content` だけ
- **テストは 5 本**（`web/tests/tableNodes.test.tsx`・実 `RichTextEditor` を jsdom で）。登録を外すと 5 本とも落ちることを実測した。開いたときのセル本文と周囲の段落、`th` 2 / `td` 4 と `.tableWrapper`、保存後もヘッダー行がヘッダーのままであること、merged cell の colspan / rowspan が残ること、セルが複数段落を持てること
- **エディタから表を作る導線は足していない**（slash メニュー項目・input rule なし）。#1521 と同じ判断で DoD の範囲外・i18n カタログ 2 本への追加を伴うため。読み込みと round-trip 専用
- **検証**: CI verify のステップ列 14 本（shared → web → desktop → mcp-server）+ `docs-lint` をローカル全緑。lockfile を触ったので `npm ls @tiptap/extension-table` でツリーの整合も確認。実ブラウザ確認は worktree では回さない規約なので merge 後に chat-main

### 2026-09-06 - #1409 の Materials 4 件（PR #1540 / #1543 / #1547 / #1549）

#### 概要

Mobile 幅点検 #1409 と Desktop 点検 #1408 の所見 4 件。全部 `origin/main` から独立に切って 1 件 1 PR。書いた時点の実測で #1540 / #1543 / #1547 が merged、#1549 が open（merge はこうだいさんの手番 = P-001）。

着手して分かったのは、**4 件のうち 2 件（#1470 / #1471）は前日に main で直っていて Issue だけが open で残っていた**こと。実装が要ったのは #1523 と #1518 の 2 件で、残り 2 件は「現状が DoD を満たしているかの確認」と「抜けていた回帰テスト」に変わった。

#### 変更点

- **#1523（PR #1540）Note 本文のチェックボックスに親指サイズの当たり判定と名乗り**: 丸そのものは #1368 で既に `TODO_CHECKBOX_ICON_PX` のマスク描画に揃っていて、足りなかったのは当たり判定と属性の 2 つ。`index.css` には「44px にすると上下の行のキャレット移動用クリックを飲む」という**既存の反対理由**が書かれており、マウスではそれが正しいので **768px 未満だけ**に入れた（ItemLinkMenu が `max-md:min-h-11` を敷いているのと同じ境界）。当たり判定に場所を奪わせず、`min-height` で**行に場所を与える** — 隣り合う 2 つの 44px 領域が重ならないので境界付近のタップが隣の Todo を切り替えない。領域は label の擬似要素で、label は 1.6em の行ボックスを保つので #883 の光学中央合わせがそのまま生きる（label を高くすると丸が約 3px 下がる）。`role` / `aria-checked` は TipTap の node view を包んで input に付けた
- **#1518（PR #1543）候補メニューを画面幅で頭打ちに**: 配置関数には #471 以来 **高さ**の上限しか無かった。メニューの幅は一番長い行で決まるので、`[[` のアクション行（文章）が 445px を作り、390px の画面で左マージン 8px に正しく寄せたうえで画面外まで描いていた（`/` メニューの行は単語なので露呈しない）。左オフセットは**上限後の幅**から計算する（素の幅だと、もう存在しない余白の分だけ左に引き戻す）。上限は **portal 先のコンテナ**に書く — メニュー本体は配置の後に ReactRenderer が差し込むので、配置時に存在するのはコンテナだけ。既存の ResizeObserver がもう 1 周まわして収束する
- **アクション行だけ折り返し、候補行は省略のまま**: アクション行は意味が末尾にある（「…のノートを作成してリンク」）ので三点リーダーだと動詞が消える。候補行は先頭で識別できるし、全部折り返すとピッカーではなく壁になる
- **#1471（PR #1547）は確認 + 配線のガードだけ**: PR #1507 で着地済み。内側まで一致していることを読んで確認した（`NoteDetailPanel` の `variant="main"` も Modal のパネルも `p-5` + `border` 1px なので差 0px）。抜けていたのは **`useElementWidth` と `TemplateEditPanel` の間の 2 ホップ** — NotesView の `ref={measureMainColumn}` と `columnWidth={mainColumnWidth}` を押さえるテストが無く、片方消しても全緑のまま 818px に戻る。3 件追加し、**配線を 1 つずつ外して 2 件が赤くなることを実測**した
- **#1470（PR #1549）は narrow の実測**: PR #1502 で着地済みだが、Issue に「Mobile でも再現」というコメントが残っていた（**そのコメントは修正の着地より前**に書かれたもの）。#1502 の 5 件は全部 `state.isWide` の既定値 true で走るので、narrow を同じ答えに縛るものが 1 つも無かった。4 件足して緑で通ること自体が所見 = Mobile も直っている。プロダクトコードの変更なし
- **踏んだ罠**: worktree が tracker ブランチ（`origin/main` より 20 コミット古い）に居たまま最初のファイル読みをしたので、`TemplateEditPanel.tsx` などを**全部旧版で読んで**設計を組み立てかけた。**ブランチを切ってからファイルを読む**、が正しい順序
- **検証**: 4 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカルで上から全部。#1470 のときだけ一括実行で `briefingEveningLazyMount` が 1 件落ちたが、単体でも静かな状態の全件（116 files / 1096 tests）でも緑 — memory に記録済みの cold-cache flake。実ブラウザでの再測定は worktree では回さない規約なので merge 後に chat-main
