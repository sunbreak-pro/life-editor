---
id: 2026-11-21-restore-equal-width-add-dialog-buttons
type: decision
status: answered
asked: 2026-11-21
answered: 2026-11-21
chat: main
answer: B
topics: [mobile, dialog, layout]
refs: ["#2427", "#2450", "#2808"]
supersedes: ["D-20261102-sched-5"]
superseded-by: []
implemented-by: []
promoted-to: null
---

# スマホの追加ダイアログのフッターで、送信ボタンを等幅に戻すか

## 背景

キューを経ず、chat-main の会話の AskUserQuestion でこうだいさんに聞いた（2026-11-21）。D-20261102-sched-5 は回答が付かないまま、PR #2450 が「不揃いのまま」の形で merge されていたので、chat-main が事後記録の A にしていた。こうだいさんが一度も見ていない決定だったため、確かめ直した。

- 背景: #2427 / PR #2450。等幅のままだと 375px で「追加して詳細へ」の最後の 1 文字が 2 行目に落ちます。PR はラベル幅で配分し、「追加」が約 64px、「追加して詳細へ」が約 142px になります（`shared/src/components/schedule/ItemCreatePanel.tsx:654-659` の `max-md:basis-auto`）。

## 選択肢と裁定

- A: 不揃いのまま確定する（却下 — ボタンの文字は折り返さないが、こうだいさんは等幅を選んだ）
- B: 等幅に戻し、狭い幅での折り返しを受け入れる（**採用** — ユーザー回答 2026-11-21。実装は #2808）
- C: iPhone で見てから決める（却下）

## 波及

- D-20261102-sched-5 を置き換える。
- 実装の Issue は #2808。`shared/tests/createPanelTapTargets.test.tsx:235` が今の不揃いの形を固定しているので、あわせて直す。
