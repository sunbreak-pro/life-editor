---
id: D-20260905-shared-fix-1
type: decision
status: answered
asked: 2026-09-05
answered: 2026-10-03
chat: shared-fix
answer: A
topics: [ui, button, a11y]
refs: ["#1474", "#1498"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260905-shared-fix-1: 残りの塗り disabled ボタン 7 箇所も DISABLED_FILLED_BTN へ揃えるか

## 背景

（キュー原文 — 回答に伴いキューから削除）

- 背景: #1474（PR #1498）で `primary` の保存ボタン 2 本だけを「沈んだ面 + リング」へ移した。同じ欠陥を持つ塗りボタンが `Button.tsx:36`（danger）/ `schedule/EventEditorPane.tsx:452` / `schedule/ItemCreatePanel.tsx:264` / `schedule/TagFilterPanel.tsx:279` / `TodoAddDialog.tsx:129` / `TodoDetailPanel.tsx:194` / `web/src/notes/NotePasswordDialog.tsx:199` に残っている。`danger` の disabled は「処理中」の意味でも使われ、NotePasswordDialog はスピナーもラベル差し替えも無く `aria-busy` だけで手がかりがゼロになる。`PomodoroSettings.tsx:472` は枠線ボタンで opacity のままが正しい。
- 放置時: B（`primary` だけ）のまま保留。
- 期限感: いつでも

## 選択肢と裁定

- A: 一括で揃える（**採用** — ANSWERS.md の回答 A。disabled の見た目が画面ごとに割れているのが元々の問題。busy 表示の弱さは別 Issue でスピナー側を足して解く）
- B: `primary` だけで止める（却下）
- C: busy 専用の見た目を先に決めてから揃える（却下）

## 却下案が復活する条件

busy 系で「無効になった」と誤読される報告が出たとき。

## 波及

※昇格漏れの後追い（回答日は ANSWERS.md に日付なし）。busy 表示の補強は別 Issue で扱う。
