---
id: D-20260828-materials-3
type: decision
status: answered
asked: 2026-08-28
answered: 2026-08-28
chat: chat-materials-refine
answer: A
topics: [materials, notes, i18n, mobile]
refs: ["#1147", "shared/src/hooks/useNotesUnifiedCRUD.ts"]
supersedes: []
superseded-by: []
implemented-by: ["#1162"]
promoted-to: null
---

# D-20260828-materials-3: ノートの既定タイトル "Untitled" を #1147 の中で i18n 化するか

## 背景

（#1147 本文の「要判断」節から。）

#1147 は Mobile の「+ノート」からタイトル入力シートを外し、`createNote()` で即エディタを開くようにするもの。その既定タイトル `"Untitled"` は `useNotesUnifiedCRUD.ts:71` の**ハードコードされた英語リテラル**で、i18n を通っていない。ja で使うと「Untitled」と出る。

## 選択肢と裁定

- **A: 今回は触らず `Untitled` のまま出す**（**採用** — ユーザー回答 2026-08-28）。i18n 化は別 Issue。Desktop も同じ文字列を出しており、本 Issue の Scope は narrow の導線に閉じる
- B: この Issue の中で既定タイトルを i18n 化し、ja では「無題」にする（却下 — `createNote` は `shared/src/hooks/` にあり Desktop と MCP 経路にも効くので、影響範囲が narrow に閉じない）

## 却下案が復活する条件

既定タイトルの i18n 化を独立の Issue として起票したとき。**その起票は未了**（chat-main 一元化のため materials-refine からは起票しない）。
