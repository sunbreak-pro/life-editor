---
id: D-20260830-shared-fix-1
type: decision
status: answered
asked: 2026-08-30
answered: 2026-08-30
chat: shared-fix
answer: C
topics: [schedule, confirm-dialog, notice-panel, a11y, ui-consistency]
refs: ["#1279", "#1184", "#1328"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260830-shared-fix-1: #1279 RepeatListPanel のインライン確認行 — 部品にするか、手書きのまま据え置くか

## 背景

（キュー原文 — 回答に伴い本 PR でキューから削除。起票 = chat-shared-fix / PR #1328）

削除をその場で聞き返す行（答え 2 つ・backdrop 無し）を共通部品へ寄せるか、手書きのまま公認するか。見た目と操作感が変わる分岐なので P-005 に従いキューへ。

- 背景: Issue #1279 / `shared/src/components/schedule/RepeatListPanel.tsx:127-155`（state は `armed` 1 個。タイムアウトも Escape / blur / 外側クリックでの解除も無い）。**全数実測でこの形はリポジトリ内でここ 1 箇所だけ** — Modal / BottomSheet / 自前スクリムの外に「実行」と「取消」の 2 択を出している部品は他に存在しない（`TrashView` / `DeleteAccountDialog` / `TemplateApplyPanel` / `NotePasswordDialog` は全部 backdrop 付き、それ以外の聞き返しは全て `ConfirmDialog` 経由）。`border-lumen-danger` の 5 箇所のうち、確認帯として使っているのもここだけ
- 補足（A / B を選んだ場合に残る穴・別 Issue 候補）: armed に切り替わると押した削除ボタンごと unmount されるので**フォーカスが body に落ちる**。確認行に `role="alert"` / `aria-live` も無く、**問いが読み上げられない**。C はモーダル側が両方面倒を見るので自動的に消える
- 放置時: #1279 を保留し、他の #1184 子 Issue を先に進める。コードは現状のまま動き、見た目も変わらない（`onDelete` は Desktop のみ配線 = `ScheduleSidebar.tsx:331` なので狭幅には元から出ない）

## 選択肢と裁定

- A: 手書きのまま据え置き、理由を台帳と当該ファイル冒頭に残して #1279 を close（却下 — 起票レーンの推奨だったが、フォーカス落ち + 読み上げ不能の a11y 穴が残り、別 Issue が 1 枚増える）
- B: `NoticePanel` に確認バリアントを足す（却下 — 「読み飛ばせる知らせ」という #1184 の部品定義が濁り、既に 4 箇所以上が使う共有 API を広げるため戻すのが一番高くつく）
- C: `ConfirmDialog` に寄せる（**採用** — ユーザー回答 2026-08-30 AskUserQuestion・chat-main 代行。`useScheduleRepeats.ts:213` の `handleDeleteRepeat` の頭で既存の `askConfirm` を 1 回聞き、`RepeatListPanel` から `armed` state と 3 ラベルを削除する。同じ右サイドバーの Todo 削除 = `ScheduleTodoDetail.tsx:124` と形が揃って 1 画面 2 形状の不揃いが消え、a11y 穴もモーダル側が引き受けて自動的に消える。トレードオフ = 細いサイドバーの 1 行削除に全画面モーダルが立つ点は許容）

## 波及

- 実装 = #1279（裁定コメント 2026-08-30 参照）。対象 2 ファイルが schedule の縄張りのため **schedule-refine レーン推奨**
- 実装着地時に本ファイルの `implemented-by` へ PR 番号を追記する
