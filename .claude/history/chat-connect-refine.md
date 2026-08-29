# HISTORY (chat-connect-refine)

### 2026-08-29 - Connect セクションを力学グラフごと退役（#1152 / PR #1175 open）

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

### 2026-07-11 - Connect Layout Standard adoption 完了確認 + セッション帳簿整理

#### 概要

connect セクションの layout standard 追随（v1 gutter / v2 header 再編）が両方 main 反映済みであることを確認し、上の 2 件の `[途中]` 記録を確定。新規の実装作業は無し（section:connect open Issue = 0）。

#### 変更点

- **完了確認**: v1 gutter 追随 = PR #194 merged / v2 adoption（in-body ConnectHeader 撤去・graph アクションを rightSidebar 集約）= Issue #206 CLOSED → PR #212 merged。`git diff origin/main HEAD` 空 = 自ブランチ内容は main と完全一致
- **main 取り込み**: セッション開始時に `git merge origin/main` をクリーン適用（他 worktree の #230/#227/#226 等 14 コミット・コンフリクト無し）
- **Issue 帳簿**: #181 `[all]` の connect 行を `[x]` に更新 + 完了コメント投稿（close 判断は chat-main へ委譲・残 = schedule/work/settings/trash）

- 2026-07-11: [途中] Layout Standard v2 adoption（#206）— origin/main 取り込み（#202 docs 含む・merge 済）後、#196 由来の二重ヘッダーを解消。自前 ConnectHeader 撤去 + graph アクション（件数/フィルタ解除/reheat=再配置/fit=全体表示）を rightSidebar settings タブへ集約（新規 ConnectGraphActions.tsx + ConnectSidebarPanel に settingsHeader スロット + ConnectGraphView Desktop 分岐改修 + ConnectHeader.tsx 削除）。mobile/narrow 不変・幅トグルは layout-standard 後続。検証: shared build 緑 / web build 緑 / role-qa PASS(Blocker 0) / shared test は過負荷 flaky 6件のみ(単体 69/69 pass・Connect 無関係)。commit/PR 承認待ち
- 2026-07-11: [途中] #181 connect 行 — fluid variant 採用確認 + Connect の rem gutter 3 箇所を px lumen gutter トークンへ置換。検証全 pass（shared build / 768 tests / web build・role-qa PASS）。commit / PR 作成前
