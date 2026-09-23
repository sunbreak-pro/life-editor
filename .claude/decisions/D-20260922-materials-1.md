---
id: D-20260922-materials-1
type: decision
status: answered
asked: 2026-09-22
answered: 2026-09-23
chat: materials-refine
answer: A
topics: [notes, password, dead-code]
refs: ["#1843", "#1763", "#526", "known-issues/027"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260922-materials-1: ノートにパスワードを掛ける / 外す入口を復活させますか、それとも機能ごと畳みますか

## 背景

（キュー原文 — 回答に伴い本 PR でキューから削除。起票 = chat-materials-refine）

- #1843。`NotePasswordDialog` の `set` / `remove` モードと `useNotePassword.ts:44-65` の分岐は実装済みだが、呼び出し元がゼロ。解錠（verify）だけが `LockedBodyGate` から届く。入口が無いのは意図的な退役ではない — `94e32ba4`（DU-F #25）のコミット本文が「バックエンドが throw するので一時的に外す。DU-G が 1 つの diff で再配線できるよう state と import は残す」と明記していて、その DU-G が再配線しないまま今に至る。#526 と #1763 はどちらも入口がある前提で本文の遮断を強めた側
- 放置時: 現状維持。#1843 は文言の i18n 化（PR で対応済み）だけを終えて close し、この判断は次の Issue に送る
- 期限感: いつでも

## 選択肢と裁定

- A: 「…」メニューに掛ける / 外すを戻す。死にコードが消え、#1763 で強化した遮断が実際に使えるようになる。ただし #1763 以降ロック中の本文は DB から取得しないので、掛けた瞬間に本文が画面から消え、パスワードを忘れると復旧できない（`docs/known-issues/027` の平文債務も残る）。この 2 つを受け入れる（**採用** — ユーザー回答 2026-09-23）
- B: `set` / `remove` を退役させる（`NotePasswordMode` を `"verify"` へ縮約し、ダイアログの該当分岐を削除）（却下）
- C: 現状維持（却下）

## 却下案が復活する条件

入口を戻した後に「掛けたら本文が消えた」問い合わせが配布ユーザーから出て、忘却時の復旧手段を用意する見込みが立たないとき。そのときは B を再検討する。

## 波及

- #1843: 残作業 = 「…」メニューへ掛ける / 外すを戻す。掛ける前に「本文は画面から消える・忘れると復旧できない」旨の確認文を出す（materials-refine）
