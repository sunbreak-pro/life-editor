# Decision Queue — chat-materials-refine

### D-20260816-materials-1: #876 後、narrow のノート本文に Links 導線を出すか

- 背景: #876（PR 提出済）で narrow のメインが Desktop と同じ `NoteDetailPanel` になった。ただし Links（`LinkPanel`）だけは `isWide` ガードを残してある（`web/src/notes/NotesView.tsx` の `linksSlot`）。#884 が「モバイルには従来 Links 導線が無かったため渡さない」と明示的に決めた箇所で、#876 の裁定（D-20260815-materials-2）はレイアウトの話しかしていないため、こちらで勝手に広げなかった
- A: **wide 専用のまま**（推奨 — #884 の判断を維持。narrow は本文とタグだけで縦を使い切りがちで、Links を足すとタグ行がさらに押し下がる）
- B: narrow にも出す（「メインは Desktop と同様」を文字どおり通す。両幅で 1 実装になり、以後この行が分岐しなくなる）
- 放置時: A のまま（現状の PR がそう）。この Issue 自体は保留にならない
- 期限感: いつでも（#876 の merge を待たない — 後追いで足せる）

（2026-08-12 昇格分 = D-20260812-materials-1 / D-20260812-materials-2・2026-08-16 昇格分 = D-20260815-materials-1 / D-20260815-materials-2 — `.claude/decisions/` 台帳へ）
