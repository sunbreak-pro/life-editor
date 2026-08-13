# HISTORY archive (chat-shared-fix) — 2026-08

### 2026-08-10 - #631 mobile ドキュメントスクロール + pull-to-refresh 誤爆の修正

#### 概要

スマホ Web でボトムタブバーの下までドキュメントがスクロールし、上に引っ張ると pull-to-refresh が誤爆する問題を修正。PR #635（branch `claude/shared-fix-631`・書いた時点で open・CI 実行中）。

#### 変更点

- **web/src/index.css**: body の `min-height` を `100vh` → `100svh` に変更（AppShell narrow root の `h-[100svh]` と単位を揃え、URL バー分の document scroll を排除）。`html, body { overscroll-behavior: none }` を追加（pull-to-refresh は viewport スクローラ側でしか抑止できない）
- **shared/src/components/AppShell.tsx**: narrow shell の効いていなかったインライン `overscrollBehavior: "none"` を撤去（html/body 側へ移設した旨のコメントを残置）
- **検証**: shared / web の lint・test・build 全て exit 0（web 124 tests）。実機（iPhone Chrome）確認は merge 後に chat-main へ申し送り
