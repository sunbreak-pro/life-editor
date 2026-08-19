---
id: D-20260816-materials-1
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-19
chat: materials-refine
answer: A
topics: [materials, notes, mobile, links]
refs: ["#876", "#884", "web/src/notes/NotesView.tsx"]
supersedes: []
superseded-by: []
implemented-by: ["#876"]
promoted-to: null
---

# D-20260816-materials-1: #876 後、narrow のノート本文に Links 導線を出すか

## 背景

（キュー原文 = `comm/decisions/chat-materials-refine.md`）

- #876 で narrow のメインが Desktop と同じ `NoteDetailPanel` になった。ただし Links（`LinkPanel`）だけは `isWide` ガードを残してある（`web/src/notes/NotesView.tsx` の `linksSlot`）。#884 が「モバイルには従来 Links 導線が無かったため渡さない」と明示的に決めた箇所で、#876 の裁定（D-20260815-materials-2）はレイアウトの話しかしていない
- A: wide 専用のまま（推奨）
- B: narrow にも出す（両幅で 1 実装になる）

## 選択肢と裁定

- A: **wide 専用のまま**（**採用** — ユーザー回答 2026-08-19）。理由: #884 の判断を維持する。narrow は本文とタグで縦を使い切りがちで、Links を足すとタグ行がさらに下へ押される
- B: narrow にも出す（却下 — 実装の一本化は魅力だが、狭幅の縦の予算を食う）

## 却下案が復活する条件

- narrow のノート画面で縦の余白が増える改修（本文の折りたたみ等）が入ったとき

## 波及

- なし（現状の実装が A）
