# HISTORY ARCHIVE (chat-connect-refine, 2026-08)

ローリングアーカイブ: `history/chat-connect-refine.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-29 - Connect セクションを力学グラフごと退役（#1152 / PR #1175 merged）

#### 概要

Connect セクションと力学グラフ描画一式（shared 3,903 行 + web host 177 行）を削除し、タグ・アイテム間リンク・検索のデータと取り出し口は無改変で温存した。DDL 変更ゼロ。CI verify 15 ステップ + docs-lint をローカルで全通しして PR #1175 を open（**merge はユーザー = P-001**）。

#### 変更点

- **削除**: `shared/src/components/Connect/`（simulation / Canvas 2D / 操作パネル / 凡例 / 選択カード / mobile シート / primitives）・`web/src/connect/ConnectScreen.tsx` と `lazy()` 行 + descriptor 行・section registry の `connect` エントリ・i18n の `connect.*` と `section.connect`（en / ja）・グラフ系テスト 8 本。差分は 63 files / +522 -5521
- **救出（削除せず移設）**: `BacklinkView` → `shared/src/components/Backlinks/`（`GraphNode` 依存を 3 フィールドの `BacklinkNode` に置換）/ `backlinkSourceIds` + `resolveLinkId` → `shared/src/utils/itemLinks.ts` / 該当テスト 2 describe → `shared/tests/itemLinks.test.ts` / `connect.sidebar.incomingLinks` + `connect.graph.selectNodeHint` → 既存 `backlinks.*` ブロック。型手術の裏取りに `shared/tests/backlinkView.test.tsx` を新規追加（4 ケース）
- **前提の訂正（実測）**: Issue 本文の「BacklinkView / ヘルパは LinkPanel が使用」は実物と異なった。`web/src/wikitag/LinkPanel.tsx:126` は `getLinksForItem()` から自前で読んでおり、`:52` の言及はコメント内の設計参照。移設した 3 つは**現時点で呼び出し元ゼロ**で、`P-002` を適用すれば削除もできる状態 → 判断は `D-20260829-connect-1` としてキューへ（放置時＝保持）
- **docs 追随**: CLAUDE.md §8 / `rules/frontend.md` の lazy 対象 / `mobile-scope.md` #13（**D-20260723-main-1 の Full 指定を supersede**）/ `tier-2-supporting.md` WikiTags。**計画時に scope 外としていた `docs/design/IA.md` と `docs/design/briefs/connect.md` を sweep 中に追加**（前者は `Status: APPROVED` の現況 SSOT が「本流 5 = … Connect …」のままで、放置すると後続が Connect を再追加しうるため。どちらも決定本文は書き換えず注記のみ）
- **検証**: shared 266 files / 2545 tests・web 88 / 851・desktop 7・mcp-server 24 / 318 全 pass、lint / build / typecheck:tests 全 exit 0、`LC_ALL=C bash scripts/docs-lint.sh` exit 0。`web` の build 出力から `ConnectScreen-*.js`（約 101KB / gzip 約 29KB）が消えたことも確認
- **スコープ外へ送った分（P-008）**: d3 依存 4 本 + 型定義 4 本の削除は package.json + lockfile 2 本に及ぶため別 PR へ。起票依頼を `comm/outbox/chat-connect-refine.md` に投函
- **計画書**: `plans/2026-08-29-connect-section-retirement.md`（Status: IN PROGRESS。実装ブランチ側にあるため本 tracker ブランチには無く、archive 移動は merge 後）
