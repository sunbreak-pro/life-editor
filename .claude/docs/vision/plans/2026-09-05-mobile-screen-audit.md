---
Status: Draft
Created: 2026-09-05
Branch: docs/plan-1409-mobile-screen-audit（計画書）/ 実行セッションはブランチを切らない（chat-main・`main` 直下）
Owner-chat: main
Previous: ../../../archive/2026-09-02-desktop-screen-audit.md
Related:
  - "#1409" — Mobile 幅 全画面の実ブラウザ点検（本計画の対象 Issue）
  - "#1408" — 対の Desktop 側（2026-09-05 実行完了・finding #1467〜#1486）
  - "#716" — Epic: Mobile UI/UX 追随 v2（残 DoD = 狭幅の実機目視。本計画は代替ではなく前段）
---

# Plan: Mobile 幅 全画面の実ブラウザ点検 — 画面別調査 + 画面間結合（#1409）

> 一言で言うと、Desktop（#1408）で済ませた「全画面の健康診断」を**スマホの画面幅でもう一巡する**。
> ただし Mobile は「出ていない」が正解のことがある。Desktop の診断が「あるべきものが全部あるか」だったのに対し、こちらは**設計図（`mobile-scope.md`）と見比べて、出るべきものが出て・出ないと決めたものが出ていないか**を見る。修正はしない。所見は 1 つずつカルテ（Issue）にして止める。

---

## Context

- **動機**: #1408 の一巡で Desktop 幅の所見 20 件（#1467〜#1486）を起票したが、同じ画面を**狭幅で通しで回した記録が無い**。8 月末〜9 月頭に Mobile 固有の変更（#1148 月グリッド単独化 / #1290 タグ編集の narrow 入口 / #1400・#1402 サイドバー / #1403 終日トグル / #1401・#1464 月グリッド刷新 / #1463 Todo タブの 2 分類）が続けて着地しており、merge 直後の個別確認しか無い
- **制約**:
  - ブラウザ実体はセッションに 1 つ。playwright を使うエージェントは**同時 1 体まで・並列起動禁止**（`~/.claude/agents/playwright-ui-verifier.md`）
  - 実行は **chat-main・リポジトリ直下・`main` ブランチ**のみ（CLAUDE.md §7.4）
  - テストデータは**普段のアカウント**に書く（2026-09-01 ユーザー確定）。後始末が必須条件
  - **Daily は作らない**（id が `daily-<YYYY-MM-DD>` で本物と区別できない）。Briefing の宣言 / 気分 / 目標 / フォーカスも**表示確認のみ**（Daily と予約ノートに書く経路のため）
  - **Work のタイマーは開始しない**（#1408 で「開始 → 一時停止 → リセット」だけで `timer_sessions` に消せない行が 2 本残った = #1475。Mobile では transport が幅共通なので、表示と Todo 選択シートまでで止める）
  - 修正はしない。finding は起票までで止める（🛑）
- **Non-goals**:
  - 見つかった不具合の修正
  - ネイティブ殻（Capacitor）でのビルド・確認 — ブラウザの `web` ホストをリサイズするだけ（Issue 本文の決定）。`isNativeMobile()` の省略ガードはブラウザでは発火しないので**対象外**（`mobile-scope.md` §6）
  - **実タッチ**（Epic #716 の DoD「狭幅（iPhone 縦）の実機目視」はユーザー手番のまま）。本計画はマウス操作のエミュレーションで、タップの当たり判定は**サイズの実測**で代替する。swipe（#1204 / #1402）とソフトキーボード（#470 / #512 系）は**測れないので SKIP と明記**し、実機目視への申し送りに載せる
  - Desktop 幅の再確認（#1408 で済み）。Desktop 起票分の 20 件は再報告しない
  - ツアー（Epic #1121）の完走 — 実データを作る 9 ステップを含みユーザー手番として別扱い（Desktop 計画と同じ）
  - 添付（#1404）のアップロード
  - E2E テストの整備

---

## 検討した代替案（必須）

| 案                                                             | 採否                            | 却下理由                                                                                                                                                    | 復活条件                                                                      |
| -------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **1 画面 1 エージェントを直列起動 + 結合はメイン直接**（採用） | ✓                               | — #1408 で 7 画面中 7 画面が完走（settings の 1 回目 stream 停止は再起動で回復）した実績どおり                                                              | —                                                                             |
| #1408 の結果表に Mobile 列を足すだけの差分点検                 | ✗                               | Mobile はナビの形（下タブ / More シート / ハンバーガーのドロワー）が別物で、Desktop の項目をそのまま当てると「無くて正しい」ものを FAIL にしてしまう        | Desktop と Mobile の UI 部品が同一になったら（起きない）                      |
| Desktop 起票分 20 件を Mobile で全部再現確認する               | ✗                               | 修正が入る前に同じ所見を 2 回書くことになる。横断で Mobile にも出そうな 5 件（申し送り §7）だけ**再報告せず「Mobile でも再現」と既存 Issue にコメント**する | 20 件の修正が先に着地したら（その時は再現確認でなく回帰確認になる）           |
| 実機（iPhone Chrome）で回す                                    | ✗（**#716 の DoD として温存**） | playwright が実機を掴めない。実機はユーザー手番で、本計画はその前段（エミュレーションで潰せるものを先に潰す）                                               | ユーザーが実機目視を回すとき — 本レポートの「実機への申し送り」節を持って行く |
| 画面ごとに並列起動                                             | ✗                               | ブラウザ実体が 1 つで操作が混線する（エージェント定義の禁止則）                                                                                             | playwright MCP がセッション内で複数ブラウザを持てるようになったら             |
| 検証専用アカウント（#700）を使う                               | ✗                               | ユーザー裁定で普段のアカウント。env 投入の 🛑 ゲートも未消化                                                                                                | env 投入が済んだら                                                            |

> `ask-user` は使っていない — 直列起動 / chat-main 実行 / 普段のアカウント / 1 finding 1 Issue / 幅で出す（Capacitor 不要）/ Desktop 先行 の 6 点は Issue 本文の「決定」節で 2026-09-01 に確定済み。

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-09-05-mobile-screen-audit.md   （本計画書）
.claude/docs/reports/2026-09-DD-mobile-screen-audit.md        （実行レポート — DD は実行日）
GitHub Issues（finding の起票 — issue-dispatch スキル経由 / Desktop 既知分へのコメント）
```

コードには一切触らない。**`mobile-scope.md` も書き換えない** — 判定に迷った所見は「判断待ち」としてレポートに列挙するだけで、仕様の側を動かすのはユーザー回答の後（Issue 本文の 👀 ゲート・P-008）。実行中にコードの修正が要る所見が出ても起票までで止める（🛑）。

---

## Steps

| #   | Step                                                                                                                                     | Gate                                      | Acceptance                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | 本計画書を PR で main へ                                                                                                                 | 🛑 人手                                   | PR merge                                                                                                   |
| 2   | 実行セッションの起点（`git pull --ff-only` → 本計画書の Status を IN PROGRESS → 既知の除外リストを `gh issue list --state open` で更新） | 👀 目視                                   | ユーザーがセッションを開く。`git status` clean・`git log -1` が origin/main と一致                         |
| 3   | P0 環境準備 — dev server 起動・実ポート確定・サインイン状態の確認・playwright MCP ロード・**`browser_resize(390, 844)`** で狭幅に固定    | 🤖 自律 / 🛑 サインインが要るときだけ人手 | `curl` で 200・下タブバーが出る（`useMediaQuery` が narrow に切り替わった証拠）                            |
| 4   | P1 ベースライン — 狭幅で起動直後の console error 数・`document.documentElement.scrollWidth` / `innerWidth`・開始時の設定値を記録         | 🤖 自律                                   | 数値がレポートに残る                                                                                       |
| 5   | シェル調査（下タブ 4 + More シート・ハンバーガー・狭幅ヘッダー行・FAB） — §シェルチェックリスト                                          | 🤖 自律（メイン直接）                     | 全項目に PASS / FAIL / SKIP(理由)                                                                          |
| 6   | 画面別調査 ×7（`MOBILE_SECTIONS` の順で直列: briefing → schedule → materials → work → analytics → connect → settings）                   | 🤖 自律                                   | 画面ごとに §画面別チェックリストの全項目に PASS / FAIL / SKIP(理由) + **仕様どおり / 判断待ち** の振り分け |
| 7   | 結合シナリオ M1〜M10                                                                                                                     | 🤖 自律（メイン直接）                     | 全項目に PASS / FAIL                                                                                       |
| 8   | 後始末 — 台帳の全 id を削除 → Settings のゴミ箱を空に → MCP で残数 0 を実測 → 幅と設定値を元へ                                           | 🤖 自律                                   | §後始末の AC がすべて yes                                                                                  |
| 9   | finding の重複チェックと起票（issue-dispatch）。Desktop 既知 5 件の「Mobile でも再現」は既存 Issue にコメント                            | 🤖 自律                                   | 各 finding に Issue 番号が付く。判断待ちはレポートに列挙                                                   |
| 10  | レポートを `docs/reports/` に置き、#1409 に後始末完了をコメント → 本計画書を COMPLETED にして archive へ                                 | 🤖 自律 → 🛑 PR merge                     | docs-lint 緑・PR merge                                                                                     |

### Gate 凡例

- **🤖 自律** — Claude が完結
- **👀 目視** — ユーザーが画面で確認 / ユーザー判断へ回す
- **🛑 人手** — ユーザー操作必須（サインイン / PR merge）

---

## 実行の設計

### 幅と操作の前提

- **ビューポート = 390×844**（iPhone 14 / 15 の CSS px。`WIDE_BREAKPOINT_PX = 768` 未満なら何でもよいが、実機と同じ数字にしてタイルの省略や折り返しを実機に近づける）。各エージェントは起動直後に `browser_resize(390, 844)` を打ち、報告の先頭に `innerWidth` の実測値を書く（**768 以上のまま回った報告は無効**）
- **操作はマウス**。タップの当たり判定は「クリックが効く」+「要素の `getBoundingClientRect()` が 44×44 以上」の 2 つで判定する（#794 の型の再発を、サイズで先に拾う）
- **ホバーで出る操作**（#1463 の「本日分 / その他」の行き来など）は、狭幅では**ホバー無しで到達できる導線があるか**を見る。マウスなので操作自体はできてしまう — 「ホバーしないと出ない」なら finding ではなく**判断待ち**（タッチでの導線が仕様で決まっていない）
- **ソフトキーボード**と **swipe** はエミュレーションで再現できないので SKIP と明記し、§実機への申し送りに載せる

### エージェントの割当

- 実行主体は **`playwright-ui-verifier`**（global agent・opus / xhigh・`mcp__playwright` 持ち）。1 画面につき 1 体を起動し、**前の 1 体の報告が返ってから次を起動する**。シェル調査と結合はメインが直接操作（#1408 と同じ）
- **フォールバック**: 起動が失敗するか、1 画面で **2 回連続**で報告が返らないときは、その画面からメインが直接操作する（#1408 の settings は 1 回目の stream 停止 → 再起動で完走したので、閾値は 2 回のまま）。切り替えた事実と理由をレポートに残す
- エージェントは**コードを修正しない・他のエージェントを起動しない・`mobile-scope.md` を書き換えない**

### エージェントへ渡すブリーフ（画面ごとに埋める）

```
対象: <section id>（Mobile 幅 = 390×844。起動直後に `browser_resize(390, 844)` → `innerWidth` を報告の先頭に書く）
URL: http://localhost:<実ポート>/
前提: 既にサインイン済み。ログイン画面が出たら操作せず「BLOCKED: login」で即終了
やること: playwright-verify の Gate P1 → P2 → P3 → P5 を、下のチェックリストの項目順に実施
  <§画面別チェックリストの該当画面の全文を貼る>
判定の基準: <§mobile-scope.md の該当行（目標スコープ列）を貼る>
  出ない機能を見つけたら、上の行で「省略」「Desktop 専用」「wide 専用」と書かれているか確認する。
  書かれていれば「仕様どおり」（finding にしない）。書かれておらず判断に迷えば「判断待ち」。
  勝手に仕様を決めない。
テストデータ: 名前は必ず `PWV1409-<section>-<連番>` で始める。作ったものは id を控え、
  最終報告の「作成した id」節に全部書く（消さなくてよい — 後始末はメインがまとめて行う）
禁止: Daily を作らない / Briefing の宣言・気分・目標・フォーカスに書き込まない /
  Work のタイマーを開始しない / Settings のアカウント（パスワード・削除）を触らない /
  `claude` を起動しない / ツアーを開始しない / 幅を 768 以上に戻さない / コードを直さない
既知の open Issue（再報告しない）: <§既知の除外リストを貼る>
  ただし「Desktop で既知・Mobile でも同じ所見」は再報告せず、報告の「Mobile でも再現」節に Issue 番号を書く
報告: playwright-verify の Report Format。FAIL は「画面 / 操作 / 期待 / 実際 / console / screenshot path」を必ず埋める。
  加えて「作成した id」「変更した設定値と復元の有無」「console error の増減」「仕様どおり と 判断待ち の一覧」
  「Mobile でも再現（Desktop 既知）」の 5 節を末尾に付ける
```

### 停止条件

- ログイン画面が出た → 🛑 ユーザーにサインインを依頼して待つ（資格情報は Claude に渡さない）
- 同じ操作が 3 回連続で失敗 → その画面を BLOCKED として次へ進み、レポートに残す
- 1 画面で console error が **20 件を超えて増え続ける** → その画面の残り項目を SKIP して次へ（原因を 1 件の finding にまとめる）
- dev server が落ちた → 再起動 1 回まで。2 回目は中断してユーザーに報告
- 予定時間の目安 = シェル 15 分・1 画面 15 分・結合 30 分・後始末 15 分（合計 約 3 時間）。**倍を超えたら中断して途中経過をレポートに残す**（途中経過でも後始末は必ず完了させる）
- **テストデータの日付は実行日に合わせる**（#1408 は日付を跨いで作り直した）。日付を跨いだら当日付で結合分を作り直す

### テストデータの台帳

- 命名: **`PWV1409-<section>-<n>`**（例 `PWV1409-schedule-1`）。#1408 の `PWV1408-` の系譜
- 台帳の置き場: 実行中は scratchpad（`ledger.md`）に「id / 種類 / 作った画面 / 削除済みか」を追記し、完了時にレポートへ転記する
- 作ってよいもの: Todo（task）/ Event / 繰り返し Event（routine + occurrence）/ Note / タグ / タグの item link
- 作らないもの: Daily / 目標ノートの本文 / フォーカスノートの本文 / **timer_sessions 行（タイマーを開始しない）** / 添付ファイル

---

## シェルチェックリスト（Step 5・メイン直接。画面別の前に 1 回）

正本 = `shared/src/sections.ts` の `mobileOrder`（下タブは `AppShell.tsx` の `maxBottomTabs` 既定 4 件・残りが More シート）/ 狭幅ヘッダー行の形 = `web/src/sectionDescriptors.tsx` の `narrowHeader` / More シートの行 = `web/src/MobileShellActions.tsx`。

- [ ] 下タブバーに固定 4 セクション + More が出て、More シートに残りのセクションが `mobileOrder` 順で出る（個数を書かず registry と突き合わせる）
- [ ] 下タブ → More シート → 各セクション の順で **7 セクションすべてに到達できる**。More シートを開いたまま下タブを押しても壊れない
- [ ] More シートの Quick actions（コマンドパレット / タグを編集 / Undo / Redo）が出る。パレットとタグ編集は選ぶとシートが閉じ、Undo / Redo は閉じない（`MobileShellActions.tsx` の設計）。More シートに「閉じる」ボタンがある（D-20260730-mobile-2 = B）
- [ ] 狭幅ヘッダー行: 各セクションの形が descriptor どおり（Briefing / Schedule / Materials = タブ + ハンバーガー、Work / Settings / Connect = ハンバーガーのみ、Analytics = 無し）。**Undo / Redo は全セクションの右端に出る**（#1035。`mobile-scope.md` #16 行の「header = wide 専用」は古い記述で、night-safe 2026-09-02 が docs 追随を起票依頼済み — 所見にしない）
- [ ] ハンバーガーで左の `MobileDrawer` が開閉し、閉じるボタンがある。開いたまま下タブを押すとドロワーが閉じる（閉じないなら判断待ち）
- [ ] FAB の位置が Schedule / Materials で揃っている（#632 の統一）。下タブバーと重ならない
- [ ] `document.documentElement.scrollWidth <= innerWidth`（横スクロール無し）を 7 セクションで実測。**本文が下タブバーの下へ潜らない**（#631 — `document.scrollingElement.scrollHeight <= innerHeight` を実測）
- [ ] safe-area: `env(safe-area-inset-*)` はエミュレーションでは 0 なので SKIP と明記（実機への申し送り）
- [ ] ライト / ダーク両テーマで下タブバーと More シートの背景が透明落ちしていない（`background-color` が `rgba(0, 0, 0, 0)` でない）
- [ ] 入力欄のフォント下限: 各セクションで最初に見つかる `input` / `textarea` の `getComputedStyle().fontSize` が **16px 以上**（`tokens.css` の `@media (max-width: 767px)` ブロック = #1134。守りは `web/tests/fieldFontFloorLockstep.test.ts` だが実挙動はここでしか見えない）。ノート本文（ProseMirror）も同じ（`web/src/index.css` 側）

---

## 画面別チェックリスト

共通（全画面・Gate P1 / P5 相当）:

- [ ] 遷移 → snapshot → console error の増分 0（増えたら件数と先頭 3 件を記録）
- [ ] 空状態・ロード中・データありの 3 状態のうち、その画面で出せるものが出る（骨組み表示が挟まらない = #1101）
- [ ] レイアウト崩れ・はみ出し・重なりが無い（screenshot 1 枚を scratchpad に保存）。**390px でのタイル・見出し・ボタン文言の省略（`…`）と折り返し**を Desktop の「詳細パネル開」の代わりとして見る（#1469 / #1480 相当）
- [ ] 主要 UI コンテナ背景の透明落ちが無い（1 コンテナで実測）
- [ ] ライト / ダーク両テーマで 1 回ずつ snapshot（Settings で切り替え・最後に元へ戻す）
- [ ] タップ対象（行 / チェックボックス / ボタン）の `getBoundingClientRect()` が 44×44 以上（1 画面につき代表 3 つ）
- [ ] **仕様どおり（出ないのが正しい）の一覧**をその画面の `mobile-scope.md` 行と突き合わせて報告に書く

### 1. briefing（`mobile-scope.md` #1 / #2 / #3 / #18 / #19 / #20）

- [ ] 朝刊 / 夕刊の in-body SegmentedControl で切り替わる（#2。17 時以降は夕刊が既定）
- [ ] 朝刊: 見出し・「今日のスケジュール」・持ち越し・「今週」カード・グラフ 2 枚・目標ブロック（#18 = 幅共通で表示）が 390px に収まる。ストリーク「最長 (日)」は #1467 既知
- [ ] 完了トグル（予定 / Todo / 持ち越し）が **44px 以上で押せて書き込む**（#19 + #794 の再発確認）。「今日のスケジュール」Todo 行の意味づけは #1486 既知
- [ ] 夕刊: 気分★（#20）が押せる（**押した後に元へ戻す** = 同じ★をもう一度押して解除）。宣言・フォーカスの入力欄は表示のみ
- [ ] ハンバーガーで「今日の Todo」トレイと「きのうまでの自分」（朝刊のみ）がドロワーに出る（#609 / #938）
- [ ] 朝刊のクイック作成で Todo `PWV1409-briefing-1` を作れる（Schedule に出るのは結合 M1）

### 2. schedule（`mobile-scope.md` #4 / #5 / #6）

- [ ] narrow のメイン = **月グリッド単独**（#1148 / #1401 / #1464: 横余白ゼロ・丸点無し・タイトルの縦リスト）。7 列が 390px に収まり、セル内のタイトルが省略されすぎていない
- [ ] 日付タップで右ドロワーが「今日の流れ」タブで開き、その日の Dayflow（終了時刻・所要時間ぶんの高さ・空き区切り・現在線 = #691）が出る
- [ ] 右ドロワーの 3 タブ（`ScheduleSidebarTabId` flow / todo / repeats）のラベルが 1 行（#1343）。「本日の Todo」が**本日分 / その他**の 2 分類（#1463）で、**行き来の操作がホバー無しで到達できるか**（できなければ判断待ち）
- [ ] FAB → QuickCaptureSheet で Event `PWV1409-schedule-1`（今日・時刻あり）と Todo `PWV1409-schedule-2`（今日・時刻あり）を作成 → グリッドとドロワーに即反映
- [ ] 行タップで `EventEditorPane` が BottomSheet に載る（#889）。タイトル / 日付 / 時刻 / 終日（**終日トグルが日付欄と重ならない** = #1403 の回帰）/ メモ / 繰り返し / タグ / 削除 が出る。シートに閉じるボタンがある
- [ ] 繰り返し Event `PWV1409-schedule-3`（毎日）を作成 → 「繰り返し」タブに載る → 行タップで次回発生日へジャンプ。**削除が出ないのは仕様**（#5「削除は Desktop 専用」）
- [ ] 繰り返しの削除は Desktop 専用なので、種イベントの削除は結合 M9 の後始末で Desktop 幅に戻して行う（ここでは SKIP と明記）
- [ ] Todo 行タップで詳細オーバーレイ（`ScheduleTodoDetail`）。ステータスが narrow の 2 択タッチ行（`TodoStatusChoices`・D-20260730-mobile-1）
- [ ] 前後移動（月単位）と「今日」で表示が動く。**月セルからの新規作成が無いのは仕様**（#4）
- [ ] Undo（ヘッダー右端）で直前の作成が消え Redo で戻る。**Todo が Undo で消えないのは #1485 既知**（Mobile でも再現なら同 Issue へコメント）

### 3. materials（`mobile-scope.md` #7 / #8）

- [ ] Notes: メインは選択中ノートの `NoteDetailPanel`（#876）。一覧・タグフィルタチップ・ピン留めはハンバーガーのドロワー側に出る
- [ ] 「+」で**タイトル入力なしで即エディタ**が開く（#1147 = QuickAddSheet 退役）→ `PWV1409-materials-1` をタイトルに入れ本文入力 → 800ms 後に保存（リロードで残る）
- [ ] `/` ブロックメニューと `[[` 補完が出る。候補メニューがビューポート内に収まる（`suggestionPopup.ts` の配置。**ソフトキーボード回避は SKIP**）。`[[PWV1409-schedule-2` で Todo を候補に出してリンク
- [ ] タイトル / タグ / ピン / 削除が narrow で触れる（#7 = フル編集可）。削除で ConfirmDialog（#1345）→ キャンセル → 実行でゴミ箱へ
- [ ] **Links パネルが出ないのは仕様**（#7「Links（#884）は wide 専用」）。テンプレート編集はダイアログの幅が 390px に収まるか見る（#1471 は Desktop 既知）
- [ ] Daily: 今日で開く・`DateStrip` で前後に動く・`EditorCard` が出る。並び替え / 絞り込み / エントリ一覧はドロワー側（#876）。**本文には書かない**
- [ ] 検索 0 件の空状態は #1470 既知（Mobile でも同じなら同 Issue へコメント）

### 4. work（`mobile-scope.md` #10 / #11）

- [ ] 単一フルスクリーンタイマー + Todo 選択シート（`PomodoroTodoSheet`）が出る。transport（start / pause / reset / skip / ±5 分）のボタンが 44px 以上
- [ ] Todo 選択シートで `PWV1409-schedule-2` を選べる → 選択がタイマー面に反映される。**開始しない**
- [ ] ハンバーガーの左ドロワーから設定 / プリセットに到達できる（#10）
- [ ] **環境音ミキサーが出ないのは仕様**（#11 = Desktop 専用。ただし実ゲートは `WorkScreen.tsx` の narrow 早期 return なので、ブラウザでも出ない）
- [ ] disabled ボタンの見た目は #1474 既知

### 5. analytics（`mobile-scope.md` #12）

- [ ] `MobileAnalyticsView` の単一スクロールが出る。**4 タブ帯・期間切替・heatmap / timeline が出ないのは仕様**（#12）
- [ ] 各カードの数値タイル・チャートが 390px に収まる（省略 `…` は #1480 相当だが Mobile 用ビューなので**別所見**として扱う）。横スクロール無し（#948 の 390px 裏取り）
- [ ] 英語ラベルの残り（#1478）・生 id（#1479）が Mobile ビューにも出るかを見て、出れば同 Issue へコメント
- [ ] タップ可能要素が無い（= 閲覧専用）ことを確認。あれば判断待ち
- [ ] 狭幅ヘッダー行が「無し」でも Undo / Redo の右端は出る（シェル項目の再確認）

### 6. connect（`mobile-scope.md` #13）

- [ ] More シートから到達。narrow は**タグ一覧 → アイテム一覧の 1 画面ずつ遷移**で、戻るリンク（`connect.back`）がある
- [ ] タグを選ぶと Note / Todo / Event / Daily の種類別に出る（結合 M3 のタグで 3 種）。件数の単複（#1276）
- [ ] アイテムをタップすると該当セクションへ遷移し、そのアイテムが開く（`navigateToItem` が narrow でも効く — Materials は `NoteDetailPanel`、Schedule は BottomSheet）
- [ ] **hub 内に編集導線が無いのは仕様**（#13 = Consumption）。右詳細パネルが常時空（#1472）は Desktop 既知で narrow には無い
- [ ] 離れて戻るとタグ選択がリセットされる件（#1473）は Mobile でも同じなら同 Issue へコメント

### 7. settings（`mobile-scope.md` #14 / #15 / #9）

- [ ] general: 外観（テーマ 3 カード）/ フォントサイズ（**narrow は 3 段階** = #1182・大で溢れないこと = #1253 の回帰）/ 言語 を切り替えて即反映 → **最後に元の値へ戻す**（開始時の値を台帳に記録）。`touch` / `stacked` の narrow レイアウトで行が重ならない
- [ ] **Shortcuts カードが出ないのは仕様**（#14）。AI 連携カードは出る（#14 = `isWide` ガード無し）。起動ボタンは押さない
- [ ] セクション別の行（`SECTION_TAB_IDS`）を順に開き各ペインが 390px に収まる。プレースホルダの 4 カテゴリは by design（#1408 で確認済み・所見にしない）
- [ ] ゴミ箱（#15 / #1293）: 本計画で削除したアイテムが該当カテゴリに出る・1 件復元 → 再削除・**複数選択と一括削除の UI が 390px で操作できる**（#1294。実際の一括削除は Step 8）
- [ ] タグ編集（#9 = Full・#1290）: More シート「タグを編集」→ `TagEditModal` が **一覧 → 編集の 2 ステップ**（#740）で開き、戻るリンクが narrow 限定で出る。改名 / 色 / アイコン / 削除の導線がある（実操作は結合 M3 のタグで）
- [ ] 法務 reader が 390px で読め、Escape と戻るボタンで閉じる（#1281）。Tips 行で概要モーダル（ツアーは開始しない）
- [ ] アカウントカードは表示のみ。サインアウト・削除は触らない

---

## 結合シナリオ（画面別が全部終わってから・メインが直接実施）

| #   | シナリオ                                                                                                                                                                                           | 期待                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Quick capture で作ったもの → それを映す画面: Briefing クイック作成の `PWV1409-briefing-1` と Schedule FAB の `-schedule-1 / -2` → 朝刊「今日のスケジュール」+ Schedule ドロワー「本日の Todo」     | 朝刊に Event + Todo が 1 リストで時刻付き・ドロワーの本日分に Todo 2 件                                                                                     |
| M2  | 朝刊の完了トグルで `PWV1409-schedule-2` を完了 → Schedule ドロワー → Analytics（Mobile ビュー）                                                                                                    | ドロワーの行が完了表示・Analytics の完了数が +1                                                                                                             |
| M3  | More シート「タグを編集」でタグ `PWV1409-tag` を作り、Event / Todo / Note に付ける（各詳細シートの `TagPicker`）→ Connect → Materials ドロワーのチップ                                             | Connect で 3 種が同時に出る・Materials のチップで Note が絞れる                                                                                             |
| M4  | **Desktop で作ったデータを Mobile 幅で読む**: `browser_resize(1280, 800)` で Event `PWV1409-main-1` + Note `PWV1409-main-2`（本文にチェックリスト 1 行）を作る → `browser_resize(390, 844)` に戻す | 同じアカウント・同じセッションで、月グリッド / 朝刊 / Note 本文（チェックボックス付き）が narrow で正しく出る。幅を戻した後も開いていたセクションが保たれる |
| M5  | 下タブ / More シートを跨いだ遷移: Note を開いたまま Schedule（下タブ）→ Connect（More）→ Analytics（More）→ Materials（下タブ）                                                                    | 同じ Note が開いたまま・Schedule のアンカー日が保持・console error 0                                                                                        |
| M6  | Undo の 2 経路: Schedule で Event を作り、**ヘッダー右端の Undo** で消す → **More シートの Redo** で戻す                                                                                           | 同じ 1 本のスタックを読む（#1035 + #472）。セクションを跨ぐとスタックが空になるのは仕様                                                                     |
| M7  | More シートのコマンドパレットからセクション移動 + `PWV1409-materials-1` を検索して開く                                                                                                             | パレットが 390px で候補を出し、選ぶと該当セクションが開く                                                                                                   |
| M8  | 入力欄のフォント下限を横断で実測: Briefing 宣言欄 / Schedule QuickCaptureSheet / Note タイトル + 本文 / Settings のテキスト欄 / パレットの検索欄                                                   | すべて `fontSize >= 16px`（#1134）                                                                                                                          |
| M9  | 横断の見た目（S9 の Mobile 版）: Todo チェックボックス（朝刊 / Schedule ドロワー / Note 本文）・FAB・BottomSheet の閉じるボタン・空状態の文言                                                      | 同じ概念が同じ見た目・同じ操作。ズレは 1 件 1 finding（Desktop 既知は除外）                                                                                 |
| M10 | 一巡後の console error 総数 + 7 セクションの `scrollWidth <= innerWidth` 再実測                                                                                                                    | P1 のベースラインと同数・横スクロール 0                                                                                                                     |

---

## 後始末（Step 8 — 普段のアカウントを使うための必須条件）

1. 台帳の全 id を、作った画面から削除する（Event / Todo / Note）。**繰り返し `PWV1409-schedule-3` は narrow に削除導線が無い（仕様）ので `browser_resize(1280, 800)` に戻して Desktop の編集パネルから種イベントごと削除**（#1279 の ConfirmDialog）
2. タグ `PWV1409-tag` を More シート「タグを編集」から削除する（#1408 では確認ダイアログ無しで消えた）
3. Settings → ゴミ箱で `PWV1409-` を全カテゴリで複数選択 → 一括削除（「取り消せません」の確認を通す）。**390px で一括削除の UI が操作できなければ Desktop 幅に戻して行い、その事実を finding にする**
4. 夕刊の気分★を解除して開始時の状態へ。変更した設定値（テーマ / フォントサイズ / 言語）を開始時の値へ戻す
5. `browser_resize(1280, 800)` に戻し、`life-editor-last-section` を開始時の値へ
6. MCP で残数を実測: `search_all("PWV1409")` = 0 件 / `list_wiki_tags` に `PWV1409` 無し / `list_schedule`（今日〜7 日）に `PWV1409` 無し。Supabase MCP（read-only）で `items_meta ilike '%PWV1409%'` = 0 行
7. `timer_sessions` は**開始しないので行が増えない**ことを、当日分の SELECT で確認（増えていたら報告 🛑）
8. 完了を #1409 にコメント（台帳の転記 + 上の実測値）

---

## Acceptance Criteria (機械検証可能)

- [ ] レポートの実施条件に `innerWidth = 390` の実測値がある（768 以上で回った画面が 1 つも無い）
- [ ] シェルチェックリストの全項目と、7 セクションすべての §画面別チェックリストの全項目に PASS / FAIL / SKIP(理由) が記録されている
- [ ] 出なかった機能がすべて「仕様どおり（`mobile-scope.md` #N 行）/ 不具合 / 判断待ち」のどれかに振り分けられ、**判断待ちが 0 件でなければレポートと #1409 コメントに列挙されている**
- [ ] 結合 M1〜M10 に PASS / FAIL が記録されている
- [ ] finding が **1 件 1 Issue** で起票され、`type:bug` + `section:<id>` または `shared-fix` + `sev:*` が付き、レポートの finding 表に Issue 番号が入っている。Desktop 既知と同じ所見は起票せず既存 Issue にコメントし、その番号がレポートにある
- [ ] `search_all("PWV1409")` が 0 件・`list_wiki_tags` に `PWV1409` が無い・`items_meta ilike '%PWV1409%'` が 0 行（後始末の実測値がレポートと #1409 コメントに転記されている）
- [ ] `timer_sessions` の当日分が実行前後で同数
- [ ] レポート `.claude/docs/reports/2026-09-DD-mobile-screen-audit.md` が存在し、`LC_ALL=C bash scripts/docs-lint.sh` が exit 0
- [ ] 本計画書の Status が COMPLETED になり `archive/` へ移動している（PR）
- [ ] 完了・退役・supersede 時: 対応 plan・per-chat memory の Status を更新した

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積む。

---

## 既知の除外リスト（再報告しない open Issue — 実行日に `gh issue list --state open` で更新する）

| 所見                                                          | 既知                                     | Mobile での扱い                                       |
| ------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Desktop 点検の起票分（ストリーク折り返し〜Todo 行の意味づけ） | #1467〜#1486（20 件・レポート §4 が正）  | 同じ所見が Mobile でも出れば**既存 Issue にコメント** |
| うち横断で Mobile にも出そうな 5 件（#1408 レポート §7）      | #1481 / #1474 / #1478 / #1486 / #1480    | 再現の有無を必ず記録する                              |
| 期間プリセットの効き / Undo の Todo 経路                      | #1476 / #1485                            | 同じコードを通るので再現確認（#1408 §7 の申し送り）   |
| `timer_sessions` の残行 id 18 / 19                            | #1475 + ユーザー手番                     | 本計画はタイマーを開始しないので触れない              |
| dead i18n キー / dead CSS                                     | #1388                                    | 画面には出ない                                        |
| `mobile-scope.md` #16 行の「header = wide 専用」              | night-safe 2026-09-02 の起票依頼（docs） | 所見にしない。実装（#1035）を正として見る             |
| 添付のアップロード                                            | Non-goal                                 | —                                                     |

Desktop 計画の除外リストにあった #1371 / #1399 / #1405 / #1406 / #1442 は**すべて CLOSED**（2026-09-05 実測）なので、該当箇所は「修正後の回帰確認」として通常の項目に含めてある。

---

## レポート書式（`docs/reports/2026-09-DD-mobile-screen-audit.md`）

1. 実施条件（main の commit・実ポート・**`innerWidth` の実測**・開始時の設定値・console ベースライン・`scrollWidth`）
2. シェルの結果表
3. 画面別の結果表（画面 × 項目 × PASS/FAIL/SKIP・FAIL は所見 id・**仕様どおり列と判断待ち列**）
4. 結合シナリオの結果表（M1〜M10）
5. finding 一覧（所見 id / 画面 / 操作 / 期待 / 実際 / screenshot / **Issue 番号** / 既知なら既存番号）
6. **判断待ち一覧**（`mobile-scope.md` で判定できなかったもの — ユーザーへ回す）
7. エージェント運用の実測（起動できた画面・フォールバックした画面と理由・所要時間）
8. テストデータ台帳と後始末の実測値
9. **実機（iPhone）への申し送り**（Epic #716 の DoD 用: エミュレーションで SKIP した swipe / ソフトキーボード / safe-area / 実タッチの当たり判定、および本計画の finding のうち実機で見直すもの）

---

## Risks / Known Issues 参照

- **エミュレーションと実機の差**: swipe（#1204 / #1402）・ソフトキーボード（#470 / #512 / `suggestionPopup.ts`）・safe-area は測れない。「PASS」が実機の PASS を意味しないことをレポート冒頭に明記する
- **マウスでホバーが効いてしまう**: #1463 の行き来のように、ホバー前提の操作は狭幅でも「できてしまう」。判定は「ホバー無しの導線があるか」に置き換え、無ければ判断待ち（勝手に仕様と決めない）
- **エージェントが幅を戻す / 戻し忘れる**: 各報告の先頭に `innerWidth` を必須にし、768 以上の報告は無効として再起動する
- **エージェント起動の失敗**（2026-08-31 の API セッション上限 / 2026-09-02 の stream 停止）→ §フォールバック
- **dev server のポートずれ**（5173 に先客がいると 5174+）→ 起動ログから実ポートを読む（playwright-verify P0）。#1408 では 5174 の先客を流用した
- **繰り返しの削除導線が narrow に無い**（仕様 #5）→ 後始末で Desktop 幅に戻す手順を組み込んである
- Supabase MCP は `--read-only`。後始末で SQL による削除はできない（UI と life-editor MCP の削除ツールだけが手段）
- 所見の量が多くなりうるが、**起票は 1 件 1 Issue** を守り、まとめ Issue を作らない（`[all]` 禁止則と同じ理由）

---

## References

- Issue: #1409（本計画）/ #1408（Desktop 側・完了）/ #716（Epic Mobile v2 — 実機目視の DoD）
- 判定の正本: [`docs/requirements/mobile-scope.md`](../../requirements/mobile-scope.md)（#319 = D-20260723-main-1。§1 の分類・§4 の表・§6 の native ガード注記）
- 前段: [`archive/2026-09-02-desktop-screen-audit.md`](../../../archive/2026-09-02-desktop-screen-audit.md) / [`docs/reports/2026-09-05-desktop-screen-audit.md`](../../reports/2026-09-05-desktop-screen-audit.md) §7（申し送り）
- skill: `playwright-verify`（Gate P0〜P5・Report Format）/ `issue-dispatch`（起票）/ `docs-workflow`（ラベル routing）
- agent: `~/.claude/agents/playwright-ui-verifier.md`（同時 1 体・コード修正禁止）
- registry: `shared/src/sections.ts`（`mobileOrder` / `MOBILE_SECTIONS`）/ `shared/src/components/AppShell.tsx`（`maxBottomTabs`）/ `web/src/sectionDescriptors.tsx`（`narrowHeader`）/ `web/src/MobileShellActions.tsx`（More シートの行）/ `shared/src/constants/breakpoints.ts`（`WIDE_BREAKPOINT_PX = 768`）
- フォント下限: `shared/src/styles/tokens.css` の `@media (max-width: 767px)` + `web/tests/fieldFontFloorLockstep.test.ts`（#1134）
- CLAUDE.md §2（モバイル UI は画面幅で出る / 省略ガードは Capacitor 殻のみ）/ §7.4（dev server と playwright は chat-main のみ）

---

## Worklog

- 2026-09-05: 計画書作成（計画セッション・ブラウザ未起動）。Desktop 側 #1408 の実行完了（同日）を受けて着手。実行セッションは別途ユーザーが開く（#1409 の 👀 ゲート）

完了時（archive する時）の乖離レビュー 3 行は必須:

1. スコープ逸脱の有無
2. AC 免除の有無
3. 途中で出た判断とその行き先（`D-…` / Issue #NNN / 「行き先なし」）
