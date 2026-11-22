---
id: 2026-11-22-mobile-note-create-in-top-bar
type: decision
status: answered
asked: 2026-11-22
answered: 2026-11-22
chat: main
answer: A
topics: [mobile, materials, layout]
refs: ["#2291", "#2795", "#2673", "2026-11-22-icon-buttons-40px"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# スマホのノートの作成ボタンをどこに置くか

## 背景

キューを経ず、chat-main の会話の AskUserQuestion でこうだいさんに聞いた（2026-11-22）。見比べた案は試作「Life Editor 余白と作成ボタンの案.dc.html」（Claude Design「Life Editor試作完成」の複製ファイル。試作パネルの「0. 案」で切り替える）の「切り替え 3」。本文の上の「+ ノート」の帯が、どのノートでも高さを取っている（#2291 の 10 番）。

## 選択肢と裁定

- A: 上のバーの右端（やり直しの隣）に 40px 角の「+」を置き、ノートのタブでだけ出す。1 回の操作で作れる（**採用** — ユーザー回答 2026-11-22）
- B: 右のパネル（ドロワー）の一覧の上に「+ ノート」を置く（却下 — 作るまで 2 回の操作になる）
- 今の形のまま（却下）

## 波及

- 実装は #2795。ほかのボタンが 49.5px のままだと、390px 幅でタブの文字が「ノ…」「デイ…」に切れるので、#2673 のあとに進める。
