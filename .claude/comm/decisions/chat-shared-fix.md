# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260818-shared-fix-1: サイドバーのリサイズが全画面を再描画させている件を叩くか（#992 の根本原因・スコープが `shared/` 全域へ広がる）

- 背景: #992 の安全サブセット（PR #1091）で行を `memo` 化したが、**そもそもなぜ全行が描き直されていたのか**の源には手を付けていない。
  - `shared/src/components/RightSidebar.tsx:65` が **pointermove のたびに無スロットルで `setWidth`** を呼ぶ（ドラッグ 1 回で毎フレーム state 更新）
  - `shared/src/context/RightSidebarContext.tsx:72-97` が **`width` を `open` / `close` と同じ context 値に同梱**しているため、幅が 1px 動くたびに context 値そのものが作り直され、**幅に関心の無い消費者まで全部再描画される**
  - 例えるなら「本棚の幅を 1cm 動かすたびに、部屋中の家具を並べ直している」状態。今回の `memo` は家具の側に「並べ直さなくていい」と貼り紙をしただけで、号令自体は止まっていない
- A: **rAF スロットル化**（`RightSidebar.tsx` 1 ファイル）。pointermove の処理を `requestAnimationFrame` で間引く。変更が小さく、消費者側の API は一切変わらない。ただし context 値の同梱は残るので、幅を読まない消費者が再描画される構造自体は残る
- B: **`width` を別 context へ分離**（`RightSidebarContext.tsx` + 全 RightSidebar 消費者）。源を断てるが、`shared/` と消費者すべてに波及する。**#992 の Scope（`web/src/notes/` と `web/src/todos/`）を大きく超える**
- 放置時: 現状維持。PR #1091 の `memo` はドラッグしていない間の再描画には効くので、実害は「サイドバーをドラッグしている間だけ重い」に縮む。壊れてはいない
- 期限感: いつでも。ただし **#992 の実ブラウザ計測（chat-main 手番）を回すなら、その前に決めておくと 1 回の計測で両方の効果を測れる**

（未決はこの 1 件）

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
