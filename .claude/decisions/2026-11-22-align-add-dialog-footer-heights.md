---
id: 2026-11-22-align-add-dialog-footer-heights
type: decision
status: answered
asked: 2026-11-22
answered: 2026-11-22
chat: main
answer: B
topics: [mobile, dialog, layout]
refs: ["#2808", "#2811", "#2814", "2026-11-21-restore-equal-width-add-dialog-buttons"]
supersedes: []
superseded-by: []
implemented-by: ["#2816"]
promoted-to: null
---

# スマホの追加ダイアログのフッターで、3 つのボタンの高さをそろえるか

## 背景

キューを経ず、chat-main の会話の AskUserQuestion でこうだいさんに聞いた（2026-11-22）。

2026-11-21 の決定（`2026-11-21-restore-equal-width-add-dialog-buttons`）で送信ボタンを等幅に戻した（#2808 = PR #2811）。実ブラウザで確かめると、幅 375px では「追加して詳細へ」の「へ」が 2 行目に落ち、そのボタンだけが 64.3px に伸びて、「追加」と「キャンセル」の 49.5px と高さがそろわなかった。フッターの行が `items-center` で、`max-md:min-h-11` は下限だからである。390px では 1 行に収まり、3 つとも 49.5px でそろう。等幅を決めたときは幅だけを決めていて、高さは決めていなかった。

## 選択肢と裁定

- A: このままにする（却下 — 高さがずれるのは 390px 未満の幅だけだが、こうだいさんはそろえるほうを選んだ）
- B: フッターの行を `items-stretch` にして、3 つの高さをいちばん背の高いボタンにそろえる。375px ではフッターが約 15px 高くなる（**採用** — ユーザー回答 2026-11-22。実装は #2814）

## 波及

- 実装の Issue は #2814。
