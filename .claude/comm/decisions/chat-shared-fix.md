# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
（2026-08-19 昇格分 = D-20260818-shared-fix-1（回答 = A = rAF スロットル・実装 Issue #1103）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-26 昇格分 = D-20260824-shared-fix-1（回答 = A = 日曜に揃える・実装 Issue #1138）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-28 昇格分 = D-20260827-shared-fix-1（回答 = A = localStorage のまま）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

## D-20260830-shared-fix-1: #1279 RepeatListPanel のインライン確認行 — 部品にするか、手書きのまま据え置くか

削除をその場で聞き返す行（答え 2 つ・backdrop 無し）を共通部品へ寄せるか、手書きのまま公認するか。見た目と操作感が変わる分岐なので P-005 に従いキューへ。

- 背景: Issue #1279 / `shared/src/components/schedule/RepeatListPanel.tsx:127-155`（state は `armed` 1 個。タイムアウトも Escape / blur / 外側クリックでの解除も無い）。**全数実測でこの形はリポジトリ内でここ 1 箇所だけ** — Modal / BottomSheet / 自前スクリムの外に「実行」と「取消」の 2 択を出している部品は他に存在しない（`TrashView` / `DeleteAccountDialog` / `TemplateApplyPanel` / `NotePasswordDialog` は全部 backdrop 付き、それ以外の聞き返しは全て `ConfirmDialog` 経由）。`border-lumen-danger` の 5 箇所のうち、確認帯として使っているのもここだけ
- A: **手書きのまま据え置き**、理由を `.claude/decisions/` と当該ファイル冒頭に 1 行残して #1279 を close（推奨 — 呼び出し元が 1 つしかない形を部品にしても抽象が 1 枚増えるだけで、消える重複はゼロ。P-002 / P-003 と同じ「実測を根拠に見送る」筋）
- B: **`NoticePanel` に確認バリアントを足す**。今の `action` は 1 個だけなので、2 つ目の action と danger 塗りが要る。`NoticePanel` は #1184 のヘッダコメントで「読み飛ばせる知らせ」と定義されており（Ask with the dialog, tell with the panel）、答えないと進めない問いを載せるとその定義が濁る。4 箇所以上が既に使う共有 API を広げるので、戻すのが一番高くつく
- C: **`ConfirmDialog` に寄せる**。同じ画面の `CalendarTab.tsx:346` に `askConfirm` が既にあり、`useScheduleRepeats.ts:213` の `handleDeleteRepeat` の頭で 1 回聞けば済む。パネルからは `armed` state と 3 ラベルが消える。**同じ右サイドバーの Todo 削除は既に `ConfirmDialog` 経由**（`ScheduleTodoDetail.tsx:124`）なので、1 画面に 2 形状という不揃いは解消する。代わりに、細いサイドバーの 1 行を消すのに全画面モーダルが立つ
- 補足（A / B を選んだ場合に残る穴・別 Issue 候補）: armed に切り替わると押した削除ボタンごと unmount されるので**フォーカスが body に落ちる**。確認行に `role="alert"` / `aria-live` も無く、**問いが読み上げられない**。C はモーダル側が両方面倒を見るので自動的に消える
- 放置時: #1279 を保留し、他の #1184 子 Issue を先に進める。コードは現状のまま動き、見た目も変わらない（`onDelete` は Desktop のみ配線 = `ScheduleSidebar.tsx:331` なので狭幅には元から出ない）
- 期限感: いつでも（#1184 の子 Issue 群を閉じるまで）
