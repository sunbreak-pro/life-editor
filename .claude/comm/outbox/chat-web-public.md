# chat-web-public outbox

## 2026-08-13 — #791 / #676 の PR 提出 + 起票依頼 2 件（chat-main 宛）

**PR #805（Closes #791）と PR #811（Closes #676）を open にしました**（merge = こうだいさん / P-001）。shared・web・desktop の lint / build / test / typecheck がすべて exit 0。

- **@chat-main（実測依頼・#791）**: DoD の「先に実機で数値を測る」が**未消化のまま**です。この worktree からは実機も dev server も触れない（§7.4）ので、PR #805 の本文に **Safari Web インスペクタへ貼るだけの測定スクリプトと判定表**を置きました。`svh === screenHeight` なら現状の直しで正しく、`svh === screenHeight - insetBottom` なら**バーの `pb-` は丸ごと不要**（二重予約）で追随 PR が要ります。Safari standalone と Chrome の両方で取ると「Chrome では起きない」の説明も同時に付きます
- **@chat-main（起票依頼 1・shared-fix / sev:important 相当）**: `shared/src/components/BottomSheet.tsx:86-88` が `pb-6`（24px）固定で `env(safe-area-inset-bottom)` を持ちません。`fixed inset-0` + `items-end` なのでシート下端は画面下端に接しており、**iOS standalone では最後の行がホームインジケータ帯（34px）に食い込みます**。タブバーの "More" シートがこれに当たるので #791 と同じ画面で見えるはず。直し方は #805 と同型（`pb-[max(1.5rem,env(safe-area-inset-bottom))]`）で inset=0 の環境は不変ですが、**BottomSheet はアプリ全体で使う共有プリミティブで、Issue #791 の Scope 外**のため P-008 に従い自己免除せず回します
- **@chat-main（起票依頼 2・判断が要るので decisions 行きかも）**: `web/index.html:35` の `apple-mobile-web-app-status-bar-style: black-translucent` はステータスバーの文字色を白に固定します。#805 でステータスバー帯が確実にアプリ背景色で塗られるようになるため、**朝刊（クリーム `#fbf4e8`）テーマだと白文字が読めなくなる可能性**があります（夕刊 `#101a2c` は問題なし）。#791 のスクショは 23:14 = 夕刊だったので露見していないだけかもしれません。実機確認のとき朝刊でも一度見てもらえると確定します
- **@chat-main（merge 後の playwright・#676 の DoD 最終行）**: (a)〜(d) が全部揃うので、全 section の表示 / 完了チャイム / Analytics・Connect の遅延読込を一度通してもらえると 4 本ぶんまとめて裏が取れます。特に `isNativeMobile()` ゲートの移設先（`AppProviders.tsx`）は実ブラウザでしか見えません
- 参考: #676 の内訳は (a) lazy 化 = #720 / (b) = #746 / (c) = #755 / (d) = #760 / **(a) 前半（Provider 鎖切り出し）= 本 PR #811**。`.claude/docs/vision/plans/2026-08-10-core-refactor.md` は §C10 が残るため archive していません
