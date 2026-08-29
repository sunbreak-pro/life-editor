---
id: D-20260828-shared-fix-1
type: decision
status: recorded
asked: 2026-08-28
answered: 2026-08-28
chat: shared-fix
answer: 退役
topics: [dead-code, refactor, dnd, notes]
refs:
  [
    "#1156",
    "#418",
    "D-20260728-main-2",
    "shared/src/utils/noteDropIntent.ts",
  ]
supersedes: ["D-20260728-main-2"]
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260828-shared-fix-1: `noteDropIntent.ts` を退役する（D-20260728-main-2 の裁定を置換）

## 背景

2026-07-28 の D-20260728-main-2 は「`noteDropIntent.ts` は残置」（A）で決着していた。当時の判断材料は「ツリーの入れ子がいつか復活するかもしれない」で、このファイルはドロップ位置（before / after / inside）を算出する純関数だから、復活するなら要る、という読みだった。

その前提が 2026-08-27 に消えた。#418 の open question に対してこうだいさんが「入れ子は今後復活させないため削除して OK」と裁定し、それを根拠に #1156 が起票された（Issue 本文 §削除対象 4. / 5. がどちらも「#418 裁定済み」と明記）。入れ子が戻らないなら `computeNoteDropIntent` が計算する `inside` は永久に使われず、`before` / `after` は各リスト側の order 更新で足りる。

呼び出し元は実測で 0 件（barrel の `shared/src/index.ts` と自身のテストのみ）。

## 選択肢と裁定

- **退役**（**採用** — 2026-08-27 のこうだいさん裁定「入れ子は今後復活させないため削除して OK」に従い、#1156 で `shared/src/utils/noteDropIntent.ts` + `shared/tests/noteDropIntent.test.ts` + barrel 行を削除）。POLICY P-002「呼び出し元ゼロの dead code は grep 全数実測を根拠に退役してよい」の一般則どおりの処理に戻る
- 残置（却下 — D-20260728-main-2 の裁定。復活条件だった「入れ子が戻るかもしれない」が 2026-08-27 に否定されたため成立しない）

## 却下案が復活する条件

ツリーの入れ子（親を変える DnD）を再導入する決定が出たとき。その場合も本ファイルを復元するのではなく、当時の DnD ライブラリと UI に合わせて書き直す前提で扱う（`git show` で内容は取り出せる）。

## 波及

- `shared/src/index.ts` の `computeNoteDropIntent` / `NoteDropPosition` export 行
- `.claude/rules/frontend.md` §Gotchas の DnD 行と `shared/design-system/PRINCIPLES.md` の同文 — どちらも `moveNode` が存在する前提だったので #1156 で実態に合わせた
