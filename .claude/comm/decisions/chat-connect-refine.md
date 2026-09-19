# chat-connect-refine decision queue

判断待ちを積む場所。書き込みは connect-refine のみ。回答は `ANSWERS.md`（こうだいさん）へ。

---

### D-20260919-connect-1: Mobile の「つながり」上部バーに「＋」（タグを追加）を置くか

- 背景: #1646 / brief §4.2 は画面 1 の上部バー右端に「＋」を指定している。narrow ヘッダーは shell 側の形状 enum（`web/src/sectionDescriptors.tsx` の `narrowHeader` と `web/src/MainScreen.tsx`）で、末尾アクションを足すには #1646 の Scope 外の `MainScreen.tsx` を触る。現状はレール下端の追加行（#1643 / D5）がタグ追加の入口として narrow でも出ている
- A: 現状維持（推奨 — 入口は既にあり、shell の narrow ヘッダーに「セクション固有の末尾アクション」という新しい概念を持ち込まずに済む）
- B: shell に末尾アクション枠を足し、Connect から「＋」を渡す（他セクションにも波及する変更なので別 Issue にする）
- 放置時: A のまま。#1646 は「＋」無しで完了扱いにし、必要になったら別 Issue で起票する

### D-20260919-connect-2: Step 12 で出た設計との差分 3 件（#1734）をどう畳むか

- 背景: chat-main の実ブラウザ検証で、Mobile 画面 1 の上部バー（設計は ハンバーガー / 見出し / ＋、実装は Open details / 見出しなし / Undo・Redo）、リンク追加シートの「候補（N）」見出しが無いこと、エラートーストの先頭アイコンが AlertCircle ではなく丸ドットであることの 3 点が設計と違うと分かった。どれも機能は足りていて壊れてはいない
- A: 2（候補見出し）と 3（AlertCircle）だけ実装を直し、1（上部バー）は現状維持にして計画書を実態に合わせる（推奨 — 2 と 3 は Connect と Toast の中だけで閉じる小さい変更、1 は shell の `narrowHeader` enum に触るので別格。1 は D-20260919-connect-1 と同じ判断になる）
- B: 3 つとも実装を直す（1 は shell の末尾アクション枠を新設するので別 Issue が要る）
- C: 3 つとも計画書側を実装に合わせる（実装は 1 行も動かさない）
- 放置時: 何も直さず #1734 を open のままにする。#1732 / #1733 のブロッカー 2 件だけ先に直す

（2026-08-30 昇格分 = D-20260829-connect-1（回答 = B = 削除・実装 = #1239 / PR #1258 merged）— `.claude/decisions/` 台帳へ。転記 / 昇格は chat-main が代行した）
