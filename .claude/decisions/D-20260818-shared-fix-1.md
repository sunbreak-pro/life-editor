---
id: D-20260818-shared-fix-1
type: decision
status: answered
asked: 2026-08-18
answered: 2026-08-19
chat: shared-fix
answer: A
topics: [performance, react-context, sidebar, rendering]
refs: ["#992", "#1091", "#1103", "shared/src/components/RightSidebar.tsx", "shared/src/context/RightSidebarContext.tsx"]
supersedes: []
superseded-by: []
implemented-by: ["#1103"]
promoted-to: null
---

# D-20260818-shared-fix-1: サイドバーのリサイズが全画面を再描画させている件を叩くか

## 背景

（キュー原文 = `comm/decisions/chat-shared-fix.md`）

- #992 の安全サブセット（PR #1091）で行を `memo` 化したが、源には手を付けていない。`RightSidebar.tsx:65` が pointermove のたびに無スロットルで `setWidth` を呼び、`RightSidebarContext.tsx:72-97` が `width` を `open` / `close` と同じ context 値に同梱しているため、幅が 1px 動くたびに幅に関心の無い消費者まで再描画される
- A: rAF スロットル化（`RightSidebar.tsx` 1 ファイル）
- B: `width` を別 context へ分離（源を断てるが `shared/` 全域へ波及・#992 の Scope を大きく超える）
- 放置時: 現状維持（実害は「ドラッグしている間だけ重い」に縮んでいる）

## 選択肢と裁定

- A: **rAF スロットル化**（**採用** — ユーザー回答 2026-08-19）。理由: 1 ファイルで号令の回数を画面の更新回数まで落とせる。消費者側の API は変わらず、並行レーンと衝突しない
- B: `width` を別 context へ分離（却下 — 源は断てるが `shared/` と RightSidebar 消費者すべてに波及し、#992 の Scope を大きく超える）
- C: 放置（却下 — 実測の機会（#994）が控えており、1 ファイルで測れる改善を先に入れておくほうが安い）

## 却下案が復活する条件

- rAF で間引いても実ブラウザ計測でドラッグ中のフレーム落ちが残るとき → B（context 分離）を独立 Issue で起票

## 波及

- 実装 Issue **#1103** を起票。#992 は計測（#994）待ちで open のまま
