---
Status: COMPLETED
Created: 2026-09-02
Branch: docs/plan-1408-desktop-screen-audit（計画書）/ 実行は chat-main・`main` 直下（レポートと archive 移動は docs/1408-desktop-screen-audit-report）
Owner-chat: main
Related:
  - "#1408" — Desktop 全画面の実ブラウザ点検（本計画の対象 Issue）
  - "#1409" — 対の Mobile 幅側（本計画の完了後に別計画書で着手）
---

# Plan: Desktop 全画面の実ブラウザ点検 — 画面別調査 + 画面間結合（#1408）

> 一言で言うと「**型もテストも通っているのに、画面では壊れている**」を全画面まとめて洗い出す健康診断。
> 各科（画面）を順に回って所見を取り、最後に科をまたぐ検査（結合）をして、見つかった所見は 1 つずつカルテ（Issue）にする。**治療（修正）はこの計画ではしない**。

---

## Context

- **動機**: #1275〜#1407 の 2 ラウンドで UI の修正が 60 本以上 main に着地したが、実ブラウザでの確認は「merge 直後に該当 PR だけ」の点検で、**全画面を通しで回した記録が無い**。Todo のチェックボックスが画面ごとに 3 通りだった #1368 のような**横断のズレ**は、画面単位の点検では構造的に見つからない
- **制約**:
  - ブラウザ実体はセッションに 1 つ。playwright を使うエージェントは**同時 1 体まで・並列起動禁止**（`~/.claude/agents/playwright-ui-verifier.md`）
  - 実行は **chat-main・リポジトリ直下・`main` ブランチ**のみ（CLAUDE.md §7.4 — dev server と playwright MCP は chat-main 専有）
  - テストデータは**普段のアカウント**に書く（2026-09-01 ユーザー確定）。後始末が必須条件
  - **Daily は作らない**（id が `daily-<YYYY-MM-DD>` で本物と区別できない）。Briefing の宣言 / 気分 / 夕刊 / 目標 / フォーカスは Daily と予約ノート（`note-goals` / note-focus）に書くため**読むだけ**にする
  - 修正はしない。finding は起票までで止める（🛑）
- **Non-goals**:
  - Mobile 幅（#1409 — 本計画の完了後に別計画書）
  - 見つかった不具合の修正
  - E2E テストの整備（1 回きりの監査。再発防止のテストは各 finding の Issue 側で扱う）
  - ネイティブ殻（Electron / Capacitor）での確認 — ブラウザの `web` ホストのみ
  - 添付（#1404）のアップロード確認 — バケットの DDL（`0027_attachments_bucket.sql`）が未 push で、失敗トーストが仕様どおりの状態。push 後に別途
  - ツアー（Epic #1121）の完走 — 実データを作る 9 ステップを含み、ユーザー手番として別扱い

---

## 検討した代替案（必須）

| 案                                              | 採否                              | 却下理由                                                                                                      | 復活条件                                                                                                              |
| ----------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **1 画面 1 エージェントを直列起動**（採用）     | ✓                                 | —                                                                                                             | —                                                                                                                     |
| 1 エージェントで 7 画面を通しで回す             | ✗                                 | 実ブラウザ操作はコンテキストを大量に食い、後半の画面ほど精度が落ちる。所見も画面ごとに切り出しにくい          | 1 画面あたりの操作量が今の半分以下になったら                                                                          |
| 画面ごとに並列起動                              | ✗                                 | ブラウザ実体が 1 つでクリックとスナップショットが混線する（エージェント定義の禁止則）                         | playwright MCP がセッション内で複数ブラウザを持てるようになったら                                                     |
| メインチャットが最初から全部直接操作            | ✗（**フォールバックとして保持**） | メインのコンテキストを検証ログで埋め、後続の起票と判断の質が落ちる                                            | エージェント起動が API のセッション上限で落ちたとき（2026-08-31 に実際に起きた — history 参照）は即この案に切り替える |
| 検証専用アカウント（#700 の検証ハーネス）を使う | ✗                                 | ユーザー裁定で普段のアカウント（2026-09-01）。加えて env 投入の 🛑 ゲートが未消化で 3 ツールが常に throw する | env 投入が済み、普段のアカウントを汚したくない場面が出たら                                                            |
| Playwright のテストコードとして書き残す         | ✗                                 | 1 回きりの監査で、画面が今後も動く。コード化した瞬間から保守が乗る                                            | 同じ一巡を 3 回以上繰り返す運用になったら                                                                             |

> `ask-user` は今回使っていない — 直列起動 / chat-main 実行 / 普段のアカウント / 1 finding 1 Issue の 4 点は Issue 本文の「決定」節で 2026-09-01 に確定済み。

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-09-02-desktop-screen-audit.md   （本計画書）
.claude/docs/reports/2026-09-05-desktop-screen-audit.md        （実行レポート — DD は実行日）
GitHub Issues（finding の起票 — issue-dispatch スキル経由）
```

コードには一切触らない。実行中にコードの修正が要る所見が出ても、**P-008 に従い起票までで止める**（Issue #1408 の 🛑 ゲート）。

---

## Steps

| #   | Step                                                                                                                         | Gate                                      | Acceptance                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | 本計画書を PR で main へ                                                                                                     | 🛑 人手                                   | PR merge                                                                                  |
| 2   | 実行セッションの起点（`git pull --ff-only` で main を最新化 → 本計画書の Status を IN PROGRESS）                             | 👀 目視                                   | ユーザーがセッションを開く。`git status` clean・`git log -1` が origin/main と一致        |
| 3   | P0 環境準備 — dev server 起動・実ポート確定・サインイン状態の確認・playwright MCP ロード                                     | 🤖 自律 / 🛑 サインインが要るときだけ人手 | `curl` で 200・トップに Briefing が出る（ログイン画面が出たらユーザーにサインインを依頼） |
| 4   | P1 ベースライン — 起動直後の console error 数を記録                                                                          | 🤖 自律                                   | 数値がレポートに残る                                                                      |
| 5   | 画面別調査 ×7（registry の canonical order で直列: briefing → schedule → materials → connect → work → analytics → settings） | 🤖 自律                                   | 画面ごとに §画面別チェックリストの全項目に PASS / FAIL / SKIP(理由) が付く                |
| 6   | 結合シナリオ ×10                                                                                                             | 🤖 自律                                   | §結合シナリオの全項目に PASS / FAIL が付く                                                |
| 7   | 後始末 — 台帳の全 id を削除 → ゴミ箱を空に → MCP で残数 0 を実測                                                             | 🤖 自律                                   | §後始末の AC がすべて yes                                                                 |
| 8   | finding の重複チェックと起票（issue-dispatch）                                                                               | 🤖 自律                                   | 各 finding に Issue 番号が付く                                                            |
| 9   | レポートを `docs/reports/` に置き、#1408 に後始末完了をコメント → 本計画書を COMPLETED にして archive へ                     | 🤖 自律 → 🛑 PR merge                     | docs-lint 緑・PR merge                                                                    |

### Gate 凡例

- **🤖 自律** — Claude が完結
- **👀 目視** — ユーザーが画面で確認
- **🛑 人手** — ユーザー操作必須（サインイン / PR merge）

---

## 実行の設計

### エージェントの割当

- 実行主体は **`playwright-ui-verifier`**（global agent・opus / xhigh・`mcp__playwright` 持ち）。1 画面につき 1 体を起動し、**前の 1 体の報告が返ってから次を起動する**。起動時のプロンプトは §エージェントへ渡すブリーフを画面ごとに埋めて渡す
- **フォールバック**: 起動が失敗する（2026-08-31 は API のセッション上限で落ちた）か、1 画面で 2 回続けて報告が返らないときは、その画面から**メインが playwright MCP を直接操作**する。チェックリストと報告書式は同じものを使う。切り替えた事実と理由をレポートに残す
- エージェントは**コードを修正しない・他のエージェントを起動しない**（定義どおり）

### エージェントへ渡すブリーフ（画面ごとに埋める）

```
対象: <section id>（Desktop 幅 = 1280×800 で固定。`browser_resize` で合わせる）
URL: http://localhost:<実ポート>/
前提: 既にサインイン済み。ログイン画面が出たら操作せず「BLOCKED: login」で即終了
やること: playwright-verify の Gate P1 → P2 → P3 → P5 を、下のチェックリストの項目順に実施
  <§画面別チェックリストの該当画面の全文を貼る>
テストデータ: 名前は必ず `PWV1408-<section>-<連番>` で始める。作ったものは id を控え、
  最終報告の「作成した id」節に全部書く（消さなくてよい — 後始末はメインがまとめて行う）
禁止: Daily を作らない / Briefing の宣言・気分・夕刊・目標・フォーカスに書き込まない /
  Settings のアカウント（パスワード・削除）を触らない / `claude` を起動しない / ツアーを開始しない /
  Work のタイマーを完了まで走らせない（timer_sessions 行は Trash から消せない） / コードを直さない
既知の open Issue（再報告しない）: <§既知の除外リストを貼る>
報告: playwright-verify の Report Format。FAIL は「画面 / 操作 / 期待 / 実際 / console / screenshot path」を必ず埋める。
  加えて「作成した id」「変更した設定値と復元の有無」「console error の増減」の 3 節を末尾に付ける
```

### 停止条件

- ログイン画面が出た → 🛑 ユーザーにサインインを依頼して待つ（資格情報は Claude に渡さない）
- 同じ操作が 3 回連続で失敗（クリックが効かない・タイムアウト）→ その画面を BLOCKED として次へ進み、レポートに残す
- 1 画面で console error が **20 件を超えて増え続ける** → その画面の残り項目を SKIP して次へ（原因を 1 件の finding にまとめる）
- dev server が落ちた → 再起動 1 回まで。2 回目は中断してユーザーに報告
- 予定時間の目安 = 1 画面 15 分・結合 30 分・後始末 15 分（合計 約 2.5 時間）。**倍を超えたら中断して途中経過をレポートに残す**（途中経過でも後始末は必ず完了させる）

### テストデータの台帳

- 命名: **`PWV1408-<section>-<n>`**（例 `PWV1408-schedule-1`）。#1306 の実ブラウザ確認で使った `PWVERIFY-` 接頭辞の系譜
- 台帳の置き場: 実行中は scratchpad（`ledger.md`）に「id / 種類 / 作った画面 / 削除済みか」を追記し、完了時にレポートへ転記する
- 作ってよいもの: Todo（task）/ Event / 繰り返し Event（routine + occurrence）/ Note / タグ / タグの item link
- 作らないもの: Daily / 目標ノートの本文 / フォーカスノートの本文 / timer_sessions 行 / 添付ファイル

---

## 画面別チェックリスト

共通（全画面・Gate P1 / P5 相当）:

- [ ] 遷移 → snapshot → console error の増分 0（増えたら件数と先頭 3 件を記録）
- [ ] 空状態・ロード中・データありの 3 状態のうち、その画面で出せるものが出る（骨組み表示が挟まらない = #1101 の stale-while-revalidate）
- [ ] rightSidebar のトグルで詳細パネルが開閉する（Analytics は共有の空状態プレースホルダが出る）
- [ ] レイアウト崩れ・はみ出し・重なりが無い（screenshot 1 枚を scratchpad に保存）
- [ ] 主要 UI コンテナ背景の透明落ちが無い（要素の `background-color` が `rgba(0, 0, 0, 0)` でないことを 1 コンテナで実測）
- [ ] ライト / ダークの両テーマで 1 回ずつ snapshot（Settings で切り替え・最後に元へ戻す）

### 1. briefing（`BriefingTab` = morning / evening — `shared/src/components/briefing/eveningSection.ts:241`）

- [ ] 朝刊: 見出し・「今日のスケジュール」（予定 + 時刻付き Todo が 1 リスト・Todo 行に HH:MM = #1369）・持ち越し Todo・「今週」カード・グラフ 2 枚（`TaskCompletionTrend` / `WorkBreakBalance`）が出る
- [ ] 朝刊のクイック作成で Todo `PWV1408-briefing-1` を作れる（Schedule に現れることは結合 S2 で見る）
- [ ] 持ち越し行のチェックボックスが Schedule tray と同じ見た目（#1368 の統一）。**「今日のスケジュール」の Todo 行だけ 16px なのは D-20260901-shared-fix-2 で既知 — 再報告しない**
- [ ] 夕刊タブに切り替わる（17 時以降は自動で夕刊が既定 = `EVENING_TAB_START_HOUR`）。宣言 / 気分 / フォーカスの入力欄は**表示のみ確認**して書かない
- [ ] 保存失敗トースト（#955）は再現条件が無いので SKIP と明記

### 2. schedule（rightSidebar の 3 タブ = `ScheduleSidebarTabId` flow / todo / repeats — `web/src/schedule/ScheduleSidebar.tsx:151`）

- [ ] 週グリッド: 曜日ヘッダ・今日の強調・終日レーン・現在時刻ライン（時刻ラベル無し = #1411）
- [ ] 作成パネル（2 タブ: 予定 / Todo。ノート紐付けは両タブの内側 = #1413）で Event `PWV1408-schedule-1`（今日・時刻あり）を作成 → グリッドに即反映
- [ ] 同パネルで Todo `PWV1408-schedule-2`（今日・時刻あり）を作成 → 青チップとして出る
- [ ] Event をクリック → 編集パネル: タイトル・時刻・タグ・繰り返し設定・Todo への変換ボタン（**Event → Todo の逆変換が無いのは #1405 で既知**）
- [ ] 繰り返し Event `PWV1408-schedule-3`（毎日）を作成 → 翌日以降にも出る → rightSidebar「繰り返し」タブに載る
- [ ] rightSidebar 3 タブのラベルが 1 行に収まる（#1343）。「本日の Todo」に `PWV1408-schedule-2` が出る（**区分が 3 つのままなのは #1406 で既知**・**追加ボタンの「＋+」は #1371 で既知**）
- [ ] Event のドラッグで時刻が変わる（`browser_drag` が使えなければ SKIP と明記）
- [ ] 繰り返し Event の削除 → ConfirmDialog（#1279 / D-20260830-shared-fix-1 = C）→ 種イベントごと消える → Undo で戻る（#708）
- [ ] タグフィルタ + グループ（#1173）: `PWV1408-tag` で絞ると該当だけ残る（タグは結合 S4 で作るので、この画面では既存タグ 1 つで代用可）
- [ ] 週ナビ（前週 / 次週 / 今日）で表示が動く

### 3. materials（`MaterialsTab` = notes / daily — `web/src/hooks/useShellNavigation.ts:22`）

- [ ] Notes: 一覧・タグフィルタチップ（複数選択 OR = #1288・選択の繰り上げ無し = #1364・タグ自身のアイコン = #1365）・ピン留めスロット（#1287）・空状態に中央ボタンが無い（#1372）
- [ ] Note `PWV1408-materials-1` を作成 → 本文入力 → 800ms 後に保存される（リロードで残る）
- [ ] スラッシュメニュー（`/`）と `[[` 補完が同じエディタで併用できる（#293）。`[[PWV1408-schedule-2` で Todo を候補に出してリンクを張る
- [ ] Note 本文のチェックリスト（`- [ ]`）のチェックボックスがフォーカスリング付きで見える（#1410）
- [ ] ノート削除 → ConfirmDialog が出る（#1345）→ キャンセル → 実行でゴミ箱へ
- [ ] テンプレート編集パネルが Note と同じ幅で開く（#1363）。テンプレートは作らない（読むだけ）
- [ ] Daily: 今日の日付で開く・エディタが出る・日付ナビで前後に動く。**本文には書かない**
- [ ] Notes → Schedule → Materials と往復しても開いていた Note が保たれる（#1313 / #1407）

### 4. connect（Tag hub = #1171）

- [ ] 左レール（タグ一覧）と右ペイン（種類別のアイテム）の 2 ペイン。レールにタグの件数（"1 item" の単複 = #1276）
- [ ] タグを選ぶと Note / Todo / Event / Daily の種類別に一覧が出る（結合 S4 のタグで 3 種が同時に出る）
- [ ] アイテムをクリックすると該当セクションへ遷移し、そのアイテムが開く（`navigateToItem`）
- [ ] 力学グラフの残骸（canvas / d3）が出ていない（#1152 / #1220）
- [ ] 空状態（タグ 0 のとき）は実データがあるため SKIP と明記

### 5. work（Pomodoro — TimerProvider はシェル層）

- [ ] タイマー本体・プリセット選択・Todo セレクタ・環境音ミキサー（Desktop では表示 = `isNativeMobile()` の省略対象外）が出る
- [ ] Todo セレクタで `PWV1408-schedule-2` を選び **開始 → 一時停止 → リセット**。完了まで走らせない
- [ ] Todo 未選択で開始しても `Untitled todo` が生成されない（#1116）
- [ ] rightSidebar のセッション一覧が出る（今日のセッションが増えていないこと）
- [ ] Settings の Pomodoro 2 列で入力欄の下端が揃う（#946）
- [ ] 環境音の再生は `AudioContext` の resume を伴うので、再生ボタンを 1 回押して console error が出ないことだけ見る（音は確認できない → SKIP と明記）

### 6. analytics（`AnalyticsTab` = overview / todos / work / schedule — `shared/src/components/Analytics/tabs.ts:13`）

- [ ] 4 タブがそれぞれ描画される（recharts の SVG が出る・空でない）。`lazy()` の Suspense 待ちが挟まっても白画面にならない
- [ ] 期間プリセットを切り替えると Overview のタグ使用状況カードの**左（期間内）だけ**が動き、右（総数）は動かない（#1379）
- [ ] 「今週」がカレンダー週（日曜始まり = #1102）で、Briefing の「今週」カードと同じ週を指す
- [ ] Todos タブの完了数が結合 S2 で完了させた Todo を含む（ローカル暦日 = #420）
- [ ] タグ別作業時間チャートがゴミ箱行きを含まない（#428 — 実データで判定できなければ SKIP）
- [ ] 1440px と 390px の切替は #948 の裏取り済み。**Desktop 幅では 1280px 固定で崩れが無いことだけ**見る

### 7. settings（行の一覧 = `web/src/settings/SettingsScreen.tsx::SECTION_TAB_IDS` + general / trash / tips）

- [ ] general: 外観（テーマ 3 カード = #887 のネスト表示 / フォントサイズ / 言語 en-ja）を切り替えて即反映 → **最後に元の値へ戻す**（開始時の値を台帳に記録）。アカウントカードは表示のみ
- [ ] AI 連携カード: ツール一覧を開く（件数は `mcpToolCatalog.json` が正 — 数を書かない）・「プロジェクトのパス」欄が出る。**起動ボタンは押さない**
- [ ] セクション別の行（briefing / schedule / materials / work / analytics）を順に開き、各ペインが出る。ja の呼び名が nav と揃っている（#1243）
- [ ] ショートカット: 1 件を rebind → 競合の警告 → リセットで戻る
- [ ] ゴミ箱（`TrashCategory` 5 種 = `shared/src/components/TrashView.tsx:32`）: 本計画で削除したアイテムが該当カテゴリに出る・1 件復元 → 再削除・複数選択と一括削除（#1294）— **実際の一括削除は Step 7 の後始末で行う**
- [ ] 法務（ポリシー / 規約）のカードから reader が開き、Escape と戻るボタンで閉じる（#1281）
- [ ] Tips 行で概要モーダルが開く（ツアーは開始しない）

---

## 結合シナリオ（画面別が全部終わってから・メインまたは最後の 1 体が実施）

| #   | シナリオ                                                                                                                         | 期待                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Schedule で作った Event `PWV1408-schedule-1` → Briefing 朝刊                                                                     | 「今日のスケジュール」に時刻付きで出る                                                                                              |
| S2  | Schedule で作った Todo `PWV1408-schedule-2`（時刻あり）→ Briefing で完了に → Analytics Todos                                     | Briefing の行に HH:MM・完了後に Analytics の今日の完了数が +1・Schedule tray で完了表示                                             |
| S3  | Briefing のクイック作成で作った `PWV1408-briefing-1` → Schedule                                                                  | tray「本日の Todo」に出る（日付 = 今日）                                                                                            |
| S4  | タグ `PWV1408-tag` を作り Event / Todo / Note に付ける → Connect / Materials / Schedule                                          | Connect で 3 種が同時に出る・Materials のチップで Note が絞れる・Schedule のフィルタで Event / Todo が絞れる                        |
| S5  | Note から `[[PWV1408-schedule-2]]` リンク → LinkPanel                                                                            | Note 側と Todo 側の両方のリンク一覧に相手が名前で出る（#1306 の名前解決）                                                           |
| S6  | Work で `PWV1408-schedule-2` を選び開始 → 一時停止 → リセット                                                                    | Briefing / Analytics の数値が変わらない・`Untitled todo` が増えない                                                                 |
| S7  | Note を開いたまま Schedule → Analytics（タブを変える）→ Materials                                                                | 同じ Note が開いたまま・Analytics のタブが保持・Schedule の選択が保持（#282）                                                       |
| S8  | Schedule で Event を作り、ヘッダーの Undo → Redo → 別セクションへ → 戻る                                                         | Undo で消え Redo で戻る。セクションを跨ぐと Undo スタックが空になるのは仕様（`TodoTreeContext` の unmount clear）— finding にしない |
| S9  | 横断の見た目: Todo チェックボックス（Briefing 持ち越し / Schedule tray / Note 本文）・各画面の「追加」ボタンの表記・空状態の文言 | 同じ概念が同じ見た目・同じ操作。ズレは 1 件 1 finding（**#1371 / #1399 / D-20260901-shared-fix-2 は既知**）                         |
| S10 | 一巡後の console error 総数                                                                                                      | P1 のベースラインと同数                                                                                                             |

---

## 後始末（Step 7 — 普段のアカウントを使うための必須条件）

1. 台帳の全 id を、作った画面から削除する（Event / Todo / Note / 繰り返し）
2. タグ `PWV1408-tag` をタグ編集モーダルから削除する（`useWikiTagsUnifiedAPI.ts:164 deleteTag`。ソフト削除で UI から消せない形なら**消さずに報告**して 🛑 ユーザー手番へ）
3. Settings → ゴミ箱で `PWV1408-` を全カテゴリで複数選択 → 一括削除（「取り消せません」の確認を通す）
4. 変更した設定値（テーマ / フォントサイズ / 言語 / ショートカット）を開始時の値へ戻す
5. MCP で残数を実測: `search_all("PWV1408")` = 0 件 / `list_wiki_tags` に `PWV1408` 無し / `list_schedule`（今日〜7 日）に `PWV1408` 無し
6. Work の一時停止 → リセットで `timer_sessions` 行が書かれていないか、Supabase MCP（read-only）で当日分を SELECT して確認。**行があれば消せないので報告**（🛑）
7. 完了を #1408 にコメント（台帳の転記 + 上の実測値）

---

## Acceptance Criteria (機械検証可能)

- [ ] 7 セクションすべてに、§画面別チェックリストの全項目の PASS / FAIL / SKIP(理由) がレポートに記録されている
- [ ] 結合 S1〜S10 に PASS / FAIL が記録されている
- [ ] finding が **1 件 1 Issue** で起票され、`type:bug` + `section:<id>` または `shared-fix` + `sev:*` が付き、レポートの finding 表に Issue 番号が入っている（既知の open Issue と重複する所見は起票せず、既存番号を書く）
- [ ] `search_all("PWV1408")` が 0 件・`list_wiki_tags` に `PWV1408` が無い（後始末の実測値がレポートと #1408 コメントに転記されている）
- [ ] レポート `.claude/docs/reports/2026-09-05-desktop-screen-audit.md` が存在し、`LC_ALL=C bash scripts/docs-lint.sh` が exit 0
- [ ] 本計画書の Status が COMPLETED になり `archive/` へ移動している（PR）
- [ ] 完了・退役・supersede 時: 対応 plan・per-chat memory の Status を更新した

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積む。

---

## 既知の除外リスト（再報告しない open Issue — 実行日に `gh issue list --state open` で更新する）

| 所見                                                                 | 既知                                |
| -------------------------------------------------------------------- | ----------------------------------- |
| Schedule rightSidebar の追加ボタンに「＋+」                          | #1371                               |
| leftSidebar ブランドヘッダーとメインヘッダーの縦ずれ                 | #1399                               |
| Event → Todo の逆変換が無い                                          | #1405                               |
| 「本日の Todo」タブが 3 区分のまま                                   | #1406                               |
| Briefing「今日のスケジュール」の Todo 行だけ 16px のチェックボックス | D-20260901-shared-fix-2（放置時 A） |
| 予定のリマインダーが無い                                             | #1374（PR #1433 open）              |
| 添付のアップロードが失敗トーストになる                               | 0027 未 push（仕様どおり）          |
| dead i18n キー / dead CSS                                            | #1388（画面には出ない）             |

---

## レポート書式（`docs/reports/2026-09-05-desktop-screen-audit.md`）

1. 実施条件（main の commit・実ポート・ブラウザ幅・開始時の設定値・console ベースライン）
2. 画面別の結果表（画面 × 項目 × PASS/FAIL/SKIP・FAIL は所見 id）
3. 結合シナリオの結果表（S1〜S10）
4. finding 一覧（所見 id / 画面 / 操作 / 期待 / 実際 / screenshot / **Issue 番号** / 既知なら既存番号）
5. エージェント運用の実測（起動できた画面・フォールバックした画面と理由・所要時間）
6. テストデータ台帳と後始末の実測値
7. 次に回すもの（#1409 Mobile への申し送り — Desktop で見つかった横断ズレのうち Mobile でも出そうなもの）

---

## Risks / Known Issues 参照

- **エージェント起動の失敗**（2026-08-31 history: playwright-ui-verifier が API のセッション上限で落ち、メインが直接操作に切り替えた）→ §フォールバック
- **dev server のポートずれ**（5173 に先客がいると 5174+ になる）→ 起動ログから実ポートを読む（playwright-verify P0）
- **並行チャットの二重実装**（known-issues 029）→ 本計画はコードを触らないので対象外。ただし finding の起票時は open Issue との重複チェックを必ず通す（issue-dispatch §2）
- **jsdom で測れないもの**を実ブラウザで初めて見る計画なので、所見の量が多くなりうる。**起票は所見の量に関わらず 1 件 1 Issue** を守り、まとめ Issue を作らない（`[all]` 禁止則と同じ理由 — 誰の手番か決まらなくなる）
- Supabase MCP は `--read-only`。後始末で SQL による削除はできない（UI と life-editor MCP の削除ツールだけが手段）

---

## References

- Issue: #1408（本計画）/ #1409（Mobile 側・次）
- skill: `playwright-verify`（Gate P0〜P5・Report Format）/ `issue-dispatch`（起票）/ `docs-workflow`（ラベル routing）
- agent: `~/.claude/agents/playwright-ui-verifier.md`（同時 1 体・コード修正禁止）
- registry: `shared/src/sections.ts`（7 セクション = SSOT）/ `shared/src/constants/breakpoints.ts`（`WIDE_BREAKPOINT_PX = 768`）
- 精度の前例: `.claude/history/chat-main.md` 2026-08-31「8/30 着地分の実ブラウザ検証 13 項目」（PASS 12 / 再現不能 1・`PWVERIFY-` 接頭辞）
- CLAUDE.md §6（`lumen-*` / 透明度禁止）/ §7.4（dev server と playwright は chat-main のみ）

---

## Worklog

- 2026-09-02: 計画書作成（計画セッション・ブラウザ未起動）。実行セッションは別途ユーザーが開く（#1408 の 👀 ゲート）
- 2026-09-02 12:40〜14:15 JST: 実行 Step 2〜5（briefing → analytics の 6 画面をエージェント直列で完走）。dev server は同じリポジトリ直下の先客 5174（サインイン済み）を流用
- 2026-09-05 12:49〜13:25 JST: settings（エージェント 1 回目は stream 停止で失敗 → 再起動で完走）→ 結合 S1〜S10（chat-main 直接・当日付のテストデータを追加）→ 後始末 → finding 20 件を #1467〜#1486 に起票 → レポート `docs/reports/2026-09-05-desktop-screen-audit.md`

乖離レビュー（archive 時）:

1. スコープ逸脱: なし。コードは触っていない（所見は起票まで = P-008）。レポートのファイル名は実行日の 09-05
2. AC 免除: なし。S5 / S6 は PARTIAL だが理由はチェックリスト側の前提違い（Todo 側のリンク一覧は製品に無い）と、削除経路の無い `timer_sessions` 行（🛑 ユーザー手番として #1475 と #1408 コメントに記載）
3. 途中の判断: 設定の 4 カテゴリのプレースホルダは by design として起票せず（行き先なし）／ 日付跨ぎでテストデータを当日付で作り直した（行き先なし）／ `timer_sessions` の掃除 = ユーザー手番（#1475 Gate）
