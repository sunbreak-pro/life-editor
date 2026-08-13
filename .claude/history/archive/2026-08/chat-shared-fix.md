# HISTORY archive (chat-shared-fix) — 2026-08

### 2026-08-10 - #587 Notes 系の共有神ファイル 2 本を分割

#### 概要

`useNotesUnifiedAPI.ts`（1075 行）と `SupabaseNotesUnifiedService.ts`（842 行）を責務ごとのモジュールへ分割（挙動変更ゼロ・テスト先行・1 ファイル = 1 PR）。PR #642 / #647（書いた時点でどちらも open、#642 は CI 緑）。

#### 変更点

- **PR #642（hook）**: 429 行のオーケストレータ + `notesUnifiedHelpers`（純粋ヘルパ）/ `useNoteHydrationLedger`（#301+#607 の own-write 台帳 — D-20260810-main-4 のとおりコメントごと吸収）/ `useNotesUnifiedCRUD` / `useNotesUnifiedTrash` / `useNotesUnifiedLock`。公開 I/F・barrel・呼び出し側 diff ゼロ
- **PR #647（service）**: 303 行の facade（書き込み系 + PHASE2 dispatch セット）+ `SupabaseNotesUnifiedReads`（list/trash/detail/count・join ループ重複解消）/ `SupabaseNotesUnifiedSearch` / `SupabaseNotesUnifiedLock` / `notesUnifiedPurgeOrder`（純粋・leaf-first）
- **テスト先行**: 無防備だった経路に計 17 テストを分割前に追加（hook の trash/lock/pin/cascade 8 件 + service の write 4 経路 6 件 + purge 順序 3 件）。全ゲート緑（shared 1521 / web 124）
- **知見**: `react-hooks/set-state-in-effect` は「ref 直読みの guard」は許すが「関数呼び出し越しの guard」を弾く — 台帳から `hydratedIdsRef` を公開して元の形を維持した

### 2026-08-10 - #631 mobile ドキュメントスクロール + pull-to-refresh 誤爆の修正

#### 概要

スマホ Web でボトムタブバーの下までドキュメントがスクロールし、上に引っ張ると pull-to-refresh が誤爆する問題を修正。PR #635（branch `claude/shared-fix-631`・書いた時点で open・CI 実行中）。

#### 変更点

- **web/src/index.css**: body の `min-height` を `100vh` → `100svh` に変更（AppShell narrow root の `h-[100svh]` と単位を揃え、URL バー分の document scroll を排除）。`html, body { overscroll-behavior: none }` を追加（pull-to-refresh は viewport スクローラ側でしか抑止できない）
- **shared/src/components/AppShell.tsx**: narrow shell の効いていなかったインライン `overscrollBehavior: "none"` を撤去（html/body 側へ移設した旨のコメントを残置）
- **検証**: shared / web の lint・test・build 全て exit 0（web 124 tests）。実機（iPhone Chrome）確認は merge 後に chat-main へ申し送り
