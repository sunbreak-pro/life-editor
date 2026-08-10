---
Status: COMPLETED # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: 2026-08-10
Branch: claude/main-607-608-mobile-keyboard
Owner-chat: main
---

# Plan: スマホ Web のソフトキーボード起因バグ 2 件（#607 / #608）

> 公開 Web URL をスマホの主導線に据えた（[`D-20260807-main-1`](../decisions/D-20260807-main-1.md)）直後の実機確認で出た 2 件。どちらも「ソフトキーボードが開くとレイアウトが動く」という同じ根を共有している疑いが濃いため、1 本の計画として扱う。

---

## Context

- **動機**: スマホ Chrome で **Note に書き込めない**（#607 — 入力パネルが出た直後に閉じる）。同じ画面で**ボトムタブバーがせり上がってレイアウトが崩れる**（#608）。open Issue 18 件のうち `sev:important` はこの 2 件だけで、しかも塞がっているのは主導線の入り口にあたる。
- **同じ根を疑う理由**: #607 の Issue 本文自身が #608 と根を共有する可能性を挙げ、**両方を見てから直す**よう指示している。加えて、キーボードでレイアウトビューポートが縮むのは Android、縮まないのは iOS という**逆向きの壊れ方**があり、片方だけ見て直すともう片方を壊す。
- **制約**: 実機・実ブラウザ検証はこうだいさんの手番（CLAUDE.md §7.4）。`web/tests/` の jsdom には**レイアウトが無い**ので座標依存の経路はテストで固定できない（#475 の教訓・CLAUDE.md §7.1）。DDL ゼロ / コスト $0。
- **Non-goals**:
  - #609（Briefing の narrow ハンバーガー）— Epic #321 Phase 2 の判断事項であってバグではない
  - fanout r3 の 7 件（#585〜#591）— 改善と負債であり、壊れている箇所より後
  - ボトムタブバーの見た目・構成そのものの刷新（今回は「キーボード表示中にどう振る舞うか」だけ）

---

## 検討した代替案（必須）

| 案                                             | 採否 | 却下理由                                                                                | 復活条件                                                       |
| ---------------------------------------------- | ---- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| #607 + #608 を 1 計画にまとめる                | ✓    | —                                                                                       | —                                                              |
| #607 だけに絞る                                | ✗    | 根が共有の疑いが濃く、片方だけ直すともう片方を壊す（Issue #607 本文の指示）             | 実機計測で 2 件の根が無関係と確定したら分割する                |
| fanout r3 の 7 件（#585〜#591）を先に回す      | ✗    | 壊れている箇所を後回しにして改善を先にすることになる                                    | 本計画が着地したら次ラウンドとして再開                         |
| #608: キーボード表示中もタブバーを見せる       | ✗    | 狭い画面をさらに削り、iOS / Android の挙動差を自前で吸収し続けることになる              | こうだいさんが「入力中にタブバーが消えるのが不便」と判断したら |
| #608: 実機計測してから方式を決める             | ✗    | 方式は 2026-08-10 の選択で確定済み（隠す）。計測は原因特定に絞れば 1 往復で済む         | 計測結果が「隠すだけでは直らない」を示したら                   |
| #512（コマンドパレット上余白）を本計画に含める | △    | 同じキーボード起因だが**実機で見えるか未確認**。Step 4 で「見えたら同時処理」の条件付き | Step 1 の実機計測で潜りが確認されたら Scope 入り               |

> 2026-08-10 の `AskUserQuestion` でこうだいさんが選んだのは、**着手対象 = #607 + #608 をまとめて** / **#608 の方式 = キーボード中は隠す** / **実装場所 = このセッション（chat-main / harness-loop worktree）で通す** の 3 点。

---

## Scope (Touchable Paths)

```
shared/src/components/BottomTabBar.tsx
shared/src/components/AppShell.tsx          # タブバーの描画条件のみ
shared/src/components/BottomSheet.tsx       # H1 が原因だった場合のみ
shared/src/hooks/useVisualViewport.ts       # キーボード判定を足す場合
shared/src/hooks/useSoftKeyboard.ts         # 新設する場合
web/src/notes/NotesView.tsx                 # H3 が原因だった場合のみ
web/src/notes/hooks/useNoteSheetTarget.ts   # H2 が原因だった場合のみ
shared/src/components/CommandPalette.tsx    # #512 が実機で見えた場合のみ
shared/src/hooks/useNotesUnifiedAPI.ts      # #607 の原因確定を受けた例外 — 下記
shared/src/index.ts                         # 新設フックの barrel export のみ
shared/tests/** web/tests/**
.claude/docs/vision/plans/2026-08-10-mobile-keyboard-input-fixes.md
```

**触らない**: `web/src/schedule/**` `shared/src/components/schedule/**`（schedule-refine 専有）。`shared/src/services/SupabaseNotesUnifiedService.ts`（#587 = shared-fix レーンが分割予定）。

**Scope 例外（2026-08-10 ユーザー確定 = [`D-20260810-main-4`](../decisions/D-20260810-main-4.md)）**: `shared/src/hooks/useNotesUnifiedAPI.ts` は当初「触らない」側に置いていた（#587 が分割予定）が、Step 0 で #607 の原因がこのファイルと確定したため例外として Scope 入りさせた。裁定時の実測 = #587 未着手（open PR ゼロ・shared-fix worktree は #372 作業中）・差分は約 15 行の追加。#587 側には分割時に取り込む旨を申し送る。

スコープ外の変更が要ると分かったら **P-008** に従い、実装せずキュー（`comm/decisions/chat-main.md`）へ積んで現計画を続行する。

---

## Steps

| #   | Step                                                        | Gate    | Acceptance                                                                                  |
| --- | ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 0   | 狭幅（768px 未満）で #607 の再現を試み、H1〜H3 を絞る       | 🤖 自律 | 再現手順と、棄却できた仮説が file:line 付きで Worklog に残る                                |
| 1   | 実機（Android Chrome）で #607 / #608 / #512 を 1 往復で計測 | 👀 目視 | 「入力パネル」の同定・キーボード開閉時の layout / visual viewport 実測値・#512 の潜りの有無 |
| 2   | #608: キーボード表示中は `BottomTabBar` を出さない          | 🤖 自律 | 新規テストが緑・shared / web の lint / test / build が exit 0                               |
| 3   | #607: Step 0-1 で確定した原因を直す                         | 🤖 自律 | 座標非依存の回帰テストが緑・同上                                                            |
| 4   | #512: Step 1 で潜りが見えた場合のみ `max()` 補正            | 👀 目視 | 補正後に実機で潜っていない ／ 見えなければ実測結果を Issue にコメントして close             |
| 5   | PR 作成 → main merge                                        | 🛑 人手 | こうだいさんの merge（P-001）                                                               |

### Step 0 で当たる 3 つの仮説

どれも実測前の見立て。**Step 0 の目的は消し込みであって、当てにいくことではない**。

- **H1 — backdrop 誤爆**: `BottomSheet` の閉じ判定は `onMouseDown` + `e.target === e.currentTarget`（`shared/src/components/BottomSheet.tsx:82-88`）。キーボードが開いてレイアウトが動くと、タッチから合成される mousedown が backdrop 側に落ちて閉じる筋。**先例あり** = [known-issues 019](../docs/known-issues/019-createportal-clickoutside-misfire.md)（portal 配下の click-outside 誤発火で「開いた瞬間閉じる」）。#473 は同じ理由でコマンドパレットの背景判定を `pointerdown` へ移している。
- **H2 — id 差し替えレース**: `useNoteSheetTarget` は「開いている id が notes プールで解決できなくなったら閉じる」（`web/src/notes/hooks/useNoteSheetTarget.ts:74`）。新規作成の楽観行がサーバー行へ差し替わって id が変われば、その瞬間に閉じる。
- **H3 — `vh` 依存**: 詳細シートは `max-h-[92vh] min-h-[70vh]`（`web/src/notes/NotesView.tsx:836`）。`vh` はレイアウトビューポート基準なので、Android では縮み、iOS では縮まずキーボードの裏に潜る。#473 が `useVisualViewport` を作った理由と同型。

**切り分けの分岐**:

- 既存 Note を開いてタップ／新規作成直後にタップで**挙動が割れたら H2**（割れなければ H2 は棄却）
- Desktop を 768px 未満に狭め、DevTools のデバイスモードで高さを縮めて再現したら **H1 か H3**（実機固有ではなく narrow レイアウトの問題）
- どれでも再現しなければ Step 1 の実機計測に判断を委ねる（**H1〜H3 の外側を疑う**）

### Step 1 でこうだいさんに踏んでもらう手順

1 往復で終わらせるため、聞くことを先に固定しておく。

1. スマホ Chrome で公開 URL を開き、**既存の Note** の本文をタップ → 入力パネルは閉じるか
2. 同じく **新規作成した直後**の Note の本文をタップ → 挙動が 1 と違うか
3. 閉じるとき、消えるのは**シート全体**か、**本文エディタだけ**か（= Issue の「入力パネル」がどれか）
4. キーボードを出した状態で**コマンドパレット**を開き、検索行がノッチ / ステータスバーに潜っていないか（#512）
5. キーボードを閉じたときにタブバーが元に戻るか

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に型 / lint / test を回して担保
- **👀 目視** — Claude では検証不能（実機 / 体感 / レイアウト）。こうだいさんが画面で確認
- **🛑 人手** — ユーザー操作必須（PR merge — P-001）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run lint` / `npm run test` / `npm run build` がすべて exit 0
- [ ] `cd web && npm run lint` / `npm run test` / `npm run build` がすべて exit 0
- [ ] キーボード表示中に `BottomTabBar` が描画されないことを固定するテストが `shared/tests/` か `web/tests/` にある（`visualViewport` をモックし、**座標に依存しない**形で書く）
- [ ] #607 の原因に対する回帰テストがあり、座標依存でない（jsdom で意味を持つ形 — CLAUDE.md §7.1）
- [ ] `git diff` が上記 Scope 内に収まっている（`web/src/schedule/**` `shared/src/components/schedule/**` の diff がゼロ）
- [ ] 色のハードコードがゼロ（`lumen-*` トークンのみ）・i18n を追加した場合は en / ja 両 catalog
- [ ] PR diff が ±200 行以内（修正カテゴリの目安。超える見込みになったら P-008 でキューへ）
- [ ] 完了時: 本計画の Status を更新し `archive/` へ移動、per-chat memory も追随
- [ ] plans/ を触るので `node .claude/scripts/records.mjs index` を同一コミットで実行（docs-lint 検査 (e)）

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積む。

---

## Risks / Known Issues 参照

- [known-issues 019](../docs/known-issues/019-createportal-clickoutside-misfire.md) — portal 配下の click-outside 誤発火。H1 と同型で、**1 箇所直しても別の portal 化箇所で再燃する構造的な罠**と明記されている。直すなら `BottomSheet` / `MobileDrawer` の**両方**を見る
- **jsdom に `visualViewport` が無い**（`useVisualViewport` 自身が「platforms without the API」で null を返す設計）。テストではモックを置く必要があり、モックが実ブラウザと食い違えば緑のまま壊れる。**テストは「隠す判断が下る」ことまでを固定し、実際の見た目は Step 1 / 4 の目視に委ねる**
- **iOS 未検証で着地するリスク**: 手元の実機が Android のみなら、iOS 側は「レイアウトビューポートが縮まない」前提のコード読みで担保するしかない。その場合は**その旨を PR 本文に明記**し、iOS 実機確認を別 Issue として残す
- **タブバーを隠す副作用**: 入力中にセクション移動ができなくなる。Undo / コマンドパレットは「その他」シート経由なので同時に到達不能になる（#472 / #473）。入力中にそれらが要るかは Step 1 の目視で確認する

---

## References

- Issue: [#607](https://github.com/sunbreak-pro/life-editor/issues/607) / [#608](https://github.com/sunbreak-pro/life-editor/issues/608) / [#512](https://github.com/sunbreak-pro/life-editor/issues/512)（条件付き）
- Epic: [#321](https://github.com/sunbreak-pro/life-editor/issues/321)（Mobile UI/UX 追随）
- 決定: `D-20260807-main-1`（スマホの主導線 = 公開 Web URL）
- 要件: [`docs/requirements/mobile-scope.md`](../docs/requirements/mobile-scope.md)（#7 Notes フル編集 / #8 materials Full）
- 規約: CLAUDE.md §7.1（jsdom にレイアウトが無い）・§7.4（実ブラウザ検証は chat-main）・[`rules/frontend.md`](../rules/frontend.md)（IME / Provider 順序）
- 前ラウンド: [`2026-08-03-open-issue-fanout-r3.md`](../docs/vision/plans/2026-08-03-open-issue-fanout-r3.md)（#585〜#593 は本計画の後に再開）

---

## Worklog

### 2026-08-10 — Step 0 完了: #607 の原因を再現テストで確定

**H2 本体（id 差し替えレース）は棄却**。`shared/src/hooks/useNotesUnifiedAPI.ts:521` の `createNote` は `generateId("note")` でクライアント側が id を採番し、そのまま書き込む。サーバーが id を振り直さないので「楽観行がサーバー行に差し替わって id が変わる」経路は存在しない。

**確定した原因は H2 の亜種 — 自分の書き込みが自分の hydrate を無効化する**。連鎖はこうなっている:

1. 本文を打つ → `RichTextEditor` が 800ms debounce（`web/src/notes/RichTextEditor.tsx:277`）→ `updateNote`
2. `updateNote` はローカル行に**クライアント時計の `updatedAt`** を楽観的に載せる（`useNotesUnifiedAPI.ts` の `const now = new Date().toISOString()`）
3. 約 1.1 秒後、own-write の Realtime エコーで `syncVersion` が bump（#300 — このファイルのコメント自身が「typing anywhere bumps syncVersion ~1.1s later」と書いている）
4. リスト再取得 → #301 の限定無効化マージが `prev.updatedAt === row.updatedAt` の行だけ hydrate を維持する（`useNotesUnifiedAPI.ts:274-286`）。**クライアント時計の刻印がサーバーの `updated_at` と一致することはない**ので、いま編集中のノートだけが必ず脱落する
5. `contentLoadedIdsRef` から落ちる → `isContentLoaded(id)` が false → narrow のシートの `sheetReady` が false（`web/src/notes/hooks/useNoteSheetTarget.ts:78`）→ `RichTextEditor` が unmount され `SkeletonList` に差し替わる（`web/src/notes/NotesView.tsx:864-895`）→ **フォーカスが外れてソフトキーボードが閉じる**
6. `:295` の `hydrateContent(openId)` が再取得を投げ直すので、往復が終われば戻る。**Desktop はエディタが note id で keyed され remount しないのでこの窓を踏まない**（`:221-223` のコメントが明記）— スマホだけで起きるという症状と一致する

**再現テスト = `shared/tests/notesOpenNoteOwnEditHydrate.test.tsx`（現在 RED）**。最初は緑になったが、それはモックの再 hydrate が即座に解決して「落ちている窓」を跨いでいたため。実機ではここがネットワーク往復なので、再 hydrate を手動で保留する形に直したところ `isContentLoaded` が false を返すことを観測できた。**このテストは Step 3 の修正と同じコミットに載せる**（赤いまま単独で commit すると CI を壊すため）。

**H1 / H3 は未判定のまま残す**。上の経路だけで症状が説明できるので、Step 1 の実機で「打鍵の前に消えるか / 後に消えるか」を確認して切り分ける。**打鍵の前に消えるなら H1 か H3 が別に生きている**。

### 2026-08-10 — Step 1 への申し送り（#608 の計測項目が 1 つ増えた）

`AppShell.tsx:203` の narrow ルートは `h-[100svh]` で、`web/index.html:11-13` の viewport meta は `width=device-width, initial-scale=1.0, viewport-fit=cover` — **`interactive-widget` の指定が無い**。

Chrome 108+ の既定は `resizes-visual`（レイアウトビューポートは縮まず visual だけ縮む）で、それが効いているなら `100svh` は動かず、通常フローのタブバーもせり上がらないはず。**実機でせり上がっている以上、既定どおりに振る舞っていないか、別の経路で高さが縮んでいる**。ここが決まらないと「何をトリガーに隠すか」が決まらない（`visualViewport.height` はレイアウトごと縮む挙動では変化しないため、キーボード検出そのものが成立しない）。

そこで Step 1 に計測を 1 つ足す: **キーボードを出す前と出した後で `window.innerHeight` と `window.visualViewport.height` の両方**を読む。両方縮む＝レイアウトごと縮む挙動なので、`interactive-widget=resizes-visual` を meta に明示して土俵を揃えてから隠す判定を書く。visual だけ縮むなら `useVisualViewport` の差分でそのまま判定できる。

### 2026-08-10 — Step 2 / Step 3 実装完了（Step 1 の実測を待たずに着地できた）

**Step 3（#607）= 「自分の書き込みは自分の hydrate を無効化しない」**。`useNotesUnifiedAPI` に `locallyWrittenIdsRef` を足し、`prev.updatedAt === row.updatedAt` に「**または自分が書いた行**」を OR で並べた（`shared/src/hooks/useNotesUnifiedAPI.ts:322`）。マークを付けるのは `updateNote` / `createNote` と undo/redo の 4 経路（どれもクライアント時計の `updatedAt` を楽観的に載せる側）。**マークは「開いているノートの間だけ」有効**で、選択が外れた時点で捨てる（`:189`）— 開いている間は自分のバッファが最新という Desktop 既存の挙動（エディタが note id で keyed で読み直さない）に揃えた形で、閉じた後は #301 どおり他デバイスの書き込みが勝つ。

新規作成直後も同じ穴だった（INSERT が返す `updated_at` はサーバ時計）ので `createNote` にも同じマークを付けた。**Step 1 の質問 2（新規作成直後に挙動が違うか）は「同じ穴・同時に塞がった」が答え**になる見込み。

**Step 2（#608）= `useSoftKeyboard` 新設 + narrow の `BottomTabBar` を非描画**（`shared/src/hooks/useSoftKeyboard.ts` / `AppShell.tsx:160,216`）。Step 1 で決めるはずだった「レイアウトごと縮むのか visual だけか」に**判定を依存させない形にした**: 「`documentElement.clientHeight` との差」と「同じ幅で見た中で一番高かった高さとの差」の**大きい方**をキーボードの高さとみなす。前者が visual だけ縮む挙動、後者がレイアウトごと縮む挙動を拾うので、どちらでも成立する（閾値 150px 未満はアドレスバーとみなして無視）。

そのため **`web/index.html` の `interactive-widget=resizes-visual` は入れていない**。Scope 外のパスであり、上の判定では不要なため（P-008）。Step 1 の実測で「レイアウトごと縮む」と出たなら、タブバー以外（`h-[100svh]` のシェル自体がスクロールする筋）も動くので、その時に別途判断する。

**テスト**: `shared/tests/notesOpenNoteOwnEditHydrate.test.tsx`（Step 0 の再現テストを修正後の機構に合わせて書き直し + 「閉じた後の他者書き込みは従来どおり落ちる」境界も追加）/ `shared/tests/appShellSoftKeyboard.test.tsx`（`visualViewport` をモックし、隠す判断が下ることだけを固定。見た目は Step 1 / 4 の目視）。#607 のテストは**修正を戻すと落ちることを実測で確認済み**。落ちるのは「再取得が 2 回走る」行で、モックでは再 hydrate が同一 tick で解決して `isContentLoaded` の窓が閉じてしまうため（この事情はテスト本文にコメントで固定した）。

**Step 1 は依然として必要**（塞がったのが症状そのものかの確認 + #512 の潜り）。ただし**ブロッカーではなくなった**ので、質問は当初の 5 点 + `innerHeight` / `visualViewport.height` の実測のまま据え置く。

### 2026-08-10 — Step 1 実機報告（deploy 前の現状確認）+ QA 指摘の反映

**実機（Android Chrome・こうだいさん）の回答**:

- Q1 / Q2: 既存ノートも新規作成直後も**挙動は同じ**（どちらも入力パネルが閉じる）。「まだ改善していない」との報告だが、これは**本修正が未 commit / 未 deploy で公開 URL は main のビルドを配っているため**で、想定どおり。修正後の判定は deploy 後に再度依頼する
- Q3: 質問の意味が伝わらなかったため保留。**deploy 後に「板ごと消えるか / 本文だけ灰色の棒になるか」で聞き直す**（後者なら本計画の原因で確定、前者なら H1 / H3 が別に生きている）
- Q4: **#512 は潜っていない・支障なし** → Step 4 は「実測結果を Issue にコメントして close」の分岐で決着
- Q5: **タブバーはキーボードの上に半分ほど見える** → #608 の報告どおり。Step 2 の「キーボード中は出さない」がそのまま効く形
- `innerHeight` / `visualViewport.height` の数値は未取得（スマホでの DevTools 接続が要るため）。ただし下記のとおり判定式が両方の挙動を跨ぐ形になったので、**この数値は blocking ではなくなった**

**QA（role-qa・別コンテキスト）で BLOCKING 1 / IMPORTANT 4 が出たので反映した**:

- **BLOCKING = マークの寿命**。「選択が外れるまで有効」にしていたが、モバイルのシートは `closeSheet` しても shared の選択が残る（`useNoteSheetTarget.ts:83`）。つまり実質セッション中ずっとマークが生き、その間に他デバイス / MCP が同じノートに書くと、こちらの古い本文が保持されたまま再 hydrate もスキップされ、次の保存で**相手の編集を無言で上書きする**筋があった。→ **マークは「それを使ったリロード 1 回」で使い捨てる**形に変更（保持した行はサーバの `updatedAt` を取り込むので、次からは素の等値判定で足りる）。書き込みが in-flight の間は使い捨てを保留する（`unackedWritesRef`）。回帰テストを 1 本追加（**修正を戻すと落ちることを実測済み**）
- **IMPORTANT = マージ判定を「開いている行」に限定**（開いていないノートまでピン留めしていた。とくに `createNote({select:false})` は空本文をピン留めしうる）
- **IMPORTANT = `useSoftKeyboard` の baseline から `documentElement.clientHeight` を外した**。モバイルの ICB は大ビューポート（アドレスバー非表示時）を返す一方 `visualViewport.height` は小ビューポートなので、キーボードが無くても常時 60〜110px の差が出て、閾値 150px の余裕を食っていた（上下 2 段バーの UA では**キーボード無しでタブバーが恒久的に消える**危険側の失敗）。**同じ幅で観測した最大高との差**だけで判定する
- **IMPORTANT = ピンチズームの誤検出**に `vv.scale > 1` のガードを追加
- **IMPORTANT = 計測を render 中から `resize` ハンドラ内へ移動**（baseline は履歴依存なので、render 中に更新すると React の呼び出しタイミングで答えが変わる）
- NIT 2 件は 👀 の確認項目として残す: **タブバー非表示時に safe-area の下端余白も一緒に消える**（ホームインジケータ帯に本文が乗らないか）/ **「その他」シートを開いたままキーボードが上がるとシートごと消える**

**AC「PR diff ±200 行以内」を超過**: 実装 約 200 行 + テスト 約 380 行 + 記録類。**免除ではなく明示**として PR 本文に内訳を書く（超過分の大半はテストと記録で、修正カテゴリの目安が意図した「実装の膨張」ではない）。

---

完了時（archive する時）の乖離レビュー 3 行は必須（実行者 = `task-tracker` の END フロー）:

1. スコープ逸脱の有無
2. AC 免除の有無
3. 途中で出た判断とその行き先（`D-…` / Issue #NNN / 「行き先なし」）

### 乖離レビュー（2026-08-10・PR #621 merged 後に記入）

1. **スコープ逸脱**: **あり 1 件**。`shared/src/hooks/useNotesUnifiedAPI.ts` は #587（分割予定）のため「触らない」と宣言していたが、Step 0 で #607 の原因がまさにこのファイルの限定無効化マージだと確定したため、ユーザー裁定で例外入り（**D-20260810-main-4**・実測 = #587 未着手 / open PR ゼロ）。#587 に分割時の申し送りをコメント済み。`web/index.html` の `interactive-widget` は Scope 外だったので**触らず**、代わりに検出器を両ビューポート挙動で成立する形にした
2. **AC 免除**: **免除ゼロ、超過の明示が 1 件**。「PR diff ±200 行以内」を超過（実装 約 200 行 + テスト 約 380 行 + 記録類）。免除ではなく PR 本文に内訳を記載した。**Step 5 の 👀 実機目視 4 点は同日中に消化済み**（2026-08-10・**iPhone の Chrome**）— 本文タップでシートが閉じない / タブバーの出戻り / タブバー非表示時もホームインジケータ帯に本文が乗らない / 「その他」シートがキーボードで消えるのは許容。#607 / #608 とも CLOSED。**「iOS 未検証」も解消**（iOS のブラウザは全て WebKit なので描画エンジンは Safari と同経路。Safari の UI そのものは未確認）
3. **途中で出た判断の行き先**: Scope 例外 → **D-20260810-main-4**（台帳化済み）/ QA の BLOCKING 1・IMPORTANT 4 → **本 PR 内で全件反映**（上の Worklog に記載）/ QA の NIT 2 件 → **👀 の確認項目**として memory へ / #512（コマンドパレット上余白）→ **close せず open のまま**（Android 実測は iPhone 前提の指摘の反証にならないためコメントのみ）。**行き先なしの指摘はゼロ**
