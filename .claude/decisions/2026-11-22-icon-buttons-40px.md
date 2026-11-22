---
id: 2026-11-22-icon-buttons-40px
type: decision
status: answered
asked: 2026-11-22
answered: 2026-11-22
chat: main
answer: A
topics: [mobile, layout, a11y]
refs: ["#2672", "#2673", "2026-11-22-goal-tree-indent-17px"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# スマホのアイコンボタンの押せる範囲を 40px にするとき、文字のある行も縮めるか

## 背景

キューを経ず、chat-main の会話の AskUserQuestion でこうだいさんに聞いた（2026-11-22）。見比べた案は試作「Life Editor 余白と作成ボタンの案.dc.html」（Claude Design「Life Editor試作完成」の複製ファイル。試作パネルの「0. 案」で切り替える）の「切り替え 2」。「44px の下限」は、既定の文字サイズでは 49.5px で出ている。

## 選択肢と裁定

- A: アイコンだけのボタンを 40px 角・隣との間 0 にし、文字のある行とボタンは今のまま（**採用** — ユーザー回答 2026-11-22）
- B: 文字のある行とボタンの高さも 40px にする（却下 — 行が押しにくくなり、依頼の「アイコンの余白」を超える）
- 今の形のまま（却下）

## 波及

- 実装は #2673。#2672 のあとに進める。
