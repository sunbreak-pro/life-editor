# HISTORY (chat-shared-fix)

### 2026-08-11 - #669 mcp-server の書き込み儀式を utils/items へ・tools.ts を宣言的レジストリ化

#### 概要

core-refactor C2（計画書 `docs/vision/plans/2026-08-10-core-refactor.md` §C2）。`utils/items.ts` に正解がありながら `scheduleHandlers` / `briefingHandlers` が手写ししていた items_meta 書き込みを置換し、`tools.ts` の手動レジストリ（import + 配列 + switch の 3 箇所同時編集）を宣言的な 1 箇所へ畳んで、引数の実行時検証を同じ PR で入れた。PR #694（書いた時点で open）。

#### 変更点

- **書き込みの集約**: schedule 5 経路 + briefing 2 経路を `insertItem` / `updatePayload` / `softDeleteItem` / `bumpMeta` へ置換。`grep -rn -A2 'from("items_meta")' mcp-server/src/handlers/ | grep -E '\.(insert|update|delete)\('` が 9 行ヒット → 0 行
- **レジストリ**: `TOOL_DEFINITIONS`（name / description / inputSchema / handler の 1 エントリ）から `TOOLS` と dispatch を導出。`switch` 削除・JSON→型のキャストは `defineTool` の 1 行に集約
- **validator**: `src/utils/toolSchema.ts` を新規追加し `callTool` が dispatch 前に公開スキーマで検証。未宣言プロパティの素通しと「任意プロパティの明示 null = 未指定」は現行の呼び出しを落とさないため意図的に緩めてある
- **テスト**: `tests/toolRegistry.test.ts` を追加（mcp-server 118 tests / 8 files 緑）。公開中の全ツールに型違いを投げて `Invalid arguments for <name>:` で止まる = レジストリ登録済 かつ ハンドラ未到達（メッセージに `Supabase` を含まない）を検証。逆方向に全 27 ツールの「正しい引数」テーブルも通す
- **挙動不変の実測**: main の build と本ブランチの build で `JSON.stringify(TOOLS, null, 2)` を生成して diff → 差分ゼロ（md5 一致）。wire に出る差分は DB エラー時のメッセージ接頭辞のみ
- **db-conventions §13**: migration 0013 は「一度も存在しなかった番号」と実測で確定（`git log --all --full-history -- '*0013*'` が 0 件・リモート台帳も 0012 → 0014）。0012 と 0014 は同一 commit `fe2c7d86` で、並行 2 計画が番号を先取りした結果。埋めない / 振り直さない を運用則として明記

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
