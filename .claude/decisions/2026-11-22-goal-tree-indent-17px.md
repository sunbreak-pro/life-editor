---
id: 2026-11-22-goal-tree-indent-17px
type: decision
status: answered
asked: 2026-11-22
answered: 2026-11-22
chat: main
answer: A
topics: [mobile, connect, layout]
refs: ["#2672", "#2673"]
supersedes: []
superseded-by: []
implemented-by: ["#2826"]
promoted-to: null
---

# スマホの目標と Todo の木の字下げをどこまで詰めるか

## 背景

キューを経ず、chat-main の会話の AskUserQuestion でこうだいさんに聞いた（2026-11-22）。見比べた案は試作「Life Editor 余白と作成ボタンの案.dc.html」（Claude Design「Life Editor試作完成」の複製ファイル。試作パネルの「0. 案」で切り替える）の「切り替え 1」。

字下げは矢印の列の幅の半分に 13.5px を足して決まる。既定の文字サイズ（ルート 18px）では `--spacing` が 4.5px なので、矢印は 44px ではなく 49.5px、字下げは 1 段約 38px で出ている。3 段目の題の幅は 162.8px しか無い。

## 選択肢と裁定

- A: 字下げ 17px、矢印と「…」の押せる範囲 40px 角、行の高さ 40px。3 段目の題は 224.4px（**採用** — ユーザー回答 2026-11-22）
- B: 字下げ 20px、行の高さ 44px、題と矢印の間 4px。3 段目の題は 222.9px（却下 — 依頼の「約半分」と完了条件の 15〜19px から外れる）
- 今の形のまま（却下）

## 波及

- 実装は #2672。40px を px と rem のどちらで持つかは、実装のときに決める（`spacing*9` は 40.5px、`spacing*10` は 45px になる）。
