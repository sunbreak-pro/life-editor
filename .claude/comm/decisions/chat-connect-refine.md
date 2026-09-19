# chat-connect-refine decision queue

判断待ちを積む場所。書き込みは connect-refine のみ。回答は `ANSWERS.md`（こうだいさん）へ。

---

### D-20260919-connect-1: Mobile の「つながり」上部バーに「＋」（タグを追加）を置くか

- 背景: #1646 / brief §4.2 は画面 1 の上部バー右端に「＋」を指定している。narrow ヘッダーは shell 側の形状 enum（`web/src/sectionDescriptors.tsx` の `narrowHeader` と `web/src/MainScreen.tsx`）で、末尾アクションを足すには #1646 の Scope 外の `MainScreen.tsx` を触る。現状はレール下端の追加行（#1643 / D5）がタグ追加の入口として narrow でも出ている
- A: 現状維持（推奨 — 入口は既にあり、shell の narrow ヘッダーに「セクション固有の末尾アクション」という新しい概念を持ち込まずに済む）
- B: shell に末尾アクション枠を足し、Connect から「＋」を渡す（他セクションにも波及する変更なので別 Issue にする）
- 放置時: A のまま。#1646 は「＋」無しで完了扱いにし、必要になったら別 Issue で起票する

（2026-08-30 昇格分 = D-20260829-connect-1（回答 = B = 削除・実装 = #1239 / PR #1258 merged）— `.claude/decisions/` 台帳へ。転記 / 昇格は chat-main が代行した）
